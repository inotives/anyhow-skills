import importlib.util
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "generate_dashboard.py"
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location("generate_dashboard", SCRIPT)
dashboard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dashboard)


def write_task(root, task_id, title, status, dependencies):
    folder = root / "tasks" / f"T-{task_id[2:]}--task-{task_id[2:]}"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "README.md").write_text(
        f"---\nid: {task_id}\nfeature: IP-0001\ntitle: {title}\nstatus: {status}\ndepends_on: [{', '.join(dependencies)}]\n---\n",
        encoding="utf-8",
    )


def write_handoff(root, task_id, filename, role, recipient, outcome, timestamp, summary=""):
    folder = root / "tasks" / f"T-{task_id[2:]}--task-{task_id[2:]}" / "handoffs"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / filename).write_text(
        f"# Handoff\n\n- Role: {role}\n- Timestamp (UTC): {timestamp}\n- Recipient: {recipient}\n- Outcome: {outcome}\n\n## Summary\n\n{summary}\n",
        encoding="utf-8",
    )


class DashboardGenerationTests(unittest.TestCase):
    def test_multi_task_snapshot_and_updates_follow_readmes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            write_task(root, "T-0001", "Start", "ready", [])
            write_task(root, "T-0002", "Finish", "queued", ["T-0001"])
            self.assertEqual(dashboard.generate(root), "generated with 2 tasks")
            page = (root / "dashboard.html").read_text(encoding="utf-8")
            self.assertIn('"id":"T-0001"', page)
            self.assertIn('"status":"queued"', page)
            self.assertIn('"depends_on":["T-0001"]', page)
            self.assertIn("d3@7/+esm", page)
            self.assertNotIn('<meta http-equiv="refresh"', page)

            write_task(root, "T-0001", "Start", "done", [])
            write_task(root, "T-0002", "Finish", "ready", [])
            dashboard.generate(root)
            updated = (root / "dashboard.html").read_text(encoding="utf-8")
            self.assertIn('"status":"done"', updated)
            self.assertIn('"status":"ready"', updated)
            self.assertIn('"depends_on":[]', updated)
            self.assertNotIn('"source":"T-0001"', updated)

    def test_single_task_omits_generated_dashboard(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            write_task(root, "T-0001", "Only", "ready", [])
            write_task(root, "T-0002", "Temporary second task", "queued", ["T-0001"])
            dashboard.generate(root)
            self.assertTrue((root / "dashboard.html").exists())
            (root / "tasks" / "T-0002--task-0002" / "README.md").unlink()
            self.assertEqual(dashboard.generate(root), "omitted")
            self.assertFalse((root / "dashboard.html").exists())

    def test_multi_task_refuses_to_overwrite_unmarked_dashboard(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            write_task(root, "T-0001", "Start", "ready", [])
            write_task(root, "T-0002", "Finish", "queued", ["T-0001"])
            page = root / "dashboard.html"
            original = "<!doctype html><title>Human dashboard</title>\n"
            page.write_text(original, encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "refusing to overwrite"):
                dashboard.generate(root)
            self.assertEqual(page.read_text(encoding="utf-8"), original)

    def test_embedded_task_text_is_script_safe(self):
        tasks = [{"id": "T-0001", "title": "</script><script>alert(1)</script>", "status": "ready", "depends_on": []}]
        page = dashboard.render_html(tasks)
        self.assertNotIn("</script><script>alert", page)
        self.assertIn("\\u003c/script\\u003e", page)

    def test_latest_handoff_changes_owner_and_embedded_activity(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            write_task(root, "T-0001", "Complete", "done", [])
            write_task(root, "T-0002", "Waiting", "in_progress", ["T-0001"])
            write_handoff(root, "T-0002", "20261017_100000--worker-handoff-1.md", "worker", "project-manager", "completed", "2026-10-17T10:00:00Z")
            write_handoff(root, "T-0002", "20261017_110000--project-manager-handoff-2.md", "project-manager", "reviewer", "dispatched", "2026-10-17T11:00:00Z")

            dashboard.generate(root)
            first = (root / "dashboard.html").read_text(encoding="utf-8")
            self.assertIn('"owner":"Completed"', first)
            self.assertIn('"owner":"Reviewer"', first)
            self.assertIn('"role":"project-manager","recipient":"reviewer","outcome":"dispatched","timestamp":"2026-10-17T11:00:00Z"', first)

            write_handoff(root, "T-0002", "20261017_110000--project-manager-handoff-2.md", "project-manager", "human", "blocked for input", "2026-10-17T11:00:00Z")
            dashboard.generate(root)
            updated = (root / "dashboard.html").read_text(encoding="utf-8")
            self.assertIn('"owner":"Human"', updated)
            self.assertIn('"outcome":"blocked for input"', updated)

    def test_latest_handoff_uses_numeric_sequence_when_timestamps_match(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            write_task(root, "T-0001", "Start", "done", [])
            write_task(root, "T-0002", "Continue", "in_progress", ["T-0001"])
            timestamp = "2026-10-17T12:00:00Z"
            write_handoff(root, "T-0002", "20261017_120000--worker-handoff-9.md", "worker", "reviewer", "older sequence", timestamp)
            write_handoff(root, "T-0002", "20261017_120000--worker-handoff-10.md", "worker", "human", "newer sequence", timestamp)

            dashboard.generate(root)
            page = (root / "dashboard.html").read_text(encoding="utf-8")
            self.assertIn('"owner":"Human"', page)
            self.assertIn('"role":"worker","recipient":"human","outcome":"newer sequence"', page)
            self.assertIn('"role":"worker","recipient":"reviewer","outcome":"older sequence"', page)

    def test_kanban_routes_each_status_once_and_keeps_handoff_timeline(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            statuses = ["done", "in_progress", "review", "queued", "ready", "blocked", "changes_requested"]
            for index, status in enumerate(statuses, start=1):
                write_task(root, f"T-{index:04d}", f"Task {index}", status, [])
            write_handoff(root, "T-0001", "20261017_090000--worker-handoff-1.md", "worker", "project-manager", "completed", "2026-10-17T09:00:00Z", "Inspected the repository safely.")
            write_handoff(root, "T-0002", "20261017_110000--worker-handoff-9.md", "worker", "reviewer", "completed", "2026-10-17T11:00:00Z", "Generated the first dependency view.")
            write_handoff(root, "T-0003", "20261017_110000--reviewer-handoff-10.md", "reviewer", "project-manager", "changes_requested", "2026-10-17T11:00:00Z", "Requested a small layout correction.")
            write_handoff(root, "T-0006", "20261017_120000--project-manager-handoff-1.md", "project-manager", "project-manager", "awaiting human intervention", "2026-10-17T12:00:00Z", "Needs a human decision.")

            dashboard.generate(root)
            page = (root / "dashboard.html").read_text(encoding="utf-8")
            task_data = json.loads(re.search(r"const tasks = (\[.*?\]);", page).group(1))
            embedded = re.search(r"const handoffs = (\[.*?\]);", page).group(1)
            handoffs = json.loads(embedded)
            expected_lanes = ["Done", "Worker", "Reviewer", "Project manager", "Project manager", "Project manager", "Worker"]
            self.assertEqual([task["lane"] for task in task_data], expected_lanes)
            self.assertEqual(len({task["id"] for task in task_data}), len(statuses))
            self.assertEqual(task_data[5]["owner"], "Human")
            self.assertEqual([item["task_id"] for item in handoffs], ["T-0006", "T-0003", "T-0002", "T-0001"])
            self.assertEqual(handoffs[1]["sequence"], 10)
            self.assertEqual(handoffs[1]["summary"], "Requested a small layout correction.")
            self.assertEqual([lane for lane in [task["lane"] for task in task_data] if lane == "Project manager"].count("Project manager"), 3)
            self.assertIn('const laneDefinitions = [', page)
            self.assertEqual(page.count('name: "Project manager"'), 1)
            self.assertEqual(page.count('name: "Worker"'), 1)
            self.assertEqual(page.count('name: "Reviewer"'), 1)
            self.assertEqual(page.count('name: "Done"'), 1)
            self.assertIn('task.lane === lane.name', page)
            self.assertIn('task-card-status', page)
            self.assertIn('field("Owner", task.owner);', page)
            self.assertIn('field("Depends", task.depends_on.length ? task.depends_on.join(", ") : "None");', page)
            self.assertIn('task.latest_handoff.summary', page)
            self.assertIn('id="handoff-stack"', page)
            self.assertIn('class="card handoff-panel"', page)
            self.assertIn('id="kanban-board"', page)
            self.assertNotIn('class="graph"', page)
            self.assertNotIn('Dependency map', page)
            self.assertIn("${handoffs.length} handoffs", page)

    def test_owner_fallbacks_and_dashboard_overview_fields(self):
        empty_handoff = {"recipient": ""}
        self.assertEqual(dashboard.current_owner("done", empty_handoff), "Completed")
        self.assertEqual(dashboard.current_owner("blocked", empty_handoff), "Human")
        self.assertEqual(dashboard.current_owner("blocked", {"recipient": "project-manager"}), "Human")
        self.assertEqual(dashboard.current_owner("review", empty_handoff), "Reviewer")
        self.assertEqual(dashboard.current_owner("in_progress", empty_handoff), "Worker")
        self.assertEqual(dashboard.current_owner("ready", empty_handoff), "Project manager")
        self.assertEqual(dashboard.kanban_lane("queued"), "Project manager")
        self.assertEqual(dashboard.kanban_lane("blocked"), "Project manager")
        self.assertEqual(dashboard.kanban_lane("changes_requested"), "Worker")
        self.assertEqual(dashboard.kanban_lane("review"), "Reviewer")
        self.assertEqual(dashboard.kanban_lane("done"), "Done")
        page = dashboard.render_html([])
        self.assertIn("Overall completion", page)
        self.assertIn('id="completion-progress"', page)
        self.assertIn('aria-label="Task counts by status"', page)
        self.assertIn('id="handoff-stack"', page)
        self.assertIn('task.latest_handoff.role', page)
        self.assertIn('task.latest_handoff.outcome', page)
        self.assertIn('task.latest_handoff.timestamp', page)
        self.assertIn("feature monitor", page)

    def test_dark_theme_accessible_refresh_and_reduced_motion(self):
        page = dashboard.render_html([])
        self.assertIn('<html lang="en" data-theme="dark">', page)
        self.assertIn('aria-label="Toggle automatic dashboard refresh" aria-pressed="false"', page)
        self.assertIn('class="refresh-icon" aria-hidden="true" alt="" width="20" height="20" src="https://cdn-icons-png.flaticon.com/512/3917/3917293.png"', page)
        self.assertIn('.refresh-control[aria-pressed="true"] .refresh-icon', page)
        self.assertIn("animation: refresh-spin 1.5s linear infinite", page)
        self.assertIn("filter: brightness(0) invert(1)", page)
        self.assertIn("@media (prefers-reduced-motion: reduce)", page)
        self.assertIn('@media (prefers-reduced-motion: reduce) { .refresh-control[aria-pressed="true"] .refresh-icon { animation: none; } }', page)
        self.assertIn('href="https://www.magnific.com">Magnific</a> from <a href="https://www.flaticon.com/">Flaticon</a>', page)
        self.assertNotIn("<svg class=\"refresh-icon\"", page)
        self.assertIn(".kanban-lane {", page)
        self.assertIn(".task-card {", page)

    def test_dashboard_fills_viewport_and_kanban_scrolls_responsively(self):
        page = dashboard.render_html([])
        self.assertIn("height: 100vh; height: 100dvh", page)
        self.assertIn(".dashboard { box-sizing: border-box; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto;", page)
        self.assertIn(".kanban-board { display: grid; grid-template-columns: repeat(4, minmax(220px, 1fr));", page)
        self.assertIn(".kanban-board {", page)
        self.assertIn("overflow: auto;", page)
        self.assertIn(".kanban-lane-cards { display: grid; align-content: start;", page)
        self.assertNotIn('<meta http-equiv="refresh" content="5">', page)
        self.assertNotIn('d3.select(".graph")', page)
        self.assertNotIn('class="graph"', page)
        self.assertIn('refreshControl.addEventListener("click", () => setAutoRefreshEnabled(refreshControl.getAttribute("aria-pressed") !== "true"));', page)
        self.assertNotIn("onclick=", page)

    def test_auto_refresh_is_opt_in_persistent_and_toggleable(self):
        page = dashboard.render_html([])
        self.assertNotIn('<meta http-equiv="refresh"', page)
        self.assertIn('aria-label="Toggle automatic dashboard refresh" aria-pressed="false"', page)
        self.assertIn('.refresh-control[aria-pressed="true"] { border-color: rgba(74, 222, 128, .8); background: #16a34a;', page)
        self.assertIn('.refresh-control[aria-pressed="true"] .refresh-icon { animation: refresh-spin 1.5s linear infinite;', page)
        self.assertIn('const autoRefreshHash = "#auto-refresh";', page)
        self.assertIn('setAutoRefreshEnabled(window.location.hash === autoRefreshHash);', page)
        self.assertIn('window.setInterval(() => window.location.reload(), 5000)', page)
        self.assertIn('window.clearInterval(autoRefreshInterval)', page)
        self.assertIn('autoRefreshInterval = null', page)
        self.assertNotIn("sessionStorage", page)


if __name__ == "__main__":
    unittest.main()
