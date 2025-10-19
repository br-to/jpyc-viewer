# JPYC Viewer

JPYCトークンの情報を表示するWeb3アプリケーションです。wagmiとRainbowKitを使用してウォレット接続とブロックチェーン操作を行います。

## 機能

- ウォレット接続（RainbowKit）
- JPYC SDKを使用したトークン情報取得
- `balanceOf`、`totalSupply`などのJPYC専用メソッド
- Sepoliaテストネットワーク対応
- レスポンシブデザイン

## サポートネットワーク

- **Sepolia Testnet**: `0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB`

このアプリケーションはSepoliaテストネットワーク専用です。テスト環境でのJPYC開発・検証にご利用ください。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` ファイルを作成し、WalletConnectプロジェクトIDを設定します：

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

WalletConnectプロジェクトIDは[WalletConnect Cloud](https://cloud.walletconnect.com)で取得できます。

### 3. 開発サーバーの起動

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
