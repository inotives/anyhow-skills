# Agent instructions

`anyhow-skills` is a personal collection of small, agent-agnostic skills. Keep
each skill independently understandable and copyable.

## Before changing code

- Read the relevant phase plan under `docs/` and the target skill's `SKILL.md`.
- Check `git status --short` and preserve unrelated user changes.
- Keep the smallest complete implementation; avoid adding dependencies or
  abstractions without a clear need.
- Put runtime SQLite or DuckDB files in `skills/<skill>/.state/`. Keep schemas,
  migrations, and small synthetic fixtures versioned; do not commit downloaded
  databases or source dumps.
- Document online sources, refresh behavior, provenance, and failure safety for
  skills that collect data.

## Planner → worker ↔ reviewer workflow

Use AgentRig as a manager-driven loop:

1. The planner and human agree on a phase plan.
2. The planner breaks it into small tasks with explicit dependencies.
3. Only dependency-free tasks are `ready`; downstream tasks stay `blocked`.
4. The worker implements one ready task and records a handoff.
5. The independent reviewer checks the implementation against the task brief
   and repository standards.
6. Findings return to the worker. The task stays in the fix/re-review loop until
   the reviewer accepts it.
7. After acceptance, the manager explicitly unblocks the next selected task.
8. A final human task reviews the integrated phase before completion.

AgentRig does not infer or rewrite dependencies automatically. The manager must
inspect the board and perform each unblock deliberately. Use the local CLI for
task and handoff state; do not edit the workflow SQLite database directly.

```sh
node /Users/inotives/workspaces/agent-rig/dist/index.js status

PATH="$PWD/.agent-rig/_shared/tools:$PATH" \
node /Users/inotives/workspaces/agent-rig/dist/index.js loop \
  --once --worker worker --reviewer reviewer

node /Users/inotives/workspaces/agent-rig/dist/index.js tasks unblock \
  task-XXXX --status ready
```

Run the loop from a normal network-capable terminal when a spawned Codex
process needs network access. `.agent-rig/` is local workflow state and must
remain ignored; never copy credentials into the repository.

## Completion checks

- Run the narrowest relevant tests or validation commands.
- Run `git diff --check` before handoff.
- Report what was validated and any checks that remain for human review.
- Do not commit or push unless explicitly requested.
