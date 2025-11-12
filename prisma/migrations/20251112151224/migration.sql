/*
  Warnings:

  - You are about to drop the column `nonce` on the `SubscriptionPayment` table. All the data in the column will be lost.
  - You are about to drop the column `signatureR` on the `SubscriptionPayment` table. All the data in the column will be lost.
  - You are about to drop the column `signatureS` on the `SubscriptionPayment` table. All the data in the column will be lost.
  - You are about to drop the column `signatureV` on the `SubscriptionPayment` table. All the data in the column will be lost.
  - You are about to drop the column `validAfter` on the `SubscriptionPayment` table. All the data in the column will be lost.
  - You are about to drop the column `validBefore` on the `SubscriptionPayment` table. All the data in the column will be lost.
  - Added the required column `permitDeadline` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `permitR` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `permitS` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `permitV` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "SubscriptionPayment_nonce_idx";

-- DropIndex
DROP INDEX "SubscriptionPayment_nonce_key";

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "permitDeadline" BIGINT NOT NULL,
ADD COLUMN     "permitExecuted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permitR" TEXT NOT NULL,
ADD COLUMN     "permitS" TEXT NOT NULL,
ADD COLUMN     "permitV" INTEGER NOT NULL,
ADD COLUMN     "totalAmount" DECIMAL(65,30) NOT NULL;

-- AlterTable
ALTER TABLE "SubscriptionPayment" DROP COLUMN "nonce",
DROP COLUMN "signatureR",
DROP COLUMN "signatureS",
DROP COLUMN "signatureV",
DROP COLUMN "validAfter",
DROP COLUMN "validBefore";
