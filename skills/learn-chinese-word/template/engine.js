// learn-chinese-word engine. Reads the embedded JSON and builds every panel.
// Three.js (3D tiles, sky, bubble game, confetti) and Hanzi Writer (strokes) come from jsDelivr.
// If either CDN fails, the page still works with plain DOM fallbacks.
const C = JSON.parse(document.getElementById("content").textContent);
const $ = (id) => document.getElementById(id);
const HAN = /\p{Script=Han}/u;
const ZH_FONT = getComputedStyle(document.documentElement).getPropertyValue("--zh").trim();
const chars = C.chars;
const phrases = C.phrases;
const sentences = C.sentences;
const distractors = C.distractors;

/* ---------- small helpers ---------- */
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "style") n.style.cssText = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
}
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const centerOf = (node) => { const r = node.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
// Wrap every occurrence of the target word in <mark>.
function highlight(text) {
  const parts = text.split(C.word);
  const out = [];
  parts.forEach((p, i) => { if (p) out.push(p); if (i < parts.length - 1) out.push(el("mark", {}, C.word)); });
  return out;
}
const TONE_MARKS = { 1: "āēīōūǖĀĒĪŌŪǕ", 2: "áéíóúǘÁÉÍÓÚǗ", 3: "ǎěǐǒǔǚǍĚǏǑǓǙ", 4: "àèìòùǜÀÈÌÒÙǛ" };
const toneOf = (py) => { for (const t of [1, 2, 3, 4]) if ([...py].some((ch) => TONE_MARKS[t].includes(ch))) return t; return 5; };
const TONE_COLOR = { 1: "#e5383b", 2: "#2fa86b", 3: "#3d7dd8", 4: "#8e5cd9", 5: "#8d93a8" };

/* ---------- sound: device text-to-speech plus synthesized effects ---------- */
let slow = false, muted = false, zhVoice = null;
function pickVoice() {
  const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  zhVoice = vs.find((v) => /zh[-_]CN/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang) && !/HK|TW/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang)) || null;
}
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text) {
  if (!window.speechSynthesis || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-CN";
  if (zhVoice) u.voice = zhVoice;
  u.rate = slow ? 0.5 : 0.8;
  speechSynthesis.speak(u);
}
let actx;
function beep(freqs, dur = 0.1, type = "sine", gain = 0.15) {
  if (muted) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = actx.currentTime;
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * dur);
      g.gain.exponentialRampToValueAtTime(gain, t0 + i * dur + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * dur + 0.12);
      o.connect(g).connect(actx.destination);
      o.start(t0 + i * dur); o.stop(t0 + (i + 1) * dur + 0.15);
    });
  } catch { /* audio is optional */ }
}
const sfx = {
  good: () => beep([660, 880, 1320], 0.08, "triangle"),
  bad: () => beep([240, 180], 0.13, "square", 0.05),
  pop: () => beep([1100, 700], 0.04, "sine", 0.12),
  flip: () => beep([520], 0.05, "triangle", 0.08),
  win: () => beep([523, 659, 784, 1047, 1319], 0.1, "triangle"),
};

/* ---------- stars and confetti (fx is replaced by the 3D version once Three.js loads) ---------- */
let stars = 0;
const fx = { burst() {} };
function addStar(n = 1, at) {
  stars += n;
  $("starCount").textContent = stars;
  const s = $("stars"); s.classList.remove("bump"); void s.offsetWidth; s.classList.add("bump");
  if (at) fx.burst(at[0], at[1], n > 1 ? 120 : 45);
}

/* ---------- header and tabs ---------- */
$("chipZh").textContent = C.word;
$("chipPy").textContent = C.pinyin;
$("wordChip").onclick = () => say(C.word);
document.querySelectorAll("[data-word]").forEach((n) => (n.textContent = C.word));
$("slowBtn").onclick = (e) => { slow = !slow; e.currentTarget.setAttribute("aria-pressed", slow); say(C.word); };
$("muteBtn").onclick = (e) => { muted = !muted; e.currentTarget.textContent = muted ? "🔕" : "🔔"; };
$("infoBtn").onclick = () => $("srcDlg").showModal();
$("srcX").onclick = () => $("srcDlg").close();
for (const s of C.sources || []) {
  $("srcList").append(el("li", {}, el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.title), s.note ? ` — ${s.note}` : ""));
}

const TABS = [
  { id: "learn", ico: "📖", txt: "Learn", zh: "学" },
  { id: "words", ico: "💬", txt: "Words", zh: "说" },
  { id: "write", ico: "✍️", txt: "Write", zh: "写" },
  { id: "play", ico: "🎮", txt: "Play", zh: "玩" },
  { id: "quiz", ico: "⭐", txt: "Quiz", zh: "考" },
];
const hooks = {};               // id -> { show(), hide() }
let current = null;
for (const t of TABS) {
  $("tabs").append(el("button", { class: "tab", role: "tab", id: `t-${t.id}`, "aria-controls": `p-${t.id}`, "aria-label": t.txt, title: t.txt, onclick: () => showTab(t.id) },
    el("span", { class: "ico" }, t.ico), el("span", { class: "txt" }, t.txt), el("span", { class: "zh" }, t.zh)));
}
function showTab(id) {
  if (id === current) return;
  if (current) hooks[current]?.hide?.();
  current = id;
  for (const t of TABS) {
    $(`t-${t.id}`).setAttribute("aria-selected", t.id === id);
    $(`p-${t.id}`).classList.toggle("on", t.id === id);
  }
  hooks[id]?.show?.();
}
document.addEventListener("keydown", (e) => {
  if (e.target.closest("dialog")) return;
  const i = TABS.findIndex((t) => t.id === current);
  if (e.key === "ArrowRight") showTab(TABS[(i + 1) % TABS.length].id);
  if (e.key === "ArrowLeft") showTab(TABS[(i + TABS.length - 1) % TABS.length].id);
});

