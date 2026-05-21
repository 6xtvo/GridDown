# Contributing
## Branch naming

Branches follow the format `<type>/<short-description>`, where `type` matches one of the conventional commit types below.

```
feat/live-commit-webhook
fix/discord-identity-dedup
chore/upgrade-prisma
docs/db-migration-workflow
```

Keep the description lowercase and hyphen-separated. Avoid vague names like `patch`, `updates`, or `wip`.

## Commit messages

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org) specification. Non-conforming commits are rejected by the pre-commit hook (commitlint + lefthook).

```
<type>(<optional scope>): <description>
```

- Subject line: lowercase, imperative mood, no trailing period, ≤ 72 characters
- Body (optional): explain _why_, not what - the diff shows what changed

**Allowed types:**

| Type       | Use for                                  |
| ---------- | ---------------------------------------- |
| `feat`     | New user-facing functionality            |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation only                       |
| `style`    | Formatting, whitespace - no logic change |
| `refactor` | Restructure with no behaviour change     |
| `perf`     | Performance improvement                  |
| `test`     | Adding or correcting tests               |
| `chore`    | Tooling, dependencies, config            |
| `ci`       | CI/CD pipeline changes                   |
| `build`    | Build system changes                     |
| `revert`   | Reverts a previous commit                |

**Scopes** are optional but useful - use the area changed.

```
feat(worker): add retry logic to discord ingestion
fix(db): correct unique constraint on PersonIdentity
chore(web): upgrade to Next.js 15.1
```

## Merging and rebasing

Favour rebasing over merge commits - it keeps history linear and makes it easier to follow what changed and why.

Before opening a PR, rebase onto the latest `master`:

```bash
git fetch origin
git rebase origin/master
```

Rebase regularly when `main` is active. Smaller, frequent rebases are easier to resolve than one big conflict at the end.

After rebasing, push with `--force-with-lease` (never bare `--force`):

```bash
git push --force-with-lease origin <your-branch>
```

`--force-with-lease` is only needed when the branch already exists on the remote - rebasing rewrites commit hashes, so Git would otherwise reject the push to protect the remote's history. If the branch hasn't been pushed yet, a regular push is fine:

```bash
git push -u origin <your-branch>
```
