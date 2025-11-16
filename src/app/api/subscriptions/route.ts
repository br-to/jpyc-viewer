import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addMonths } from 'date-fns';
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
 * POST /api/subscriptions
 *
 * サブスクリプションを作成し、署名データをDBに保存する
 *
 * リクエストボディ:
 * {
 *   customerAddress: string;
 *   merchantAddress: string;
 *   planName: string;
 *   amount: number;  // 月額料金（JPYC単位）
 *   totalAmount: number;  // 合計金額（JPYC単位）
 *   billingCycle: 'monthly' | 'quarterly' | 'yearly';
 *   totalMonths: number;
 *   permitSignature: {
 *     deadline: string;  // BigInt文字列
 *     v: number;         // ECDSA署名のv
 *     r: string;         // ECDSA署名のr
 *     s: string;         // ECDSA署名のs
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerAddress,
      merchantAddress,
      planName,
      amount,
      totalAmount,
      billingCycle,
      totalMonths,
      permitSignature,
    } = body;

    // バリデーション
    if (
      !customerAddress ||
      !merchantAddress ||
      !planName ||
      !amount ||
      !totalAmount ||
      !billingCycle ||
      !totalMonths ||
      !permitSignature
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (
      !permitSignature.deadline ||
      permitSignature.v === undefined ||
      !permitSignature.r ||
      !permitSignature.s
    ) {
      return NextResponse.json(
        { error: 'Invalid permit signature' },
        { status: 400 }
      );
    }

    // リレイヤー（バックエンドウォレット）の設定
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      throw new Error('RELAYER_PRIVATE_KEY is not set');
    }

    const account = privateKeyToAccount(relayerPrivateKey as `0x${string}`);
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(),
    });
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    });

    const jpyc = new JPYC({
      client: walletClient,
    });

    // トランザクションでサブスクリプションと支払いを一括作成
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = await prisma.$transaction(async (tx: any) => {
      // 最初の決済日を計算（申込日の1ヶ月後）
      const baseDate = new Date();
      const firstBillingDate = addMonths(baseDate, 1);

      // 1. Subscriptionレコード作成（Permit署名を保存）
      const newSubscription = await tx.subscription.create({
        data: {
          customerAddress,
          merchantAddress,
          planName,
          amount,
          totalAmount,
          billingCycle,
          status: 'active',
          startDate: new Date(),
          nextBillingDate: firstBillingDate,
          totalMonths,
          currentCycle: 0, // まだ決済していない
          // EIP-2612 Permit署名（1つだけ）
          permitDeadline: BigInt(permitSignature.deadline),
          permitV: permitSignature.v,
          permitR: permitSignature.r,
          permitS: permitSignature.s,
          permitExecuted: false, // 後でpermit()実行後にtrueに更新
        },
      });

      // 2. 各月の支払いレコードを作成（シンプル化、署名情報は不要）
      const paymentData = [];
      // ベース日付を一度だけ作成して、すべての支払いが同じ時点を基準にスケジュールされるようにする
      for (let i = 0; i < totalMonths; i++) {
        const scheduledDate = addMonths(baseDate, i + 1);

        paymentData.push({
          subscriptionId: newSubscription.id,
          amount,
          cycleNumber: i + 1,
          scheduledDate,
          status: 'pending',
        });
      }

      await tx.subscriptionPayment.createMany({
        data: paymentData,
      });

      return newSubscription;
    });

    // 3. permit()を実行してallowanceを設定
    try {
      console.log(`permit() 実行中: ${subscription.id}`);

      const permitHash = await jpyc.permit({
        owner: customerAddress as Address,
        spender: account.address, // リレイヤーのアドレス
        value: Number(totalAmount), // JPYC単位（SDKが内部でwei単位に変換）
        deadline: Uint256.from(permitSignature.deadline.toString()),
        v: Uint8.from(permitSignature.v.toString()),
        r: permitSignature.r as Hex,
        s: permitSignature.s as Hex,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.subscription.update({
        where: { id: subscription.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { permitExecuted: true } as any,
      });

      console.log(`permit() 完了: ${permitHash}`);
    } catch (error) {
      console.error('Error executing permit:', error);
      // permit()が失敗した場合、サブスクリプションを削除するか、エラーを返す
      // ここではエラーを返す（DBには保存されているが、permitが失敗）
      await prisma.subscription.delete({
        where: { id: subscription.id },
      });
      return NextResponse.json(
        { error: 'Failed to execute permit on-chain' },
        { status: 500 }
      );
    }

    console.log('サブスクリプション作成完了:', subscription.id);

    return NextResponse.json(
      {
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          nextBillingDate: subscription.nextBillingDate,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/subscriptions
 *
 * 特定ユーザーのサブスクリプション一覧を取得
 *
 * クエリパラメータ:
 * - customerAddress: string (必須)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerAddress = searchParams.get('customerAddress');

    if (!customerAddress) {
      return NextResponse.json(
        { error: 'customerAddress query parameter is required' },
        { status: 400 }
      );
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        customerAddress,
      },
      include: {
        payments: {
          orderBy: {
            cycleNumber: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ subscriptions }, { status: 200 });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}
