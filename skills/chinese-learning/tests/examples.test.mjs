import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplesDir = join(skillDir, "examples");
const renderer = join(skillDir, "scripts", "build-lesson.mjs");
const generatedOutput = resolve(skillDir, "../..", "generated_output");
const examples = ["rainy-school-morning.json", "workday-break.json"].map(name =>
  JSON.parse(readFileSync(join(examplesDir, name), "utf8"))
);

function build(lesson) {
  const dir = mkdtempSync(join(tmpdir(), "chinese-learning-example-"));
  try {
    const input = join(dir, "lesson.json");
    const outputDir = join(dir, "output");
    mkdirSync(outputDir);
    const output = join(outputDir, "lesson.html");
    writeFileSync(input, JSON.stringify(lesson));
    execFileSync(process.execPath, [renderer, input, output]);
    assert.deepEqual(readdirSync(outputDir), ["lesson.html"], "generated output should contain only the HTML artifact");
    return readFileSync(output, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("examples use researched targets and direct source links", () => {
  assert.deepEqual(examples.map(({ meta }) => meta.target), ["雨", "休息"]);
  assert.deepEqual(examples.map(({ meta }) => meta.pinyin), ["yǔ", "xiūxi"]);
  for (const lesson of examples) {
    assert.ok(lesson.sources.length > 0);
    assert.ok(lesson.sources.every(source => /^https:\/\//.test(source.url)));
  }
});

test("lesson concepts, flow, and selected interactions fit each meaning", () => {
  const [rain, breakLesson] = examples;
  assert.notEqual(rain.meta.concept, breakLesson.meta.concept);
  assert.notDeepEqual(rain.sections.map(section => section.type), breakLesson.sections.map(section => section.type));
  assert.ok(rain.sections.some(section => section.type === "quiz"));
  assert.ok(breakLesson.sections.some(section => section.type === "dialogue"));
  assert.ok(breakLesson.sections.some(section => section.type === "compare"));
});

test("rendered pages keep source links and interactions without saving learner data", () => {
  const [rainHtml, breakHtml] = examples.map(build);
  assert.match(rainHtml, /<svg class="lesson-art"/);
  assert.doesNotMatch(rainHtml, /<img\b|lesson-art\.svg/);
  assert.match(rainHtml, /<script id="lesson-data" type="application\/json">/);
  assert.match(rainHtml, /https:\/\/zdic\.net\/hans\/%E9%9B%A8/);
  assert.match(rainHtml, /role="tablist"/);
  assert.match(rainHtml, /A Primary 1 learner is getting ready/);
  assert.match(rainHtml, /id="panel-learn"/);
  assert.match(rainHtml, /id="panel-practice"/);
  assert.match(rainHtml, /ArrowRight/);
  assert.match(rainHtml, /id="sources-dialog"/);
  assert.match(rainHtml, /id="popover-2"/);
  assert.match(rainHtml, /data-dialog="popover-2"/);
  assert.match(rainHtml, /Freehand character shape practice area/);
  assert.match(rainHtml, /pointerdown/);
  assert.match(rainHtml, /pointermove/);
  assert.match(rainHtml, /pointercancel/);
  assert.match(rainHtml, /touch-action:none/);
  assert.match(rainHtml, /Clear writing/);
  assert.match(rainHtml, /does not teach stroke order or score correctness/);
  assert.match(rainHtml, /Writing stays on this page and is not saved/);
  assert.doesNotMatch(breakHtml, /Freehand character shape practice area/);
  assert.match(rainHtml, /Choose for the rainy walk/);
  assert.match(rainHtml, /It is raining today/);
  assert.match(breakHtml, /https:\/\/zdic\.net\/hans\/%E4%BC%91%E6%81%AF/);
  assert.match(breakHtml, /A natural workplace exchange/);
  assert.match(breakHtml, /Pause or continue\?/);
  for (const html of [rainHtml, breakHtml]) {
    assert.doesNotMatch(html, /\b(?:localStorage|sessionStorage|indexedDB)\b/);
  }
});

test("embedded authoring JSON round-trips while script closers stay escaped", () => {
  const lesson = structuredClone(examples[0]);
  lesson.meta.title = "</script><img src=x onerror=alert(1)> & test";
  const html = build(lesson);
  const dataBlock = html.match(/<script id="lesson-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(dataBlock);
  assert.doesNotMatch(dataBlock[1], /<\/script/i);
  assert.match(dataBlock[1], /\\u003c\/script\\u003e/i);
  assert.deepEqual(JSON.parse(dataBlock[1]), lesson);
});

test("checked-in first-run HTML matches the maintained rainy-school example", () => {
  const html = readFileSync(join(generatedOutput, "chinese-learning-first-run.html"), "utf8");
  const embedded = html.match(/<script id="lesson-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded), examples[0]);
  assert.ok(examples[0].sections.some(section => section.type === "popover"));
  assert.equal(examples[0].practice?.writing, true);
  assert.match(html, /data-dialog="popover-2"/);
  assert.match(html, /Freehand character shape practice area/);
  assert.equal(existsSync(join(generatedOutput, "chinese-learning-first-run.json")), false);
});

test("Practice tab sizes the canvas and the Sources dialog opens repeatedly", () => {
  const html = build(examples[0]);
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);

  const element = () => ({ listeners: {}, addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); } });
  const panels = new Map(["learn", "use", "practice"].map(id => [`panel-${id}`, { hidden: id !== "learn" }]));
  const tabs = ["learn", "use", "practice"].map(id => {
    const tab = element();
    tab.getAttribute = name => name === "aria-controls" ? `panel-${id}` : null;
    tab.setAttribute = () => {};
    tab.focus = () => {};
    return tab;
  });
  const sourcesButton = element();
  const sourcesDialog = { open: false, opens: 0, showModal() { assert.equal(this.open, false); this.open = true; this.opens++; }, close() { this.open = false; } };
  const practicePanel = panels.get("panel-practice");
  const canvas = element();
  canvas.width = 300;
  canvas.height = 150;
  canvas.getBoundingClientRect = () => practicePanel.hidden ? { width: 0, height: 0, left: 0, top: 0 } : { width: 320, height: 220, left: 0, top: 0 };
  canvas.getContext = () => ({ setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, closePath() {}, clearRect() {} });
  canvas.setPointerCapture = () => {};
  const clearButton = element();
  const ids = new Map([[
    "listen", element()
  ], ["sources-open", sourcesButton], ["sources-dialog", sourcesDialog]]);
  const windowEvents = {};
  const window = { devicePixelRatio: 2, addEventListener(type, handler) { (windowEvents[type] ??= []).push(handler); }, dispatchEvent(event) { for (const handler of windowEvents[event.type] ?? []) handler(event); } };
  const document = {
    getElementById(id) { return panels.get(id) ?? ids.get(id); },
    querySelectorAll(selector) { return selector === "[role=tab]" ? tabs : []; },
    querySelector(selector) { return selector === ".writing-board canvas" ? canvas : selector === ".clear-writing" ? clearButton : null; }
  };
  runInNewContext(script, { document, window, Event: class { constructor(type) { this.type = type; } }, SpeechSynthesisUtterance: class {} });

  assert.equal(canvas.width, 300, "hidden canvas should not be initialized at zero size");
  tabs[2].listeners.click[0]();
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 440);
  assert.equal(sourcesButton.listeners.click.length, 1);
  for (let i = 0; i < 2; i++) {
    sourcesButton.listeners.click[0]();
    sourcesDialog.close();
  }
  assert.equal(sourcesDialog.opens, 2);
});
