import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/subscriptions/[id]
 *
 * サブスクリプションIDに紐づく詳細情報を取得する
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const subscription = await prisma.subscription.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: {
            cycleNumber: 'asc',
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ subscription }, { status: 200 });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/subscriptions/[id]
 *
 * サブスクリプションをキャンセルする
 * (実際にはstatusをcancelledに更新する)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existingSubscription = await prisma.subscription.findUnique({
      where: { id },
    });

    if (!existingSubscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // 既にキャンセル済み or 期限切れの場合
    if (
      existingSubscription.status === 'cancelled' ||
      existingSubscription.status === 'expired'
    ) {
      return NextResponse.json(
        {
          error: 'Subscription is already cancelled or expired',
          subscription: existingSubscription,
        },
        { status: 400 }
      );
    }

    // サブスクリプションのステータスをキャンセル済みに更新
    const cancelledSubscription = await prisma.subscription.update({
      where: { id },
      data: {
        status: 'cancelled',
        endDate: new Date(), // キャンセル日を記録
      },
    });

    // 関連する未処理の支払いもキャンセル済みに更新
    await prisma.subscriptionPayment.updateMany({
      where: {
        subscriptionId: id,
        status: 'pending',
      },
      data: {
        status: 'cancelled',
      },
    });

    return NextResponse.json(
      { subscription: cancelledSubscription },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
