'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { JPYCInfo } from '../components/JPYCInfo';

export default function Home() {
  const { address, isConnected } = useAccount();

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="flex flex-col items-center gap-8">
          <h1 className="text-4xl font-bold text-center">JPYC Viewer</h1>
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 max-w-md">
            <p>Sepoliaテストネットワーク上のJPYCトークン情報を表示します</p>
            <p className="mt-2">💡 テスト用JPYCの残高と情報を確認できます</p>
          </div>
          <ConnectButton />

          {isConnected && (
            <div className="space-y-6">
              <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg max-w-md">
                <h2 className="text-xl font-semibold mb-4">ウォレット情報</h2>
                <div className="space-y-2">
                  <p className="text-sm break-all">
                    <strong>アドレス:</strong> {address}
                  </p>
                </div>
              </div>
              <JPYCInfo />
            </div>
          )}
        </div>

        {!isConnected && (
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p>ウォレットを接続してJPYC情報を表示してください</p>
          </div>
        )}
      </main>
    </div>
  );
}
