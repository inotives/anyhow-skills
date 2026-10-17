---
name: trinary-agents
description: Plan and deliver a feature through a project-manager, worker, and reviewer workflow with dependency-tracked tasks and durable Markdown handoffs in a project-root trinary-workspace/. Use when coordinating multi-task feature work across subagents.
---

# Trinary Agents

Run a feature as a human-approved implementation plan, a dependency-aware task graph, and a sequence of worker/reviewer cycles. The project-manager is the only role that changes task status or dispatches the next task. Keep the durable record in the target repository's root-level `trinary-workspace/` directory.

## Operating rules

- Work in the target project's repository root. Create or continue `<project-root>/trinary-workspace/`; do not put it under `docs/`, a home directory, or this skill's installation folder.
- Use ordinary Markdown and the terminal's native subagent feature. Do not require AgentRig, SQLite, a server, or network access.
- Preserve existing files and work. Inspect before creating or changing anything. Never overwrite an existing feature, task, or handoff.
- Keep one feature plan per feature folder and one task brief per task folder. The feature README is canonical for feature scope and acceptance; task READMEs are canonical for task status, scope, dependencies, and task acceptance.
- Only the project-manager writes task statuses. Workers and reviewers record outcomes in handoffs.
- Keep task dependencies within the same feature in v1. Dispatch only one task at a time, even when multiple tasks are ready.
- Treat `trinary-workspace/` as workflow records. Implementation tasks change the target project's actual source, tests, configuration, and documentation at the paths their briefs identify. A workflow exercise may explicitly ask for its artifact to live inside its task folder, as this Toto snapshot test does.
- Do not merge, push, or declare the feature accepted unless the human explicitly authorizes the relevant action.

## Workflow

### 1. Start on a feature branch

Inspect the repository root, current branch, worktree, and existing branch naming convention. Start a dedicated branch for the feature before creating its plan. If the current branch already is the intended feature branch, continue there. If existing changes make branch ownership unclear, preserve them and ask the human how to proceed; do not stash, reset, discard, or silently move unrelated work.

Use the repository's branch naming convention. If none exists, use a descriptive branch such as `feat/<feature-title-slug>`. Do not create a branch name already in use; inspect and resolve that case with the human.

### 2. Interview the human and create and approve the feature plan

Inspect `<project-root>/trinary-workspace/` before writing. Create its `README.md` if absent to explain that it stores feature plans, tasks, and handoffs for this project. Create `features/` as needed.

Before drafting an approval-ready IP or task breakdown, interview the human until the feature request is decision-complete. Check whether `grill-with-docs` is available in the active agent terminal. If available, invoke it (for example, `/grill-with-docs`) to guide the plan interview and capture decisions. Do not assume it is available just because it exists in the skill authoring environment. If unavailable, conduct the interview yourself: ask one focused question at a time, wait for the answer, and follow up until material uncertainties are resolved. Offer concrete options and a recommendation when that helps the human decide; do not ask questions already answered in the conversation.

Cover the request's goal and success criteria, users and workflows, scope and non-goals, important behavior/design choices, constraints, dependencies or integrations, failure cases, and acceptance checks. Adapt the questions to the feature; continue only while an answer could materially change the plan. If a material decision remains unresolved, keep the IP in `Draft`, list the open question, and continue the interview rather than presenting the plan as approval-ready.

Then investigate relevant parts of the target codebase. Read applicable `AGENTS.md` and project guidance, inspect the current worktree, and identify the existing modules, callers, tests, fixtures, and configuration that the proposed feature may affect. Use context-mode tools for broad search or analysis when they are available in the terminal session. If the repository root contains `.codegraph/` and CodeGraph tools or CLI are available, use CodeGraph to locate relevant symbols and call paths. Treat either tool as optional: if it is unavailable or has no usable index, continue with ordinary repository scanning such as `rg --files`, focused `rg` searches, and targeted file reads. Do not install or configure tools as part of discovery. Bring findings that materially change the proposed behavior back to the interview and resolve them with the human before finalizing the plan.

