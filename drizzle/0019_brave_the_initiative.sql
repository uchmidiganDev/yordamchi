CREATE TABLE "phone_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" text NOT NULL,
	"caller_number" text,
	"callee_number" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone,
	"duration_seconds" integer,
	"transcript_json" text,
	"summary" text,
	"recording_base64" text,
	"recording_mime_type" text,
	"raw_payload" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_calls_conversation_unique" UNIQUE("conversation_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_agent_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number_e164" text;--> statement-breakpoint
ALTER TABLE "phone_calls" ADD CONSTRAINT "phone_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;