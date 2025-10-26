/*
  Warnings:

  - You are about to drop the column `code` on the `Language` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Language_code_key";

-- AlterTable
ALTER TABLE "Language" DROP COLUMN "code";
