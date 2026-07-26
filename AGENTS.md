# AGENTS.md

This is a private pi package repository for syncing custom skills and extensions across devices.

## Repository structure

```
skills/          # Agent Skills — each subdirectory contains SKILL.md + scripts
extensions/      # TypeScript extensions loaded by pi at startup
package.json     # pi package manifest with "pi" key declaring resource paths
```

## When adding a new skill

1. Create `skills/<skill-name>/SKILL.md` with valid frontmatter (name, description required).
2. Follow the Agent Skills spec: name must be lowercase a-z, 0-9, hyphens, max 64 chars.
3. Put helper scripts alongside SKILL.md and reference them with relative paths.
4. Commit and push.

## When adding a new extension

1. Place the `.ts` file in `extensions/`.
2. Export a default function that takes `ExtensionAPI`.
3. If the extension needs npm dependencies, add them to `dependencies` in `package.json`.
4. Commit and push.

## When modifying existing skills/extensions

- Read the current file first, understand what it does, then edit.
- Keep changes focused and backward-compatible when possible.
- After pushing, remind the user to run `pi update --extensions` and `/reload` on other devices.

## Loading behavior

- pi auto-discovers skills from `skills/` (directories containing SKILL.md) and extensions from `extensions/` (`.ts` files).
- The package.json `pi` key explicitly maps these directories.
- This repo is installed via `pi install git:...` which clones to `~/.pi/agent/git/github.com/...`.
