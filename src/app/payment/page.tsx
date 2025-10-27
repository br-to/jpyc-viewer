'use client';

import { useAccount } from 'wagmi';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBalanceOf } from '@jpyc/sdk-react';
import { useJPYCPayment } from '@/hooks/useJPYCPayment';
import { CheckoutPaymentSelector } from '@/components/CheckoutPaymentSelector';

export default function PaymentPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // JPYC残高を取得
  const {
    data: balanceData,
    isPending: isBalanceLoading,
    error: balanceError,
  } = useBalanceOf({
    account: address as `0x${string}`,
  });

  // JPYC決済機能（EIP-3009パターン）
  const {
    executePayment,
    isLoading: isPaymentProcessing,
    isConfirming, // トランザクション承認待ち
    isSuccess: isPaymentSuccess, // トランザクション完了
    error: paymentError,
    txHash,
  } = useJPYCPayment();

  const jpycBalance = balanceData ? parseFloat(balanceData) : null;

  // サンプルの購入情報
  const orderSummary = {
    items: [
      { id: 'item-1', name: 'サンプル商品A', price: 1500, quantity: 2 },
      { id: 'item-2', name: 'サンプル商品B', price: 3000, quantity: 1 },
    ],
    subtotal: 6000,
    tax: 600,
    total: 6600,
  };

  // 送金成功後に注文完了画面に遷移（TanStack Queryのパターン）
  if (isPaymentSuccess && txHash) {
    router.push(
      `/payment/success?txHash=${txHash}&total=${orderSummary.total}`
    );
  }

  const canProceedPayment = () => {
    if (!isConnected) return false;
    if (isBalanceLoading || isPaymentProcessing || isConfirming) return false;
    if (balanceError || jpycBalance === null) return false;
    if (jpycBalance < orderSummary.total) return false;
    return true;
  };

  const getButtonText = () => {
    if (!isConnected) return 'ウォレットを接続してください';
    if (isBalanceLoading) return '残高確認中...';
    if (isPaymentProcessing) return '署名処理中...';
    if (isConfirming) return 'トランザクション処理中...';
    if (jpycBalance !== null && jpycBalance < orderSummary.total)
      return '残高不足';
    return 'お支払いを確定する';
  };

  // 支払い処理（JPYC決済のみ実装）
  const handlePayment = () => {
    if (!canProceedPayment()) return;
    executePayment(orderSummary);
  };

  return (
    <div className="font-sans min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8">
      {/* ローディングオーバーレイ */}
      {(isPaymentProcessing || isConfirming) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl max-w-md mx-4">
            <div className="flex flex-col items-center gap-4">
              {/* スピナー */}
              <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />

              {/* メッセージ */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {isPaymentProcessing && '署名を作成中...'}
                  {isConfirming && 'トランザクション処理中...'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isPaymentProcessing && 'ウォレットで署名を承認してください'}
                  {isConfirming &&
                    'ブロックチェーン上で処理されています。しばらくお待ちください。'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-2 mb-4"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-label="戻る"
            >
              <title>戻る</title>
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            ショッピングを続ける
          </Link>
          <h1 className="text-3xl font-bold">お支払い</h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* メインコンテンツ */}
          <div className="lg:col-span-2 space-y-6">
            {/* お届け先情報 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4">お届け先</h2>
              <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  山田 太郎
                </p>
                <p>〒123-4567</p>
                <p>東京都渋谷区サンプル 1-2-3</p>
                <p>サンプルマンション 101号室</p>
              </div>
            </div>

            {/* 支払い方法選択 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
              <CheckoutPaymentSelector
                onSelect={handlePayment}
                jpycBalance={jpycBalance}
                isBalanceLoading={isBalanceLoading}
                balanceError={balanceError}
                totalAmount={orderSummary.total}
              />
            </div>
          </div>

          {/* 注文サマリー */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm sticky top-8">
              <h2 className="text-xl font-bold mb-4">ご注文内容</h2>

              {/* 商品リスト */}
              <div className="space-y-3 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                {orderSummary.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {item.name}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">
                        数量: {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      ¥{(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* 小計・税金 */}
              <div className="space-y-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">小計</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    ¥{orderSummary.subtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    消費税(10%)
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    ¥{orderSummary.tax.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* 合計 */}
              <div className="flex justify-between text-lg font-bold mb-6">
                <span>合計</span>
                <span className="text-blue-600 dark:text-blue-400">
                  ¥{orderSummary.total.toLocaleString()}
                </span>
              </div>

              {/* 支払いボタン */}
              <button
                type="button"
                onClick={handlePayment}
                disabled={!canProceedPayment()}
                className={`
                  w-full py-3 rounded-lg font-semibold transition-colors
                  ${
                    canProceedPayment()
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                {getButtonText()}
              </button>

              {/* エラー表示 */}
              {paymentError && (
                <p className="text-xs text-center text-red-500 mt-2">
                  エラー: {paymentError.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
