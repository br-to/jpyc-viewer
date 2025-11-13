import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { JPYC } from '@jpyc/sdk-core';
import { Uint256, Uint8 } from 'soltypes';

/**
 * GET /api/subscriptions/execute-pending
 *
 * 決済予定日が来たpendingの支払いを実行する（Cronから呼ばれる）
 *
 * 処理フロー（EIP-2612 Permit版）:
 * 1. 実行対象の支払いを取得（scheduledDate が過去 & status = pending）
 * 2. 初回（cycleNumber = 1）の場合、permit() を実行
 * 3. transferFrom() でJPYCを送金
 * 4. 成功したら status = completed に更新
 * 5. 失敗したら status = failed に更新（リトライカウントも増やす）
 */
export async function GET(request: NextRequest) {
  try {
    // 認証チェック（Cronからのリクエストのみ許可）
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('=== Cron実行開始 ===');

    // 1. 実行対象の支払いを取得（バッチ処理: 最大100件）
    const now = new Date();
    const BATCH_SIZE = 100;

    // pendingのIDだけを取得してロック
    // processingのまま1時間以上経過したものも回復対象に含める
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const pendingIds = await prisma.subscriptionPayment.findMany({
      where: {
        OR: [
          {
            status: 'pending',
            scheduledDate: { lte: now },
          },
          {
            status: 'processing',
            updatedAt: { lte: oneHourAgo },
          },
        ],
      },
      select: { id: true },
      orderBy: {
        scheduledDate: 'asc',
      },
      take: BATCH_SIZE,
    });

    if (pendingIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending payments to execute',
        executed: 0,
      });
    }

    // ロック: pending/古いprocessing → processing に一括更新
    const idList = pendingIds.map((p: { id: string }) => p.id);

    await prisma.subscriptionPayment.updateMany({
      where: {
        id: { in: idList },
        OR: [
          { status: 'pending' },
          { status: 'processing', updatedAt: { lte: oneHourAgo } },
        ],
      },
      data: { status: 'processing' },
    });

    // 実際に更新されたpaymentを取得
    const pendingPayments = await prisma.subscriptionPayment.findMany({
      where: {
        id: { in: idList },
        status: 'processing',
      },
      include: {
        subscription: true,
      },
      orderBy: {
        scheduledDate: 'asc',
      },
    });

    // 2. Relayerウォレットの準備
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      throw new Error('RELAYER_PRIVATE_KEY is not set');
    }

    const account = privateKeyToAccount(relayerPrivateKey as Hex);

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    });

    const jpyc = new JPYC({ client: walletClient });

    // 3. 各支払いを実行
    const results = [];

    for (const payment of pendingPayments) {
      const { subscription } = payment;

      // サブスクがキャンセル済みならスキップ
      if (
        subscription.status === 'cancelled' ||
        subscription.status === 'expired'
      ) {
        console.log(
          `スキップ: サブスクがキャンセル/期限切れ (${subscription.id})`
        );
        await prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: { status: 'cancelled' },
        });
        continue;
      }

      try {
        console.log(
          `決済実行中: ${payment.id} (${subscription.customerAddress} → ${subscription.merchantAddress}), cycle ${payment.cycleNumber}`
        );

        // 初回（cycleNumber = 1）の場合、permit() を実行
        if (payment.cycleNumber === 1 && !subscription.permitExecuted) {
          console.log(`permit() 実行中: ${subscription.id}`);

          // spenderはリレイヤー（バックエンドウォレット）のアドレスである必要がある
          // transferFrom()を実行するのはリレイヤーなので、リレイヤーにallowanceを付与する
          // フロントエンドでwei単位で署名しているので、バックエンドでもwei単位に変換する必要がある
          // ただし、JPYC SDK Coreのpermit()はJPYC単位を受け取り、内部でwei単位に変換する
          // したがって、JPYC単位で渡すのが正しい
          const permitHash = await jpyc.permit({
            owner: subscription.customerAddress as Address,
            spender: account.address, // リレイヤーのアドレス
            value: Number(subscription.totalAmount.toString()), // JPYC単位（SDKが内部でwei単位に変換）
            deadline: Uint256.from(subscription.permitDeadline.toString()),
            v: Uint8.from(subscription.permitV.toString()),
            r: subscription.permitR as Hex,
            s: subscription.permitS as Hex,
          });

          console.log(`permit() トランザクション送信: ${permitHash}`);

          // permit()の完了を待つ
          const permitReceipt = await publicClient.waitForTransactionReceipt({
            hash: permitHash,
          });

          if (permitReceipt.status !== 'success') {
            throw new Error('permit() failed on-chain');
          }

          // permitExecuted フラグを立てる
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { permitExecuted: true },
          });

          console.log(`permit() 完了: ${permitHash}`);
        }

        // transferFrom() を実行
        console.log(`transferFrom() 実行中: ${payment.id}`);

        const hash = await jpyc.transferFrom({
          from: subscription.customerAddress as Address,
          to: subscription.merchantAddress as Address,
          value: Number(payment.amount.toString()), // JPYC単位
        });

        console.log(`transferFrom() トランザクション送信: ${hash}`);

        // トランザクションの完了を待つ
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === 'success') {
          // 成功: ステータスを更新
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await prisma.$transaction(async (tx: any) => {
            await tx.subscriptionPayment.update({
              where: { id: payment.id },
              data: {
                status: 'completed',
                txHash: hash,
                executedAt: new Date(),
              },
            });

            // サブスクのcurrentCycleを更新
            const updatedSubscription = await tx.subscription.update({
              where: { id: subscription.id },
              data: {
                currentCycle: {
                  increment: 1,
                },
              },
            });

            // 全ての決済が完了したか確認
            if (
              updatedSubscription.currentCycle >=
              updatedSubscription.totalMonths
            ) {
              await tx.subscription.update({
                where: { id: subscription.id },
                data: {
                  status: 'expired',
                  endDate: new Date(),
                },
              });
              console.log(`サブスク完了: ${subscription.id}`);
            } else {
              // 次回決済日を更新
              const nextPayment = await tx.subscriptionPayment.findFirst({
                where: {
                  subscriptionId: subscription.id,
                  status: 'pending',
                },
                orderBy: {
                  cycleNumber: 'asc',
                },
              });

              if (nextPayment) {
                await tx.subscription.update({
                  where: { id: subscription.id },
                  data: {
                    nextBillingDate: nextPayment.scheduledDate,
                  },
                });
              }
            }
          });

          results.push({
            paymentId: payment.id,
            status: 'success',
            txHash: hash,
          });

          console.log(`決済完了: ${payment.id}`);
        } else {
          // トランザクションは送信されたがfailed
          await prisma.subscriptionPayment.update({
            where: { id: payment.id },
            data: {
              status: 'failed',
              txHash: hash,
              errorMessage: 'Transaction reverted on-chain',
            },
          });

          results.push({
            paymentId: payment.id,
            status: 'failed',
            error: 'Transaction reverted',
          });

          console.log(`決済失敗（on-chain revert）: ${payment.id}`);
        }
      } catch (error) {
        console.error(`決済失敗: ${payment.id}`, error);

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        await prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            errorMessage,
            retryCount: payment.retryCount + 1,
          },
        });

        results.push({
          paymentId: payment.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('=== Cron実行完了 ===');

    return NextResponse.json({
      success: true,
      message: 'Pending payments processed (Permit version)',
      total: pendingPayments.length,
      results,
    });
  } catch (error) {
    console.error('Cron execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute pending payments' },
      { status: 500 }
    );
  }
}
