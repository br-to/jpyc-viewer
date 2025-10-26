import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export type CheckoutPaymentMethod = 'credit-card' | 'jpyc';

interface PaymentOption {
  id: CheckoutPaymentMethod;
  name: string;
  description: string;
  disabled?: boolean;
}

const paymentOptions: PaymentOption[] = [
  {
    id: 'credit-card',
    name: 'クレジットカード',
    description: 'Visa、Mastercard、JCB、American Express',
    disabled: true,
  },
  {
    id: 'jpyc',
    name: 'JPYC',
    description: 'ブロックチェーン上の日本円ステーブルコイン',
  },
];

/**
 * CheckoutPaymentSelectorコンポーネントのプロパティ
 */
interface CheckoutPaymentSelectorProps {
  /**
   * 支払い方法が選択されたときに呼び出されるコールバック
   * @param method 選択された支払い方法
   */
  onSelect: (method: CheckoutPaymentMethod) => void;
  /**
   * 現在選択されている支払い方法
   */
  selectedMethod?: CheckoutPaymentMethod;
  /**
   * JPYCの残高（nullの場合は未取得）
   */
  jpycBalance?: number | null;
  /**
   * JPYC残高の取得中かどうか
   */
  isBalanceLoading?: boolean;
  /**
   * JPYC残高取得時のエラー（nullの場合はエラーなし）
   */
  balanceError?: Error | null;
  /**
   * 支払いに必要な合計金額（円単位）
   */
  totalAmount?: number;
}

export function CheckoutPaymentSelector({
  onSelect,
  selectedMethod,
  jpycBalance,
  isBalanceLoading = false,
  balanceError,
  totalAmount,
}: CheckoutPaymentSelectorProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const formattedBalance = jpycBalance ?? 0;

  const hasInsufficientBalance =
    selectedMethod === 'jpyc' &&
    isConnected &&
    !isBalanceLoading &&
    !balanceError &&
    totalAmount !== undefined &&
    formattedBalance < totalAmount;

  return (
    <div className="w-full max-w-2xl">
      <h2 className="text-xl font-bold mb-4">お支払い方法</h2>

      <div className="space-y-3">
        {paymentOptions.map((option) => {
          const isSelected = selectedMethod === option.id;
          const isDisabled = option.disabled;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => !isDisabled && onSelect(option.id)}
              disabled={isDisabled}
              className={`
                w-full p-4 rounded-lg border-2 transition-all
                flex items-start gap-4 text-left
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-pointer'
                    : isDisabled
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed opacity-60'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer'
                }
              `}
            >
              {/* ラジオボタン */}
              <div className="shrink-0 mt-1">
                <div
                  className={`
                  w-5 h-5 rounded-full border-2 flex items-center justify-center
                  ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }
                `}
                >
                  {isSelected && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
              </div>

              {/* コンテンツ */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3
                    className={`font-semibold ${
                      isDisabled
                        ? 'text-gray-500 dark:text-gray-500'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {option.name}
                  </h3>
                  {isDisabled && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-gray-400 text-white rounded-full">
                      利用不可
                    </span>
                  )}
                </div>
                <p
                  className={`text-sm ${
                    isDisabled
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {option.description}
                </p>

                {/* JPYC選択時 */}
                {option.id === 'jpyc' && isSelected && (
                  <>
                    {/* ウォレット未接続の場合 */}
                    {!isConnected && (
                      <div className="mt-3 p-3 bg-white dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <p className="text-sm dark:text-blue-200">
                          ウォレットを接続してJPYC残高を確認してください
                        </p>
                        <ConnectButton />
                      </div>
                    )}

                    {/* ウォレット接続済みの場合 */}
                    {isConnected && (
                      <div
                        className={`mt-3 p-3 rounded border ${
                          hasInsufficientBalance
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-white dark:bg-gray-700/50 border-blue-200 dark:border-blue-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            ご利用可能なJPYC残高:
                          </span>
                          {isBalanceLoading ? (
                            <span className="text-sm text-gray-500">
                              読み込み中...
                            </span>
                          ) : balanceError ? (
                            <span className="text-sm text-red-500">エラー</span>
                          ) : (
                            <span
                              className={`text-lg font-bold ${
                                hasInsufficientBalance
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              ¥
                              {formattedBalance.toLocaleString('ja-JP', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 6,
                              })}
                            </span>
                          )}
                        </div>
                        {hasInsufficientBalance && (
                          <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                            残高が不足しています。お支払いには¥
                            {totalAmount?.toLocaleString('ja-JP', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 6,
                            })}
                            が必要です。
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400 truncate mr-2">
                            {address?.slice(0, 6)}...{address?.slice(-4)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              disconnect();
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline whitespace-nowrap cursor-pointer"
                          >
                            ウォレット切断
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
