import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
 *   billingCycle: 'monthly' | 'quarterly' | 'yearly';
 *   totalMonths: number;
 *   signatures: [
 *     {
 *       nonce: string;
 *       validAfter: number;
 *       validBefore: number;
 *       v: number;        // ECDSA署名のv
 *       r: string;        // ECDSA署名のr
 *       s: string;        // ECDSA署名のs
 *       cycleNumber: number;
 *       scheduledDate: string;
 *     },
 *     ...
 *   ]
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
      billingCycle,
      totalMonths,
      signatures,
    } = body;

    // バリデーション
    if (
      !customerAddress ||
      !merchantAddress ||
      !planName ||
      !amount ||
      !billingCycle ||
      !totalMonths ||
      !signatures
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(signatures) || signatures.length !== totalMonths) {
      return NextResponse.json(
        { error: `signatures must be an array of length ${totalMonths}` },
        { status: 400 }
      );
    }

    // トランザクションでサブスクリプションと支払いを一括作成
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = await prisma.$transaction(async (tx: any) => {
      // 1. Subscriptionレコード作成
      const newSubscription = await tx.subscription.create({
        data: {
          customerAddress,
          merchantAddress,
          planName,
          amount,
          billingCycle,
          status: 'active',
          startDate: new Date(),
          nextBillingDate: new Date(signatures[0].scheduledDate), // 最初の決済日
          totalMonths,
          currentCycle: 0, // まだ決済していない
        },
      });

      // 2. 各署名をSubscriptionPaymentレコードとして保存
      const paymentData = signatures.map((sig) => ({
        subscriptionId: newSubscription.id,
        nonce: sig.nonce,
        validAfter: BigInt(sig.validAfter),
        validBefore: BigInt(sig.validBefore),
        signatureV: sig.v,
        signatureR: sig.r,
        signatureS: sig.s,
        amount,
        cycleNumber: sig.cycleNumber,
        scheduledDate: new Date(sig.scheduledDate),
        status: 'pending', // 初期状態は「保留中」
      }));

      await tx.subscriptionPayment.createMany({
        data: paymentData,
      });

      return newSubscription;
    });

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
