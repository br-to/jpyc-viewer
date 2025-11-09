import { NextRequest, NextResponse } from 'next/server';
import { keccak256, toHex } from 'viem';
import crypto from 'crypto';

/**
 * POST /api/subscriptions/nonces
 *
 * 複数月分のnonceを生成する
 *
 * リクエストボディ:
 * {
 *   customerAddress: string;  // ユーザーのウォレットアドレス
 *   months: number;           // 契約月数
 * }
 *
 * レスポンス:
 * [
 *   {
 *     nonce: string;
 *     validAfter: number;   // Unix timestamp（秒）
 *     validBefore: number;  // Unix timestamp（秒）
 *     cycleNumber: number;
 *     scheduledDate: string; // ISO 8601形式
 *   },
 *   ...
 * ]
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerAddress, months } = body;

    // バリデーション
    if (!customerAddress || typeof customerAddress !== 'string') {
      return NextResponse.json(
        { error: 'customerAddress is required and must be a string' },
        { status: 400 }
      );
    }

    if (!months || typeof months !== 'number' || months < 1 || months > 12) {
      return NextResponse.json(
        { error: 'months must be a number between 1 and 12' },
        { status: 400 }
      );
    }

    // 各月分のnonceとタイムスタンプを生成
    const nonces = [];

    for (let i = 0; i < months; i++) {
      // 決済予定日を計算（テスト用: 1時間前から開始）
      const scheduledDate = new Date();
      scheduledDate.setHours(scheduledDate.getHours() - 1 + i); // 1時間前、現在、1時間後...
      scheduledDate.setMinutes(0, 0, 0);

      // Unix timestamp（秒）
      const validAfter = Math.floor(scheduledDate.getTime() / 1000);
      const validBefore = validAfter + 3 * 24 * 60 * 60; // 3日間有効

      // nonceを一意に生成
      // フォーマット: keccak256(customerAddress + timestamp + cycleNumber + random)
      const randomBytes = crypto.randomBytes(16).toString('hex');
      const nonceInput = `${customerAddress}-${Date.now()}-${i}-${randomBytes}`;
      const nonce = keccak256(toHex(nonceInput));

      nonces.push({
        nonce,
        validAfter,
        validBefore,
        cycleNumber: i + 1,
        scheduledDate: scheduledDate.toISOString(),
      });
    }

    console.log(`Generated ${months} nonces for ${customerAddress}`);

    return NextResponse.json({ nonces }, { status: 200 });
  } catch (error) {
    console.error('Error generating nonces:', error);
    return NextResponse.json(
      { error: 'Failed to generate nonces' },
      { status: 500 }
    );
  }
}
