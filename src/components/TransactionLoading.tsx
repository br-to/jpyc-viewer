'use client';

interface TransactionLoadingProps {
  title?: string;
  step: string;
  variant?: 'default' | 'cancel';
}

/**
 * トランザクション実行中のローディング画面コンポーネント
 */
export function TransactionLoading({
  title,
  step,
  variant = 'default',
}: TransactionLoadingProps) {
  const colorClass = variant === 'cancel' ? 'border-red-600' : 'border-blue-600';
  const defaultTitle = variant === 'cancel' ? 'キャンセル処理中...' : '処理中...';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div
            className={`inline-block animate-spin rounded-full h-12 w-12 border-b-2 ${colorClass} mb-4`}
          ></div>
          <h3 className="text-xl font-bold mb-2">{title || defaultTitle}</h3>
          <p className="text-gray-600 mb-4">{step}</p>
          {step === '署名を生成中...' && (
            <p className="text-sm text-gray-500">
              MetaMaskで署名を承認してください
            </p>
          )}
          {step === 'トランザクション確認待ち...' && (
            <p className="text-sm text-gray-500">
              ブロックチェーンで確認されるまでお待ちください
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
