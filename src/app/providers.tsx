'use client';

import { WagmiProvider } from 'wagmi';
import { JpycSdkProvider } from '@jpyc/sdk-react';
import { sepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

const config = getDefaultConfig({
  appName: 'JPYC Sample Viewer',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
  chains: [sepolia],
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {/* env="prod"の時SDKが自動的にJPYC_PREPAID_PROXY_ADDRESS (0x431D5dfF...)を選択 */}
          <JpycSdkProvider
            env="prod"
            contractType="jpycPrepaid"
            localContractAddress={undefined}
          >
            {children}
          </JpycSdkProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
