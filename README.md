<p align="center">
  <img src="assets/anyhow-skills.svg" alt="Anyhow Skills mark" width="150">
</p>

<h1 align="center">anyhow-skills</h1>

<p align="center">
  A personal playground for small, niche, agent-agnostic skills.
</p>

<p align="center">
  <img alt="Status: Experimental" src="https://img.shields.io/badge/status-experimental-white?style=for-the-badge&labelColor=000000">
  <img alt="Runtime: TypeScript" src="https://img.shields.io/badge/runtime-typescript-white?style=for-the-badge&labelColor=000000">
  <img alt="Data: Local first" src="https://img.shields.io/badge/data-local--first-white?style=for-the-badge&labelColor=000000">
</p>

<p align="center">
  <a href="docs/phase-1-repository-and-singapore-toto.md">Phase 1 plan</a>
  ·
  <a href="skills/">Skills</a>
  ·
  <a href="docs/phase-1-repository-and-singapore-toto.md#agentrig-breakdown">AgentRig workflow</a>
</p>

---

## What It Is

`anyhow-skills` is a personal collection of niche skills that may be useful in
specific situations and unnecessary in most others. The skills are designed to
be understandable and usable across agent tools.

The collection favors small, local-first utilities. Skills that collect online
data may store it in SQLite or DuckDB so an agent can query the result locally
with little setup.

## Skill Model

Each skill is an isolated directory:

```text
skills/
└── <skill-name>/
    ├── SKILL.md          # purpose, trigger, workflow, requirements, limits
    ├── package.json      # only when the skill has executable code
    ├── scripts/          # optional
    ├── schema/           # optional SQL schema and migrations
    ├── fixtures/         # optional small checked-in examples
    └── .state/           # ignored local SQLite/DuckDB runtime data
```

The main `SKILL.md` is the source of truth. Skills use lowercase kebab-case
names and remain independently copyable. Platform-specific adaptations are
optional and must not change the portable core instructions.

## Current Skills

| Skill | Status | Description |
| --- | --- | --- |
| [Singapore Toto](skills/singapore-toto/) | Planned | Local SQLite history, refresh/import workflow, and descriptive heuristic estimates. |

The Singapore Toto skill is the first migration planned for this collection.
It is not available in this checkout until Phase 1 implementation is complete.

## Local Data

- Runtime databases belong in `skills/<skill>/.state/` and are ignored by Git.
- Schemas and migrations belong in `schema/` and are versioned.
- Small synthetic examples may live in `fixtures/`.
- Downloaded data is disposable by default.
- Data-using skills must document sources, retrieval time, refresh commands,
  reset/rebuild behavior, privacy boundaries, and provenance.
- A failed refresh must not destroy an existing local database.

## AgentRig Workflow

This repository uses AgentRig with planner, worker, and reviewer roles. The
canonical planning documents live under `docs/`; live task and handoff state is
stored in the local `.agent-rig/` SQLite workflow store.

The engineering loop is:

```text
planner + human
      ↓
dependency-gated tasks
      ↓
worker implementation → worker handoff
      ↓
independent reviewer
      ↓
fix and re-review, if needed
      ↓
human end-to-end review
```

Use the local AgentRig CLI for task and handoff state changes:

```sh
node /Users/inotives/workspaces/agent-rig/dist/index.js validate
node /Users/inotives/workspaces/agent-rig/dist/index.js status
node /Users/inotives/workspaces/agent-rig/dist/index.js tasks --json
```

Do not commit `.agent-rig/`; it contains local workflow state, credentials,
agent runs, and runtime artifacts.

## Development Principles

- Keep the smallest complete implementation.
- Prefer an existing platform feature or installed dependency over new code.
- Keep skills agent-agnostic and independently copyable.
- Make network collection explicit in documentation.
- Label heuristic output honestly; historical patterns cannot improve random
  lottery odds.
- Do not claim current data or completed validation without evidence.

## Phase 1

Phase 1 establishes the repository baseline and migrates the existing Singapore
Toto TypeScript skill and SQLite bootstrap data without committing the database
or CSV history.

See [the Phase 1 plan](docs/phase-1-repository-and-singapore-toto.md) for the
accepted decisions, acceptance checks, and AgentRig task breakdown.
