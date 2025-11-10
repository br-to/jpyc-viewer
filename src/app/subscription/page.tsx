'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSignTransferAuthorization } from '@/hooks/useSignTransferAuthorization';
import { parseUnits, type Hex } from 'viem';

export default function SubscriptionPage() {
  // ウォレット接続状態
  const { address, isConnected } = useAccount();

  // 署名生成フック
  const { signTransferAuthorization } = useSignTransferAuthorization();

  // 状態管理: ユーザーが選択した内容を保持
  const [selectedPlan, setSelectedPlan] = useState('basic'); // どのプランか
  const [selectedMonths, setSelectedMonths] = useState(3); // 何ヶ月契約か
  const [isProcessing, setIsProcessing] = useState(false); // 処理中かどうか
  const [currentStep, setCurrentStep] = useState(0); // 現在何回目の署名か

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
    setCurrentStep(0);

    try {
      const merchantAddress = '0xE7d037165080025Aa3A8747890f7a3B5cA32709D'; // テスト用アドレス（40文字）

      // 1. バックエンドから複数月分のnonceを取得
      console.log('nonceを取得中...');
      const nonceResponse = await fetch('/api/subscriptions/nonces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerAddress: address,
          months: selectedMonths,
        }),
      });

      if (!nonceResponse.ok) {
        throw new Error('nonce生成に失敗しました');
      }

      const { nonces } = await nonceResponse.json();
      console.log('取得したnonces:', nonces);

      // 2. 各nonceに対して署名を生成
      const signatures = [];

      for (let i = 0; i < nonces.length; i++) {
        setCurrentStep(i + 1); // 進捗表示用
        const nonceData = nonces[i];

        console.log(`署名 ${i + 1}/${selectedMonths}:`, nonceData);

        // 署名生成（MetaMaskが立ち上がる）
        const signature = await signTransferAuthorization({
          nonce: nonceData.nonce as Hex,
          to: merchantAddress,
          value: parseUnits(monthlyAmount.toString(), 18), // JPYC単位 → wei
          validAfter: nonceData.validAfter,
          validBefore: nonceData.validBefore,
        });

        signatures.push({
          ...nonceData,
          ...signature,
        });
      }

      console.log('すべての署名完了:', signatures);

      // 3. バックエンドに署名を送信してDB保存
      console.log('サブスクリプションを作成中...');
      const createResponse = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerAddress: address,
          merchantAddress,
          planName: selectedPlan,
          amount: monthlyAmount,
          billingCycle: 'monthly',
          totalMonths: selectedMonths,
          signatures,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('サブスクリプション作成に失敗しました');
      }

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
      setCurrentStep(0);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-md mx-auto">
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

        {/* 進捗表示 */}
        {isProcessing && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-semibold mb-2">
              署名中... ({currentStep}/{selectedMonths})
            </p>
            <p className="text-xs text-gray-600">
              MetaMaskで署名を承認してください
            </p>
          </div>
        )}

        {/* 申込ボタン */}
        <button
          onClick={handleSubscribe}
          disabled={!isConnected || isProcessing}
          className="w-full p-4 bg-blue-600 text-white rounded-lg font-semibold cursor-pointer hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          type="button"
        >
          {isProcessing ? '処理中...' : '申し込む'}
        </button>

        {/* 注意書き */}
        <p className="mt-4 text-sm text-gray-600 text-center">
          ※ {selectedMonths}回の署名が必要です（気持ち悪いですが...）
        </p>
      </div>
    </div>
  );
}
