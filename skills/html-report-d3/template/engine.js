/* Report engine: reads the JSON, builds tabs and blocks, draws D3 charts. No network. */
(function () {
  const R = JSON.parse(document.getElementById("report").textContent);
  const M = R.meta;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const TOK = ["c1", "c2", "c3", "c4", "c5", "c6", "good", "warn", "risk", "accent", "ink-3"];
  const col = (t, i) => `var(--${TOK.includes(t) ? t : "c" + ((i || 0) % 6 + 1)})`;
  const tip = $("#tip");
  const showTip = (e, html) => { tip.innerHTML = html; tip.style.opacity = 1; tip.style.left = Math.min(e.clientX + 12, innerWidth - 250) + "px"; tip.style.top = e.clientY + 14 + "px"; };
  const hideTip = () => { tip.style.opacity = 0; };
  const fmt = (v, u) => (typeof v === "number" ? d3.format(",")(v) : v) + (u || "");

  /* ---------- masthead and footer ---------- */
  $("#masthead").innerHTML =
    `<p class="eyebrow">${esc(M.eyebrow || "")}</p>` +
    `<button class="theme-btn" id="themeBtn" type="button" aria-live="polite"><span class="tdot" aria-hidden="true"></span><span id="themeLabel">Auto</span></button>` +
    `<h1>${esc(M.title)}</h1><p class="standfirst">${rich(M.standfirst || "")}</p>` +
    `<div class="meta-row">` +
    `<span class="chip ${M.confidentiality === "public" ? "good" : "warn"}">${esc(M.confidentiality)} &middot; sanitized view</span>` +
    (M.status ? `<span class="chip ${M.status === "draft" ? "draft" : ""}">${esc(M.status)}</span>` : "") +
    (M.date ? `<span class="chip">${esc(M.date)}</span>` : "") +
    (M.chips || []).map(c => c.href
      ? `<a class="chip" href="${esc(c.href)}" target="_blank" rel="noopener noreferrer">${esc(c.text)}</a>`
      : `<span class="chip ${esc(c.tone || "")}">${esc(c.text)}</span>`).join("") + `</div>`;
  $("#foot").innerHTML = (M.notes || []).map(n => `<p>${rich(n)}</p>`).join("") +
    `<p>This report is a sanitized view. It names no production tables, columns, accounts, or credentials.</p>`;

  /* ---------- theme toggle: Auto, Light, Dark ---------- */
  (function () {
    const root = document.documentElement, btn = $("#themeBtn"), lab = $("#themeLabel");
    const get = () => { try { return localStorage.getItem("report-theme"); } catch (e) { return null; } };
    const draw = () => { const t = root.getAttribute("data-theme"); lab.textContent = t === "dark" ? "Dark" : t === "light" ? "Light" : "Auto"; };
    btn.addEventListener("click", () => {
      const t = root.getAttribute("data-theme"), n = t === "light" ? "dark" : t === "dark" ? null : "light";
      if (n) root.setAttribute("data-theme", n); else root.removeAttribute("data-theme");
      try { n ? localStorage.setItem("report-theme", n) : localStorage.removeItem("report-theme"); } catch (e) {}
      draw();
    });
    draw();
  })();

  /* ---------- svg helpers ---------- */
  const svgOf = (el, w, h, label) => d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("role", "img").attr("aria-label", label || "Chart");
  const T = (g, x, y, s, cls, anchor) => g.append("text").attr("x", x).attr("y", y).attr("class", cls || null).attr("text-anchor", anchor || "start").text(s);
  const legend = (el, items) => { if (items.length > 1) el.insertAdjacentHTML("beforeend", `<div class="legend">${items.map(i => `<span><i style="background:${i.c}"></i>${esc(i.n)}</span>`).join("")}</div>`); };
  const hover = (sel, html) => sel.on("mousemove", (e, d) => showTip(e, html(d))).on("mouseleave", hideTip);

  /* ---------- charts ---------- */
  const C = {};

  C.bars = (el, b, W) => {
    const items = b.sort === false ? b.items : [...b.items].sort((a, c) => c.value - a.value);
    const rh = 34, lw = b.labelWidth || 170, H = items.length * rh + 6, max = b.max || d3.max(items, d => d.value);
    const svg = svgOf(el, W, H, b.title), x = d3.scaleLinear([0, max], [0, W - lw - 70]);
    const g = svg.selectAll("g").data(items).join("g").attr("transform", (d, i) => `translate(0,${i * rh + 3})`);
    g.append("text").attr("class", "lbl").attr("x", lw - 10).attr("y", rh / 2 + 4).attr("text-anchor", "end").text(d => d.label);
    g.append("rect").attr("x", lw).attr("y", 5).attr("height", rh - 12).attr("rx", 4).attr("class", "gx").style("fill", (d, i) => col(d.color, b.single ? 0 : i)).attr("width", d => x(d.value));
    g.append("text").attr("class", "val").attr("x", d => lw + x(d.value) + 8).attr("y", rh / 2 + 4).text(d => fmt(d.value, b.unit));
  };

  C.stacked = (el, b, W) => {
    const rh = 38, lw = b.labelWidth || 170, H = b.categories.length * rh + 6;
    const tot = b.categories.map((c, i) => d3.sum(b.series, s => s.values[i])), max = b.max || d3.max(tot);
    const svg = svgOf(el, W, H, b.title), x = d3.scaleLinear([0, max], [0, W - lw - 70]);
    b.categories.forEach((c, i) => {
      const g = svg.append("g").attr("transform", `translate(0,${i * rh + 3})`); let acc = 0;
      T(g, lw - 10, rh / 2 + 4, c, "lbl", "end");
      b.series.forEach((s, k) => {
        const v = s.values[i];
        hover(g.append("rect").attr("x", lw + x(acc)).attr("y", 5).attr("width", Math.max(0, x(v) - 1)).attr("height", rh - 12).style("fill", col(s.color, k)).datum(v), d => `${esc(s.name)}: <b>${fmt(d, b.unit)}</b>`);
        acc += v;
      });
      T(g, lw + x(acc) + 8, rh / 2 + 4, fmt(acc, b.unit), "val");
    });
    legend(el, b.series.map((s, k) => ({ n: s.name, c: col(s.color, k) })));
  };

  C.donut = (el, b, W) => {
    const H = Math.min(W, 300), r = H / 2 - 6, svg = svgOf(el, W, H, b.title), g = svg.append("g").attr("transform", `translate(${W / 2},${H / 2})`);
    const arc = d3.arc().innerRadius(r * 0.62).outerRadius(r).padAngle(0.015).cornerRadius(4), total = d3.sum(b.items, d => d.value);
    const arcs = d3.pie().sort(null).value(d => d.value)(b.items);
    const p = g.selectAll("path").data(arcs).join("path").attr("class", "fi").attr("d", arc).style("fill", (d, i) => col(d.data.color, i));
    hover(p, d => `${esc(d.data.label)}: <b>${fmt(d.data.value, b.unit)}</b> (${Math.round(d.data.value / total * 100)}%)`);
    if (b.center) { T(g, 0, 4, b.center, "val", "middle").style("font-size", "22px"); if (b.centerSub) T(g, 0, 24, b.centerSub, "", "middle"); }
    legend(el, b.items.map((d, i) => ({ n: `${d.label} (${fmt(d.value, b.unit)})`, c: col(d.color, i) })));
  };

  C.line = (el, b, W) => {
    const H = b.height || 280, m = { l: 44, r: 16, t: 12, b: 30 }, svg = svgOf(el, W, H, b.title);
    const x = d3.scalePoint(b.x, [m.l, W - m.r]).padding(0.3);
    const ymax = b.max || d3.max(b.series, s => d3.max(s.values)) * 1.1, y = d3.scaleLinear([b.min || 0, ymax], [H - m.b, m.t]).nice();
    const gr = svg.append("g").attr("class", "grid axis");
    y.ticks(5).forEach(t => { gr.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(t)).attr("y2", y(t)); T(gr, m.l - 8, y(t) + 4, fmt(t, b.unit), "", "end"); });
    b.x.forEach(v => T(gr, x(v), H - 8, v, "", "middle"));
    const ln = d3.line().x((d, i) => x(b.x[i])).y(d => y(d)).curve(d3.curveMonotoneX);
    b.series.forEach((s, k) => {
      const c = col(s.color, k);
      svg.append("path").attr("class", "dl").attr("d", ln(s.values)).attr("pathLength", 1).attr("fill", "none").style("stroke", c).attr("stroke-width", 2.6).attr("stroke-linecap", "round");
      hover(svg.selectAll(null).data(s.values.map((v, i) => ({ v, i }))).join("circle").attr("cx", d => x(b.x[d.i])).attr("cy", d => y(d.v)).attr("r", 4.5).style("fill", c), d => `${esc(s.name)} · ${esc(b.x[d.i])}: <b>${fmt(d.v, b.unit)}</b>`);
    });
    legend(el, b.series.map((s, k) => ({ n: s.name, c: col(s.color, k) })));
  };

  C.radar = (el, b, W) => {
    const H = Math.min(W, 380), cx = W / 2, cy = H / 2, r = H / 2 - 44, n = b.axes.length, max = b.max || 5, svg = svgOf(el, W, H, b.title);
    const ang = i => i / n * Math.PI * 2 - Math.PI / 2, pt = (i, v) => [cx + Math.cos(ang(i)) * r * v / max, cy + Math.sin(ang(i)) * r * v / max];
    for (let k = 1; k <= max; k++) svg.append("polygon").attr("points", b.axes.map((a, i) => pt(i, k).join(",")).join(" ")).attr("fill", "none").style("stroke", "var(--line)");
    b.axes.forEach((a, i) => { const [x, y] = pt(i, max + 0.55); svg.append("line").attr("x1", cx).attr("y1", cy).attr("x2", pt(i, max)[0]).attr("y2", pt(i, max)[1]).style("stroke", "var(--line)"); T(svg, x, y + 4, a, "", "middle"); });
    b.series.forEach((s, k) => {
      const c = col(s.color, k);
      svg.append("polygon").attr("points", s.values.map((v, i) => pt(i, v).join(",")).join(" ")).style("fill", c).style("stroke", c).attr("fill-opacity", 0.16).attr("stroke-width", 2);
      hover(svg.selectAll(null).data(s.values.map((v, i) => ({ v, i }))).join("circle").attr("cx", d => pt(d.i, d.v)[0]).attr("cy", d => pt(d.i, d.v)[1]).attr("r", 4).style("fill", c), d => `${esc(s.name)} · ${esc(b.axes[d.i])}: <b>${d.v}</b>`);
    });
    legend(el, b.series.map((s, k) => ({ n: s.name, c: col(s.color, k) })));
  };

  C.treemap = (el, b, W) => {
    const H = b.height || 280, svg = svgOf(el, W, H, b.title);
    const groups = d3.group(b.items, d => d.group || "");
    const root = d3.hierarchy({ children: [...groups].map(([k, v]) => ({ name: k, children: v })) }).sum(d => d.value);
    d3.treemap().size([W, H]).paddingInner(3).round(true)(root);
    const cell = svg.selectAll("g").data(root.leaves()).join("g").attr("transform", d => `translate(${d.x0},${d.y0})`);
    hover(cell.append("rect").attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0).attr("rx", 5).style("fill", (d, i) => col(d.data.color, [...groups.keys()].indexOf(d.parent.data.name))).attr("fill-opacity", 0.85), d => `${esc(d.data.label)}: <b>${fmt(d.data.value, b.unit)}</b>`);
    cell.filter(d => d.x1 - d.x0 > 70 && d.y1 - d.y0 > 30).append("text").attr("x", 8).attr("y", 18).attr("class", "t1").style("fill", "#fff").style("font-size", "12px").style("font-weight", 600).text(d => d.data.label);
    cell.filter(d => d.x1 - d.x0 > 70 && d.y1 - d.y0 > 46).append("text").attr("x", 8).attr("y", 34).style("fill", "#fff").style("font-size", "11px").text(d => fmt(d.data.value, b.unit));
    if (groups.size > 1) legend(el, [...groups.keys()].map((k, i) => ({ n: k, c: col(null, i) })));
  };

  C.flow = (el, b, W) => {
    const cols = b.cols, rows = b.rows || 1, gx = 46, gy = 22, nh = b.nodeHeight || 62, H = rows * nh + (rows - 1) * gy + 4;
    const cw = (W - gx * (cols - 1)) / cols, svg = svgOf(el, W, H, b.title), byId = {};
    const defs = svg.append("defs"); defs.append("marker").attr("id", "arw").attr("viewBox", "0 0 10 10").attr("refX", 8).attr("refY", 5).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,0L10,5L0,10z").style("fill", "var(--ink-3)");
    b.nodes.forEach(n => { n.x = n.col * (cw + gx); n.y = n.row * (nh + gy) + 2; n.w = cw * (n.cs || 1) + gx * ((n.cs || 1) - 1); byId[n.id] = n; });
    const edges = b.edges.map(([a, c, l]) => ({ a: byId[a], c: byId[c], l }));
    const ep = svg.selectAll("path.edge").data(edges).join("path").attr("class", "edge").attr("marker-end", "url(#arw)").attr("d", e => {
      const A = e.a, B = e.c;
      if (B.x > A.x + A.w - 1) return d3.linkHorizontal()({ source: [A.x + A.w, A.y + nh / 2], target: [B.x - 4, B.y + nh / 2] });
      return `M${A.x + A.w / 2},${A.y + (B.y > A.y ? nh : 0)}L${B.x + B.w / 2},${B.y + (B.y > A.y ? -4 : nh + 4)}`;
    });
    const ng = svg.selectAll("g.node").data(b.nodes).join("g").attr("class", "node").attr("transform", d => `translate(${d.x},${d.y})`).attr("tabindex", 0);
    ng.append("rect").attr("width", d => d.w).attr("height", nh).attr("rx", 10).style("stroke", (d, i) => col(d.color, i));
    ng.append("text").attr("class", "t1").attr("x", d => d.w / 2).attr("y", d => d.sub ? 26 : 36).attr("text-anchor", "middle").text(d => d.title);
    ng.append("text").attr("class", "t2").attr("x", d => d.w / 2).attr("y", 45).attr("text-anchor", "middle").text(d => d.sub || "");
    const focus = d => { const on = new Set([d.id]); edges.forEach(e => { if (e.a.id === d.id) on.add(e.c.id); if (e.c.id === d.id) on.add(e.a.id); }); ng.classed("dim", n => !on.has(n.id)); ep.classed("dim", e => e.a.id !== d.id && e.c.id !== d.id); };
    const clear = () => { ng.classed("dim", false); ep.classed("dim", false); };
    ng.on("mouseenter focus", (e, d) => focus(d)).on("mouseleave blur", clear);
  };

  /* ---------- blocks ---------- */
  function table(b) {
    const th = b.columns.map(c => `<th class="${c.kind === "num" ? "num" : c.kind === "score" ? "score" : ""}">${esc(c.label)}</th>`).join("");
    const body = b.rows.map(r => "<tr>" + b.columns.map(c => {
      const v = r[c.key];
      if (c.kind === "score") { const cl = v >= 4 ? "hi" : v === 3 ? "mid" : "lo"; return `<td class="score ${cl}">${esc(v)}</td>`; }
      if (c.kind === "num") return `<td class="num">${esc(typeof v === "number" ? d3.format(",")(v) : v)}</td>`;
      if (v && typeof v === "object") return `<td><span class="pill ${esc(v.tone || "")}">${esc(v.text)}</span></td>`;
      return `<td>${rich(v)}</td>`;
    }).join("") + "</tr>").join("");
    return `<div class="scroller"><table>${b.caption ? `<caption>${esc(b.caption)}</caption>` : ""}<thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function block(b, narrow) {
    const el = document.createElement("div");
    const W = b.width || (narrow ? 560 : 1000);
    if (C[b.type]) {
      el.className = "panel chart";
      el.innerHTML = (b.title ? `<h3>${esc(b.title)}</h3>` : "") + (b.hint ? `<p class="hint">${rich(b.hint)}</p>` : "");
      requestAnimationFrame(() => C[b.type](el, b, W));
      return el;
    }
    switch (b.type) {
      case "text": el.innerHTML = b.paragraphs.map(p => `<p>${rich(p)}</p>`).join(""); break;
      case "kpis": el.className = "statgrid"; el.innerHTML = b.items.map(k => `<div class="kpi"><div class="k">${esc(k.label)}</div><div class="v ${esc(k.tone || "")}">${esc(k.value)}</div>${k.sub ? `<div class="sub">${esc(k.sub)}</div>` : ""}</div>`).join(""); break;
      case "cards": el.className = "board"; el.innerHTML = b.items.map((c, i) => `<article class="cand" style="--dot:${col(c.color, i)}"><div class="cand-head"><span class="cand-name">${esc(c.title)}</span><span class="rank">${esc(c.tag || "")}</span></div>` +
        `<div class="stat-list">${(c.stats || []).map(s => `<div class="stat"><span>${esc(s.label)}</span><b>${esc(s.value)}</b>${s.pct != null ? `<div class="bar"><i style="width:${Math.max(0, Math.min(100, s.pct))}%"></i></div>` : ""}</div>`).join("")}</div>` +
        (c.line ? `<p class="cand-line">${rich(c.line)}</p>` : "") + (c.goto ? `<button class="details-btn" data-goto="${esc(c.goto)}">${esc(c.gotoLabel || "Detail")} &rarr;</button>` : "") + `</article>`).join(""); break;
      case "table": el.innerHTML = table(b); break;
      case "callout": el.className = "note " + (b.kind || ""); el.innerHTML = (b.title ? `<p><strong>${esc(b.title)}</strong></p>` : "") + `<p>${rich(b.text)}</p>`; break;
      case "findings": el.className = "findings"; el.innerHTML = b.items.map((f, i) => `<div class="finding"><span class="idx">${String(i + 1).padStart(2, "0")}</span><div><h3>${esc(f.title)}</h3><p>${rich(f.text)}</p></div></div>`).join(""); break;
      case "steps": el.className = "panel"; el.innerHTML = b.items.map((s, i) => `<div class="step"><span class="step-n">${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${rich(s.text || "")}</p>${s.code ? `<pre class="code">${esc(s.code)}</pre>` : ""}</div></div>`).join(""); break;
      case "grid": el.className = "cols"; el.style.setProperty("--min", (b.min || 320) + "px"); b.blocks.forEach(x => el.appendChild(block(x, true))); break;
    }
    return el;
  }

  /* ---------- tabs ---------- */
  const tabs = R.tabs, tabsEl = $("#tabs"), panels = $("#panels");
  if (tabs.length === 1) $("#tabbar").hidden = true;
  tabs.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.className = "tab"; btn.id = "tab-" + t.id; btn.setAttribute("role", "tab"); btn.setAttribute("aria-controls", "panel-" + t.id);
    btn.style.setProperty("--dot", col(t.color, i)); btn.innerHTML = `<span class="dot" aria-hidden="true"></span>${esc(t.label)}`;
    tabsEl.appendChild(btn);
    const p = document.createElement("div");
    p.id = "panel-" + t.id; p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", btn.id); p.hidden = true; p.className = "stack";
    t.sections.forEach(s => {
      const sec = document.createElement("section");
      sec.innerHTML = `<h2>${esc(s.heading)}</h2>` + (s.note ? `<p class="section-note">${rich(s.note)}</p>` : "");
      const body = document.createElement("div"); body.className = "stack";
      s.blocks.forEach(b => body.appendChild(block(b, false)));
      sec.appendChild(body); p.appendChild(sec);
    });
    panels.appendChild(p);
  });
  function show(id) {
    tabs.forEach(t => { const on = t.id === id; $("#tab-" + t.id).setAttribute("aria-selected", on); $("#panel-" + t.id).hidden = !on; });
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    scrollTo({ top: 0 });
  }
  tabsEl.addEventListener("click", e => { const b = e.target.closest(".tab"); if (b) show(b.id.slice(4)); });
  tabsEl.addEventListener("keydown", e => {
    const i = tabs.findIndex(t => $("#tab-" + t.id).getAttribute("aria-selected") === "true"), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; show(n.id); $("#tab-" + n.id).focus(); }
  });
  document.addEventListener("click", e => { const g = e.target.closest("[data-goto]"); if (g) show(g.dataset.goto); });
  const first = tabs.find(t => "#" + t.id === location.hash) || tabs[0];
  show(first.id);
  document.title = M.title;
})();