/* ---------- LEARN ---------- */
$("heroFallback").textContent = C.word;
chars.forEach((ch) => {
  const t = toneOf(ch.pinyin);
  $("syllables").append(el("button", { class: "syl", onclick: () => say(ch.char), "aria-label": `Listen to ${ch.char}` },
    el("span", { class: "py", style: `color:${TONE_COLOR[t]}` }, ch.pinyin), el("span", { class: "zh" }, ch.char)));
  $("parts").append(el("button", { class: "part", onclick: () => say(ch.char) },
    el("span", { class: "ch" }, ch.char),
    el("span", { class: "pm" }, `${ch.pinyin} · ${ch.meaning}`),
    ch.radical ? el("span", { class: "rad" }, "Radical ", el("b", {}, ch.radical), ch.radicalMeaning ? ` (${ch.radicalMeaning})` : "") : null,
    ch.strokes ? el("span", { class: "stk" }, `${ch.strokes} strokes`) : null));
});
$("mEmoji").textContent = C.emoji || "";
$("mText").textContent = C.meaning;
$("mExplain").textContent = C.explain;
if (C.mnemonic) {
  $("tipText").append(C.mnemonic, el("span", { class: "tag" }, "memory trick, not history"));
} else if (C.funFact) {
  $("tipCard").querySelector("h2").textContent = "🌏 Did you know?";
  $("tipText").textContent = C.funFact;
} else {
  $("tipCard").remove();
  document.querySelector(".learn-row").style.gridTemplateColumns = "1fr";
}
const CONTOUR = { 1: "M8 8 L52 8", 2: "M8 30 L52 6", 3: "M8 14 L26 32 L52 6", 4: "M8 6 L52 32", 5: "M28 20 L32 20" };
chars.forEach((ch) => {
  const t = toneOf(ch.pinyin);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 60 38");
  svg.innerHTML = `<path d="${CONTOUR[t]}" fill="none" stroke="${TONE_COLOR[t]}" stroke-width="${t === 5 ? 10 : 5}" stroke-linecap="round" stroke-linejoin="round"/>`;
  $("tones").append(el("button", { class: "tone", onclick: () => say(ch.char) }, svg,
    el("b", { style: `color:${TONE_COLOR[t]}` }, ch.pinyin), t === 5 ? "light tone" : `tone ${t}`));
});

/* ---------- WORDS ---------- */
const PH_COLORS = ["#ffc93c", "#3d7dd8", "#2fa86b", "#8e5cd9", "#e94f37"];
let phPage = 0;
const PER = 4;
const phPages = Math.ceil(phrases.length / PER);
function renderPhrases() {
  const box = $("phrases");
  box.replaceChildren();
  phrases.slice(phPage * PER, phPage * PER + PER).forEach((p, i) => {
    box.append(el("button", { class: "phrase", style: `--c:${PH_COLORS[(phPage * PER + i) % PH_COLORS.length]}`, onclick: (e) => { say(p.zh); e.currentTarget.animate([{ transform: "scale(1.06)" }, { transform: "none" }], 300); } },
      el("span", { class: "em" }, p.emoji || "🔊"), el("span", { class: "zh" }, highlight(p.zh)), el("span", { class: "py" }, p.pinyin), el("span", { class: "en" }, p.en)));
  });
  $("phPage").textContent = `${phPage + 1} / ${phPages}`;
  $("phPrev").disabled = $("phNext").disabled = phPages < 2;
}
$("phPrev").onclick = () => { phPage = (phPage + phPages - 1) % phPages; renderPhrases(); };
$("phNext").onclick = () => { phPage = (phPage + 1) % phPages; renderPhrases(); };
let seIdx = 0;
function renderSentence() {
  const s = sentences[seIdx];
  $("sentence").replaceChildren(...highlight(s.zh));
  $("sentPy").textContent = s.pinyin;
  $("sentEn").textContent = s.en;
  $("sePage").textContent = `${seIdx + 1} / ${sentences.length}`;
}
$("sentence").onclick = () => say(sentences[seIdx].zh);
$("sePrev").onclick = () => { seIdx = (seIdx + sentences.length - 1) % sentences.length; renderSentence(); };
$("seNext").onclick = () => { seIdx = (seIdx + 1) % sentences.length; renderSentence(); };
renderPhrases();
renderSentence();

/* ---------- WRITE (Hanzi Writer, freehand fallback) ---------- */
const W = { idx: 0, mode: "watch", writer: null, done: new Set(), size: 0, strokes: {} };
chars.forEach((ch, i) => {
  $("charPick").append(el("button", { "data-i": i, "aria-label": `Practise ${ch.char}`, onclick: () => { W.idx = i; setupWriter(); } }, ch.char));
});
$("modes").querySelectorAll(".mode").forEach((b) => (b.onclick = () => { W.mode = b.dataset.mode; setupWriter(); }));
$("writeAgain").onclick = () => setupWriter();
$("writeSay").onclick = () => say(chars[W.idx].char);
const msg = (t) => ($("writeMsg").textContent = t);
const hasHW = () => typeof window.HanziWriter !== "undefined";