After the interview and codebase investigation, create the IP README and consolidate the discussion into that feature's `README.md`: preserve the human's answers, decisions, assumptions, constraints, open questions, acceptance checks, relevant domain terms, and repository findings. The feature README is the canonical record of the plan discussion. If `grill-with-docs` creates ADRs or glossary notes, summarize and link the relevant items from the feature README; keep any separate ADR needed by the feature inside the same feature folder. Do not leave the plan's decisions only in chat or in a separate planning document.

Choose the next unused four-digit feature number by inspecting `features/IP-*/`. Create:

```text
trinary-workspace/features/IP-XXXX--<feature-title-slug>/README.md
```

The feature folder's `README.md` is the implementation plan; do not create a second IP document. Include:

- YAML frontmatter with `id`, `title`, `status`, `branch`, and `created_at` (UTC ISO 8601).
- Goal, context, scope, and explicit non-goals.
- Proposed design and relevant decisions/ADRs, with dates and rationale.
- Acceptance checks that prove the feature works.
- Human decisions and open questions.
- A task breakdown section that will link to each task README and list dependencies.
- A final human acceptance section for evidence and the human's explicit decision.

Set plan status to `Draft` while interviewing and drafting. Present the IP, including the discussion captured in its README and any proposed task/dependency breakdown, for human review. Do not create task folders or dispatch implementation work until the human explicitly approves the plan and breakdown. Record the approval and set status to `Approved`. If an approved plan changes materially, explain the change and get approval again before affected work continues.

### 3. Decompose the approved plan into tasks

Break the approved scope into small, verifiable tasks. Give each task the next unused four-digit number within this feature and a kebab-case title:

```text
trinary-workspace/features/IP-XXXX--<feature-title>/
├── README.md
└── tasks/
    └── T-XXXX--<task-title>/
        ├── README.md
        └── handoffs/
```

Each task `README.md` links to the feature README using a relative path and contains YAML frontmatter with `id`, `feature`, `title`, `status`, and `depends_on`. Also include scope, explicit exclusions where useful, acceptance criteria, relevant implementation context, and links to upstream tasks. Begin with `queued` status.

For features with more than one task, generate a feature-local `dashboard.html` from the task README frontmatter by running the skill's `scripts/generate_dashboard.py` with the feature folder path. Regenerate it after creating or changing a task's `status` or `depends_on` fields, including when a review outcome or blocker changes status, and after adding or changing a timestamped handoff. Do not create a dashboard for a single-task feature. If `dashboard.html` already exists without the skill's generated marker, preserve it and stop rather than overwrite it. The dashboard is a read-only snapshot: task READMEs remain canonical for status and dependencies; the latest timestamped handoff per task supplies activity and recipient. The task board has four lanes: `queued`, `ready`, and `blocked` go to Project manager; `in_progress` and `changes_requested` go to Worker; `review` goes to Reviewer; and `done` goes to Done. Cards show task ID/title, status, current owner, dependencies, and latest handoff role/outcome/time, with its summary when present. The separate handoff timeline lists every timestamped handoff newest first with its task, role, recipient, outcome, and summary when present. The dashboard also shows status counts and completion progress. Owner is `Completed` for `done` and always `Human` for `blocked`, regardless of handoff recipient; otherwise use a usable latest handoff recipient, falling back to `Human` for `needs_human`/`waiting_human`, `Reviewer` for `review`, `Worker` for `in_progress`, and `Project manager` for other statuses. The feature workflow must work without the dashboard or network access. The page loads DaisyUI and D3 from their online CDNs. Its auto-refresh toggle is off by default; enabling it sets the `#auto-refresh` URL hash and starts five-second page reloads, while disabling it clears the interval and hash. The URL hash persists through reloads and also works for `file://` dashboards without session storage. The enabled toggle turns green and animates its icon unless `prefers-reduced-motion` is set. The four lanes and handoff timeline scroll within their panels when content exceeds the available space.

