'use client';

import { useAccount, useSignTypedData } from 'wagmi';
import { useMutation } from '@tanstack/react-query';
import type { Hex } from 'viem';

/**
 * EIP-3009 transferWithAuthorization の署名を生成するカスタムフック
 *
 * このフックの役割:
 * 1. バックエンドから受け取ったnonceを使用（自分では生成しない）
 * 2. EIP-712署名を生成
 * 3. 署名パラメータ（v, r, s）を返す
 *
 * なぜフロントでnonce生成しないのか:
 * - セキュリティ: バックエンドがnonceの一意性を保証
 * - リプレイ攻撃防止: 同じorderIdで複数回署名できないようにする
 */

interface SignTransferAuthorizationParams {
  nonce: Hex; // バックエンドから受け取ったnonce
  to: string; // 送金先アドレス
  value: bigint; // 送金額（wei単位）
  validAfter?: number; // 有効期間の開始（Unix timestamp）
  validBefore?: number; // 有効期間の終了（Unix timestamp）
}

interface SignTransferAuthorizationResult {
  v: number; // ECDSA署名のv
  r: Hex; // ECDSA署名のr
  s: Hex; // ECDSA署名のs
  validAfter: number;
  validBefore: number;
}

export function useSignTransferAuthorization() {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const mutation = useMutation({
    mutationFn: async ({
      nonce,
      to,
      value,
      validAfter,
      validBefore,
    }: SignTransferAuthorizationParams): Promise<SignTransferAuthorizationResult> => {
      if (!address) {
        throw new Error('Wallet not connected');
      }
      if (!chainId) {
        throw new Error('Chain ID not found');
      }

      // 1. 有効期間のデフォルト値を設定
      // validAfter: 現在時刻 - 60秒（時刻のズレを考慮）
      // validBefore: 現在時刻 + 1時間（1時間後に無効）
      const now = Math.floor(Date.now() / 1000);
      const _validAfter = validAfter ?? now - 60; // 60秒前から有効
      const _validBefore = validBefore ?? now + 3600; // 1時間後まで有効

      // 2. JPYCコントラクトアドレス（Sepolia）
      const jpycAddress = '0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB';

      // 3. EIP-712のTypedDataを構築
      // これはJPYCコントラクトが要求する署名フォーマット
      // 注意: versionは '1' を使用（JPYCコントラクトの仕様）
      const domain = {
        name: 'JPY Coin',
        version: '1',
        chainId,
        verifyingContract: jpycAddress as Hex,
      };

      const types = {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      };

      const message = {
        from: address,
        to: to as Hex,
        value,
        validAfter: BigInt(_validAfter),
        validBefore: BigInt(_validBefore),
        nonce,
      };

      // 3. ユーザーに署名してもらう
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'TransferWithAuthorization',
        message,
      });

      // 4. 署名を分解（v, r, s）
      // 署名は65バイト: r(32) + s(32) + v(1)
      const r = signature.slice(0, 66) as Hex;
      const s = `0x${signature.slice(66, 130)}` as Hex;
      const v = Number(`0x${signature.slice(130, 132)}`);

      return {
        v,
        r,
        s,
        validAfter: _validAfter,
        validBefore: _validBefore,
      };
    },
  });

  return {
    signTransferAuthorization: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
