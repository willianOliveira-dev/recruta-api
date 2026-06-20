CREATE TYPE "public"."ai_processing_job_status" AS ENUM('pending', 'queued', 'processing', 'completed', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."inbox_event_status" AS ENUM('processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."outbox_event_status" AS ENUM('pending', 'processing', 'published', 'failed');--> statement-breakpoint
CREATE TABLE "ai_processing_job" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_type" text NOT NULL,
	"status" "ai_processing_job_status" DEFAULT 'pending' NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"input_hash" text,
	"idempotency_key" text NOT NULL,
	"outbox_event_id" uuid,
	"request_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"queued_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"source" text NOT NULL,
	"organization_id" uuid,
	"correlation_id" uuid,
	"payload_hash" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "inbox_event_status" DEFAULT 'processing' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid,
	"actor_user_id" uuid,
	"correlation_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "outbox_event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"published_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_processing_job" ADD CONSTRAINT "ai_processing_job_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_processing_job" ADD CONSTRAINT "ai_processing_job_outbox_event_id_outbox_event_id_fk" FOREIGN KEY ("outbox_event_id") REFERENCES "public"."outbox_event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_event" ADD CONSTRAINT "inbox_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_processing_job_idempotency_key_uidx" ON "ai_processing_job" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_processing_job_organization_id_idx" ON "ai_processing_job" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_processing_job_status_next_attempt_idx" ON "ai_processing_job" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "ai_processing_job_status_locked_idx" ON "ai_processing_job" USING btree ("status","locked_at");--> statement-breakpoint
CREATE INDEX "ai_processing_job_type_idx" ON "ai_processing_job" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "ai_processing_job_type_input_hash_idx" ON "ai_processing_job" USING btree ("job_type","input_hash");--> statement-breakpoint
CREATE INDEX "ai_processing_job_entity_idx" ON "ai_processing_job" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ai_processing_job_outbox_event_id_idx" ON "ai_processing_job" USING btree ("outbox_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_event_source_event_id_uidx" ON "inbox_event" USING btree ("source","event_id");--> statement-breakpoint
CREATE INDEX "inbox_event_source_idx" ON "inbox_event" USING btree ("source");--> statement-breakpoint
CREATE INDEX "inbox_event_status_next_attempt_idx" ON "inbox_event" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "inbox_event_status_locked_idx" ON "inbox_event" USING btree ("status","locked_at");--> statement-breakpoint
CREATE INDEX "inbox_event_organization_id_idx" ON "inbox_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inbox_event_correlation_id_idx" ON "inbox_event" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "outbox_event_status_next_attempt_idx" ON "outbox_event" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "outbox_event_status_locked_idx" ON "outbox_event" USING btree ("status","locked_at");--> statement-breakpoint
CREATE INDEX "outbox_event_organization_id_idx" ON "outbox_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "outbox_event_event_type_idx" ON "outbox_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "outbox_event_entity_idx" ON "outbox_event" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "outbox_event_correlation_id_idx" ON "outbox_event" USING btree ("correlation_id");