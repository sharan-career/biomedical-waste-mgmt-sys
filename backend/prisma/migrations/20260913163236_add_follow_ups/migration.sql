-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('PHONE_CALL', 'WHATSAPP', 'EMAIL', 'VISIT', 'OTHER');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('OPEN', 'FOLLOW_UP_REQUIRED', 'PROMISE_TO_PAY', 'DISPUTED', 'ESCALATED', 'CLOSED');

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "assignedToId" TEXT NOT NULL,
    "previousAssignedToId" TEXT,
    "followUpDate" TIMESTAMP(3) NOT NULL,
    "followUpType" "FollowUpType" NOT NULL,
    "contactPerson" TEXT,
    "discussionNotes" TEXT,
    "customerResponse" TEXT,
    "promiseAmount" DECIMAL(14,2),
    "promisePaymentDate" TIMESTAMP(3),
    "nextFollowUpDate" TIMESTAMP(3),
    "status" "FollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "previousFollowUpId" TEXT,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "follow_ups_previousFollowUpId_key" ON "follow_ups"("previousFollowUpId");

-- CreateIndex
CREATE INDEX "follow_ups_assignedToId_status_nextFollowUpDate_idx" ON "follow_ups"("assignedToId", "status", "nextFollowUpDate");

-- CreateIndex
CREATE INDEX "follow_ups_customerId_idx" ON "follow_ups"("customerId");

-- CreateIndex
CREATE INDEX "follow_ups_invoiceId_idx" ON "follow_ups"("invoiceId");

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_previousFollowUpId_fkey" FOREIGN KEY ("previousFollowUpId") REFERENCES "follow_ups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
