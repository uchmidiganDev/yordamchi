CREATE TYPE "public"."login_token_status" AS ENUM('pending', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"status" "login_token_status" DEFAULT 'pending' NOT NULL,
	"telegram_id" bigint,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" bigint NOT NULL,
	"telegram_username" text,
	"name" text,
	"google_refresh_token" text,
	"timezone" text DEFAULT 'Asia/Tashkent' NOT NULL,
	"morning_time" time DEFAULT '08:00' NOT NULL,
	"evening_time" time DEFAULT '21:00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;