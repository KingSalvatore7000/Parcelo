-- Store the handover fee as integer paise instead of a float of rupees
ALTER TABLE "handovers" ADD COLUMN "feePaise" INTEGER NOT NULL DEFAULT 0;
UPDATE "handovers" SET "feePaise" = ROUND("fee" * 100)::INTEGER;
ALTER TABLE "handovers" DROP COLUMN "fee";
