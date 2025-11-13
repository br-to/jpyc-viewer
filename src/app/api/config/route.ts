import { NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import type { Hex } from 'viem';

/**
 * GET /api/config
 *
 * アプリケーションの設定情報を取得
 * - relayerAddress: リレイヤー（バックエンドウォレット）のアドレス
 * - merchantAddress: マーチャント（JPYCの送金先）のアドレス
 */
export async function GET() {
  try {
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      return NextResponse.json(
        { error: 'RELAYER_PRIVATE_KEY is not set' },
        { status: 500 }
      );
    }

    const account = privateKeyToAccount(relayerPrivateKey as Hex);
    const merchantAddress = process.env.MERCHANT_WALLET_ADDRESS;

    if (!merchantAddress) {
      return NextResponse.json(
        { error: 'MERCHANT_WALLET_ADDRESS is not set' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        relayerAddress: account.address,
        merchantAddress,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting config:', error);
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    );
  }
}
