import { NextResponse, type NextRequest } from 'next/server';
import { keccak256, toHex, type Hex } from 'viem';

/**
 * POST /api/orders
 *
 * 新しい決済を作成し、paymentIdとnonceを生成する
 *
 * 📚 アーキテクチャの整理:
 * - orderId: 注文ID（カートから注文確定時に生成、今回は固定）
 * - paymentId: 決済ID（支払い実行時に生成、このAPIで作る）
 * - 1つの注文(orderId)に対して複数の決済(paymentId)がありえる
 *
 * 📖 記事との対応:
 * - このpaymentIdが記事の「paymentId」そのもの
 * - nonceはpaymentIdから生成される
 *
 * このAPIの役割:
 * 1. 一意なpaymentIdを生成
 * 2. paymentIdからnonceを生成（keccak256でハッシュ化）
 * 3. paymentIdとnonceの対応をDBに保存
 * 4. フロントエンドにpaymentIdとnonceを返す
 *
 * なぜバックエンドでnonce生成するのか:
 * - nonceの一意性を保証できる
 * - 同じpaymentIdで複数回署名されるのを防げる
 * - リプレイ攻撃を防止できる
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
  orderId?: string; // オプション: 既存の注文IDがあれば渡す
}

interface CreateOrderResponse {
  paymentId: string;
  nonce: Hex;
  merchantAddress: string;
  total: number;
  orderId?: string; // 関連する注文ID
}

/**
 * paymentIdからnonceを生成
 * フロントエンドでも同じ計算をする必要はない（バックエンドが返すnonceを使う）
 */
function generateNonce(paymentId: string): Hex {
  return keccak256(toHex(paymentId));
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateOrderRequest = await request.json();
    const { total, orderId } = body;

    // 1. 一意なpaymentIdを生成（UUID v4）
    const paymentId = crypto.randomUUID();

    // 2. paymentIdからnonceを生成
    const nonce = generateNonce(paymentId);

    // 3. 商店のウォレットアドレス
    const merchantAddress = process.env
      .MERCHANT_WALLET_ADDRESS as `0x${string}`;

    // 4. データベースに保存
    // TODO: 実際のデータベースに保存
    // await db.payments.create({
    //   data: {
    //     id: paymentId,
    //     orderId,  // 関連する注文ID
    //     nonce,
    //     customerAddress,
    //     merchantAddress,
    //     total,
    //     status: 'pending', // pending -> processing -> completed
    //     createdAt: new Date(),
    //   },
    // });

    // 4. フロントエンドに必要な情報を返す
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
