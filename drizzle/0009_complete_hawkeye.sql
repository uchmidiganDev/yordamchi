CREATE TABLE "business_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" bigint NOT NULL,
	"from_name" text,
	"from_username" text,
	"text" text NOT NULL,
	"answer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_connection_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_connection_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "business_messages" ADD CONSTRAINT "business_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;