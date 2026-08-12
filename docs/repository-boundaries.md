# Repository Boundaries

## Separate repositories

- `corsair-platform` is the platform repository.
- `job-application-assistant` is an independent workload repository.
- Corsair includes the workload only as a Git submodule for coordinated local development; it does not own the workload source.

## Dependency direction

```text
job-application-assistant -> published/versioned @corsair-platform/client
corsair-platform          -> Corsair provider primitives
```

The application may depend on the public Corsair SDK/contracts. Corsair must not depend on Job Application domain types.

## GitHub migration

The local submodule uses a local repository path until the GitHub owner and repository URLs are supplied. Replace that URL in `.gitmodules` before pushing the platform repository.
