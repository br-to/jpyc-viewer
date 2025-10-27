# JPYC Viewer

SepoliaテストネットワークでJPYCトークンの残高表示と**EIP-3009決済デモ**を提供するWeb3アプリケーションです。wagmi、RainbowKit、JPYC SDKを使用してウォレット接続、トークン情報の取得、ガスレス決済を実現します。

## 🚀 主な機能

- **ウォレット接続**: RainbowKitによる直感的なウォレット接続UI
- **JPYC残高表示**: 接続されたウォレットのJPYC残高をリアルタイム表示
- **EIP-3009決済デモ**: バックエンドリレイヤーによるガスレス決済（ユーザーは署名のみ）
- **トークン情報**: JPYCの総供給量、コントラクトアドレス、ネットワーク情報
- **JPYC SDK統合**: 公式JPYC Core SDK（バックエンド）とReact SDK（フロントエンド）
- **レスポンシブデザイン**: モバイル・デスクトップ対応のモダンUI

## 🌐 サポートネットワーク

- **Sepolia Testnet のみ**: テスト用JPYCトークンの表示・決済に特化

## 🛠 技術スタック

### フロントエンド
- **Next.js 15**: React フレームワーク（App Router）
- **wagmi v2**: Ethereum React hooks
- **RainbowKit**: ウォレット接続UI
- **JPYC React SDK**: 公式JPYC hooks（ローカルビルド版）
- **TanStack Query**: 非同期状態管理
- **viem**: 低レベルEthereumユーティリティ
- **TypeScript**: 型安全性
- **Biome**: Linter/Formatter
- **Tailwind CSS v4**: スタイリング

### バックエンド
- **Next.js API Routes**: サーバーレスAPI
- **JPYC Core SDK**: transferWithAuthorization実装
- **viem**: トランザクション送信
- **soltypes**: Solidity型サポート

## � EIP-3009決済の仕組み

このアプリケーションは、EIP-3009の`transferWithAuthorization`パターンを実装しています：

1. **署名生成（フロントエンド）**: ユーザーがEIP-712署名を生成（ガス代不要）
2. **トランザクション実行（バックエンド）**: リレイヤーが署名を使ってトランザクションを送信
3. **ガス代負担**: バックエンドウォレットがガス代を支払う
4. **トランザクション完了待機**: フロントエンドでトランザクション完了を監視

詳細: [docs/gas-fee-flow.md](docs/gas-fee-flow.md)

## �📋 前提条件

- Node.js 20.x 以上
- pnpm 8.x 以上
- SepoliaテストネットワークでJPYCトークンを保有するウォレット
- **バックエンドウォレット**: Sepolia ETH（ガス代用）を保有する秘密鍵

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
pnpm install
```

### 3. JPYC SDK のセットアップ

JPYC SDKはgit submoduleとして管理されています：

```bash
# submoduleの初期化（クローン時に--recurse-submodulesを使わなかった場合）
git submodule update --init --recursive

# JPYC SDKのビルドと依存関係のインストール
pnpm --filter @jpyc/sdk-react compile && pnpm install
```

**submoduleの更新:**
```bash
git submodule update --remote
```

### 4. 環境変数の設定

`.env.local` ファイルを作成し、以下を設定：

```env
# WalletConnect プロジェクトID （任意）
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# 決済機能用（必須）
# バックエンドウォレットの秘密鍵（Sepolia ETHを保有している必要があります）
BACKEND_PRIVATE_KEY=0x...

# マーチャントウォレットアドレス（JPYCの送金先）
MERCHANT_WALLET_ADDRESS=0x...
```

**⚠️ セキュリティ注意事項:**
- `BACKEND_PRIVATE_KEY`は絶対にGitにコミットしないでください
- 本番環境では環境変数管理サービス（Vercel Secrets等）を使用してください
- テスト用ウォレットのみを使用してください

### 5. 開発サーバーの起動

```bash
pnpm dev
```

[http://localhost:3000](http://localhost:3000) でアプリケーションが起動します.

## 🎯 使用方法

### 残高確認
1. **ウォレット接続**: 「Connect Wallet」ボタンからウォレットを接続
2. **ネットワーク確認**: Sepoliaテストネットに接続されていることを確認
3. **残高確認**: JPYCトークンの残高と詳細情報が自動で表示されます

### 決済デモ
1. **支払いページ**: トップページから「お支払いへ進む」をクリック
2. **支払い方法選択**: JPYC決済を選択
3. **署名**: MetaMaskで署名を承認（ガス代不要）
4. **トランザクション処理**: バックエンドがトランザクションを送信
5. **完了待機**: トランザクション完了を自動監視
6. **成功画面**: トランザクション完了後、自動で成功画面に遷移

## 🚦 利用可能なスクリプト

```bash
pnpm dev             # 開発サーバー起動
pnpm build           # プロダクションビルド
pnpm start           # プロダクションサーバー起動
pnpm lint            # Biome Lint実行
pnpm format          # Biome Format実行
```

##  よくある問題

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

### 決済が失敗する
- `BACKEND_PRIVATE_KEY`が設定されているか確認
- バックエンドウォレットにSepolia ETHがあるか確認
- ユーザーウォレットにJPYC残高があるか確認
- 署名のvalidAfter/validBeforeが正しいか確認

### トランザクションが承認されない
- Sepoliaネットワークの混雑状況を確認
- ブロックエクスプローラーでトランザクションステータスを確認

### ウォレット接続できない
- ウォレットアプリが最新版か確認
- ブラウザの拡張機能が有効か確認

## 📚 参考資料

- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [EIP-712: Typed structured data hashing and signing](https://eips.ethereum.org/EIPS/eip-712)
- [JPYC SDK Documentation](https://github.com/jcam1/sdks)
- [wagmi Documentation](https://wagmi.sh/)
- [viem Documentation](https://viem.sh/)
