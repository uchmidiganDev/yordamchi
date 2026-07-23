CREATE TABLE "pdf_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" bigint NOT NULL,
	"file_id" text NOT NULL,
	"file_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pdf_sessions_chat_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
ALTER TABLE "pdf_sessions" ADD CONSTRAINT "pdf_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;