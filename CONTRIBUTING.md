# Contributing to Piel en Armonía

This project uses standard tools to maintain code quality and consistency.

## Code Style & Formatting

### PHP

We follow **PSR-12** coding standards.

- **Check code style**: `composer run lint`
- **Fix code style**: `composer run fix`

### JavaScript / Frontend

We use **ESLint** and **Prettier**.

- **Format code**: `npm run format` (Runs Prettier on all files)
- **Lint code**: `npm run lint`

## Git Hooks

We use **Husky** and **lint-staged** to automatically lint and format your code before committing.
When you run `git commit`, the following will happen on staged files:

- **PHP**: `php-cs-fixer` will fix coding style issues.
- **JS/CSS/JSON/MD**: `prettier` will format the files.
- **JS**: `eslint` will fix linting issues.

If any tool fails, the commit will be aborted. You can bypass this with `git commit --no-verify` (not recommended).

## Setup

1. Install PHP dependencies: `composer install`
2. Install Node dependencies: `npm install`
3. Initialize Husky (should happen automatically via `prepare` script): `npm run prepare`

## Multi-agent governance

- Canonical policy: `AGENTS.md`
- Canonical backlog: `AGENT_BOARD.yaml`
- Codex lanes activos: `codex_backend_ops`, `codex_frontend`
- Tombstones historicos: `JULES_TASKS.md`, `KIMI_TASKS.md`

Before opening a PR:

1. `npm run agent:status`
2. `npm run agent:conflicts`
3. `npm run agent:jobs:status`
4. `npm run agent:validate`