function setupWriter() {
  const ch = chars[W.idx];
  $("charPick").querySelectorAll("button").forEach((b, i) => {
    b.setAttribute("aria-pressed", i === W.idx);
    b.querySelector(".done")?.remove();
    if (W.done.has(i)) b.append(el("span", { class: "done" }, "✅"));
  });
  $("modes").querySelectorAll(".mode").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === W.mode));
  const box = $("gridBox");
  W.size = Math.floor(box.clientWidth);
  $("writer").replaceChildren();
  W.writer = null;
  if (!hasHW()) return setupFreehand(ch);
  $("freeCanvas").hidden = true;
  const memory = W.mode === "memory";
  W.writer = HanziWriter.create($("writer"), ch.char, {
    width: W.size, height: W.size, padding: Math.round(W.size * 0.07),
    showOutline: !memory, showCharacter: false,
    strokeColor: "#2b2d42", radicalColor: "#e94f37", outlineColor: "#e8dfcf",
    highlightColor: "#ffc93c", drawingColor: "#3d7dd8", drawingWidth: Math.max(10, W.size / 22),
    strokeAnimationSpeed: 0.9, delayBetweenStrokes: 280, showHintAfterMisses: memory ? 2 : 1,
    onLoadCharDataError: () => setupFreehand(ch),
  });
  HanziWriter.loadCharacterData(ch.char).then((d) => {
    W.strokes[ch.char] = d.strokes.length;
    $("writeMeta").textContent = `${ch.char} · ${ch.pinyin} · ${d.strokes.length} strokes${ch.radical ? ` · radical ${ch.radical}` : ""}`;
  }).catch(() => {});
  if (W.mode === "watch") {
    msg("👀 Watch the strokes in order");
    const loop = () => W.writer?.animateCharacter({ onComplete: () => setTimeout(() => W.writer && W.mode === "watch" && loop(), 1400) });
    loop();
    return;
  }
  msg(memory ? "🌟 Write it from memory!" : "✏️ Trace each stroke in order");
  const w = W.writer;
  w.quiz({
    onCorrectStroke: (d) => { if (w !== W.writer) return; sfx.pop(); msg(`👍 Stroke ${d.strokeNum + 1} of ${d.strokeNum + 1 + d.strokesRemaining}`); },
    onMistake: () => { if (w !== W.writer) return; sfx.bad(); msg("Oops! Try that stroke again 💪"); },
    onComplete: (d) => {
      if (w !== W.writer) return;
      const n = d.totalMistakes === 0 ? 3 : d.totalMistakes <= 3 ? 2 : 1;
      msg(`${"⭐".repeat(n)} ${n === 3 ? "Perfect!" : n === 2 ? "Great job!" : "Well done!"}`);
      W.done.add(W.idx);
      sfx.win(); say(ch.char);
      addStar(n, centerOf($("gridBox")));
      setTimeout(() => { if (w === W.writer) setupWriter(); }, 2600);
    },
  });
}
// Freehand drawing when stroke data or Hanzi Writer is unavailable (offline).
function setupFreehand(ch) {
  const cv = $("freeCanvas");
  cv.hidden = false;
  const dpr = window.devicePixelRatio || 1;
  cv.width = W.size * dpr; cv.height = W.size * dpr;
  const g = cv.getContext("2d");
  g.scale(dpr, dpr);
  const guide = () => {
    g.clearRect(0, 0, W.size, W.size);
    if (W.mode !== "memory") {
      g.fillStyle = "rgba(43,45,66,.13)";
      g.font = `700 ${W.size * 0.78}px ${ZH_FONT}`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(ch.char, W.size / 2, W.size / 2 + W.size * 0.03);
    }
  };
  guide();
  msg(W.mode === "memory" ? "🌟 Write it from memory!" : "✏️ Draw over the grey character");
  $("writeMeta").textContent = `${ch.char} · ${ch.pinyin}${ch.strokes ? ` · ${ch.strokes} strokes` : ""} · stroke order needs internet`;
  let drawing = false;
  cv.onpointerdown = (e) => { drawing = true; cv.setPointerCapture(e.pointerId); g.beginPath(); g.moveTo(e.offsetX, e.offsetY); };
  cv.onpointermove = (e) => { if (!drawing) return; g.lineTo(e.offsetX, e.offsetY); g.strokeStyle = "#3d7dd8"; g.lineWidth = W.size / 26; g.lineCap = g.lineJoin = "round"; g.stroke(); };
  cv.onpointerup = () => (drawing = false);
}
hooks.write = { show: () => setupWriter(), hide: () => { W.writer = null; $("writer").replaceChildren(); } };

/* ---------- PLAY: game switcher ---------- */
let game = "bubbles";
const games = {};               // id -> { show(), hide() }
$("gamesBar").querySelectorAll(".game-tab").forEach((b) => (b.onclick = () => showGame(b.dataset.game)));
function showGame(id) {
  games[game]?.hide?.();
  game = id;
  $("gamesBar").querySelectorAll(".game-tab").forEach((b) => b.setAttribute("aria-pressed", b.dataset.game === id));
  for (const g of ["bubbles", "match", "build"]) $(`g-${g}`).classList.toggle("on", g === id);
  games[id]?.show?.();
}
hooks.play = { show: () => showGame(game), hide: () => games[game]?.hide?.() };

