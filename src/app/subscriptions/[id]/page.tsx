'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * サブスクリプション詳細画面
 *
 * 機能:
 * - サブスク情報の表示（プラン名、金額、期間）
 * - 各月の決済履歴（pending/processing/completed/failed）
 * - キャンセルボタン（確認ダイアログ付き）
 */

interface SubscriptionPayment {
  id: string;
  cycleNumber: number;
  amount: string;
  scheduledDate: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  txHash: string | null;
  executedAt: string | null;
  errorMessage: string | null;
}

interface SubscriptionDetail {
  id: string;
  customerAddress: string;
  merchantAddress: string;
  planName: string;
  amount: string;
  billingCycle: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'failed';
  startDate: string;
  nextBillingDate: string | null;
  endDate: string | null;
  totalMonths: number;
  currentCycle: number;
  payments: SubscriptionPayment[];
}

export default function SubscriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const subscriptionId = params.id as string;

  // サブスク詳細を取得
  const { data, isLoading, error } = useQuery({
    queryKey: ['subscription', subscriptionId],
    queryFn: async () => {
      const response = await fetch(`/api/subscriptions/${subscriptionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      return response.json();
    },
  });

  // キャンセル処理
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }
      return response.json();
    },
    onSuccess: () => {
      // キャッシュを更新
      queryClient.invalidateQueries({
        queryKey: ['subscription', subscriptionId],
      });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setShowCancelDialog(false);
      alert('サブスクリプションをキャンセルしました');
    },
    onError: (error) => {
      setShowCancelDialog(false);
      const message = (error as Error).message;
      if (message.includes('already cancelled or expired')) {
        alert('このサブスクリプションは既にキャンセル済み、または期限切れです');
      } else {
        alert(`エラー: ${message}`);
      }
    },
  });

  const subscription: SubscriptionDetail | undefined = data?.subscription;

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
      case 'pending':
        return '決済待ち';
      case 'processing':
        return '処理中';
      case 'completed':
        return '完了';
      default:
        return status;
    }
  };

  // 決済ステータスの色
  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubscriptionStatusColor = (status: string) => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-center py-12 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 mb-4">
              エラーが発生しました:{' '}
              {error
                ? (error as Error).message
                : 'サブスクリプションが見つかりません'}
            </p>
            <Link
              href="/subscriptions"
              className="text-blue-600 hover:underline"
            >
              一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href="/subscriptions"
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            ← 一覧に戻る
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {subscription.planName}
              </h1>
              <p className="text-gray-600">
                {Number(subscription.amount).toLocaleString()} JPYC / 月
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${getSubscriptionStatusColor(subscription.status)}`}
            >
              {getStatusText(subscription.status)}
            </span>
          </div>
        </div>

        {/* サブスク情報 */}
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">契約情報</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">契約ID</p>
              <p className="font-mono text-sm">{subscription.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">契約期間</p>
              <p className="font-semibold">
                {subscription.totalMonths}ヶ月（{subscription.currentCycle}/
                {subscription.totalMonths}）
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">開始日</p>
              <p className="font-semibold">
                {new Date(subscription.startDate).toLocaleDateString('ja-JP')}
              </p>
            </div>
            {subscription.nextBillingDate && (
              <div>
                <p className="text-sm text-gray-500">次回決済日</p>
                <p className="font-semibold">
                  {new Date(subscription.nextBillingDate).toLocaleDateString(
                    'ja-JP'
                  )}
                </p>
              </div>
            )}
            {subscription.endDate && (
              <div>
                <p className="text-sm text-gray-500">終了日</p>
                <p className="font-semibold">
                  {new Date(subscription.endDate).toLocaleDateString('ja-JP')}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">顧客アドレス</p>
              <p className="font-mono text-xs">
                {subscription.customerAddress}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">販売店アドレス</p>
              <p className="font-mono text-xs">
                {subscription.merchantAddress}
              </p>
            </div>
          </div>
        </div>

        {/* 決済履歴 */}
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">決済履歴</h2>
          <div className="space-y-3">
            {subscription.payments.map((payment) => (
              <div
                key={payment.id}
                className="p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold">
                      第 {payment.cycleNumber} 回目の決済
                    </p>
                    <p className="text-sm text-gray-600">
                      予定日:{' '}
                      {new Date(payment.scheduledDate).toLocaleDateString(
                        'ja-JP'
                      )}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getPaymentStatusColor(payment.status)}`}
                  >
                    {getStatusText(payment.status)}
                  </span>
                </div>

                <div className="text-sm space-y-1">
                  <p className="text-gray-600">
                    金額: {Number(payment.amount).toLocaleString()} JPYC
                  </p>
                  {payment.executedAt && (
                    <p className="text-gray-600">
                      実行日時:{' '}
                      {new Date(payment.executedAt).toLocaleString('ja-JP')}
                    </p>
                  )}
                  {payment.txHash && (
                    <p className="text-gray-600">
                      TX Hash:{' '}
                      <a
                        href={`https://sepolia.etherscan.io/tx/${payment.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono text-xs"
                      >
                        {payment.txHash.slice(0, 10)}...
                        {payment.txHash.slice(-8)}
                      </a>
                    </p>
                  )}
                  {payment.errorMessage && (
                    <p className="text-red-600">
                      エラー: {payment.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* キャンセルボタン */}
        {subscription.status === 'active' && (
          <div className="text-center">
            <button
              onClick={() => setShowCancelDialog(true)}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
              type="button"
            >
              サブスクをキャンセル
            </button>
          </div>
        )}

        {/* キャンセル確認ダイアログ */}
        {showCancelDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold mb-4">キャンセル確認</h3>
              <p className="mb-6 text-gray-600">
                本当にこのサブスクリプションをキャンセルしますか？
                <br />
                未実行の決済はすべてキャンセルされます。
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  type="button"
                  disabled={cancelMutation.isPending}
                >
                  戻る
                </button>
                <button
                  onClick={() => cancelMutation.mutate()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                  type="button"
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending
                    ? 'キャンセル中...'
                    : 'キャンセルする'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
