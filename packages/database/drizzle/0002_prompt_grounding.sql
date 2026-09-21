ALTER TABLE "style_profile_versions" DROP CONSTRAINT "styleProfileVersions_explicitRequirements_check";--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "assertions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "style_profile_versions" ADD COLUMN "address_form" text;--> statement-breakpoint
UPDATE "style_profile_versions" SET "address_form" = 'VOUS' WHERE "kind" = 'STYLE_EXPLICIT' AND "address_form" IS NULL;--> statement-breakpoint
ALTER TABLE "style_profile_versions" ADD CONSTRAINT "styleProfileVersions_explicitRequirements_check" CHECK ("style_profile_versions"."kind" <> 'STYLE_EXPLICIT' OR ("style_profile_versions"."created_by" IS NOT NULL AND "style_profile_versions"."address_form" IS NOT NULL AND "style_profile_versions"."formality" IS NOT NULL AND "style_profile_versions"."tone" IS NOT NULL));
