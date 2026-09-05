-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BUYER', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFYING', 'NOT_READY', 'READY_FOR_APPROVAL', 'APPROVED', 'PAYMENT_PENDING', 'PAID', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "VerificationRunStatus" AS ENUM ('CREATED', 'PLANNING', 'READY', 'EXECUTING', 'EVIDENCE_COLLECTION', 'EVALUATING', 'RETRYING', 'COMPLETED', 'ERROR', 'ENVIRONMENT_FAILURE', 'HUMAN_REVIEW');

-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('PASS', 'FAIL', 'UNCERTAIN');

-- CreateEnum
CREATE TYPE "VerificationTool" AS ENUM ('BROWSER', 'API');

-- CreateEnum
CREATE TYPE "VerificationTaskStatus" AS ENUM ('CREATED', 'EXECUTING', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('SCREENSHOT', 'TRACE', 'API_RESPONSE', 'LOG');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PAYMENT_PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criteria" (
    "id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "ai_interpretation" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "app_url" TEXT NOT NULL,
    "credentials_ref" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_runs" (
    "id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "status" "VerificationRunStatus" NOT NULL DEFAULT 'CREATED',
    "overall_result" "VerificationResult",
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_type" TEXT,

    CONSTRAINT "verification_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tasks" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "criterion_id" UUID NOT NULL,
    "tool" "VerificationTool" NOT NULL,
    "action" JSONB NOT NULL,
    "status" "VerificationTaskStatus" NOT NULL DEFAULT 'CREATED',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "result" "VerificationResult",
    "error_type" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "verification_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "criterion_id" UUID NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "path" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "payment_link_id" TEXT,
    "reference_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "milestone_id" UUID,
    "run_id" UUID,
    "event_type" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");

-- CreateIndex
CREATE INDEX "milestones_project_id_idx" ON "milestones"("project_id");

-- CreateIndex
CREATE INDEX "criteria_milestone_id_idx" ON "criteria"("milestone_id");

-- CreateIndex
CREATE INDEX "submissions_milestone_id_idx" ON "submissions"("milestone_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_milestone_id_version_key" ON "submissions"("milestone_id", "version");

-- CreateIndex
CREATE INDEX "verification_runs_milestone_id_idx" ON "verification_runs"("milestone_id");

-- CreateIndex
CREATE INDEX "verification_runs_submission_id_idx" ON "verification_runs"("submission_id");

-- CreateIndex
CREATE INDEX "verification_tasks_run_id_idx" ON "verification_tasks"("run_id");

-- CreateIndex
CREATE INDEX "verification_tasks_criterion_id_idx" ON "verification_tasks"("criterion_id");

-- CreateIndex
CREATE INDEX "evidence_run_id_idx" ON "evidence"("run_id");

-- CreateIndex
CREATE INDEX "evidence_criterion_id_idx" ON "evidence"("criterion_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_id_key" ON "payments"("reference_id");

-- CreateIndex
CREATE INDEX "payments_milestone_id_idx" ON "payments"("milestone_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_milestone_id_idx" ON "audit_logs"("milestone_id");

-- CreateIndex
CREATE INDEX "audit_logs_run_id_idx" ON "audit_logs"("run_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tasks" ADD CONSTRAINT "verification_tasks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "verification_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tasks" ADD CONSTRAINT "verification_tasks_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "verification_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "verification_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "verification_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