Use this structure for every task README; keep the section names and frontmatter keys consistent. Replace the example values and remove optional placeholder bullets that do not apply:

```markdown
---
id: T-0001
feature: IP-0001
title: Example task
status: queued
depends_on: []
---

# T-0001: Example task

Feature plan: [IP-0001](../../README.md)

## Scope

Describe the specific outcome this task owns.

## Out of scope

- List exclusions, or write `None`.

## Dependencies

- List prerequisite task IDs and links, or write `None`.

## Acceptance criteria

- [ ] State observable, verifiable outcomes for this task.

## Implementation notes

- Record relevant constraints, decisions, or context, or write `None`.

## Handoffs

Append project-manager, worker, reviewer, and human-response records in [`handoffs/`](handoffs/). Do not overwrite earlier handoffs.
```

The `depends_on` frontmatter is the machine-readable source for dependency checks; keep the Dependencies section aligned with it. The project-manager updates only `status` as the task moves through the lifecycle. Change scope or acceptance criteria only through an approved plan change, and record the decision in the feature README and a project-manager handoff.

Represent dependencies as a directed acyclic graph within this feature. Validate that every dependency names an existing task, no task depends on itself, and there are no cycles. Show the task list and dependency order to the human. A dependency change after work starts pauses dispatch until the revised plan is approved.

After the plan and task breakdown are approved, set tasks with no dependencies to `ready`. A task becomes `ready` only when the plan is approved and every dependency is `done`.

Before setting the first task to `ready`, show the human the numbered task breakdown and dependency order and get approval. Record the approval in the feature README. If the human requests a change, revise the plan/task graph and revalidate dependencies before dispatch.

### 4. Dispatch one ready task to a worker

As project-manager, select one `ready` task in dependency order and set it to `in_progress`. Start a worker subagent with:

- The task README and its acceptance criteria.
- The feature README sections that define the relevant scope and constraints.
- Relevant dependency handoffs and implementation context.
- The requirement to work on the feature branch, run appropriate checks, and write a worker handoff in this task's `handoffs/` folder.

The worker investigates the assigned area before editing. Use context-mode tools for broad search or analysis when available. If `.codegraph/` exists at the target repository root and CodeGraph tools or CLI are available, use it to locate relevant symbols and call paths. If either capability is unavailable or the index is unusable, fall back to ordinary repository scanning (`rg --files`, focused `rg`, and targeted reads). Follow applicable repository instructions and inspect callers, tests, fixtures, and configuration affected by the change. Implement only the assigned task in the target project's files and do not change task status. The task brief may explicitly place an exercise artifact in its task folder; follow that scoped instruction. The worker handoff records the task ID, role, timestamp, summary, changed files, checks actually run and their results, unresolved concerns, and the next action. Never claim a check was run unless there is evidence it was run.

### 5. Send the worker handoff to an independent reviewer

Read the worker handoff, set the task to `review`, then start a reviewer subagent that has not implemented the task. Give the reviewer the worker handoff, task README, relevant feature acceptance criteria, and the implementation diff or code context. Ask it to check correctness, scope, acceptance criteria, and regressions, then write a reviewer handoff in the same task's `handoffs/` folder.

The reviewer handoff starts with exactly one verdict:

```text
VERDICT: APPROVED
```

or:

```text
VERDICT: CHANGES_REQUESTED
```

It includes evidence for the verdict and concrete findings or follow-up actions. The reviewer reports the result but does not change task status.

### 6. Process review and change requests

Read the reviewer handoff and act on its verdict:

