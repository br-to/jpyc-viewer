'use client';

import { useBalanceOfConnectedAccount, useTotalSupply } from '@jpyc/sdk-react';
import { useAccount } from 'wagmi';

export function JPYCInfo() {
  const { isConnected, chain } = useAccount();

  // JPYC SDK hooks
  const balance = useBalanceOfConnectedAccount({
    skip: false,
  });
  const totalSupply = useTotalSupply({ skip: false });

  if (!isConnected) {
    return null;
  }
  // SDKの結果を12乗で補正
  const correctedBalance = balance?.data
    ? (Number(balance.data) * 10 ** 12).toString()
    : '0';

  const formattedTotalSupply = totalSupply?.data
    ? (Number(totalSupply.data) * 10 ** 12).toString()
    : '0';
  const isBalanceLoading = !balance || balance?.isPending || false;
  const isTotalSupplyLoading = totalSupply?.isPending || false;

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
          ) : balance?.error ? (
            <span className="text-red-500" title={balance.error.message}>
              エラー: {balance.error.message}
            </span>
          ) : (
            `${correctedBalance} JPYC`
          )}
        </p>
        <p className="text-sm">
          <strong>総供給量:</strong>{' '}
          {isTotalSupplyLoading ? (
            <span className="text-gray-500">読み込み中...</span>
          ) : (
            `${formattedTotalSupply} JPYC`
          )}
        </p>
        <p className="text-sm">
          <strong>ネットワーク:</strong> {chain?.name || 'Unknown'}
        </p>
      </div>
    </div>
  );
}
