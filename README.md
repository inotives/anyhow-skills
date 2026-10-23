<p align="center">
  <img src="assets/anyhow-skills.svg" alt="Anyhow Skills mark" width="150">
</p>

<h1 align="center">anyhow-skills</h1>

<p align="center">
  A personal playground for small, niche, agent-agnostic skills.
</p>

<p align="center">
  A collection of seven skills with different runtimes, data needs, and outputs.
</p>

<p align="center">
  <a href="skills/">Skills</a>
  ·
  <a href="docs/phase-1-repository-and-singapore-toto.md">Repository history</a>
</p>

---

## What This Repository Contains

`anyhow-skills` is a personal collection of focused agent skills. Each skill
documents its own trigger, workflow, requirements, and limitations in its
`SKILL.md`. The collection includes local data tools, research workflows, and
skills that generate shareable HTML.

Runtime and network requirements vary by skill. Some retrieve online data and
store it locally; others use online sources or CDNs to create learning
materials, reports, or presentations. Check the linked skill instructions
before running a workflow.

## Skill Model

Each skill is an isolated directory:

```text
skills/
└── <skill-name>/
    ├── SKILL.md          # purpose, trigger, workflow, requirements, limits
    ├── package.json      # only when the skill has executable code
    ├── scripts/          # optional
    ├── schema/           # optional SQL schema and migrations
    ├── examples/          # optional sample inputs and outputs
    └── data/             # ignored local SQLite/DuckDB runtime data
```

The `SKILL.md` is the source of truth for each skill. Skill folders use
lowercase kebab-case names and are designed to be copied independently. A skill
may include scripts, examples, schemas, or local runtime state when its workflow
needs them.

## Skills

| Skill | What it does |
| --- | --- |
| [Singapore Toto](skills/singapore-toto/SKILL.md) | Import or refresh Singapore Toto results, inspect recent draws, and generate clearly labeled heuristic estimates from local history. |
| [Interactive Learning HTML](skills/interactive-learning-html/SKILL.md) | Build a one-screen interactive explainer as a single HTML file with inline content, diagrams, and interactions. |
| [Interactive Deck (Reveal.js)](skills/interactive-deck-reveal/SKILL.md) | Create a browser-based presentation with progressive diagrams and charts, packaged as one HTML file. |
| [HTML Report (D3 + SVG)](skills/html-report-d3/SKILL.md) | Create a sanitized, shareable HTML report with tabs, tables, charts, and checks for sensitive details. |
| [Stock Data Collector](skills/stock-data-collector/SKILL.md) | Fetch daily ticker prices and record market sentiment analyses in a local SQLite database, joinable by ticker and date. |
| [Chinese Learning](skills/chinese-learning/SKILL.md) | Teach Mandarin through research-backed, context-driven lessons for adults and children. Generates an interactive HTML page with embedded lesson data, inline illustrations, and optional iPad touch writing practice. |
| [Learn Chinese Word](skills/learn-chinese-word/SKILL.md) | Turn one Chinese word into a one-screen, kid-friendly HTML app with 3D tiles (Three.js), phrases, stroke-order writing practice, mini games, and a quiz. |

## Local Data

- Runtime databases belong in `skills/<skill>/data/` and are ignored by Git.
- Schemas and migrations belong in `schema/` and are versioned.
- Example and fixture inputs may live alongside the skill that uses them.
- Downloaded data is disposable by default.
- Data-using skills must document sources, retrieval time, refresh commands,
  reset/rebuild behavior, privacy boundaries, and provenance.
- A failed refresh must not destroy an existing local database.

## Development Principles

- Keep the smallest complete implementation.
- Prefer an existing platform feature or installed dependency over new code.
- Keep skills agent-agnostic and independently copyable.
- Make network collection explicit in documentation.
- Label heuristic output honestly; historical patterns cannot improve random
  lottery odds.
- Do not claim current data or completed validation without evidence.

## Repository History

The repository began by establishing the skill layout and migrating the
Singapore Toto tool. The linked document records that initial plan and its
decisions; it is historical context, not a current project roadmap. Each
skill's `SKILL.md` and implementation describe its current behavior.

See [the initial repository and Toto plan](docs/phase-1-repository-and-singapore-toto.md).
