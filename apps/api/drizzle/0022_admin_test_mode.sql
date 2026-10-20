CREATE TABLE "bot_admin_test_modes" (
	"admin_telegram_id" bigint PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
