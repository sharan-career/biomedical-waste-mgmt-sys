-- CreateEnum
CREATE TYPE "ReminderTriggerType" AS ENUM ('DAYS_BEFORE_DUE', 'ON_DUE_DATE', 'DAYS_AFTER_DUE');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ReminderDeliveryStatus" AS ENUM ('SENT', 'FAILED', 'DELIVERED', 'READ');

-- CreateTable
CREATE TABLE "reminder_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" "ReminderTriggerType" NOT NULL,
    "triggerOffsetDays" INTEGER NOT NULL DEFAULT 0,
    "channel" "ReminderChannel" NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "reminder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_logs" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveryStatus" "ReminderDeliveryStatus" NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "responseText" TEXT,
    "responseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_logs_deliveryStatus_idx" ON "reminder_logs"("deliveryStatus");

-- CreateIndex
CREATE INDEX "reminder_logs_customerId_idx" ON "reminder_logs"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_logs_ruleId_invoiceId_key" ON "reminder_logs"("ruleId", "invoiceId");

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "reminder_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
