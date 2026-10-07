# Git & GitHub Engineering Standards & Workflow Guide

This document establishes the official Git and GitHub workflow for the Incident Reporting and Tracking Platform, aligned with GitHub Flow standards, Conventional Commits, and multi-agent engineering discipline.

---

## 1. Core Principles

1. **Deployable Trunk:** The `main` branch is always stable, passing tests, and deployable. Never commit broken code directly to `main`.
2. **Short-Lived Feature Branches:** Every feature, fix, or chore lives on its own isolated branch branched directly off the latest `main`. Branches should be short-lived (hours or days, not weeks).
3. **No Stale Branches (Zero Branch Clutter):** Once a branch is merged into `main`, it must be immediately deleted from both remote and local repositories.
4. **Atomic, Descriptive Commits:** Commits must represent small, coherent units of work with clear conventional commit messages explaining _what_ and _why_.
5. **Independent Review Before Merge:** All code entering `main` must pass automated validation (lint, typecheck, tests, build) and receive formal review.

---

## 2. Branch Lifecycle (GitHub Flow)

```text
       feature/GIT-16-incident-reporting
       ┌───────────► Commits ───────────► PR & Review ──┐
       │                                                ▼
───────┴────────────────────────────────────────────► Merge & Delete Branch ──► main
```

### Step 1: Sync and Branch

Always update your local `main` with `origin/main` before starting new work:

```bash
git checkout main
git pull origin main
git checkout -b feature/<ticket-key>-<short-description>
```

#### Branch Naming Conventions:

- Features: `feature/<ticket>-<short-name>` (e.g., `feature/GIT-16-incident-reporting`)
- Bug Fixes: `fix/<ticket>-<short-name>` (e.g., `fix/GIT-22-audit-timestamp`)
- Chores / Refactoring: `chore/<ticket>-<short-name>` or `refactor/<short-name>`

### Step 2: Develop and Atomic Commits

Commit early and often as logical milestones are reached.
Follow the **Conventional Commits** specification:

Format: `<type>(<scope>): <imperative summary>`

Allowed types:

- `feat`: A new feature for the user
- `fix`: A bug fix
- `test`: Adding or correcting tests
- `chore`: Build process, package updates, configuration
- `docs`: Documentation only changes
- `refactor`: Code change that neither fixes a bug nor adds a feature

Rules:

- Use the imperative present tense: "add" not "added", "fix" not "fixed".
- Do not end the summary line with a period.
- Reference the ticket ID at the end: `feat(incidents): add category validation (GIT-16)`.
- Do not use em dashes anywhere in commit messages.

### Step 3: Local Pre-Push Validation

Before pushing, run full validation from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Verify your diff and ensure no scratch files (`.patch`, debug logs, credentials) are staged:

```bash
git status
git diff main...HEAD
```

### Step 4: Push and Open Pull Request

Push your branch to GitHub:

```bash
git push -u origin feature/<ticket-key>-<short-description>
```

Create a Pull Request using the GitHub CLI or GitHub web interface:

```bash
gh pr create --title "feat(incidents): implement incident reporting backend (GIT-16)" --body "Closes GIT-16..."
```

### Step 5: Post-Merge Branch Pruning

Once the Pull Request is merged into `main`:

1. Switch back to `main` and pull the merged changes:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Delete the local merged branch:
   ```bash
   git branch -d feature/<ticket-key>-<short-description>
   ```
3. Prune stale remote tracking references:
   ```bash
   git fetch --prune
   ```

---

## 3. Recommended GitHub Repository Settings

To automate branch hygiene on GitHub:

1. Navigate to repository **Settings** > **General** > **Pull Requests**.
2. Enable **"Automatically delete head branches"**. When checked, GitHub will automatically delete the feature branch once its pull request is merged.
3. In **Settings** > **Branches**, configure branch protection for `main`:
   - Require a pull request before merging.
   - Require status checks to pass before merging (CI build, lint, and test).

---

## 4. Useful Git Maintenance Commands

| Action                    | Command                             | Purpose                                                                 |
| :------------------------ | :---------------------------------- | :---------------------------------------------------------------------- |
| **Prune Remote Tracking** | `git fetch --prune`                 | Removes references to remote branches that have been deleted on GitHub. |
| **List Merged Branches**  | `git branch --merged main`          | Lists local branches that have already been integrated into `main`.     |
| **Safe Delete Local**     | `git branch -d <branch>`            | Deletes branch only if it has been fully merged into upstream.          |
| **Delete Remote Branch**  | `git push origin --delete <branch>` | Manually deletes a stale branch from the GitHub remote.                 |
| **Clean Untracked Files** | `git status -s`                     | Inspects working directory for rogue files before staging.              |
