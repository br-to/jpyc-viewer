import { NextResponse, type NextRequest } from 'next/server';
import { keccak256, toHex, type Hex } from 'viem';

/**
 * 注文作成リクエストの型定義
 */
interface CreateOrderRequest {
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  customerAddress: string;
  orderId?: string; // オプション: 既存の注文IDがある場合
}

/**
 * 注文作成レスポンスの型定義
 */
interface CreateOrderResponse {
  paymentId: string;
  nonce: Hex;
  merchantAddress: string;
  total: number;
  orderId?: string;
}

/**
 * EIP-3009のnonceを生成
 * paymentIdをkeccak256でハッシュ化してユニークなnonceを作成
 *
 * @param paymentId - UUID形式の支払いID
 * @returns EIP-3009で使用するnonce (bytes32)
 */
function generateNonce(paymentId: string): Hex {
  return keccak256(toHex(paymentId));
}

/**
 * POST /api/orders
 *
 * EIP-3009 transferWithAuthorizationで使用する支払い情報を生成
 *
 * フロー:
 * 1. ユニークなpaymentIdを生成（UUID v4）
 * 2. paymentIdからEIP-3009のnonceを生成
 * 3. 受取先アドレス（MERCHANT_WALLET_ADDRESS）を取得
 * 4. 支払い情報をデータベースに保存（TODO）
 * 5. フロントエンドに署名に必要な情報を返す
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateOrderRequest = await request.json();
    const { total, orderId } = body;

    // paymentIdを生成（UUID v4で一意性を保証）
    const paymentId = crypto.randomUUID();

    // EIP-3009のnonceを生成（paymentIdをハッシュ化）
    const nonce = generateNonce(paymentId);

    // JPYC受取先のウォレットアドレス（環境変数から取得）
    const merchantAddress = process.env
      .MERCHANT_WALLET_ADDRESS as `0x${string}`;

    // TODO: データベースに支払い情報を保存
    // await db.payments.create({
    //   data: {
    //     id: paymentId,
    //     orderId,  // ECサイト側の注文IDとの紐付け
    //     nonce,
    //     customerAddress,
    //     merchantAddress,
    //     total,
    //     status: 'pending', // pending -> processing -> completed
    //     createdAt: new Date(),
    //   },
    // });

    // フロントエンドに署名用の情報を返す
    const response: CreateOrderResponse = {
      paymentId,
      nonce,
      merchantAddress,
      total,
      orderId,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
