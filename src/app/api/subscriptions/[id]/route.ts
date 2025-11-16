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
 * 1. permit 0の署名を受け取る
 * 2. permit(value=0)を実行してallowanceを0にする
 * 3. statusをcancelledに更新
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // permit 0の署名を受け取る
    const permitSignature = body.permitSignature;
    if (!permitSignature) {
      return NextResponse.json(
        { error: 'Permit signature is required' },
        { status: 400 }
      );
    }

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

    // permit(value=0)を実行してallowanceを0にする
    try {
      console.log(`permit(value=0) 実行中: ${id}`);

      const permitHash = await jpyc.permit({
        owner: existingSubscription.customerAddress as Address,
        spender: account.address, // リレイヤーのアドレス
        value: 0, // 0に設定してallowanceをキャンセル
        deadline: Uint256.from(permitSignature.deadline.toString()),
        v: Uint8.from(permitSignature.v.toString()),
        r: permitSignature.r as Hex,
        s: permitSignature.s as Hex,
      });

      console.log(`permit(value=0) トランザクション送信: ${permitHash}`);

      // permit()の完了を待つ
      const permitReceipt = await publicClient.waitForTransactionReceipt({
        hash: permitHash,
      });

      if (permitReceipt.status !== 'success') {
        throw new Error('permit(value=0) failed on-chain');
      }

      console.log(`permit(value=0) 完了: ${permitHash}`);
    } catch (error) {
      console.error('Error executing permit(value=0):', error);
      return NextResponse.json(
        { error: 'Failed to cancel permit on-chain' },
        { status: 500 }
      );
    }

    // サブスクリプションのステータスをキャンセル済みに更新
    const cancelledSubscription = await prisma.subscription.update({
      where: { id },
      data: {
        status: 'cancelled',
        endDate: new Date(),
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
