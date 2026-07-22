ALTER TABLE "users" ADD COLUMN "business_voice_reply_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_link_analysis_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_video_download_enabled" boolean DEFAULT true NOT NULL;