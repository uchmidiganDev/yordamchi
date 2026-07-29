CREATE TYPE "public"."veo_job_status" AS ENUM('processing', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "photo_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" bigint NOT NULL,
	"file_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photo_sessions_chat_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "veo_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" bigint NOT NULL,
	"prompt" text NOT NULL,
	"status" "veo_job_status" DEFAULT 'processing' NOT NULL,
	"operation_name" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_video_generation_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photo_sessions" ADD CONSTRAINT "photo_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "veo_jobs" ADD CONSTRAINT "veo_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;