/* Memory match: Chinese card + picture card */
const MATCH_PAIRS = [{ zh: C.word, pinyin: C.pinyin, en: C.meaning, emoji: C.emoji }, ...phrases, ...distractors].slice(0, 6);
let mOpen = [], mGot = 0, mLock = false;
function dealMatch() {
  mOpen = []; mGot = 0; mLock = false;
  $("matchOver").hidden = true;
  $("matchScore").textContent = `0 / ${MATCH_PAIRS.length}`;
  const cards = shuffle(MATCH_PAIRS.flatMap((p, i) => [{ i, kind: "zh", p }, { i, kind: "pic", p }]));
  $("matchGrid").replaceChildren(...cards.map((c) => {
    const face = c.kind === "zh"
      ? el("div", { class: "face" }, el("span", { class: "zh" }, c.p.zh), el("span", { class: "py" }, c.p.pinyin))
      : el("div", { class: "face" }, c.p.emoji ? el("span", { class: "em" }, c.p.emoji) : null, el("span", { class: "en" }, c.p.en));
    const card = el("button", { class: "mcard", "aria-label": "Hidden card" }, el("div", { class: "back" }, "?"), face);
    card.onclick = () => flipCard(card, c);
    return card;
  }));
}
function flipCard(card, c) {
  if (mLock || card.classList.contains("flip") || card.classList.contains("got")) return;
  card.classList.add("flip"); sfx.flip();
  if (c.kind === "zh") say(c.p.zh);
  mOpen.push({ card, c });
  if (mOpen.length < 2) return;
  const [a, b] = mOpen; mOpen = [];
  if (a.c.i === b.c.i) {
    a.card.classList.add("got"); b.card.classList.add("got");
    mGot++;
    $("matchScore").textContent = `${mGot} / ${MATCH_PAIRS.length}`;
    sfx.good(); addStar(1, centerOf(b.card));
    if (mGot === MATCH_PAIRS.length) setTimeout(() => { $("matchOver").hidden = false; sfx.win(); addStar(3, centerOf($("matchGrid"))); }, 600);
  } else {
    mLock = true;
    setTimeout(() => { a.card.classList.remove("flip"); b.card.classList.remove("flip"); mLock = false; }, 950);
  }
}
$("matchAgain").onclick = dealMatch;
dealMatch();

/* Build a sentence */
let bIdx = 0, bPlaced = [];
function stripPunct(s) { return s.replace(/[，。！？、,.!?\s]/g, ""); }
function tilesOf(s) {
  if (s.tiles) return s.tiles;
  // Keep the target word together; split the rest into single characters.
  const out = [];
  stripPunct(s.zh).split(C.word).forEach((part, i, arr) => { out.push(...Array.from(part)); if (i < arr.length - 1) out.push(C.word); });
  return out;
}
function dealBuild() {
  const s = sentences[bIdx];
  const tiles = tilesOf(s);
  let order = shuffle(tiles.map((_, i) => i));
  if (tiles.length > 1 && order.every((v, i) => v === i)) order = order.reverse();
  bPlaced = [];
  $("buildEn").textContent = `“${s.en}”`;
  $("buildScore").textContent = `${bIdx + 1} / ${sentences.length}`;
  $("buildNext").hidden = true;
  $("buildSlots").className = "build-slots";
  $("buildTiles").replaceChildren(...order.map((ti) => {
    const b = el("button", { class: "tile", lang: "zh" }, tiles[ti]);
    b.onclick = () => { if (b.classList.contains("used") || bPlaced.length >= tiles.length) return; b.classList.add("used"); bPlaced.push({ text: tiles[ti], btn: b }); sfx.pop(); renderSlots(); };
    return b;
  }));
  renderSlots();
}
function renderSlots() {
  const s = sentences[bIdx];
  const n = tilesOf(s).length;
  const slots = $("buildSlots");
  slots.classList.remove("wrong");
  slots.replaceChildren(...Array.from({ length: n }, (_, i) => {
    const p = bPlaced[i];
    if (!p) return el("span", { class: "slot empty" });
    return el("button", { class: "slot", lang: "zh", onclick: () => { if (slots.classList.contains("right")) return; bPlaced.splice(i, 1); p.btn.classList.remove("used"); renderSlots(); } }, p.text);
  }));
  if (bPlaced.length === n) {
    if (bPlaced.map((p) => p.text).join("") === stripPunct(s.zh)) {
      slots.classList.add("right");
      sfx.good(); say(s.zh); addStar(2, centerOf(slots));
      $("buildNext").hidden = false;
    } else {
      void slots.offsetWidth; slots.classList.add("wrong"); sfx.bad();
    }
  }
}
$("buildReset").onclick = dealBuild;
$("buildSay").onclick = () => say(sentences[bIdx].zh);
$("buildNext").onclick = () => { bIdx = (bIdx + 1) % sentences.length; dealBuild(); };
dealBuild();

