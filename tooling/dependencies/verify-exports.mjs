import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const resolutionParents = [
  "apps/app/resolve-exports.mjs",
  "apps/api/resolve-exports.mjs",
  "apps/worker/resolve-exports.mjs",
  "packages/workflows/resolve-exports.mjs",
].map((relativePath) =>
  pathToFileURL(path.resolve(repositoryRoot, relativePath))
);
const resolutionRequires = resolutionParents.map((parent) =>
  createRequire(parent)
);

const exportSpecifiers = [
  "@relanmo/domain",
  "@relanmo/domain/contracts",
  "@relanmo/domain/contracts/product",
  "@relanmo/domain/ports/providers",
  "@relanmo/domain/ports/persistence",
  "@relanmo/domain/workflow-safe",
  "@relanmo/auth/server",
  "@relanmo/auth/client",
  "@relanmo/auth/schema-config",
  "@relanmo/connectors/unipile/accounts",
  "@relanmo/connectors/unipile/discovery",
  "@relanmo/connectors/unipile/messages",
  "@relanmo/connectors/unipile/events",
  "@relanmo/connectors/typesafe",
  "@relanmo/connectors/anthropic",
  "@relanmo/database/client",
  "@relanmo/database/transactions",
  "@relanmo/database/schema",
  "@relanmo/database/repositories/tenancy",
  "@relanmo/email/delivery",
  "@relanmo/email/templates",
  "@relanmo/observability/error",
  "@relanmo/observability/prospecting",
  "@relanmo/payments/stripe",
  "@relanmo/prompts/defaults",
  "@relanmo/prompts/fixtures",
  "@relanmo/prompts/composition",
  "@relanmo/storage/r2",
  "@relanmo/workflows/client",
  "@relanmo/workflows/workflow-safe",
  "@relanmo/workflows/discovery",
  "@relanmo/workflows/account-sync",
  "@relanmo/workflows/prospect-sequence",
  "@relanmo/workflows/campaign-control",
  "@relanmo/design-system/lib/utils",
];

const forbiddenWorkflowImports = [
  /node:/u,
  /@temporalio\//u,
  /@anthropic-ai\/sdk/u,
  /@typesafe-ai\/sdk/u,
  /unipile-node-sdk/u,
  /drizzle-orm/u,
  /\bpg\b/u,
  /stripe/u,
  /resend/u,
  /@aws-sdk\//u,
  /@sentry\//u,
  /server-only/u,
  /\bprocess\./u,
];

const packageManifestPaths = [
  "package.json",
  "apps/app/package.json",
  "apps/api/package.json",
  "apps/worker/package.json",
  "apps/docs/package.json",
  "apps/web/package.json",
  "packages/auth/package.json",
  "packages/connectors/package.json",
  "packages/database/package.json",
  "packages/domain/package.json",
  "packages/email/package.json",
  "packages/observability/package.json",
  "packages/payments/package.json",
  "packages/prompts/package.json",
  "packages/storage/package.json",
  "packages/workflows/package.json",
];

function read(relativePath) {
  return readFileSync(path.resolve(repositoryRoot, relativePath), "utf-8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveLocalImport(filePath, specifier) {
  const basePath = path.resolve(path.dirname(filePath), specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.resolve(basePath, "index.ts"),
    path.resolve(basePath, "index.tsx"),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}

function scanWorkflowSafe(filePath, visited = new Set()) {
  if (visited.has(filePath)) {
    return;
  }

  visited.add(filePath);
  const source = readFileSync(filePath, "utf-8");
  for (const pattern of forbiddenWorkflowImports) {
    assert(
      !pattern.test(source),
      `${path.relative(repositoryRoot, filePath)} imports ${pattern}`
    );
  }

  const importPattern =
    /(?:from|import)\s*(?:type\s*)?["'](?<specifier>[^"']+)["']/gu;
  for (const { groups } of source.matchAll(importPattern)) {
    const { specifier } = groups ?? {};
    if (!specifier?.startsWith(".")) {
      continue;
    }

    const childPath = resolveLocalImport(filePath, specifier);
    assert(
      childPath,
      `Cannot resolve ${specifier} from ${path.relative(repositoryRoot, filePath)}`
    );
    scanWorkflowSafe(childPath, visited);
  }
}

for (const specifier of exportSpecifiers) {
  let resolved;
  for (const requireFromWorkspace of resolutionRequires) {
    try {
      resolved = requireFromWorkspace.resolve(specifier);
      break;
    } catch {
      // Each app has a deliberately small direct dependency set; try the next consumer.
    }
  }

  assert(
    resolved && path.isAbsolute(resolved),
    `${specifier} did not resolve from a workspace consumer`
  );
}

for (const safeEntry of [
  "packages/domain/src/workflow-safe.ts",
  "packages/workflows/src/workflow-safe.ts",
]) {
  scanWorkflowSafe(path.resolve(repositoryRoot, safeEntry));
}

for (const feature of [
  "profile",
  "accounts",
  "campaigns",
  "style",
  "pipeline",
  "conversations",
  "billing",
  "metrics",
]) {
  const bindingPath = path.resolve(
    repositoryRoot,
    `apps/app/features/${feature}/bindings.ts`
  );
  const source = readFileSync(bindingPath, "utf-8");
  assert(
    /enabled:\s*false/u.test(source),
    `${feature} binding is not disabled`
  );
  assert(
    !/demo|tenant/u.test(source),
    `${feature} binding mentions fixture tenant data`
  );
}

for (const manifestPath of packageManifestPaths) {
  const manifest = JSON.parse(read(manifestPath));
  const dependencyNames = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ];
  assert(
    !dependencyNames.some((name) =>
      /^(?:clerk|@clerk\/|prisma|@prisma\/|supabase|@supabase\/|mintlify|@mintlify\/)/u.test(
        name
      )
    ),
    `${manifestPath} contains an unapproved default dependency`
  );
}

const temporalManifests = [
  "packages/workflows/package.json",
  "apps/worker/package.json",
];
for (const manifestPath of temporalManifests) {
  const manifest = JSON.parse(read(manifestPath));
  const temporalVersions = Object.entries({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })
    .filter(([name]) => name.startsWith("@temporalio/"))
    .map(([, version]) => version);
  assert(
    temporalVersions.length > 0 &&
      temporalVersions.every((version) => version === "1.24.0"),
    `${manifestPath} has unaligned Temporal versions`
  );
}

const authServer = read("packages/auth/src/server/index.ts");
const authClient = read("packages/auth/src/client/index.ts");
const workerManifest = JSON.parse(read("apps/worker/package.json"));
assert(
  authServer.includes('import "server-only"'),
  "auth server entrypoint is not server-only"
);
assert(
  !authClient.includes("server-only"),
  "auth client entrypoint imports server-only"
);
assert(
  workerManifest.engines?.node === ">=24.21.0 <25",
  "Temporal worker Node engine is not pinned to Node 24"
);

assert(path.isAbsolute(repositoryRoot), "repository root must be absolute");
assert(
  pathToFileURL(repositoryRoot).protocol === "file:",
  "repository root must be local"
);
console.log(
  `Resolved ${exportSpecifiers.length} package exports; workflow-safe and disabled binding checks passed.`
);
