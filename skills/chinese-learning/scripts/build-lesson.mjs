#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node scripts/build-lesson.mjs <lesson.json> <lesson.html>");
  process.exit(2);
}

const esc = value => String(value ?? "").replace(/[&<>\"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));
const text = value => esc(value).replace(/\n/g, "<br>");
const required = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
};
const lesson = JSON.parse(readFileSync(resolve(input), "utf8"));
if (!lesson || typeof lesson !== "object" || Array.isArray(lesson)) throw new Error("Lesson must be a JSON object");
const meta = lesson.meta ?? {};
const target = required(meta.target, "meta.target");
const title = required(meta.title, "meta.title");
if (!Array.isArray(lesson.sections) || lesson.sections.length < 1) throw new Error("sections must be a non-empty array");

function illustration(svg) {
  if (!svg) return "";
  if (!Array.isArray(svg.elements)) throw new Error("illustration.elements must be an array of safe SVG shapes");
  const viewBox = /^[0-9. -]+$/.test(svg.viewBox ?? "") ? svg.viewBox : "0 0 320 180";
  const allowed = new Set(["rect", "circle", "line", "ellipse", "text"]);
  const shape = svg.elements.map(item => {
    if (!allowed.has(item.type)) throw new Error(`Unsupported SVG shape: ${item.type}`);
    const attrs = Object.entries(item).filter(([key]) => key !== "type" && key !== "text")
      .map(([key, value]) => {
        if (!["x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "fill", "stroke", "stroke-width", "opacity", "text-anchor", "font-size"].includes(key)) throw new Error(`Unsupported SVG attribute: ${key}`);
        if (key === "fill" || key === "stroke") {
          if (!/^(#[0-9a-f]{3,8}|[a-z]{1,20})$/i.test(String(value))) throw new Error(`Invalid SVG color: ${value}`);
        } else if (key === "text-anchor") {
          if (!["start", "middle", "end"].includes(value)) throw new Error(`Invalid text anchor: ${value}`);
        } else if (!Number.isFinite(Number(value))) throw new Error(`SVG ${key} must be numeric`);
        return `${key}="${esc(value)}"`;
      }).join(" ");
    return item.type === "text" ? `<text ${attrs}>${esc(item.text)}</text>` : `<${item.type} ${attrs}/>`;
  }).join("");
  return `<svg class="lesson-art" viewBox="${viewBox}" role="img" aria-label="${esc(svg.label || "Lesson illustration")}" xmlns="http://www.w3.org/2000/svg">${shape}</svg>`;
}

function section(block, index) {
  const heading = block.title ? `<h2>${text(block.title)}</h2>` : "";
  const body = block.text ? `<p>${text(block.text)}</p>` : "";
  switch (block.type) {
    case "scene":
    case "meaning":
    case "origin":
    case "usage":
      return `<article class="card lesson-block"><div class="card-body">${heading}${body}${block.illustration ? illustration(block.illustration) : ""}</div></article>`;
    case "reveal":
      return `<article class="card lesson-block"><div class="card-body">${heading}<details><summary>${text(required(block.prompt, `sections[${index}].prompt`))}</summary><p>${text(required(block.answer, `sections[${index}].answer`))}</p></details></div></article>`;
    case "popover": {
      const id = `popover-${index}`;
      const prompt = required(block.prompt, `sections[${index}].prompt`);
      const answer = required(block.answer, `sections[${index}].answer`);
      return `<article class="card lesson-block"><div class="card-body">${heading}${body}<button class="btn popover-trigger" type="button" data-dialog="${id}">${text(block.label || "Explore this idea")}</button><dialog id="${id}" aria-labelledby="${id}-title"><form method="dialog"><h2 id="${id}-title">${text(prompt)}</h2><p>${text(answer)}</p><button class="btn" aria-label="Close explanation">Close</button></form></dialog></div></article>`;
    }
    case "compare":
      if (!Array.isArray(block.items) || block.items.length < 2) throw new Error(`sections[${index}].items needs at least two entries`);
      return `<article class="card lesson-block"><div class="card-body">${heading}<div class="compare-grid">${block.items.map(item => `<section><h3>${text(required(item.label, "comparison label"))}</h3><p>${text(required(item.text, "comparison text"))}</p></section>`).join("")}</div>${body}</div></article>`;
    case "dialogue":
      if (!Array.isArray(block.lines) || !block.lines.length) throw new Error(`sections[${index}].lines must be a non-empty array`);
      return `<article class="card lesson-block"><div class="card-body">${heading}<ol class="dialogue">${block.lines.map(line => `<li><b>${text(required(line.speaker, "dialogue speaker"))}</b><span>${text(required(line.text, "dialogue text"))}</span></li>`).join("")}</ol>${body}</div></article>`;
    case "quiz": {
      if (!Array.isArray(block.choices) || block.choices.length < 2 || !Number.isInteger(block.answerIndex) || block.answerIndex < 0 || block.answerIndex >= block.choices.length) throw new Error(`sections[${index}] has an invalid quiz`);
      const id = `quiz-${index}`;
      return `<article class="card lesson-block quiz" data-answer="${block.answerIndex}"><div class="card-body">${heading}<p>${text(required(block.question, "quiz question"))}</p><div role="group" aria-label="Answer choices">${block.choices.map((choice, i) => `<button class="btn btn-outline choice" type="button" data-choice="${i}" aria-describedby="${id}-result">${text(choice)}</button>`).join("")}</div><p id="${id}-result" class="result" aria-live="polite"></p></div></article>`;
    }
    default: throw new Error(`Unsupported section type: ${block.type}`);
  }
}

const groups = [
  { id: "learn", label: "Learn", types: ["scene", "meaning", "origin"] },
  { id: "use", label: "Use", types: ["usage", "compare", "dialogue", "popover"] },
  { id: "practice", label: "Practice", types: ["reveal", "quiz"] }
].map(group => ({ ...group, sections: lesson.sections.map((block, i) => ({ block, i })).filter(({ block }) => group.types.includes(block.type)) }))
  .filter(group => group.sections.length || (group.id === "practice" && lesson.practice?.writing === true));

const tabs = groups.map((group, i) => `<button class="tab" type="button" role="tab" id="tab-${group.id}" aria-controls="panel-${group.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${group.label}</button>`).join("");
const panels = groups.map((group, i) => `<section class="tab-panel" style="height:100%" role="tabpanel" id="panel-${group.id}" aria-labelledby="tab-${group.id}"${i ? " hidden" : ""}>${group.id === "learn" && (lesson.illustration || meta.context || meta.concept) ? `<article class="card lesson-block"><div class="card-body">${lesson.illustration ? illustration(lesson.illustration) : ""}${meta.context ? `<p>${text(meta.context)}</p>` : ""}${meta.concept ? `<p>Lesson idea: ${text(meta.concept)}</p>` : ""}</div></article>` : ""}${group.sections.map(({ block, i }) => section(block, i)).join("\n")}${group.id === "practice" && lesson.practice?.writing === true ? `<article class="card lesson-block writing-card"><div class="card-body"><h2>Write the character shape</h2><p>${text(lesson.practice.prompt || `Use your finger or stylus to write ${target}. Practice the overall shape; this does not teach stroke order.`)}</p><div class="writing-board"><span class="writing-guide" aria-hidden="true">${text(target)}</span><canvas aria-label="Freehand character shape practice area">Freehand writing practice area</canvas></div><button class="btn clear-writing" type="button">Clear writing</button><p>Practice the shape only; this does not teach stroke order or score correctness. Writing stays on this page and is not saved.</p></div></article>` : ""}</section>`).join("\n");
const sources = (lesson.sources ?? []).map(source => {
  const url = new URL(required(source.url, "source.url"));
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Source links must use HTTP or HTTPS");
  return `<li><a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${text(required(source.title, "source.title"))}</a>${source.note ? ` — ${text(source.note)}` : ""}</li>`;
}).join("");
const pronunciation = meta.pinyin ? `<span class="pinyin">${text(meta.pinyin)}</span>` : "";
const context = meta.context ? `<p class="context">${text(meta.context)}</p>` : "";
const concept = meta.concept ? `<p class="concept">Lesson idea: ${text(meta.concept)}</p>` : "";
const spokenTarget = JSON.stringify(target).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const embeddedLesson = JSON.stringify(lesson).replace(/[<>&\u2028\u2029]/g, character => ({
  "<": "\\u003c", ">": "\\u003e", "&": "\\u0026", "\u2028": "\\u2028", "\u2029": "\\u2029"
}[character]));
const html = `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light"><title>${esc(title)}</title>
<link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css"><script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style>
:root{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#182536;background:#f4f7fb}*{box-sizing:border-box}body{margin:0;line-height:1.45;overflow:hidden}.page{height:100vh;height:100svh;max-width:1100px;margin:auto;padding:clamp(.5rem,2vw,1.25rem);display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:.65rem}header{min-height:0;padding:.7rem 1rem;border-radius:1rem;background:linear-gradient(130deg,#173d68,#3979a6);color:white;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:1rem}header h1{font-size:clamp(1.15rem,2.5vw,2rem);line-height:1.1;margin:0}header .target{font-size:1.25rem;margin:0}.pinyin{font-size:.95rem;margin-left:.4rem;opacity:.9}header .meaning{margin:.15rem 0 0}.context,.concept{display:none}.lesson-art{display:none}#listen{grid-column:2;grid-row:1/4}.tabs{display:flex;gap:.4rem;overflow-x:auto;padding:.1rem}.tab{border:1px solid #b8cadb;background:white;color:#173d68;border-radius:.6rem;padding:.55rem 1rem;font:inherit;font-weight:700;white-space:nowrap}.tab[aria-selected=true]{background:#173d68;color:white;border-color:#173d68}.tab:focus-visible,button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #f5a623;outline-offset:2px}.tab-panel{min-height:0;overflow:auto;overscroll-behavior:contain;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr));grid-auto-rows:max-content;align-content:start;gap:.65rem;padding:.1rem}.tab-panel[hidden]{display:none}.lesson-block{min-width:0;background:white;border:1px solid #dce5ee;border-radius:.8rem;box-shadow:0 4px 14px #23384d0a}.card-body{padding:.8rem}.card-body h2{margin:0 0 .35rem;font-size:1.1rem}.card-body p{margin:.35rem 0}.lesson-art{display:block;width:min(100%,280px);height:auto;max-height:160px;margin:.4rem auto}.compare-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.5rem}.compare-grid section,.dialogue li{padding:.65rem;border-radius:.6rem;background:#eef5fa}.compare-grid h3{margin:.1rem 0}.dialogue{list-style:none;padding:0;margin:.2rem 0;display:grid;gap:.45rem}.dialogue li{display:flex;gap:.6rem}.dialogue b{min-width:4rem}.choice{margin:.2rem;min-height:44px}.result{min-height:1.3rem;font-weight:700}details{padding:.7rem;background:#eef5fa;border-radius:.6rem}summary{cursor:pointer;font-weight:700}a{color:#075a9c;text-decoration:underline}footer{display:none}button{cursor:pointer;min-height:44px}dialog{width:min(90vw,32rem);border:0;border-radius:1rem;padding:0;box-shadow:0 12px 48px #10243855}dialog::backdrop{background:#10243899}.popover-trigger{margin-top:.4rem}.writing-board{height:clamp(150px,36vh,300px);position:relative;overflow:hidden;border:2px dashed #9cb1c5;border-radius:.75rem;background:#f8fbfe;touch-action:none;user-select:none}.writing-guide{position:absolute;inset:0;display:grid;place-items:center;color:#d9e2ec;font-size:min(38vw,clamp(110px,30vh,240px));line-height:1;pointer-events:none;user-select:none}.writing-board canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair}.clear-writing{margin-top:.4rem}@media(max-width:700px){.page{padding:.45rem;gap:.45rem}header{padding:.6rem .75rem}.tab-panel{grid-template-columns:1fr}.writing-board{height:clamp(145px,34vh,260px)}}@media(orientation:landscape) and (min-width:700px){.page{max-width:none}.tab-panel{grid-template-columns:repeat(2,minmax(0,1fr))}.writing-card{grid-column:span 2}.writing-board{height:min(29vh,210px)}}@media(max-height:500px){.page{gap:.3rem;padding:.35rem}header{padding:.4rem .7rem}.tab-panel{gap:.35rem}.card-body{padding:.55rem}.writing-board{height:28vh;min-height:110px}}</style></head>
<body><script id="lesson-data" type="application/json">${embeddedLesson}</script><main class="page"><header><p class="target"><strong>${text(target)}</strong>${pronunciation}</p><h1>${text(title)}</h1>${meta.meaning ? `<p class="meaning">${text(meta.meaning)}</p>` : ""}${context}${concept}<button class="btn btn-accent" type="button" id="listen">🔊 Listen</button>${sources ? `<button class="btn" type="button" id="sources-open">Sources</button>` : ""}</header>
<nav class="tabs" role="tablist" aria-label="Lesson activities">${tabs}</nav><div class="panels" style="min-height:0;height:100%;overflow:hidden">${panels}</div></main>${sources ? `<dialog id="sources-dialog" aria-labelledby="sources-title"><form method="dialog"><h2 id="sources-title">Sources</h2><ul>${sources}</ul><button class="btn">Close</button></form></dialog>` : ""}
<script>
document.getElementById("listen").addEventListener("click",()=>{if(!window.speechSynthesis)return;const utterance=new SpeechSynthesisUtterance(${spokenTarget});utterance.lang="zh-CN";speechSynthesis.cancel();speechSynthesis.speak(utterance)});
document.querySelectorAll("[role=tab]").forEach((tab,index,tabs)=>{tab.addEventListener("click",()=>activate(tab));tab.addEventListener("keydown",event=>{if(!["ArrowRight","ArrowLeft","Home","End"].includes(event.key))return;event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?tabs.length-1:(index+(event.key==="ArrowRight"?1:tabs.length-1))%tabs.length;tabs[next].focus();activate(tabs[next])})});function activate(tab){document.querySelectorAll("[role=tab]").forEach(item=>{const selected=item===tab;item.setAttribute("aria-selected",String(selected));item.tabIndex=selected?0:-1;document.getElementById(item.getAttribute("aria-controls")).hidden=!selected});window.dispatchEvent(new Event("lesson-tab-change"))}
document.querySelectorAll(".quiz").forEach(q=>q.querySelectorAll(".choice").forEach(b=>b.addEventListener("click",()=>{const correct=Number(b.dataset.choice)===Number(q.dataset.answer);q.querySelector(".result").textContent=correct?"Correct!":"Try again.";q.querySelectorAll(".choice").forEach(x=>x.setAttribute("aria-pressed",String(x===b)))})));
document.querySelectorAll(".popover-trigger").forEach(button=>button.addEventListener("click",()=>document.getElementById(button.dataset.dialog).showModal()));
document.getElementById("sources-open")?.addEventListener("click",()=>document.getElementById("sources-dialog").showModal());
const canvas=document.querySelector(".writing-board canvas");if(canvas){const ctx=canvas.getContext("2d");function resize(){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const dpr=window.devicePixelRatio||1;canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineWidth=7;ctx.lineCap="round";ctx.lineJoin="round"}resize();window.addEventListener("resize",resize);window.addEventListener("lesson-tab-change",resize);let drawing=false;const point=event=>{const rect=canvas.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top}};canvas.addEventListener("pointerdown",event=>{event.preventDefault();drawing=true;canvas.setPointerCapture(event.pointerId);const p=point(event);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.01,p.y+.01);ctx.stroke()});canvas.addEventListener("pointermove",event=>{if(!drawing)return;event.preventDefault();const p=point(event);ctx.lineTo(p.x,p.y);ctx.stroke()});const stop=()=>{drawing=false;ctx.closePath()};canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointercancel",stop);document.querySelector(".clear-writing").addEventListener("click",()=>ctx.clearRect(0,0,canvas.width/(window.devicePixelRatio||1),canvas.height/(window.devicePixelRatio||1)))}
</script></body></html>`;
writeFileSync(resolve(output), html);
