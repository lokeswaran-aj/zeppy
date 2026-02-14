-- Convert contact language from enum to free-text string.
ALTER TABLE "Contact"
ALTER COLUMN "language" TYPE TEXT USING LOWER("language"::text),
ALTER COLUMN "language" SET DEFAULT 'english';

DROP TYPE "PreferredLanguage";