/* ---------- QUIZ ---------- */
const PROMPTS = {
  listen: "Listen 🔊 Which one did you hear?",
  meaning: "What does this mean?",
  pinyin: "How do you say this?",
  picture: "Which word matches the picture?",
  fill: "Fill in the blank",
  char: "Choose the right answer",
};
let qIdx = 0, qRight = 0, qResults = [];
function renderQuiz() {
  const q = C.quiz[qIdx];
  $("quizBox").hidden = false; $("quizEnd").hidden = true;
  $("quizDots").replaceChildren(...C.quiz.map((_, i) => el("i", { class: i === qIdx ? "now" : qResults[i] === true ? "ok" : qResults[i] === false ? "no" : "" })));
  $("quizPrompt").textContent = q.prompt || PROMPTS[q.type];
  const show = $("quizShow");
  show.className = "quiz-show";
  show.replaceChildren();
  if (q.type === "listen") {
    show.append(el("button", { class: "play", "aria-label": "Play the sound", onclick: () => say(q.speak) }, "🔊"));
    setTimeout(() => current === "quiz" && say(q.speak), 350);
  } else if (q.type === "fill") {
    show.classList.add("text", "sentence");
    show.append(...q.show.split("___").flatMap((p, i, a) => (i < a.length - 1 ? [p, el("span", { style: "color:var(--red)" }, "＿＿")] : [p])));
  } else {
    if (HAN.test(q.show)) show.classList.add("text");
    show.textContent = q.show;
  }
  $("quizChoices").replaceChildren(...q.choices.map((ch, i) => el("button", { class: `choice${HAN.test(ch) ? " zh" : ""}`, onclick: (e) => answer(i, e.currentTarget) }, ch)));
  $("quizExplain").textContent = "";
  $("quizNext").hidden = true;
}
function answer(i, btn) {
  const q = C.quiz[qIdx];
  const btns = [...$("quizChoices").children];
  btns.forEach((b) => (b.disabled = true));
  btns[q.answer].classList.add("ok");
  const ok = i === q.answer;
  qResults[qIdx] = ok;
  if (ok) { qRight++; sfx.good(); addStar(1, centerOf(btn)); }
  else { btn.classList.add("no"); sfx.bad(); }
  const correct = q.choices[q.answer];
  setTimeout(() => say(q.speak || (HAN.test(correct) ? correct : HAN.test(q.show || "") ? q.show.replace("___", correct) : C.word)), 300);
  $("quizExplain").textContent = (ok ? "✅ Correct! " : "💡 ") + (q.explain || (ok ? "" : `The answer is ${correct}.`));
  $("quizNext").hidden = false;
  $("quizNext").textContent = qIdx === C.quiz.length - 1 ? "See my stars ▶" : "Next ▶";
}
$("quizNext").onclick = () => {
  if (qIdx < C.quiz.length - 1) { qIdx++; renderQuiz(); return; }
  const ratio = qRight / C.quiz.length;
  const n = ratio === 1 ? 3 : ratio >= 0.6 ? 2 : 1;
  $("quizBox").hidden = true; $("quizEnd").hidden = false;
  $("endStars").textContent = "⭐".repeat(n) + "☆".repeat(3 - n);
  $("endText").textContent = `${qRight} of ${C.quiz.length} correct! ${n === 3 ? "You are a star! 太棒了！" : n === 2 ? "Great work! 很好！" : "Good try! 加油！"}`;
  sfx.win(); addStar(n, centerOf($("endStars")));
};
$("quizAgain").onclick = () => { qIdx = 0; qRight = 0; qResults = []; renderQuiz(); };
hooks.quiz = { show: () => renderQuiz() };

/* ---------- resize ---------- */
// Drop the English tab labels, then the chip pinyin, until the header fits on one line.
function fitHeader() {
  const b = document.body, tabs = $("tabs");
  b.classList.remove("compact-1", "compact-2");
  for (const c of ["compact-1", "compact-2"]) {
    if (tabs.scrollWidth <= tabs.clientWidth + 1) break;
    b.classList.add(c);
  }
}
let resizeT;
window.addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { fitHeader(); if (current === "write") setupWriter(); for (const f of resizers) f(); }, 150);
});
const resizers = [];
fitHeader();
document.fonts?.ready.then(fitHeader);

showTab("learn");

/* =====================================================================
   Three.js layer: sky, hero tiles, bubble game and confetti.
   ===================================================================== */
