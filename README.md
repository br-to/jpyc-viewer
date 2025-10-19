# JPYC Viewer

SepoliaテストネットワークでJPYCトークンの残高と情報を表示するWeb3アプリケーションです。wagmi、RainbowKit、JPYC React SDKを使用してウォレット接続とトークン情報の取得を行います。

## 🚀 主な機能

- **ウォレット接続**: RainbowKitによる直感的なウォレット接続UI
- **JPYC残高表示**: 接続されたウォレットのJPYC残高をリアルタイム表示
- **トークン情報**: JPYCの総供給量、コントラクトアドレス、ネットワーク情報
- **JPYC SDK統合**: 公式JPYC React SDKのhooksを使用（decimals補正機能付き）
- **レスポンシブデザイン**: モバイル・デスクトップ対応のモダンUI

## 🌐 サポートネットワーク

- **Sepolia Testnet のみ**: テスト用JPYCトークンの表示に特化

## 🛠 技術スタック

- **Next.js**: React フレームワーク
- **wagmi**: Ethereum React hooks
- **RainbowKit**: ウォレット接続UI
- **JPYC React SDK**: 公式JPYC hooks（ローカルビルド版）
- **viem**: 低レベルEthereumユーティリティ
- **TypeScript**: 型安全性
- **Biome**: Linter/Formatter
- **Tailwind CSS**: スタイリング

## 📋 前提条件

- Node.js 18.x 以上
- SepoliaテストネットワークでJPYCトークンを保有するウォレット
- WalletConnectプロジェクトID

## ⚙️ セットアップ

### 1. リポジトリのクローン

```bash
git clone --recurse-submodules https://github.com/br-to/jpyc-viewer.git
cd jpyc-viewer
```

**既にクローン済みの場合:**
```bash
git submodule update --init --recursive
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. JPYC SDK のセットアップ

JPYC SDKはgit submoduleとして管理されています：

```bash
# submoduleの初期化（クローン時に--recurse-submodulesを使わなかった場合）
git submodule update --init --recursive

# JPYC SDKのビルド
cd external/jpyc-sdk/packages/react
npm install
npm run compile
cd ../../../../
```

**submoduleの更新:**
```bash
git submodule update --remote
```

### 4. 環境変数の設定

`.env.local` ファイルを作成し、以下を設定：

```env
# WalletConnect プロジェクトID （必須）
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# JPYC コントラクトアドレス（Sepolia）
NEXT_PUBLIC_JPYC_CONTRACT_ADDRESS=0xd3eF95d29A198868241FE374A999fc25F6152253
```

**WalletConnectプロジェクトIDの取得方法:**
1. [WalletConnect Cloud](https://cloud.walletconnect.com)にアクセス
2. アカウント作成・ログイン
3. 新しいプロジェクトを作成
4. プロジェクトIDをコピー

### 5. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) でアプリケーションが起動します。

## 🎯 使用方法

1. **ウォレット接続**: 「Connect Wallet」ボタンからウォレットを接続
2. **ネットワーク確認**: Sepoliaテストネットに接続されていることを確認
3. **残高確認**: JPYCトークンの残高と詳細情報が自動で表示されます

## 🔧 技術的な注意点

### JPYC SDK の Decimals 問題

JPYC React SDKはdecimals=18を前提としていますが、実際のJPYCトークン（Sepolia）はdecimals=6です。このアプリケーションでは以下の方法で解決しています：

```typescript
// SDKの結果を12乗（18-6=12）で補正
const correctedBalance = Number(balance.data) * Math.pow(10, 12);
```

### コントラクトアドレス

- **デフォルトSDKアドレス**: `0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB` (JPYC Prepaid, decimals=18)
- **実際のJPYCアドレス**: `0xd3eF95d29A198868241FE374A999fc25F6152253` (JPYC, decimals=6)

## 📁 プロジェクト構造

```
jpyc-viewer/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx       # ルートレイアウト
│   │   ├── page.tsx         # ホームページ
│   │   └── providers.tsx    # Providerラップ
│   ├── components/
│   │   └── JPYCInfo.tsx     # JPYC情報表示コンポーネント
│   └── lib/
│       └── config.ts        # wagmi設定
├── external/
│   └── jpyc-sdk/           # JPYC SDK（git submodule）
├── .env.local              # 環境変数
├── .gitmodules             # submodule設定
└── package.json
```

## 🚦 利用可能なスクリプト

```bash
npm run dev          # 開発サーバー起動
npm run build        # プロダクションビルド
npm run start        # プロダクションサーバー起動
npm run lint         # Biome Lint実行
npm run format       # Prettierでフォーマット
```

## 🐛 よくある問題

### submoduleが空になっている
```bash
git submodule update --init --recursive
```

### submoduleの更新ができない
```bash
git submodule foreach git pull origin develop
```

### 残高が0として表示される
- ウォレットがSepoliaネットワークに接続されているか確認
- 正しいJPYCコントラクトアドレスが設定されているか確認
- JPYCトークンがウォレットに実際に存在するか確認

### ウォレット接続できない
- WalletConnectプロジェクトIDが正しく設定されているか確認
- ウォレットアプリが最新版か確認
