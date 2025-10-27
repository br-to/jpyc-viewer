'use client';

import { useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, type Hex } from 'viem';
import { useMutation } from '@tanstack/react-query';
import { useSignTransferAuthorization } from './useSignTransferAuthorization';

/**
 * JPYC決済の全フローを管理するカスタムフック
 *
 * フロー:
 * 1. バックエンドに注文作成リクエスト → orderIdとnonceを取得
 * 2. nonceを使ってEIP-712署名を生成
 * 3. 署名をバックエンドに送信 → バックエンドがtransferWithAuthorizationを実行
 * 4. トランザクション完了を待つ
 */

interface OrderSummary {
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}

interface CreateOrderResponse {
  paymentId: string;
  nonce: Hex;
  merchantAddress: string;
  total: number;
  orderId?: string;
}

interface AuthorizePaymentResponse {
  success: boolean;
  paymentId: string;
  txHash: string;
  message: string;
}

export function useJPYCPayment() {
  const { address } = useAccount();
  const { signTransferAuthorization, isLoading: isSigning } =
    useSignTransferAuthorization();

  /**
   * ステップ1: バックエンドに注文を作成
   */
  const createOrder = async (
    orderSummary: OrderSummary
  ): Promise<CreateOrderResponse> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: orderSummary.items,
        total: orderSummary.total,
        customerAddress: address,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to create order');
    }

    const data: CreateOrderResponse = await response.json();

    return data;
  };

  /**
   * ステップ2: EIP-712署名を生成
   *
   * この関数が行うこと:
   * - バックエンドから受け取ったnonceを使用
   * - EIP-712のTypedDataで署名
   * - 署名パラメータ（v, r, s）を取得
   */
  const generateSignature = async (nonce: Hex, to: string, value: bigint) => {
    const signature = await signTransferAuthorization({
      nonce,
      to,
      value,
    });

    return signature;
  };

  /**
   * ステップ3: 署名をバックエンドに送信し、決済を実行
   *
   * この関数が行うこと:
   * - 署名パラメータをバックエンドに送信
   * - バックエンドがtransferWithAuthorizationを実行
   * - トランザクションハッシュを受け取る
   */
  const authorizePayment = async (
    paymentId: string,
    nonce: Hex,
    to: string,
    value: bigint,
    signature: {
      v: number;
      r: Hex;
      s: Hex;
      validAfter: number;
      validBefore: number;
    }
  ): Promise<AuthorizePaymentResponse> => {
    if (!address) {
      throw new Error('Wallet not connected');
    }

    const response = await fetch(`/api/orders/${paymentId}/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: address,
        to,
        value: value.toString(),
        validAfter: signature.validAfter,
        validBefore: signature.validBefore,
        nonce,
        v: signature.v,
        r: signature.r,
        s: signature.s,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to authorize payment');
    }

    const data: AuthorizePaymentResponse = await response.json();

    return data;
  };

  /**
   * メイン関数: JPYC決済の全フローを実行
   */
  const mutation = useMutation({
    mutationFn: async (orderSummary: OrderSummary) => {
      // Step 1: 注文作成
      const order = await createOrder(orderSummary);

      // Step 2: 署名生成
      const value = parseUnits(order.total.toString(), 18);
      const signature = await generateSignature(
        order.nonce,
        order.merchantAddress,
        value
      );

      // Step 3: 決済実行
      const result = await authorizePayment(
        order.paymentId,
        order.nonce,
        order.merchantAddress,
        value,
        signature
      );

      return {
        paymentId: result.paymentId,
        txHash: result.txHash as Hex,
      };
    },
  });

  // Step 4: トランザクション完了を監視
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: mutation.data?.txHash,
    });

  return {
    executePayment: mutation.mutate,
    executePaymentAsync: mutation.mutateAsync,
    isLoading: mutation.isPending || isSigning,
    isConfirming, // トランザクション承認待ち
    isSuccess: isConfirmed, // トランザクション完了
    error: mutation.error,
    txHash: mutation.data?.txHash ?? null,
    reset: mutation.reset,
  };
}
