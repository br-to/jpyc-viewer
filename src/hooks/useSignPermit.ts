'use client';

import { useAccount, useSignTypedData } from 'wagmi';
import { useMutation } from '@tanstack/react-query';
import type { Hex, Address } from 'viem';
import { useNonces } from '@jpyc/sdk-react';

/**
 * EIP-2612 Permit の署名を生成するカスタムフック
 *
 * このフックの役割:
 * 1. JPYC SDKのuseNoncesでユーザーのnonceを取得
 * 2. EIP-712 Permit署名を生成
 * 3. 署名パラメータ（v, r, s, deadline）を返す
 *
 * Permitの利点:
 * - ユーザーは1回の署名だけで複数月分の承認が可能
 * - approve()の代わりに署名で済むのでガス代が不要
 */

interface SignPermitParams {
  spender: Address; // 承認先アドレス（加盟店）
  value: bigint; // 承認額（wei単位）
  deadline: bigint; // 有効期限（Unix timestamp）
}

interface SignPermitResult {
  deadline: bigint;
  v: number; // ECDSA署名のv
  r: Hex; // ECDSA署名のr
  s: Hex; // ECDSA署名のs
}

export function useSignPermit() {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  // JPYCコントラクトアドレス（JPYC Prepaid on Sepolia）
  const jpycAddress = '0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB' as const;

  // JPYC SDKのuseNoncesを使用してユーザーの現在のnonceを取得
  const {
    data: nonce,
    refetch: refetchNonce,
    isPending: isNonceLoading,
  } = useNonces({
    owner: address as `0x${string}`,
    skip: !address,
  });

  const mutation = useMutation({
    mutationFn: async ({
      spender,
      value,
      deadline,
    }: SignPermitParams): Promise<SignPermitResult> => {
      if (!address) {
        throw new Error('Wallet not connected');
      }
      if (!chainId) {
        throw new Error('Chain ID not found');
      }

      // nonceを再取得（最新の値を使用）
      const { data: currentNonce } = await refetchNonce();
      if (currentNonce === undefined) {
        throw new Error('Failed to get nonce');
      }

      // EIP-2612のTypedDataを構築
      const domain = {
        name: 'JPY Coin',
        version: '1', // JPYCのversionは'1'
        chainId,
        verifyingContract: jpycAddress,
      };

      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      };

      const message = {
        owner: address,
        spender,
        value,
        nonce: currentNonce,
        deadline,
      };

      // ユーザーに署名してもらう
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'Permit',
        message,
      });

      // 署名を分解（v, r, s）
      const r = signature.slice(0, 66) as Hex;
      const s = `0x${signature.slice(66, 130)}` as Hex;
      const v = Number(`0x${signature.slice(130, 132)}`);

      return {
        deadline,
        v,
        r,
        s,
      };
    },
  });

  return {
    signPermit: mutation.mutateAsync,
    isLoading: mutation.isPending || isNonceLoading,
    error: mutation.error,
    reset: mutation.reset,
    nonce,
  };
}
