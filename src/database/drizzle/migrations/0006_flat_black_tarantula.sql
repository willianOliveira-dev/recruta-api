CREATE TYPE "public"."candidate_resume_file_status" AS ENUM('pending', 'uploaded', 'rejected', 'deleted');--> statement-breakpoint
CREATE TABLE "candidate_resume_file" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"storage_provider" text DEFAULT 'cloudflare_r2' NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"original_file_name" text NOT NULL,
	"mime_type" text DEFAULT 'application/pdf' NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum_sha256" text,
	"status" "candidate_resume_file_status" DEFAULT 'pending' NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"uploaded_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_resume_file" ADD CONSTRAINT "candidate_resume_file_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_resume_file" ADD CONSTRAINT "candidate_resume_file_candidate_id_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_resume_file" ADD CONSTRAINT "candidate_resume_file_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_resume_file_organization_id_idx" ON "candidate_resume_file" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "candidate_resume_file_candidate_id_idx" ON "candidate_resume_file" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_resume_file_status_idx" ON "candidate_resume_file" USING btree ("status");--> statement-breakpoint
CREATE INDEX "candidate_resume_file_current_idx" ON "candidate_resume_file" USING btree ("candidate_id","is_current");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_resume_file_object_key_uidx" ON "candidate_resume_file" USING btree ("object_key");