let THREE;
try {
  THREE = await import("three");
} catch {
  document.body.classList.add("no3d");
  $("gamesBar").querySelector('[data-game="bubbles"]').remove();
  game = "match";
}
if (THREE) {
  let RoundedBoxGeometry = null;
  try { ({ RoundedBoxGeometry } = await import("three/addons/geometries/RoundedBoxGeometry.js")); } catch { /* plain boxes */ }
  try { await document.fonts.ready; } catch { /* draw with fallback fonts */ }
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function makeRenderer(canvas, alpha = true) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha });
    r.setPixelRatio(DPR);
    r.outputColorSpace = THREE.SRGBColorSpace;
    return r;
  }
  function fitRenderer(r, cam, canvas) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    canvas._w = w; canvas._h = h;
    r.setSize(w, h, false);
    if (cam.isPerspectiveCamera) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
    return true;
  }
  // True when the canvas was laid out again (tab shown, rotation) since the last fit.
  const stale = (canvas) => canvas.clientWidth !== canvas._w || canvas.clientHeight !== canvas._h;
  // Canvas texture with centered text (and optional small line under it).
  function textTexture(text, { size = 256, color = "#2b2d42", bg = null, sub = null, font = ZH_FONT, scale = 0.62 } = {}) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const g = cv.getContext("2d");
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, size, size); }
    const len = Array.from(text).length;
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `700 ${size * scale / Math.max(1, len * 0.62)}px ${font}`;
    g.fillText(text, size / 2, size * (sub ? 0.44 : 0.52));
    if (sub) { g.font = `600 ${size * 0.13}px Fredoka, sans-serif`; g.fillStyle = "#3d7dd8"; g.fillText(sub, size / 2, size * 0.82); }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const PASTELS = [0xffc93c, 0xff8fa3, 0x7cc6fe, 0x8be0a4, 0xc9a7ff, 0xffb26b];

  /* --- confetti overlay --- */
  {
    const canvas = $("fx");
    const r = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
    const MAX = 500;
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), MAX);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const parts = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const col = new THREE.Color();
    let raf = 0, last = 0;
    const size = () => { const w = innerWidth, h = innerHeight; r.setSize(w, h, false); cam.right = w; cam.bottom = -h; cam.updateProjectionMatrix(); };
    size(); resizers.push(size);
    fx.burst = (x, y, n = 50) => {
      for (let i = 0; i < n; i++) {
        if (parts.length >= MAX) parts.shift();
        const a = Math.random() * Math.PI * 2, v = 250 + Math.random() * 450;
        parts.push({ x, y: -y, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 250, rx: Math.random() * 6, ry: Math.random() * 6, vr: (Math.random() - 0.5) * 18, life: 1.4 + Math.random() * 0.8, sz: 9 + Math.random() * 9, c: PASTELS[i % PASTELS.length] });
      }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      for (let i = parts.length - 1; i >= 0; i--) {
        const o = parts[i];
        o.life -= dt; if (o.life <= 0) { parts.splice(i, 1); continue; }
        o.vy -= 900 * dt; o.vx *= 0.985; o.x += o.vx * dt; o.y += o.vy * dt; o.rx += o.vr * dt; o.ry += o.vr * 0.7 * dt;
      }
      parts.forEach((o, i) => {
        p.set(o.x, o.y, 0); e.set(o.rx, o.ry, o.rx * 0.5); q.setFromEuler(e); s.setScalar(o.sz * Math.min(1, o.life * 2));
        mesh.setMatrixAt(i, m4.compose(p, q, s));
        mesh.setColorAt(i, col.setHex(o.c));
      });
      mesh.count = parts.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      r.render(scene, cam);
      raf = parts.length ? requestAnimationFrame(tick) : 0;
      if (!raf) r.clear();
    }
  }

  /* --- sky: slow floating lanterns, clouds and faint word sprites behind the page --- */
  {
    const canvas = $("sky");
    const r = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    cam.position.z = 14;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffe0b0, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(4, 6, 8); scene.add(sun);
    const items = [];
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xe94f37, roughness: 0.5, emissive: 0x6a1408, emissiveIntensity: 0.4 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.4, metalness: 0.3 });
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), lanternMat); body.scale.y = 0.8; g.add(body);
      for (const y of [0.5, -0.5]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 16), goldMat); cap.position.y = y; g.add(cap); }
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.5, 6), goldMat); tassel.position.y = -0.82; g.add(tassel);
      items.push(g);
    }
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      [[0, 0, 0.8], [0.8, -0.1, 0.6], [-0.8, -0.1, 0.6], [0.35, 0.35, 0.55]].forEach(([x, y, rr]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(rr, 16, 12), cloudMat); m.position.set(x, y, 0); g.add(m); });
      items.push(g);
    }
    const wordTex = textTexture(C.word, { color: "#e94f37" });
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: wordTex, transparent: true, opacity: 0.16, depthWrite: false }));
      sp.scale.setScalar(1.6 + Math.random());
      items.push(sp);
    }
    items.forEach((o, i) => {
      o.userData = { sx: (Math.random() - 0.5) * 26, sy: (Math.random() - 0.5) * 14, z: -2 - Math.random() * 8, sp: 0.1 + Math.random() * 0.25, ph: Math.random() * 6, rot: (Math.random() - 0.5) * 0.4 };
      o.position.set(o.userData.sx, o.userData.sy, o.userData.z);
      scene.add(o);
    });
    const size = () => fitRenderer(r, cam, canvas);
    size(); resizers.push(size);
    let last = 0;
    (function loop(now) {
      requestAnimationFrame(loop);
      if (document.hidden || now - last < 33) return;  // ~30 fps is plenty for a background
      last = now;
      const t = now / 1000;
      const halfW = Math.tan((cam.fov * Math.PI) / 360) * 20 * cam.aspect + 3;
      for (const o of items) {
        const u = o.userData;
        o.position.x = ((u.sx + t * u.sp + halfW) % (halfW * 2)) - halfW;
        o.position.y = u.sy + Math.sin(t * 0.6 + u.ph) * 0.4;
        if (!o.isSprite) o.rotation.z = Math.sin(t * 0.8 + u.ph) * 0.15 + u.rot;
      }
      r.render(scene, cam);
    })(0);
  }

  /* --- hero: one 3D tile per character; tap to flip --- */
  {
    const canvas = $("heroCanvas");
    const r = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffd9a0, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(3, 4, 6); scene.add(key);
    const n = chars.length;
    const GAP = 2.45;
    const tiles = chars.map((ch, i) => {
      const front = (() => {
        const cv = document.createElement("canvas"); cv.width = cv.height = 512;
        const g = cv.getContext("2d");
        g.fillStyle = "#fffaf0"; g.fillRect(0, 0, 512, 512);
        g.strokeStyle = "#e94f37"; g.lineWidth = 14; g.strokeRect(20, 20, 472, 472);
        g.setLineDash([16, 14]); g.lineWidth = 3; g.strokeStyle = "#f2a99d";
        [[20, 256, 492, 256], [256, 20, 256, 492], [20, 20, 492, 492], [492, 20, 20, 492]].forEach(([a, b, c2, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); });
        g.setLineDash([]);
        g.fillStyle = "#2b2d42"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `700 340px ${ZH_FONT}`; g.fillText(ch.char, 256, 272);
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
      })();
      const back = (() => {
        const cv = document.createElement("canvas"); cv.width = cv.height = 512;
        const g = cv.getContext("2d");
        g.fillStyle = "#fff4cc"; g.fillRect(0, 0, 512, 512);
        g.textAlign = "center"; g.textBaseline = "middle";
        g.font = "200px sans-serif"; g.fillText(C.emoji || "⭐", 256, 190);
        g.fillStyle = TONE_COLOR[toneOf(ch.pinyin)]; g.font = "700 76px Fredoka, sans-serif"; g.fillText(ch.pinyin, 256, 360);
        g.fillStyle = "#2b2d42"; g.font = "600 46px Fredoka, sans-serif";
        g.fillText(n === 1 ? C.meaning : ch.meaning, 256, 440, 470);
        const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
      })();
      const side = new THREE.MeshStandardMaterial({ color: 0xe94f37, roughness: 0.45 });
      const mats = [side, side, side, side, new THREE.MeshStandardMaterial({ map: front, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: back, roughness: 0.6 })];
      const geo = RoundedBoxGeometry ? new RoundedBoxGeometry(2, 2, 0.36, 4, 0.14) : new THREE.BoxGeometry(2, 2, 0.36);
      const m = new THREE.Mesh(geo, mats);
      m.position.x = (i - (n - 1) / 2) * GAP;
      m.userData = { i, target: 0, ph: i * 0.9 };
      scene.add(m);
      return m;
    });
    // Sparkles around the tiles.
    const sparkGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) { sp[i * 3] = (Math.random() - 0.5) * (n * GAP + 3); sp[i * 3 + 1] = (Math.random() - 0.5) * 3.4; sp[i * 3 + 2] = -1 - Math.random() * 2; }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffc93c, size: 0.09, transparent: true, opacity: 0.9 }));
    scene.add(sparks);
    const size = () => {
      if (!fitRenderer(r, cam, canvas)) return;
      // Fit all tiles horizontally and vertically.
      const needW = n * GAP + 0.6, needH = 2.9;
      const vfov = (cam.fov * Math.PI) / 180;
      const dH = needH / 2 / Math.tan(vfov / 2);
      const dW = needW / 2 / (Math.tan(vfov / 2) * cam.aspect);
      cam.position.set(0, 0, Math.max(dH, dW) + 0.4);
    };
    resizers.push(size);
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener("pointerdown", (e) => {
      const b = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects(tiles)[0];
      if (!hit) { say(C.word); return; }
      const t = hit.object;
      t.userData.target += Math.PI;
      sfx.flip();
      say(chars[t.userData.i].char);
    });
    let raf = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (stale(canvas)) size();
      const t = now / 1000;
      for (const m of tiles) {
        const u = m.userData;
        m.rotation.y += (u.target + Math.sin(t * 0.7 + u.ph) * 0.18 - m.rotation.y) * 0.09;
        m.rotation.x = Math.sin(t * 0.9 + u.ph) * 0.07;
        m.position.y = Math.sin(t * 1.3 + u.ph) * 0.08;
      }
      sparks.rotation.z = Math.sin(t * 0.2) * 0.05;
      sparks.material.opacity = 0.6 + Math.sin(t * 2) * 0.3;
      r.render(scene, cam);
    };
    hooks.learn = { show: () => { requestAnimationFrame(() => { size(); if (!raf) raf = requestAnimationFrame(loop); }); }, hide: () => { cancelAnimationFrame(raf); raf = 0; } };
    if (current === "learn") hooks.learn.show();
  }

  /* --- Bubble Pop: tap the bubbles that show the word --- */
  {
    const canvas = $("bubbleCanvas");
    const r = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    cam.position.z = 10;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe6ff, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 5, 6); scene.add(key);
    const GOAL = 8;
    const labels = distractors.map((d) => d.zh);
    const texCache = new Map();
    const tex = (s) => { if (!texCache.has(s)) texCache.set(s, textTexture(s, { scale: 0.7 })); return texCache.get(s); };
    const sphere = new THREE.SphereGeometry(1, 36, 24);
    const shine = new THREE.SphereGeometry(0.16, 12, 8);
    const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const bubbles = [];
    let score = 0, running = false, raf = 0, last = 0, viewH = 1, viewW = 1;
    const pieces = [];
    $("bubbleGoal").textContent = `Pop every bubble that says ${C.word} (${C.meaning})!`;
    function setLabel(b, isTarget) {
      b.userData.target = isTarget;
      b.userData.label = isTarget ? C.word : pick(labels);
      b.userData.sprite.material.map = tex(b.userData.label);
      b.userData.sprite.material.needsUpdate = true;
    }
    function respawn(b, first = false) {
      const rad = 0.75 + Math.random() * 0.3;
      b.scale.setScalar(rad);
      b.userData.rad = rad;
      b.userData.pop = 0;
      b.userData.mat.opacity = 0.42;
      b.userData.mat.color.setHex(pick(PASTELS));
      b.userData.sprite.material.opacity = 1;
      b.position.set((Math.random() - 0.5) * (viewW - 2.2), first ? -viewH / 2 + Math.random() * viewH : -viewH / 2 - rad - Math.random() * 2, (Math.random() - 0.5) * 1.5);
      b.userData.speed = 0.7 + Math.random() * 0.5 + score * 0.08;
      b.userData.ph = Math.random() * 6;
      const targetsOnScreen = bubbles.filter((o) => o !== b && o.userData.target).length;
      setLabel(b, targetsOnScreen === 0 || Math.random() < 0.42);
    }
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, shininess: 140, specular: 0xffffff, depthWrite: false });
      const b = new THREE.Group();
      const body = new THREE.Mesh(sphere, mat);
      const hl = new THREE.Mesh(shine, shineMat); hl.position.set(-0.45, 0.5, 0.75);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sprite.scale.setScalar(1.45);
      b.add(body, hl, sprite);
      body.userData.bubble = b;
      b.userData = { mat, sprite, body };
      scene.add(b);
      bubbles.push(b);
    }
    const size = () => {
      if (!fitRenderer(r, cam, canvas)) return false;
      viewH = 2 * Math.tan((cam.fov * Math.PI) / 360) * cam.position.z;
      viewW = viewH * cam.aspect;
      return true;
    };
    resizers.push(size);
    function toast(text) {
      const t = $("bubbleToast");
      t.textContent = text; t.classList.add("show");
      clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800);
    }
    function burstIn3D(pos, color) {
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(shine, new THREE.MeshBasicMaterial({ color, transparent: true }));
        m.position.copy(pos);
        m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.3) * 6, (Math.random() - 0.5) * 3), life: 0.7 };
        scene.add(m); pieces.push(m);
      }
    }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    canvas.addEventListener("pointerdown", (e) => {
      if (!running) return;
      const bb = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - bb.left) / bb.width) * 2 - 1, -((e.clientY - bb.top) / bb.height) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      const hit = ray.intersectObjects(bubbles.map((b) => b.userData.body))[0];
      if (!hit) return;
      const b = hit.object.userData.bubble;
      if (b.userData.pop) return;
      if (b.userData.target) {
        b.userData.pop = 0.001;
        sfx.pop(); setTimeout(sfx.good, 60); say(C.word);
        burstIn3D(b.position, b.userData.mat.color.getHex());
        score++;
        $("bubbleScore").textContent = `🫧 ${score} / ${GOAL}`;
        addStar(1, [e.clientX, e.clientY]);
        if (score >= GOAL) finish();
      } else {
        const d = distractors.find((x) => x.zh === b.userData.label);
        sfx.bad(); say(b.userData.label);
        b.userData.shake = 0.5;
        b.userData.mat.color.setHex(0xff6b6b);
        toast(`That's ${b.userData.label}${d ? ` ${d.pinyin} (${d.en})` : ""}. Find ${C.word}!`);
      }
    });
    function finish() {
      running = false;
      sfx.win();
      setTimeout(() => { $("bubbleOver").hidden = false; addStar(3, centerOf(canvas)); }, 500);
    }
    function start() {
      score = 0;
      $("bubbleScore").textContent = `🫧 0 / ${GOAL}`;
      $("bubbleOver").hidden = true;
      if (!size()) { requestAnimationFrame(start); return; }
      bubbles.forEach((b) => respawn(b, true));
      running = true;
    }
    $("bubbleAgain").onclick = start;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (stale(canvas)) size();
      const t = now / 1000;
      for (const b of bubbles) {
        const u = b.userData;
        if (u.pop) {
          u.pop += dt;
          b.scale.setScalar(u.rad * (1 + u.pop * 3));
          u.mat.opacity = Math.max(0, 0.42 - u.pop * 2);
          u.sprite.material.opacity = Math.max(0, 1 - u.pop * 5);
          if (u.pop > 0.25) respawn(b);
          continue;
        }
        if (running) b.position.y += u.speed * dt;
        b.position.x += Math.sin(t * 1.2 + u.ph) * 0.004;
        if (u.shake > 0) { u.shake -= dt; b.position.x += Math.sin(t * 60) * 0.04; if (u.shake <= 0) u.mat.color.setHex(pick(PASTELS)); }
        if (b.position.y > viewH / 2 + u.rad + 0.5) respawn(b);
      }
      for (let i = pieces.length - 1; i >= 0; i--) {
        const m = pieces[i], u = m.userData;
        u.life -= dt; u.v.y -= 9 * dt;
        m.position.addScaledVector(u.v, dt);
        m.material.opacity = Math.max(0, u.life / 0.7);
        if (u.life <= 0) { scene.remove(m); m.material.dispose(); pieces.splice(i, 1); }
      }
      r.render(scene, cam);
    };
    games.bubbles = {
      show: () => requestAnimationFrame(() => { size(); if (!running && $("bubbleOver").hidden) start(); last = performance.now(); if (!raf) raf = requestAnimationFrame(loop); }),
      hide: () => { cancelAnimationFrame(raf); raf = 0; },
    };
    if (current === "play" && game === "bubbles") games.bubbles.show();
  }
  for (const f of resizers) f();
}
