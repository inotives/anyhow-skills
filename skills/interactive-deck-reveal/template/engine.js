/* Deck engine: wraps slides, runs the step system, draws d3 widgets, starts Reveal. */
(function () {
  const META = JSON.parse(document.getElementById("deck-meta").textContent);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const BG = {
    light: ["color", "var(--ground)"], soft: ["color", "var(--surface-2)"], warm: ["color", "var(--warm)"],
    dark: ["color", "var(--dk-bg)"],
    brand: ["gradient", "linear-gradient(135deg,var(--br1) 0%,var(--br2) 55%,var(--br3) 100%)"],
  };
  const col = c => `var(--${c || "accent"})`;
  let uid = 0;

  /* ---------- 1. wrap slides ---------- */
  const secs = $$(".reveal .slides > section");
  secs.forEach((s, i) => {
    const bg = s.dataset.bg || "light";
    const [kind, val] = BG[bg] || BG.light;
    s.setAttribute(kind === "color" ? "data-background-color" : "data-background-gradient", val);
    const wrap = document.createElement("div");
    wrap.className = "slide-wrap" + (bg === "dark" || bg === "brand" ? " on-dark" : "") + (s.dataset.layout ? " " + s.dataset.layout : "");
    [...s.childNodes].forEach(n => { if (!(n.nodeType === 1 && n.matches("aside.notes"))) wrap.appendChild(n); });
    if (s.dataset.foot !== "off" && META.footer) {
      const f = document.createElement("div");
      f.className = "foot";
      f.innerHTML = "<span></span><span>" + (i + 1) + "</span>";
      f.firstChild.textContent = META.footer;
      wrap.appendChild(f);
    }
    s.insertBefore(wrap, s.firstChild);
    const n = parseInt(s.dataset.steps || "0", 10);
    for (let k = 1; k <= n; k++) {
      const t = document.createElement("span");
      t.className = "fragment trig"; t.dataset.fragmentIndex = k - 1;
      s.appendChild(t);
    }
    $$(".pop,.fade,.rise,.grow,.draw", s).forEach(e => { if (!e.hasAttribute("data-at")) e.dataset.at = "0"; });
  });

  /* ---------- 2. d3 widgets ---------- */
  const estW = (txt, size) => [...String(txt)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 1 : 0.58), 0) * size;
  function text(g, x, y, str, size, cls, anchor, maxW) {
    const t = g.append("text").attr("x", x).attr("y", y).attr("font-size", size).attr("class", cls || null).attr("text-anchor", anchor || "start").text(str);
    if (maxW && estW(str, size) > maxW) t.attr("textLength", maxW).attr("lengthAdjust", "spacingAndGlyphs");
    return t;
  }
  function svgFor(el, w, h, label) {
    return d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img").attr("aria-label", label || "Chart");
  }
  const at = (sel, v, i) => sel.attr("data-at", v == null ? 0 : v).style("transition-delay", v == null ? (i || 0) * 90 + "ms" : null);

  const W = {};

  W.flow = (el, s) => {
    const w = s.w || 1168, h = s.h || 340, cols = s.cols, rows = s.rows || 1, gx = s.gx || 60, gy = s.gy || 26;
    const svg = svgFor(el, w, h, s.label || "Flow diagram");
    const mid = "ar" + (++uid);
    svg.append("defs").append("marker").attr("id", mid).attr("viewBox", "0 0 10 10").attr("refX", 8).attr("refY", 5).attr("markerWidth", 4.5).attr("markerHeight", 4.5).attr("orient", "auto")
      .append("path").attr("d", "M0,0 L10,5 L0,10 z").attr("fill", "currentColor").style("color", "var(--w-ink-3)");
    const cw = (w - gx * (cols - 1)) / cols, rh = (h - gy * (rows - 1)) / rows, nh = Math.min(s.nh || 120, rh);
    const box = n => {
      const cs = n.cs || 1, rs = n.rs || 1;
      const ww = cw * cs + gx * (cs - 1), hh = rs > 1 ? rh * rs + gy * (rs - 1) : nh;
      return { x: n.col * (cw + gx), y: n.row * (rh + gy) + (rh - nh) / 2, w: ww, h: hh };
    };
    const byId = {}; s.nodes.forEach(n => { n.b = box(n); byId[n.id] = n; });
    s.edges.forEach(([a, b, o], i) => {
      o = o || {}; const A = byId[a], B = byId[b];
      let x1, y1, x2, y2, d;
      if (B.b.x > A.b.x + A.b.w - 1) { x1 = A.b.x + A.b.w; y1 = A.b.y + A.b.h / 2; x2 = B.b.x - 4; y2 = B.b.y + B.b.h / 2; d = d3.linkHorizontal()({ source: [x1, y1], target: [x2, y2] }); }
      else if (B.b.y > A.b.y) { x1 = A.b.x + A.b.w / 2; y1 = A.b.y + A.b.h; x2 = x1; y2 = B.b.y - 4; d = `M${x1},${y1}L${x2},${y2}`; }
      else { x1 = A.b.x + A.b.w / 2; y1 = A.b.y; x2 = x1; y2 = B.b.y + B.b.h + 4; d = `M${x1},${y1}L${x2},${y2}`; }
      const g = svg.append("g").attr("class", "fade");
      at(g, o.at != null ? o.at : B.at, i);
      const p = g.append("path").attr("class", "edge draw").attr("d", d).attr("pathLength", 1).attr("marker-end", `url(#${mid})`);
      at(p, o.at != null ? o.at : B.at, i);
      const dot = g.append("circle").attr("class", "dot").attr("r", 6);
      dot.append("animateMotion").attr("dur", "2.4s").attr("repeatCount", "indefinite").attr("path", d);
      at(dot, o.at != null ? o.at : B.at);
      if (o.label) text(g, (x1 + x2) / 2, Math.min(y1, y2) - 10, o.label, 15, "", "middle").attr("fill", "var(--w-ink-3)");
    });
    s.nodes.forEach((n, i) => {
      const g = svg.append("g").attr("transform", `translate(${n.b.x},${n.b.y})`).append("g").attr("class", "node pop");
      at(g, n.at, i);
      g.append("rect").attr("width", n.b.w).attr("height", n.b.h).attr("rx", 16).attr("stroke", col(n.color));
      const cx = n.b.w / 2, mw = n.b.w - 24;
      const lines = n.lines || (n.sub ? [n.sub] : []);
      const top = n.b.h / 2 - (lines.length * 11) - (n.icon ? 4 : 0);
      if (n.icon) text(g, cx, top - 2, n.icon, 30, "", "middle");
      text(g, cx, top + (n.icon ? 34 : 8), n.title, 22, "t1", "middle", mw);
      lines.forEach((l, k) => text(g, cx, top + (n.icon ? 34 : 8) + 24 + k * 20, l, 16, "t2", "middle", mw));
    });
  };

  W.bars = (el, s) => {
    const w = s.w || 1168, n = s.data.length, rh = s.rh || 56, h = n * rh + 8, lw = s.lw || 230, vw = 130;
    const svg = svgFor(el, w, h, s.label || "Bar chart");
    const max = s.max || d3.max(s.data, d => d.value), x = d3.scaleLinear([0, max], [0, w - lw - vw]);
    const fmt = v => (s.fmt || "{v}").replace("{v}", v);
    s.data.forEach((d, i) => {
      const y = i * rh + 4, g = svg.append("g");
      text(g, 0, y + rh / 2 + 6, d.label, 19, "lbl", "start", lw - 14);
      g.append("rect").attr("class", "track").attr("x", lw).attr("y", y + 8).attr("width", w - lw - vw).attr("height", rh - 20).attr("rx", 9);
      at(g.append("rect").attr("class", "grow").attr("x", lw).attr("y", y + 8).attr("width", x(d.value)).attr("height", rh - 20).attr("rx", 9).attr("fill", col(d.color || "s1")), d.at, i);
      at(text(g, lw + x(d.value) + 12, y + rh / 2 + 6, fmt(d.value), 19, "val fade", "start"), d.at, i);
    });
  };

  W.donut = (el, s) => {
    const w = s.w || 1168, h = s.h || 340, r = Math.min(h, 340) / 2 - 6;
    const svg = svgFor(el, w, h, s.label || "Donut chart");
    const g = svg.append("g").attr("transform", `translate(${r + 10},${h / 2})`);
    const arc = d3.arc().innerRadius(r * 0.62).outerRadius(r).padAngle(0.012).cornerRadius(5);
    d3.pie().sort(null).value(d => d.value)(s.data).forEach((a, i) => {
      at(g.append("path").attr("class", "pop").attr("d", arc(a)).attr("fill", col(a.data.color || "s" + (i % 5 + 1))), a.data.at, i);
    });
    if (s.center) { text(g, 0, 6, s.center, 44, "", "middle").style("font-family", "var(--font-display)").style("font-weight", 700); if (s.sub) text(g, 0, 34, s.sub, 16, "", "middle").attr("fill", "var(--w-ink-3)"); }
    const lg = svg.append("g").attr("class", "leg").attr("transform", `translate(${r * 2 + 70},${h / 2 - s.data.length * 22})`);
    s.data.forEach((d, i) => {
      const y = i * 44, row = lg.append("g");
      row.append("rect").attr("y", y - 14).attr("width", 20).attr("height", 20).attr("rx", 5).attr("fill", col(d.color || "s" + (i % 5 + 1)));
      text(row, 34, y + 2, `${d.label}  ${d.value}${s.unit || ""}`, 20, "", "start");
      at(row.classed("fade", true), d.at, i);
    });
  };

  W.line = (el, s) => {
    const w = s.w || 1168, h = s.h || 340, m = { l: 56, r: 30, t: 16, b: 40 };
    const svg = svgFor(el, w, h, s.label || "Line chart");
    const x = d3.scalePoint(s.x, [m.l, w - m.r]).padding(0.3);
    const ymax = s.max || d3.max(s.series, d => d3.max(d.values)) * 1.1, y = d3.scaleLinear([s.min || 0, ymax], [h - m.b, m.t]);
    const ax = svg.append("g").attr("class", "axis");
    y.ticks(4).forEach(t => { ax.append("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(t)).attr("y2", y(t)); text(ax, m.l - 10, y(t) + 5, t, 15, "", "end"); });
    s.x.forEach(v => text(ax, x(v), h - 12, v, 15, "", "middle"));
    const ln = d3.line().x((d, i) => x(s.x[i])).y(d => y(d)).curve(d3.curveMonotoneX);
    s.series.forEach((se, i) => {
      const c = col(se.color || "s" + (i % 5 + 1)), g = svg.append("g");
      at(g.append("path").attr("class", "draw").attr("d", ln(se.values)).attr("pathLength", 1).attr("fill", "none").attr("stroke", c).attr("stroke-width", 4).attr("stroke-linecap", "round"), se.at, i);
      se.values.forEach((v, k) => at(g.append("circle").attr("class", "pop").attr("cx", x(s.x[k])).attr("cy", y(v)).attr("r", 6).attr("fill", c), se.at, i + 3));
      const last = se.values.length - 1;
      at(text(g, x(s.x[last]) - 8, y(se.values[last]) - 14, se.name, 17, "fade", "end").attr("fill", c).style("fill", c), se.at, i);
    });
  };

  W.timeline = (el, s) => {
    const w = s.w || 1168, h = s.h || 240, n = s.items.length, y0 = h / 2;
    const svg = svgFor(el, w, h, s.label || "Timeline");
    at(svg.append("line").attr("class", "grow").attr("x1", 20).attr("x2", w - 20).attr("y1", y0).attr("y2", y0).attr("stroke", "var(--w-line)").attr("stroke-width", 4).attr("stroke-linecap", "round"), 0);
    s.items.forEach((d, i) => {
      const x = 60 + i * ((w - 120) / Math.max(1, n - 1)), up = i % 2 === 0, c = col(d.color || "accent");
      const g = svg.append("g").attr("class", "pop"); at(g, d.at, i);
      g.append("circle").attr("cx", x).attr("cy", y0).attr("r", 12).attr("fill", c);
      text(g, x, y0 + (up ? -62 : 46), d.title, 20, "t1", "middle", 210).style("font-weight", 700);
      if (d.sub) text(g, x, y0 + (up ? -38 : 70), d.sub, 15, "", "middle", 210).attr("fill", "var(--w-ink-3)").style("fill", "var(--w-ink-3)");
    });
  };

  $$(".wd").forEach(el => {
    const sc = el.querySelector('script[type="application/json"]');
    try { W[el.dataset.wd](el, JSON.parse(sc.textContent)); }
    catch (e) { el.textContent = "Widget error: " + e.message; el.style.color = "var(--risk)"; }
  });

  /* ---------- 3. step system ---------- */
  const stepOf = s => $$(".trig.visible", s).length;
  function setStep(s, k) {
    if (k == null) k = stepOf(s);
    s.dataset.step = k;
    $$("[data-at]", s).forEach(e => e.classList.toggle("on", +e.dataset.at <= k));
    $$("[data-only]", s).forEach(e => e.classList.toggle("on", +e.dataset.only === k));
    $$("[data-step-to]", s).forEach(b => b.classList.toggle("act", +b.dataset.stepTo === k));
    s.dispatchEvent(new CustomEvent("step", { detail: k, bubbles: true }));
  }
  function reset(s) { if (!s) return; $$("[data-at],[data-only]", s).forEach(e => e.classList.remove("on")); }
  function enter(s) { if (!s) return; requestAnimationFrame(() => requestAnimationFrame(() => setStep(s))); }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-step-to]");
    if (b) Reveal.navigateFragment(+b.dataset.stepTo - 1);
  });

  /* ---------- 4. start Reveal ---------- */
  const plugins = window.RevealNotes ? [RevealNotes] : [];
  Reveal.initialize({
    width: 1280, height: 720, margin: 0, controls: true, progress: true, slideNumber: false,
    hash: true, center: false, transition: "slide", backgroundTransition: "fade",
    fragments: true, overview: true, plugins,
  }).then(() => {
    Reveal.on("fragmentshown", e => { if (e.fragment.classList.contains("trig")) setStep(e.fragment.closest("section")); });
    Reveal.on("fragmenthidden", e => { if (e.fragment.classList.contains("trig")) setStep(e.fragment.closest("section")); });
    const dark = sl => Reveal.getRevealElement().classList.toggle("has-dark-background", !!sl && /^(dark|brand)$/.test(sl.dataset.bg || ""));
    Reveal.on("slidechanged", e => { reset(e.previousSlide); enter(e.currentSlide); dark(e.currentSlide); });
    dark(Reveal.getCurrentSlide());
    enter(Reveal.getCurrentSlide());
    setTimeout(() => setStep(Reveal.getCurrentSlide()), 400);
  });
  document.title = META.title;
})();
