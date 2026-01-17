/*
  Warnings:

  - Made the column `customerId` on table `Estimate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Estimate` required. This step will fail if there are existing NULL values in that column.
  - Made the column `amount` on table `Expense` required. This step will fail if there are existing NULL values in that column.
  - Made the column `category` on table `Expense` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `Expense` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `Expense` required. This step will fail if there are existing NULL values in that column.
  - Made the column `expenseDate` on table `Expense` required. This step will fail if there are existing NULL values in that column.
  - Made the column `updatedAt` on table `Expense` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Expense` required. This step will fail if there are existing NULL values in that column.
  - Made the column `amountPaid` on table `Invoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `customerId` on table `Invoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `subTotal` on table `Invoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `taxAmount` on table `Invoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Invoice` required. This step will fail if there are existing NULL values in that column.
  - Made the column `isDefault` on table `Tax` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `Tax` required. This step will fail if there are existing NULL values in that column.
  - Made the column `rate` on table `Tax` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Estimate" ALTER COLUMN "status" SET DEFAULT 'SENT',
ALTER COLUMN "customerId" SET NOT NULL,
ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "amount" SET NOT NULL,
ALTER COLUMN "amount" DROP DEFAULT,
ALTER COLUMN "category" SET NOT NULL,
ALTER COLUMN "category" DROP DEFAULT,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "description" DROP DEFAULT,
ALTER COLUMN "expenseDate" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT',
ALTER COLUMN "amountPaid" SET NOT NULL,
ALTER COLUMN "customerId" SET NOT NULL,
ALTER COLUMN "subTotal" SET NOT NULL,
ALTER COLUMN "taxAmount" SET NOT NULL,
ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Tax" ALTER COLUMN "isDefault" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "name" DROP DEFAULT,
ALTER COLUMN "rate" SET NOT NULL,
ALTER COLUMN "rate" DROP DEFAULT;
