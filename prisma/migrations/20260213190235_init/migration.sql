-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('KANNADA', 'TAMIL', 'HINDI', 'ENGLISH');

-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('QUEUED', 'DIALING', 'RINGING', 'CONNECTED', 'ANALYZING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TranscriptSpeaker" AS ENUM ('AGENT', 'CONTACT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "Investigation" (
    "id" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'DRAFT',
    "concurrency" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recommendationSummary" TEXT,
    "bestCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "language" "PreferredLanguage" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'QUEUED',
    "livekitRoomName" TEXT,
    "livekitParticipant" TEXT,
    "livekitSipCallId" TEXT,
    "score" DOUBLE PRECISION,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptEvent" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "speaker" "TranscriptSpeaker" NOT NULL,
    "contactName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedFinding" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "monthlyPrice" INTEGER,
    "locationFit" TEXT,
    "availability" TEXT,
    "rules" JSONB,
    "confidence" DOUBLE PRECISION,
    "summary" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "reasoning" TEXT,
    "monthlyPrice" INTEGER,
    "availability" TEXT,
    "locationFit" TEXT,
    "isBest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" SERIAL NOT NULL,
    "investigationId" TEXT NOT NULL,
    "callId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Investigation_status_createdAt_idx" ON "Investigation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Contact_investigationId_idx" ON "Contact"("investigationId");

-- CreateIndex
CREATE INDEX "Call_investigationId_status_idx" ON "Call"("investigationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Call_investigationId_contactId_key" ON "Call"("investigationId", "contactId");

-- CreateIndex
CREATE INDEX "TranscriptEvent_callId_createdAt_idx" ON "TranscriptEvent"("callId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedFinding_callId_key" ON "ExtractedFinding"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_callId_key" ON "Recommendation"("callId");

-- CreateIndex
CREATE INDEX "Recommendation_investigationId_score_idx" ON "Recommendation"("investigationId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_investigationId_rank_key" ON "Recommendation"("investigationId", "rank");

-- CreateIndex
CREATE INDEX "ActionItem_investigationId_priority_idx" ON "ActionItem"("investigationId", "priority");

-- CreateIndex
CREATE INDEX "EventLog_investigationId_id_idx" ON "EventLog"("investigationId", "id");

-- CreateIndex
CREATE INDEX "EventLog_callId_id_idx" ON "EventLog"("callId", "id");

-- AddForeignKey
ALTER TABLE "Investigation" ADD CONSTRAINT "Investigation_bestCallId_fkey" FOREIGN KEY ("bestCallId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptEvent" ADD CONSTRAINT "TranscriptEvent_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedFinding" ADD CONSTRAINT "ExtractedFinding_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;
