'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

/**
 * サブスクリプション一覧画面
 *
 * 機能:
 * - ウォレット接続済みユーザーのサブスク一覧を表示
 * - ステータス別の色分け（active/cancelled/expired/failed）
 * - 詳細ページへのリンク
 */

interface Subscription {
  id: string;
  planName: string;
  amount: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'failed';
  startDate: string;
  nextBillingDate: string | null;
  endDate: string | null;
  totalMonths: number;
  currentCycle: number;
}

export default function SubscriptionsPage() {
  const { address, isConnected } = useAccount();

  // サブスク一覧を取得
  const { data, isLoading, error } = useQuery({
    queryKey: ['subscriptions', address],
    queryFn: async () => {
      if (!address) return { subscriptions: [] };

      const response = await fetch(
        `/api/subscriptions?customerAddress=${address}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }

      return response.json();
    },
    enabled: !!address, // ウォレット接続済みの場合のみ実行
  });

  const subscriptions: Subscription[] = data?.subscriptions || [];

  // ステータスの表示用テキスト
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '有効';
      case 'paused':
        return '一時停止';
      case 'cancelled':
        return 'キャンセル済み';
      case 'expired':
        return '期限切れ';
      case 'failed':
        return '失敗';
      default:
        return status;
    }
  };

  // ステータスの色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">サブスク一覧</h1>
          <div className="flex gap-4">
            <Link
              href="/subscription"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              新規申込
            </Link>
            <ConnectButton />
          </div>
        </div>

        {/* ウォレット未接続 */}
        {!isConnected && (
          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
            <p className="mb-4">
              サブスクリプションを確認するにはウォレットを接続してください
            </p>
            <ConnectButton />
          </div>
        )}

        {/* ローディング中 */}
        {isConnected && isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        )}

        {/* エラー */}
        {isConnected && error && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">
              エラーが発生しました: {(error as Error).message}
            </p>
          </div>
        )}

        {/* サブスク一覧 */}
        {isConnected && !isLoading && !error && (
          <>
            {subscriptions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">
                  サブスクリプションがありません
                </p>
                <Link
                  href="/subscription"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
                >
                  新規申込
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {subscriptions.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/subscriptions/${sub.id}`}
                    className="block p-6 bg-white border rounded-lg hover:shadow-lg transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-xl font-semibold mb-1">
                          {sub.planName}
                        </h2>
                        <p className="text-gray-600">
                          {Number(sub.amount).toLocaleString()} JPYC / 月
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(sub.status)}`}
                      >
                        {getStatusText(sub.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">契約期間</p>
                        <p className="font-semibold">
                          {sub.totalMonths}ヶ月（{sub.currentCycle}/
                          {sub.totalMonths}）
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">開始日</p>
                        <p className="font-semibold">
                          {new Date(sub.startDate).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      {sub.nextBillingDate && (
                        <div>
                          <p className="text-gray-500">次回決済日</p>
                          <p className="font-semibold">
                            {new Date(sub.nextBillingDate).toLocaleDateString(
                              'ja-JP'
                            )}
                          </p>
                        </div>
                      )}
                      {sub.endDate && (
                        <div>
                          <p className="text-gray-500">終了日</p>
                          <p className="font-semibold">
                            {new Date(sub.endDate).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