- For `APPROVED`, set the task to `done`. Re-evaluate its dependents and set newly unblocked tasks to `ready`.
- For `CHANGES_REQUESTED`, set the task to `changes_requested`, give the worker the findings, then set it to `in_progress` while the worker performs rework. Repeat the worker/reviewer cycle. Allow up to three rework rounds for the task. If the third rework round is still not approved, stop and ask the human how to proceed.
- When progress requires human intervention to resolve an external impediment, set the task to `blocked` and pause the entire feature workflow. Do not dispatch or continue other tasks while any task is blocked. Write a project-manager handoff that states the blocker, impact, the specific human decision or action needed, and any reasonable options. Route it to the human; do not guess at requirements or silently bypass the blocker. Wait for the human to resolve the question or unblock the task. After each human response, write a new human-response handoff in the same task folder, link it to the project-manager request handoff, and distinguish what the human reported from what the project-manager independently verified. If the response does not resolve the blocker, keep the task `blocked`, record any remaining question in a new project-manager handoff, and wait again. Only after resolution, set the task to the appropriate status (`ready`, `in_progress`, or `queued`), re-evaluate the dependency graph, and resume the loop. Unmet dependencies alone are not a blocker; keep those tasks `queued`.

Use handoffs as append-only evidence; never edit an earlier handoff to change a verdict or outcome.

#### Repeat the task cycle until the feature is ready for acceptance

After each worker/reviewer cycle, re-read task statuses and re-evaluate the dependency graph, then repeat this loop:

1. If any task is `blocked`, stop all task dispatch and wait for the human intervention described in its project-manager handoff. After each response, write a linked human-response handoff. If the blocker remains, keep waiting with the task `blocked`; otherwise update the task status, re-evaluate dependencies, and restart this loop.
2. If all tasks are `done`, stop task dispatch and continue to feature acceptance.
3. If a task is still `in_progress`, `review`, or `changes_requested`, finish its worker/reviewer cycle before dispatching another task.
4. Otherwise, select one `ready` task in dependency order, run it through the worker/reviewer cycle, and start the loop again.
5. If no task is `ready` and unfinished tasks remain `queued`, recheck the dependency graph and identify why none can proceed. Do not mark the feature complete; report the issue and wait for human direction.

Never dispatch a task while any task is `blocked`, even if another independent task is ready. Never dispatch a task before every dependency is `done`. Feature acceptance begins only when every task is `done`.

### 7. Run feature acceptance and wait for the human

When every task is `done`, set the feature plan status to `Awaiting Human Acceptance`. Run the feature-level acceptance checks from the feature README and record the actual commands, results, and evidence. Present the evidence and any remaining limitations to the human.

Only after the human explicitly accepts the result, record that decision and set the plan status to `Accepted`. If the human requests changes, update the plan/task records and resume through the same dependency and review gates. Do not merge or push unless separately requested.

## Status reference

The project-manager is the only writer of task `status` values:

| Status | Meaning |
| --- | --- |
| `queued` | Plan or task breakdown is not approved, or dependencies remain. |
| `ready` | Approved and all dependencies are `done`. |
| `in_progress` | A worker is implementing the task. |
| `review` | Worker evidence is ready and the project-manager has dispatched review. |
| `changes_requested` | Reviewer requires worker rework. |
| `blocked` | The entire feature workflow is paused until the human resolves an external impediment or makes a decision. The project-manager records the needed intervention in a handoff and waits for the human before resuming any task. |
| `done` | Reviewer approved the task. |

Feature plan statuses are `Draft`, `Approved`, `Implementing`, `Awaiting Human Acceptance`, and `Accepted`. Use `Implementing` when the first task starts. `Accepted` requires explicit human acceptance.

## Handoff filenames

Write one new file per role handoff in that task's `handoffs/` directory:

```text
YYYYMMDD_HHMMSS--<role>-handoff-<n>.md
```

Use the UTC time when the handoff is written. `<role>` is `project-manager`, `worker`, `reviewer`, or `human`. The project-manager writes every file, including the `human` response record, which must clearly preserve the human's input rather than imply the human created the file. Increment `<n>` from 1 per role within the task folder. Inspect existing files before writing; if a timestamp collides, choose the next unused sequence number. Handoffs are append-only.

