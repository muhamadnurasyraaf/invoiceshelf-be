-- CreateEnum: PaymentStatus
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE');

-- Add paymentStatus column to Invoice with default UNPAID
ALTER TABLE "Invoice" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- Migrate existing data: Set paymentStatus based on current status
UPDATE "Invoice" SET "paymentStatus" = 'PAID' WHERE "status" = 'PAID';
UPDATE "Invoice" SET "paymentStatus" = 'OVERDUE' WHERE "status" = 'OVERDUE';
UPDATE "Invoice" SET "paymentStatus" = 'UNPAID' WHERE "status" = 'UNPAID';

-- Update status to COMPLETED for PAID invoices (workflow complete)
UPDATE "Invoice" SET "status" = 'SENT' WHERE "status" = 'PAID';
UPDATE "Invoice" SET "status" = 'SENT' WHERE "status" = 'UNPAID';
UPDATE "Invoice" SET "status" = 'SENT' WHERE "status" = 'OVERDUE';

-- Now alter the InvoiceStatus enum to remove old values and add COMPLETED
-- First, create a new enum with the desired values
CREATE TYPE "InvoiceStatus_new" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'COMPLETED', 'REJECTED');

-- Update the column to use the new enum
ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus_new" USING ("status"::text::"InvoiceStatus_new");

-- Drop the old enum and rename the new one
DROP TYPE "InvoiceStatus";
ALTER TYPE "InvoiceStatus_new" RENAME TO "InvoiceStatus";
