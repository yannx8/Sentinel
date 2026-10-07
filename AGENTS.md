# Agent Guidelines & Rules

## Writing Style & Tone

- **No Em Dashes:** Do not use em dashes ("-") under any circumstances in code, documentation, commit messages, or chat responses. Use hyphens, commas, colons, or parentheses instead.
- **Avoid AI-Generated Patterns:** Write concisely, directly, and naturally. Avoid repetitive corporate phrasing, filler text, or predictable AI structural cliches.

## Git & Branch Hygiene (GitHub Flow)

- **Strict GitHub Flow:** Always branch off up-to-date `main`. Name branches `feature/<ticket>-<slug>` or `fix/<ticket>-<slug>`.
- **Mandatory User Approval:** Explicit user approval is strictly required before executing any `git commit`, `git merge`, or `git push` operation. Never commit, merge, or push without asking and receiving approval first.
- **Zero Stale Branches:** Never leave merged branches in the repository. As soon as a branch is merged into `main`, delete both the remote and local branch immediately.
- **Conventional Commits:** Write atomic commits using the format `<type>(<scope>): <summary>` (e.g., `feat(incidents): add category validation (GIT-16)`). Never use em dashes in commit messages.
- **Prune Remote Tracking:** Periodically run `git fetch --prune` to keep local branch references in sync with GitHub.

## Database & Integration Testing

- **Local Database Concurrency:** When executing Vitest test suites against the local PostgreSQL instance, always run with `--no-file-parallelism` to prevent connection pool exhaustion.

## Workspace Hygiene

- **No Scratch Artifacts:** Never leave temporary `.patch` or diff text files in the repository root. All temporary data or scripts must reside in designated scratch directories or be cleaned up before review handoff.
