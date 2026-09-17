# Docker — reproducible application builds

**Status: recommended build/deployment format.** Build separate customer-app, API and worker images from the same source revision. [Docker Engine](https://docs.docker.com/engine/).

## Implementation

1. Use a pinned Node.js 24 base with the system libraries required by the evaluated SDKs. Prefer a tested Debian-based worker image initially; verify native Temporal dependencies before adopting a smaller alternative.
2. Use pinned Bun in dependency/build stages with a frozen lockfile. Compile for Node and use Node.js 24 in runtime stages. Preserve required workspace exports and native Temporal artifacts built for the target Linux architecture. Verify any Turbo pruning step against the chosen Bun lockfile and SDK versions; a full frozen workspace build is an acceptable first implementation.
3. Run as a non-root user. Pass secrets at runtime; never bake API keys, database passwords or customer sessions into image layers.
4. Keep persistent state in Postgres/private object storage and Temporal, so replacing a container is routine.
5. Implement graceful shutdown and deployment health behaviour in the application. Build and deploy immutable revisions so a worker release can be traced to its source.
6. Rebuild periodically for base-image security updates. Run dependency/build checks before promotion. [Official build practices](https://docs.docker.com/build/building/best-practices/).

## Verification

Start each image using only its documented environment variables, confirm it handles missing configuration clearly, and terminate it during queued work. Check that image contents and build logs contain no secrets.

Playwright browser binaries belong in the test environment, not automatically in production images. The production connector is Unipile; there is no local LinkedIn browser session to preserve inside our containers.

## Cost

There is no separately budgeted Docker Engine runtime subscription. Compute and any build/image storage are covered by hosting/CI. Docker Desktop has separate licensing conditions; use existing eligible development licences or a suitable Linux development environment. The user's €0 developer assumption does not itself make every optional commercial developer product free.

Start the worker with an explicit `node` command. Test the image itself, not just a local Bun development command. Shared workflow packages must remain importable by Temporal’s workflow bundler without accidentally bundling Node-only provider clients.
