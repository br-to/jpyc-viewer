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
import { fromUnixTime, isAfter } from 'date-fns';

/**
 * POST /api/subscriptions/execute-pending
 *
 * 決済予定日が来たpendingの支払いを実行する（Cronから呼ばれる）
 *
 * 処理フロー:
 * 1. 実行対象の支払いを取得（scheduledDate が過去 & status = pending）
 * 2. 各支払いに対して transferWithAuthorization を実行
 * 3. 成功したら status = completed に更新
 * 4. 失敗したら status = failed に更新（リトライカウントも増やす）
 */
export async function POST(request: NextRequest) {
  try {
    // 認証チェック（Cronからのリクエストのみ許可）
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('=== Cron実行開始 ===');

    // 1. 実行対象の支払いを取得（バッチ処理: 最大100件）
    // 並行実行防止: processingステータスを付けて、他のインスタンスが処理しないようにする
    const now = new Date();
    const BATCH_SIZE = 100;

    // まずpendingのIDだけを取得してロック
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
            updatedAt: { lte: oneHourAgo }, // 1時間以上前にprocessingになったもの
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

    // ロック: pending/古いprocessing → processing に一括更新（並行実行防止）
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

    // 実際に更新されたpaymentを取得（他のインスタンスが先に処理した場合は除外される）
    const pendingPayments = await prisma.subscriptionPayment.findMany({
      where: {
        id: { in: idList },
        status: 'processing', // processingになったものだけ
      },
      include: {
        subscription: true,
      },
      orderBy: {
        scheduledDate: 'asc',
      },
    });

    console.log(`実行対象の支払い（ロック済み）: ${pendingPayments.length}件`);

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

    // JPYC Prepaid (Sepolia testnet)
    const jpycAddress = '0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB' as Address;

    // JPYCコントラクトのABI（transferWithAuthorizationのみ）
    const jpycAbi = [
      {
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' },
        ],
        name: 'transferWithAuthorization',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ] as const;

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

      // validBefore をチェック（3日過ぎていたらスキップ）
      const validBeforeDate = fromUnixTime(Number(payment.validBefore));
      if (isAfter(now, validBeforeDate)) {
        console.log(`スキップ: validBefore過ぎ (${payment.id})`);
        await prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            errorMessage: 'validBefore expired',
          },
        });
        continue;
      }

      try {
        console.log(
          `決済実行中: ${payment.id} (${subscription.customerAddress} → ${subscription.merchantAddress})`
        );

        // transferWithAuthorization を実行
        const hash = await walletClient.writeContract({
          address: jpycAddress,
          abi: jpycAbi,
          functionName: 'transferWithAuthorization',
          args: [
            subscription.customerAddress as Address,
            subscription.merchantAddress as Address,
            BigInt(payment.amount.toString()) * BigInt(10 ** 18), // JPYC単位 → wei
            BigInt(payment.validAfter.toString()),
            BigInt(payment.validBefore.toString()),
            payment.nonce as Hex,
            payment.signatureV,
            payment.signatureR as Hex,
            payment.signatureS as Hex,
          ],
        });

        console.log(`トランザクション送信: ${hash}`);

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

            // サブスクのcurrentCycleを更新（incrementで安全にインクリメント）
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
              // 次回決済日を更新（次のpending支払いの日付）
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
          // トランザクションは送信されたがfailed（nonceは消費済み）
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

        // トランザクション送信後のエラーはnonceが消費されている可能性があるため
        // 安全のため、基本的にリトライせずfailedにする
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
      message: 'Pending payments processed',
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
