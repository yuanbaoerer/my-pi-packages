# AGENTS.md

This is a private pi package repository for syncing custom skills and extensions across devices.

## Repository structure

```
self/             # Self-created content (user-maintained)
  skills/         # Agent Skills — each subdirectory contains SKILL.md
  extensions/     # TypeScript extensions loaded by pi
vendored/         # Third-party resources that cannot be pi-installed
  skills/         # Vendored third-party skills
  extensions/     # Vendored third-party extensions
package.json      # pi package manifest declaring self/ and vendored/ paths
```

## Source categories

| Directory | For | Rule |
|-----------|-----|------|
| `self/` | User's own skills/extensions | Freely create and modify |
| `vendored/` | Third-party that cannot `pi install` | Keep as-is from upstream, document origin |
| (not in repo) | Third-party that can `pi install` | Install separately per device |

## When adding a new self-created skill

1. Create `self/skills/<skill-name>/SKILL.md` with valid frontmatter.
2. Follow the Agent Skills spec: name lowercase a-z, 0-9, hyphens, max 64 chars.
3. Put helper scripts alongside SKILL.md, reference with relative paths.
4. Commit and push.

## When adding a new self-created extension

1. Place `.ts` file in `self/extensions/`.
2. Export a default function taking `ExtensionAPI`.
3. If npm deps needed, add to `dependencies` in root `package.json`.
4. Commit and push.

## When vendoring a third-party skill/extension

1. Place in `vendored/skills/` or `vendored/extensions/`.
2. Record the upstream source (URL) in the vendored directory or a comment.
3. Minimize local modifications — prefer contributing upstream.

## External dependencies

The `last30days` skill used by `self/extensions/last30days-agent.ts` must be installed
separately on each device:
```
pi install git:github.com/mvanhorn/last30days-skill
```
The extension auto-discovers it from pi's git package directory.

## When modifying

- Read the current file first, then edit.
- Keep changes focused and backward-compatible.
- After push, tell user to `pi update --extensions` + `/reload` on other devices.
