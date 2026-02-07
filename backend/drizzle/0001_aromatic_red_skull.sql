CREATE TYPE "public"."delivery_status" AS ENUM('processing', 'inspection', 'documentation', 'ready_for_collection', 'collected');--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "delivery_status" "delivery_status" DEFAULT 'processing';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "estimated_ready_date" timestamp;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "delivery_notes" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "collected_at" timestamp;