Use the role template below for every handoff. Replace all bracketed placeholders and remove guidance that does not apply. Keep each handoff append-only; never revise an earlier file to update its contents or verdict.

### Project-manager handoff

```markdown
# Project-manager handoff: T-XXXX

- Task: [task ID and link]
- Role: project-manager
- Timestamp (UTC): [YYYY-MM-DDTHH:MM:SSZ]
- Recipient: [worker, reviewer, human, or none]
- Event: [dispatch, status change, review routing, blocker, or other]
- Outcome: [what was decided or assigned]

## Context passed

- [Task brief, IP criteria, findings, or other context shared]

## Evidence

- [Handoff, status change, or other evidence]

## Next action

- [Who acts next and what they do]
```

For a blocker, use `Event: blocker escalation`. State the decision or action requested, why it is needed, the impact of waiting, and any options. This is the durable request sent to the human.

### Worker handoff

```markdown
# Worker handoff: T-XXXX

- Task: [task ID and link]
- Role: worker
- Timestamp (UTC): [YYYY-MM-DDTHH:MM:SSZ]
- Recipient: project-manager
- Outcome: [completed, partial, or blocked]

## Summary

[What changed and how it meets the task scope.]

## Changed files

- `[path]` — [change]

## Acceptance criteria

- [x] [criterion] — [evidence]
- [ ] [criterion not met] — [reason, if applicable]

## Checks run

- `[command or check]` — [passed, failed, or not run, with result]

## Remaining concerns

- [Concern, or `None`]

## Next action

- [Project-manager review routing or blocker follow-up]
```

### Reviewer handoff

The first line must be exactly one verdict. Start from `VERDICT: CHANGES_REQUESTED` and change it to `VERDICT: APPROVED` only when the implementation meets the task acceptance criteria and review checks pass.

```markdown
VERDICT: CHANGES_REQUESTED

# Reviewer handoff: T-XXXX

- Task: [task ID and link]
- Role: reviewer
- Timestamp (UTC): [YYYY-MM-DDTHH:MM:SSZ]
- Recipient: project-manager

## Summary

[What was reviewed and the reason for the verdict.]

## Findings

- [Finding with file/line or other evidence and a concrete requested change; write `None` if approved]

## Acceptance criteria review

- [x] [criterion] — [evidence]
- [ ] [criterion not met] — [evidence, if applicable]

## Checks run

- `[command or review check]` — [passed, failed, or not run, with result]

## Next action

- [Worker rework or project-manager marks task done and selects the next ready task]
```

### Human response handoff

The project-manager writes this record after the human responds. Preserve the response accurately; use a short verbatim quote when practical and label any paraphrase. Link the original blocker request. Record only actions the human reported or evidence the project-manager verified.

```markdown
# Human response handoff: T-XXXX

- Task: [task ID and link]
- Role: human
- Recorded by: project-manager
- Timestamp (UTC): [YYYY-MM-DDTHH:MM:SSZ]
- Related request: [link to the project-manager blocker handoff]
- Outcome: [resolved, decision made, or still blocked]

## Human response

> [Human's response, quoted where practical; otherwise mark this as a paraphrase.]

## Action and evidence

- Human-reported action: [what the human says they did, or `None`]
- Project-manager verification: [what was independently checked, or `Not verified`]

## Project-manager decision

- [How the response resolves or changes the task and why]

## Next action

- [Updated task status and the next workflow step, or the remaining human intervention needed]
```

## Terminal capability boundary

Use the host terminal's native subagent mechanism for worker and reviewer roles. If it is unavailable, explain that the independent review gate cannot be performed in this session and ask the human to provide subagent support or explicitly approve a weaker manual workflow. Do not silently act as both implementer and independent reviewer.
