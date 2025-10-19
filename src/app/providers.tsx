'use client';

import { WagmiProvider } from 'wagmi';
import { JpycSdkProvider } from '@jpyc/sdk-react';
import { sepolia } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();
const JPYC_ADDRESS = process.env
  .NEXT_PUBLIC_JPYC_CONTRACT_ADDRESS as `0x${string}`;

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
            env="local"
            contractType="jpyc"
            localContractAddress={JPYC_ADDRESS}
          >
            {children}
          </JpycSdkProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
