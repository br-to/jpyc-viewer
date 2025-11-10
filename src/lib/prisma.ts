import { PrismaClient } from '@prisma/client';

/**
 * Prismaクライアントのシングルトンインスタンス
 *
 * 開発環境でのホットリロード時に複数のインスタンスが作成されるのを防ぐため、
 * globalオブジェクトにキャッシュする
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * BigInt型をJSON.stringifyで扱えるようにする
 * PostgreSQLのBigInt型がJSON化できない問題を解決
 */
// @ts-expect-error - BigIntのプロトタイプ拡張
BigInt.prototype.toJSON = function () {
  return this.toString();
};
