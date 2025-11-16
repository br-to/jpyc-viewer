'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSignPermit } from '@/hooks/useSignPermit';
import { parseUnits } from 'viem';
import { TransactionLoading } from '@/components/TransactionLoading';
import Link from 'next/link';

export default function SubscriptionPage() {
  // ウォレット接続状態
  const { address, isConnected } = useAccount();

  // Permit署名生成フック（1回の署名だけ！）
  const { signPermit, isLoading: isSignLoading } = useSignPermit();

  // 状態管理: ユーザーが選択した内容を保持
  const [selectedPlan, setSelectedPlan] = useState('basic'); // どのプランか
  const [selectedMonths, setSelectedMonths] = useState(3); // 何ヶ月契約か
  const [isProcessing, setIsProcessing] = useState(false); // 処理中かどうか
  const [loadingStep, setLoadingStep] = useState<string>(''); // 現在の処理ステップ

  // プランごとの金額（後でDBから取得する想定だけど、今はハードコード）
  const planPrices: Record<string, number> = {
    basic: 1000, // ベーシック: 1,000 JPYC/月
    premium: 3000, // プレミアム: 3,000 JPYC/月
  };

  // 選択中のプランの月額
  const monthlyAmount = planPrices[selectedPlan];
  // 合計金額（月額 × 契約月数）
  const totalAmount = monthlyAmount * selectedMonths;

  // 申込処理
  const handleSubscribe = async () => {
    if (!address) {
      alert('ウォレットを接続してください');
      return;
    }

    setIsProcessing(true);
    setLoadingStep('設定情報を取得中...');

    try {
      // 設定情報を取得（リレイヤーアドレス、マーチャントアドレス）
      const configResponse = await fetch('/api/config');
      if (!configResponse.ok) {
        throw new Error('Failed to get config');
      }
      const { relayerAddress, merchantAddress } = await configResponse.json();

      if (!relayerAddress || !merchantAddress) {
        throw new Error('Config is incomplete');
      }

      // 1. 1回だけPermit署名を生成（合計金額分を承認）
      setLoadingStep('署名を生成中...');
      // deadline: 契約期間 + 3日のバッファ
      const now = Math.floor(Date.now() / 1000);
      const contractDurationSeconds = selectedMonths * 30 * 24 * 60 * 60; // 契約期間（秒）
      const bufferDays = 3; // 3日のバッファ
      const bufferSeconds = bufferDays * 24 * 60 * 60;
      const deadlineSeconds = contractDurationSeconds + bufferSeconds;
      const deadline = BigInt(now + deadlineSeconds);

      // EIP-2612のPermitではvalueはuint256（wei単位）で指定される
      // フロントエンドでwei単位で署名し、バックエンドでも同じ値を使用する必要がある
      // ただし、JPYC SDK Coreのpermit()はJPYC単位を受け取り、内部でwei単位に変換する
      // したがって、フロントエンドでwei単位で署名し、バックエンドでJPYC単位に戻して渡す
      const permitSignature = await signPermit({
        spender: relayerAddress as `0x${string}`, // リレイヤーアドレス（署名に必要）
        value: parseUnits(totalAmount.toString(), 18), // 合計金額（wei単位）
        deadline,
      });

      // 2. バックエンドに送信してDB保存
      setLoadingStep('トランザクションを送信中...');
      const createResponse = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerAddress: address,
          merchantAddress,
          planName: selectedPlan,
          amount: monthlyAmount,
          totalAmount,
          billingCycle: 'monthly',
          totalMonths: selectedMonths,
          permitSignature: {
            deadline: permitSignature.deadline.toString(),
            v: permitSignature.v,
            r: permitSignature.r,
            s: permitSignature.s,
          },
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(
          errorData.error || 'サブスクリプション作成に失敗しました'
        );
      }

      setLoadingStep('トランザクション確認待ち...');
      const result = await createResponse.json();
      console.log('サブスクリプション作成完了:', result);

      alert(
        `申込完了！\nサブスクID: ${result.subscription.id}\n次回決済日: ${new Date(result.subscription.nextBillingDate).toLocaleDateString('ja-JP')}`
      );
    } catch (error) {
      console.error('エラー:', error);
      alert(
        `エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    } finally {
      setIsProcessing(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
        {/* サブスク一覧へのリンク */}
        <div className="mb-6">
          <Link
            href="/subscriptions"
            className="text-blue-600 hover:underline inline-flex items-center"
          >
            サブスク一覧
          </Link>
        </div>

        {/* タイトル */}
        <h1 className="text-3xl font-bold mb-8">サブスク申込</h1>

        {/* ウォレット接続ボタン */}
        {!isConnected && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="mb-4 text-sm">
              サブスクを申し込むにはウォレットを接続してください
            </p>
            <ConnectButton />
          </div>
        )}

        {/* プラン選択 */}
        <div className="mb-6">
          <label htmlFor="plan" className="block mb-2 font-semibold">
            プラン
          </label>
          <select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="w-full p-3 border rounded-lg"
          >
            <option value="basic">ベーシックプラン - 1,000 JPYC/月</option>
            <option value="premium">プレミアムプラン - 3,000 JPYC/月</option>
          </select>
        </div>

        {/* 契約期間選択 */}
        <div className="mb-6">
          <label htmlFor="months" className="block mb-2 font-semibold">
            契約期間
          </label>
          <select
            value={selectedMonths}
            onChange={(e) => setSelectedMonths(Number(e.target.value))}
            className="w-full p-3 border rounded-lg"
          >
            <option value={3}>3ヶ月</option>
            <option value={6}>6ヶ月</option>
            <option value={12}>12ヶ月</option>
          </select>
        </div>

        {/* 金額表示 */}
        <div className="mb-6 p-4 bg-gray-100 rounded-lg">
          <div className="flex justify-between mb-2">
            <span>月額:</span>
            <span className="font-semibold">
              {monthlyAmount.toLocaleString()} JPYC
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>合計:</span>
            <span>
              {totalAmount.toLocaleString()} JPYC（{selectedMonths}ヶ月分）
            </span>
          </div>
        </div>

        {/* ローディングオーバーレイ */}
        {isProcessing && <TransactionLoading step={loadingStep} />}

        {/* 申込ボタン */}
        <button
          onClick={handleSubscribe}
          disabled={!isConnected || isProcessing || isSignLoading}
          className="w-full p-4 bg-blue-600 text-white rounded-lg font-semibold cursor-pointer hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          type="button"
        >
          {isProcessing || isSignLoading ? '処理中...' : '申し込む'}
        </button>
      </div>
    </div>
  );
}
