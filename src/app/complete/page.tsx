'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const txHash = searchParams.get('txHash');

  return (
    <div className="font-sans min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-2xl mx-auto w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-sm text-center">
          {/* 成功アイコン */}
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-12 h-12 text-green-600 dark:text-green-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-label="成功"
              >
                <title>成功</title>
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* メッセージ */}
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            ご注文ありがとうございます!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            JPYCでのお支払いが正常に完了しました
          </p>

          {/* 注文情報 */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 mb-8">
            {txHash && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  トランザクションハッシュ
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 break-all font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  {txHash}
                </p>
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline mt-2 inline-block"
                >
                  Etherscanで確認する →
                </a>
              </div>
            )}
          </div>

          {/* 次のアクション */}
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ご注文の詳細は登録されたメールアドレスに送信されます
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                ホームに戻る
              </Link>
              <Link
                href="/payment"
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-semibold rounded-lg transition-colors"
              >
                新しい注文を作成
              </Link>
            </div>
          </div>
        </div>

        {/* 追加情報 */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>商品の発送準備が整い次第、メールでお知らせいたします</p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p>読み込み中...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
