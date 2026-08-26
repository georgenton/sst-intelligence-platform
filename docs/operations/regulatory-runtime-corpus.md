# Regulatory runtime corpus

## Deployment contract

Railway builds the repository root with `apps/api/Dockerfile`. The build stage receives the full
checkout and the runtime stage packages the version-controlled `regulatory/` directory at the
intrinsic path `/app/regulatory`. `reference:sync` resolves that path relative to its compiled
module; it does not inspect `process.cwd()`, search parent directories, require Git metadata, or
download regulatory material.

The runtime resource guard verifies the corpus, evidence, pilot, provenance, requirement and rule
draft entry points before synchronization. Missing resources remain a release-blocking error, so
Nest does not start after an incomplete pre-deploy.

## Incident cause

The previous image copied the API build, Prisma migrations and runtime workspace dependencies into
the final stage, but omitted `regulatory/`. Local and CI reference synchronization ran on the host
checkout, where parent-directory discovery found the corpus. Railway pre-deploy ran inside the
minimal final image, where that source-repository layout did not exist, and failed with
`REGULATORY_EVIDENCE_REPOSITORY_ROOT_NOT_FOUND`.

No Turborepo prune participates in this image build, and `.dockerignore` does not exclude the
corpus. The artifact-level CI gate now builds the actual Dockerfile, compares every packaged corpus
file with the canonical directory, runs fresh and already-migrated releases, starts Nest, exercises
repeat and drift behavior, and verifies a production-like upgrade with customer and historical
risk fixtures.

The packaged corpus contains JSON and Markdown only. Official PDFs and full GTC45 text are not
runtime assets; official artifact hashes, URLs, page metadata and provenance remain in the
structured manifests.
