# Wrangler — required R2 setup CLI

Use the official `wrangler` development dependency, installed and pinned with Bun, for R2 bucket setup and configuration. Runtime object access remains in `packages/storage` through AWS SDK v3. Wrangler is not a production application dependency. [Cloudflare CLI setup](https://developers.cloudflare.com/r2/get-started/cli/).

## Provisioning runbook

The following commands are implementation instructions, not commands executed by this research. Bucket names are examples to replace with the project's names.

```sh
bun add --dev --exact wrangler
bunx wrangler login
bunx wrangler whoami
bunx wrangler r2 bucket create prospecting-prod-files --jurisdiction eu
bunx wrangler r2 bucket create prospecting-staging-files --jurisdiction eu
bunx wrangler r2 bucket info prospecting-prod-files --jurisdiction eu
bunx wrangler r2 bucket info prospecting-staging-files --jurisdiction eu
```

Confirm the intended Cloudflare account before mutation. For repeat runs, inspect existing buckets first rather than treating any creation error as success. Store environment names and non-secret configuration in repository infrastructure files; keep credentials in the deployment secret store.

Leave public bucket access disabled. If browser direct uploads use signed URLs, maintain environment-specific CORS files and apply them through Wrangler:

```sh
bunx wrangler r2 bucket cors set prospecting-prod-files --jurisdiction eu --file infra/r2/cors.prod.json
bunx wrangler r2 bucket cors list prospecting-prod-files --jurisdiction eu
```

Use the pinned CLI's documented lifecycle commands for approved retention rules and inspect them after applying. CORS is browser behaviour, not tenant authorization. [Wrangler R2 commands](https://developers.cloudflare.com/r2/reference/wrangler-commands/).

## Authentication boundary

Wrangler's operator login manages Cloudflare resources. It does not replace the application's separate S3 Access Key ID and Secret Access Key. Provision bucket-scoped credentials using Cloudflare's documented R2 token flow, with separate production/staging access. If this credential step must be fully scripted, use the official Cloudflare token API from the provisioning tooling; do not invent a Wrangler token-creation command. [R2 token documentation](https://developers.cloudflare.com/r2/api/tokens/).

CI uses an appropriately scoped Cloudflare management token rather than an interactive login. Runtime Render services receive only their object-access credentials and EU S3 endpoint. No Cloudflare Worker deployment is required for this setup.

## Verification and cost

Verify EU jurisdiction and privacy, then upload/download an innocuous fixture using the **same AWS SDK path as the application**. Test signed-URL expiry and cross-tenant denial. Do not consider a Wrangler-only object check proof that application S3 credentials work. Cloudflare notes that its local `wrangler dev` storage does not expose the S3-compatible API used by these SDK examples. [AWS SDK v3 example](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/).

Wrangler adds no hosted subscription. R2 resource usage remains in the existing storage allowance.
