# Phase 1: Repository baseline and Singapore Toto skill

## Goal

Establish the repository structure for agent-agnostic skills and migrate the existing Singapore Toto skill as the first executable skill.

Source repository: `/Users/inotives/workspaces/agent-skill-toto-analyser`

## Decisions

- Each skill is an independently understandable and copyable directory under `skills/`.
- Skill directories use lowercase kebab-case names.
- Each skill has a `SKILL.md` contract with minimal YAML frontmatter and required operational sections.
- Executable skills own their `package.json`, scripts, and dependencies. There is no root workspace yet.
- Runtime SQLite/DuckDB data stays in `skills/<skill>/.state/` and is ignored by Git.
- Schemas and migrations are versioned plain SQL under `schema/`.
- Downloaded data is disposable by default. The existing Toto SQLite database is migrated as a local bootstrap into ignored `.state/`; no CSV history is migrated or committed.
- The first skill directory is `skills/singapore-toto/`.
- The migrated package name is `anyhow-skill-singapore-toto` and remains private.
- Preserve the current CLI commands: `help`, `init`, `import`, `refresh`, `latest`/`check`, and `predict`.
- Keep the implementation in one `src/cli.ts` file for this phase.
- Resolve the database from the skill root at `.state/singapore_toto.sqlite3`, not from the process working directory.
- Extract the inline table definition to `schema/001_initial.sql`.
- Keep Lottolyzer as the only refresh source for this phase.
- `latest` keeps its current possible automatic refresh behavior; `predict` uses local data only.
- Failed refreshes preserve the local database. Empty-data prediction fails clearly and does not fabricate numbers.
- Add focused tests and smoke checks without requiring live network access.
- The skill remains `experimental` until it has been used and reviewed in this collection.

## Repository baseline

Create or maintain:

```text
README.md
skills/
  singapore-toto/
docs/
  phase-1-repository-and-singapore-toto.md
```

The root README lists the skill and links to its `SKILL.md`. A minimal skill template documents the common contract without imposing a shared runtime.

## Singapore Toto migration

Migrate code, operational documentation, and the existing SQLite database. Do not copy CSV history, `dist/`, or `node_modules/`. The database remains local runtime state under `.state/` and is not committed.

Target shape:

```text
skills/singapore-toto/
├── SKILL.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── src/cli.ts
├── schema/001_initial.sql
├── tests/
│   └── fixtures/               # synthetic CSV only
└── .state/                      # ignored runtime database and migrated bootstrap
    └── singapore_toto.sqlite3  # copied from the source checkout, not tracked
```

Use the source repository's current TypeScript and Node.js approach. Change only the package identity, skill-root data path, schema loading, and tests required by this layout.

## Acceptance checks

- AgentRig workspace validation passes.
- The root README lists `singapore-toto` and its status.
- The skill has valid `SKILL.md` frontmatter and documents requirements, local data, refresh, reset/rebuild, privacy, provenance, and limitations.
- `npm install` and `npm run build` pass inside the skill.
- CLI help and initialization work from outside the skill directory.
- Initialization creates the SQLite database under `.state/` using `schema/001_initial.sql`.
- Synthetic import tests pass.
- The source SQLite database is copied into `.state/`, passes integrity and row-count checks, and remains ignored by Git.
- No CSV, credentials, or generated dependencies are tracked.
- Failed refresh and empty-data prediction behavior are covered by focused tests or deterministic checks.
- Worker handoff, independent reviewer handoff, and final integrated review are complete.
- Human end-to-end review confirms the repository discovery, local data migration, refresh/import workflow, and AgentRig task flow.

## AgentRig breakdown

1. Baseline repository documentation and skill template.
2. Migrate the Singapore Toto package, CLI, docs, schema, and skill-root state path.
3. Migrate and verify the existing SQLite bootstrap data.
4. Add synthetic fixtures, focused tests, and offline validation.
5. Run final integrated review and verify the complete Phase 1 acceptance list.
6. Obtain explicit human review and completion approval.

Only task 1 is ready initially. Tasks 2–4 remain blocked until their dependencies pass review.

## Out of scope

- Migrating CSV history or committing the SQLite bootstrap data.
- Adding a second online source or source adapter.
- Splitting the CLI into modules.
- Adding a root package workspace or shared runtime framework.
- Publishing the skill as an npm package.
- Automatic refresh services or schedulers.
- Prediction claims beyond descriptive historical heuristics.
