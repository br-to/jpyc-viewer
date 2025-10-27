import { type NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { JPYC } from '@jpyc/sdk-core';
import { Uint256, Uint8 } from 'soltypes';

// バックエンドウォレットの秘密鍵 (環境変数から取得)
const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY as Hex;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params;
    const body = await request.json();
    const { from, to, value, validAfter, validBefore, nonce, v, r, s } = body;

    // 1. paymentIdとnonceの対応をデータベースに保存
    // これにより、後でAuthorizationUsedイベントからnonceを取得したときに
    // どのpaymentIdに対応するかを特定できる
    // TODO: 実際のデータベースに保存
    // await db.payments.update({
    //   where: { id: paymentId },
    //   data: {
    //     nonce,
    //     from,
    //     to,
    //     value: value.toString(),
    //     status: 'processing',
    //   },
    // });

    // 2. バックエンドウォレットの設定
    if (!BACKEND_PRIVATE_KEY) {
      throw new Error('BACKEND_PRIVATE_KEY is not set');
    }

    const account = privateKeyToAccount(BACKEND_PRIVATE_KEY);
    const client = createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    });

    // 3. JPYC SDK インスタンスを作成
    const jpyc = new JPYC({ client });

    // 4. transferWithAuthorization を実行
    const txHash = await jpyc.transferWithAuthorization({
      from: from as Hex,
      to: to as Hex,
      value: Number(value) / 1e18, // wei → JPYC (SDKが自動でdecimalsを処理)
      validAfter: Uint256.from(validAfter.toString()),
      validBefore: Uint256.from(validBefore.toString()),
      nonce: nonce as Hex,
      v: Uint8.from(String(v)),
      r: r as Hex,
      s: s as Hex,
    });

    // TODO: データベースの決済を更新
    // await db.payments.update({
    //   where: { id: paymentId },
    //   data: {
    //     status: 'completed',
    //     txHash,
    //     completedAt: new Date(),
    //   },
    // });

    return NextResponse.json({
      success: true,
      paymentId,
      txHash,
      message: 'Payment processed successfully',
    });
  } catch (error) {
    console.error('支払い処理エラー:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
