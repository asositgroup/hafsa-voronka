UPDATE "bot_texts"
SET "text" = replace(replace(replace("text", '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
WHERE "text" IS NOT NULL
  AND "key" IN ('askContact', 'askContactShort', 'welcome', 'welcomeBack', 'registered', 'watchPrompt', 'completion', 'fallback');
