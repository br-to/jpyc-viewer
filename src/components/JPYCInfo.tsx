import { useBalanceOf, useTotalSupply } from '@jpyc/sdk-react';
import { useAccount } from 'wagmi';

export function JPYCInfo() {
  const { isConnected, chain, address } = useAccount();

  // JPYC SDK hooks
  const {
    data: balanceData,
    isPending: isBalanceLoading,
    error: balanceError,
  } = useBalanceOf({
    account: address as `0x${string}`,
  });
  const totalSupplyResult = useTotalSupply({});
  const totalSupplyData = totalSupplyResult?.data;
  const isTotalSupplyLoading = totalSupplyResult?.isPending || false;

  if (!isConnected || !address) {
    return null;
  }

  const formattedBalance = parseFloat(balanceData || '0');
  const formattedTotalSupply = parseFloat(totalSupplyData || '0');

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800 max-w-md">
      <h2 className="text-xl font-semibold mb-4 text-blue-800 dark:text-blue-200">
        JPYC トークン情報
      </h2>
      <div className="space-y-3">
        <p className="text-sm">
          <strong>トークン名:</strong> JPY Coin
        </p>
        <p className="text-sm">
          <strong>シンボル:</strong> JPYC
        </p>
        <p className="text-sm">
          <strong>残高:</strong>{' '}
          {isBalanceLoading ? (
            <span className="text-gray-500">読み込み中...</span>
          ) : balanceError ? (
            <span className="text-red-500" title={balanceError.message}>
              エラー: {balanceError.message}
            </span>
          ) : (
            `${formattedBalance.toLocaleString('ja-JP', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 6,
            })} JPYC`
          )}
        </p>
        <p className="text-sm">
          <strong>総供給量:</strong>{' '}
          {isTotalSupplyLoading ? (
            <span className="text-gray-500">読み込み中...</span>
          ) : (
            `${formattedTotalSupply.toLocaleString('ja-JP', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 6,
            })} JPYC`
          )}
        </p>
        <p className="text-sm">
          <strong>ネットワーク:</strong> {chain?.name || 'Unknown'}
        </p>
      </div>
    </div>
  );
}
