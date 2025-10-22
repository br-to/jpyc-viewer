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
          <JpycSdkProvider
            env="prod"
            contractType="jpycPrepaid"
            // SDKがJPYC_PREPAID_PROXY_ADDRESSを自動選択するため、undefinedを指定
            localContractAddress={undefined}
          >
            {children}
          </JpycSdkProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
