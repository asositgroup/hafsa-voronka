CREATE TABLE "bot_texts" (
	"key" text PRIMARY KEY NOT NULL,
	"text" text,
	"media_type" text,
	"media_file_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
