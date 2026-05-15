# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

## Contributing
### Branch naming

Branches follow the format `<type>/<short-description>`, where `type` matches one of the conventional commit types below.

```
feat/live-commit-webhook
fix/discord-identity-dedup
chore/upgrade-prisma
docs/db-migration-workflow
```

Keep the description lowercase and hyphen-separated. Avoid vague names like `patch`, `updates`, or `wip`.

## Commit messages

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org) specification. Non-conforming commits are rejected by the pre-commit hook (commitlint + Husky).

```
<type>(<optional scope>): <description>
```

- Subject line: lowercase, imperative mood, no trailing period, ≤ 72 characters
- Body (optional): explain _why_, not what — the diff shows what changed

**Allowed types:**

| Type       | Use for                                  |
| ---------- | ---------------------------------------- |
| `feat`     | New user-facing functionality            |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation only                       |
| `style`    | Formatting, whitespace — no logic change |
| `refactor` | Restructure with no behaviour change     |
| `perf`     | Performance improvement                  |
| `test`     | Adding or correcting tests               |
| `chore`    | Tooling, dependencies, config            |
| `ci`       | CI/CD pipeline changes                   |
| `build`    | Build system changes                     |
| `revert`   | Reverts a previous commit                |

**Scopes** are optional but useful — use the package or area changed: `web`, `worker`, `db`, `auth`, `github`, `discord`, `llm`.

```
feat(worker): add retry logic to discord ingestion
fix(db): correct unique constraint on PersonIdentity
chore(web): upgrade to Next.js 15.1
```

## Merging and rebasing

Favour rebasing over merge commits — it keeps history linear and makes it easier to follow what changed and why.

Before opening a PR, rebase onto the latest `main`:

```bash
git fetch origin
git rebase origin/main
```

Rebase regularly when `main` is active. Smaller, frequent rebases are easier to resolve than one big conflict at the end.

After rebasing, push with `--force-with-lease` (never bare `--force`):

```bash
git push --force-with-lease origin <your-branch>
```

`--force-with-lease` is only needed when the branch already exists on the remote — rebasing rewrites commit hashes, so Git would otherwise reject the push to protect the remote's history. If the branch hasn't been pushed yet, a regular push is fine:

```bash
git push -u origin <your-branch>
```