# Cloudflare R2 — private file storage

**Status: selected private file store; AWS SDK v3 and Wrangler setup explicitly requested on 17 September 2026.** Neon holds structured data; R2 holds private imports, exports and encrypted backup objects. Prefer text/evidence in Postgres and avoid collecting attachments unnecessarily.

Create an EU-jurisdiction bucket, not merely a European location hint. Cloudflare documents the EU endpoint as `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`; a location hint alone does not enforce jurisdiction. This guarantee concerns R2 objects, not every provider in the product. [Data location](https://developers.cloudflare.com/r2/reference/data-location/).

## Setup and implementation

Provision buckets and their settings through the [Wrangler runbook](wrangler.md). Use EU jurisdiction and separate production/staging resources. Operator provisioning credentials and application S3 credentials have different roles. The runbook includes documented commands; no infrastructure has been provisioned in this specification task.

Use the official AWS TypeScript-compatible S3 packages `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` inside `packages/storage`. R2 exposes an S3-compatible API; do not create a new handwritten signing implementation. [S3 API example](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/).

Keep buckets private. Authorize a user before generating a short-lived signed URL; scope object keys to tenant and environment. Validate file type/size at upload and retain metadata in Postgres. Never trust a caller-supplied object path to establish ownership. Use separate staging credentials and buckets.

Set retention for temporary imports and raw event archives. Store backups under distinct permissions and encrypted before upload when they contain full customer records. Test restoring both database records and referenced files. PostgreSQL restoration does not roll R2 objects back in time; retain recoverable object versions or immutable backup keys according to the runbook.

## Cost

Standard storage is $0.015/GB-month, Class A requests $4.50/million and Class B $0.36/million, with published monthly free allowances and no direct egress fee. Cloudflare bills in rounded units. The cost model uses a visible **$5–$20 monthly allowance**, rather than assuming a precise request count or relying on the free tier. No Workers subscription is necessary for S3 access from Render. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Keep this R2 choice in the baseline. A later provider change follows the user’s dependency discussion rule and requires a concrete reason.
