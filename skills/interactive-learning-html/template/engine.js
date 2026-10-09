/* ===== interactive-learning-html · engine =====
   Reads the global CONTENT object. Builds tabs, views, dialogs.
   View types: "diagram" | "catalog" | "ideas". No external libraries. */
const CONTENT=JSON.parse(document.getElementById("content").textContent);
(function(){
  "use strict";
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const tok=t=>"var(--"+(t||"accent")+")";
  const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
  const bold=(parent,str)=>{ String(str).split("**").forEach((p,i)=>{ if(!p)return; if(i%2){const b=el("b",null,p);parent.appendChild(b);} else parent.appendChild(document.createTextNode(p)); }); };

  /* speech (offline, browser voice). Hidden when the browser has none. */
  const canSpeak="speechSynthesis" in window;
  function speak(text,lang){
    if(!canSpeak||!text) return;
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text); u.lang=lang||"en-US"; u.rate=.8;
    const v=speechSynthesis.getVoices().find(v=>v.lang.replace("_","-").toLowerCase()===u.lang.toLowerCase()); if(v) u.voice=v;
    speechSynthesis.speak(u);
  }
  const restyle=()=>window.dispatchEvent(new Event("anyhow-restyle"));
  const PALETTES=[
    {id:"graphite",name:"Graphite",hint:"Tech, software, data, engineering",c:["#15171c","#5aa9ff","#4ad8a6","#ffa94d","#ff7a93"]},
    {id:"ocean",name:"Ocean",hint:"Science, maths, space, physics",c:["#0c1a2b","#46c1ff","#3fe0b5","#ffb454","#ff7f9c"]},
    {id:"forest",name:"Forest",hint:"Nature, health, biology, sustainability",c:["#0f1a14","#7bd88f","#6fd3c4","#ffb15c","#f58aa0"]},
    {id:"ember",name:"Ember",hint:"Business, finance, history, economics",c:["#1c1512","#ffb454","#8fd6a0","#5ec8d8","#ff7f8a"]},
    {id:"dusk",name:"Dusk",hint:"Language, arts, culture, humanities",c:["#1a1620","#c9a7e8","#8fdcb8","#f3b074","#f08fb0"]}
  ];
  const D=CONTENT, root=document.documentElement;

  /* ---------- shell ---------- */
  if(!root.dataset.palette||!PALETTES.some(p=>p.id===root.dataset.palette)) root.dataset.palette="graphite";
  const savedMode=store.get("anyhow-mode"); if(savedMode) root.dataset.theme=savedMode;
  $("#title").textContent=D.meta.title; bold($("#tagline"),D.meta.tagline||"");
  $("#theme").addEventListener("click",()=>{ const t=root.dataset.theme==="dark"?"light":"dark"; root.dataset.theme=t; store.set("anyhow-mode",t); restyle(); });

  /* dialogs */
  const SAYLANG=D.meta.speakLang||"en-US";
  let popSay="";
  function openPop(layer,color,title,pinyin,a,b,say){
    $("#popL").textContent=layer; $("#popL").style.setProperty("--c",color); $("#popT").textContent=title;
    $("#popP").textContent=pinyin||""; $("#popP").hidden=!pinyin;
    $("#popA").textContent=a||""; $("#popB").textContent=b||"";
    popSay=say||""; $("#popSay").hidden=!(canSpeak&&say); $("#pop").showModal();
  }
  $("#popSay").addEventListener("click",()=>speak(popSay,SAYLANG));
  [["#popX","#pop"],["#srcX","#srcDlg"],["#palX","#palDlg"]].forEach(([b,d])=>$(b).addEventListener("click",()=>$(d).close()));
  $$("dialog").forEach(d=>d.addEventListener("click",e=>{ if(e.target===d) d.close(); }));
  $("#srcBtn").addEventListener("click",()=>$("#srcDlg").showModal());
  $("#palBtn").addEventListener("click",()=>$("#palDlg").showModal());
  const sl=$("#srcList");
  (D.meta.sources||[]).forEach(s=>{ const li=el("li"); if(s.url){ const a=el("a",null,s.label); a.href=s.url; a.target="_blank"; a.rel="noopener"; li.appendChild(a); if(s.note) li.appendChild(document.createTextNode(" — "+s.note)); } else li.textContent=s.label+(s.note?" — "+s.note:""); sl.appendChild(li); });
  (D.meta.notes||[]).forEach(n=>sl.appendChild(el("li",null,n)));
  PALETTES.forEach(p=>{
    const b=el("button","sw"); b.type="button"; b.setAttribute("aria-pressed",String(p.id===root.dataset.palette));
    const ch=el("span","chips"); p.c.forEach(c=>{ const i=document.createElement("i"); i.style.background=c; ch.appendChild(i); }); b.appendChild(ch);
    const tx=el("span"); tx.appendChild(el("b",null,p.name)); tx.appendChild(el("small",null,p.hint)); b.appendChild(tx);
    b.addEventListener("click",()=>{ root.dataset.palette=p.id; $$(".sw").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); restyle(); });
    $("#swatches").appendChild(b);
  });

  /* ---------- generic diagram view ---------- */
  const NS="http://www.w3.org/2000/svg";
  const S=(tag,attrs,parent)=>{const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e;};

  function makeGrid(g){
    const W=g.w||1100,H=g.h||500,pad=g.pad??20,gx=g.gx??40,gy=g.gy??18, cw=g.cols||[1], rh=g.rows||[1];
    const uc=(W-2*pad-gx*(cw.length-1))/cw.reduce((a,b)=>a+b,0), ur=(H-2*pad-gy*(rh.length-1))/rh.reduce((a,b)=>a+b,0);
    const pos=(arr,u,gap,p)=>{ const i=Math.floor(p),f=p-i; let s=0; for(let k=0;k<i&&k<arr.length;k++) s+=arr[k]*u+gap; return pad+s+f*((arr[i]||0)*u+gap); };
    const X=c=>pos(cw,uc,gx,c), Y=r=>pos(rh,ur,gy,r);
    return { X, Y, place(o){ if(o.col==null) return o; const x=X(o.col),y=Y(o.row); o.x=x; o.y=y; o.w=X(o.col+(o.cs||1))-gx-x; o.h=Y(o.row+(o.rs||1))-gy-y; return o; },
             rowMid(r){ return (Y(r)+Y(r+1)-gy)/2; } };
  }

  function diagramView(host,V,reg){
    host.innerHTML='<div class="viz"><svg class="dg" viewBox="0 0 '+(V.grid.w||1100)+' '+(V.grid.h||500)+'" role="group"></svg></div>'+
      '<aside class="side"><div class="story" aria-live="polite"><div class="n"></div><div class="h"></div><div class="t"></div></div>'+
      '<div class="dots" role="group" aria-label="Stages"></div>'+
      '<div class="ctrl"><button class="btn play">▶ Play</button><button class="btn ghost prev" aria-label="Previous stage">◀</button><button class="btn ghost next" aria-label="Next stage">▶</button><button class="btn ghost clr">Reset</button></div>'+
      '<div class="persona" hidden role="group"><b>Who uses what?</b></div><div class="detail"></div></aside>';
    const svg=$("svg",host), side=$(".side",host); svg.setAttribute("aria-label",V.label||V.tab);
    const G=makeGrid(V.grid), byId={}, nodeEls={}, edgeEls=[], seen=new Set();
    V.nodes.forEach(n=>{ G.place(n); byId[n.id]=n; });
    let stage=-1,timer=null,persona=null,started=false;
    const last=V.stages.length-1;

    (V.zones||[]).forEach(z=>{
      G.place(z); const c=tok(z.color||"k2");
      S("rect",{class:"zone",x:z.x,y:z.y,width:z.w,height:z.h,rx:22,style:"stroke:"+c+";fill:"+c},svg);
      const end=z.align==="end", tx=end?z.x+z.w-20:z.x+20;
      S("text",{class:"zl",x:tx,y:z.y+30,"text-anchor":end?"end":"start"},svg).textContent=z.title;
      if(z.sub) S("text",{class:"zs",x:tx,y:z.y+50,"text-anchor":end?"end":"start"},svg).textContent=z.sub;
    });
    (V.heads||[]).forEach(h=>{
      const x=G.X(h.col), y=G.rowMid(h.row), g=S("g",{class:"hd"},svg);
      if(h.num){ S("circle",{cx:x+11,cy:y,r:11},g); S("text",{class:"num",x:x+11,y:y+4.5,"text-anchor":"middle"},g).textContent=h.num; }
      S("text",{x:x+(h.num?28:0),y:y+5},g).textContent=h.text;
    });
    const gTick=S("g",{},svg), gEdge=S("g",{},svg), gNode=S("g",{},svg);
    const overlapX=(A,B)=>{ const lo=Math.max(A.x,B.x)+12,hi=Math.min(A.x+A.w,B.x+B.w)-12; return hi>lo?(lo+hi)/2:(A.x+A.w/2+B.x+B.w/2)/2; };
    (V.ticks||[]).forEach(([a,b])=>{ let A=byId[a],B=byId[b]; if(A.y>B.y)[A,B]=[B,A]; const x=overlapX(A,B); S("line",{class:"tick",x1:x,y1:A.y+A.h,x2:x,y2:B.y},gTick); });

    (V.edges||[]).forEach(([a,b],i)=>{
      const A=byId[a],B=byId[b]; let x1,y1,x2,y2,ang=0,d;
      if(A.x+A.w<=B.x+2){ x1=A.x+A.w;y1=A.y+A.h/2;x2=B.x;y2=B.y+B.h/2; const mx=(x1+x2)/2; d=`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; }
      else if(B.y>=A.y+A.h){ const x=overlapX(A,B); x1=x2=x;y1=A.y+A.h;y2=B.y;ang=90; d=`M${x1},${y1} L${x2},${y2}`; }
      else { const x=overlapX(A,B); x1=x2=x;y1=A.y;y2=B.y+B.h;ang=-90; d=`M${x1},${y1} L${x2},${y2}`; }
      const g=S("g",{class:"eg"},gEdge), id=V.id+"-e"+i;
      S("path",{class:"ln",id,d},g);
      S("path",{class:"ah",d:"M-11,-8 L0,0 L-11,8",transform:`translate(${x2},${y2}) rotate(${ang})`},g);
      const dot=S("circle",{class:"pt",r:6},g);
      if(!reduce){ const am=S("animateMotion",{dur:"1.8s",repeatCount:"indefinite",begin:"-"+((i%3)*0.6)+"s"},dot); S("mpath",{href:"#"+id},am); }
      else { dot.setAttribute("cx",ang===0?x2-16:x2); dot.setAttribute("cy",y2); }
      edgeEls.push({g,a,b});
    });

    const fit=(t,txt,max,cw)=>{ if(txt.length*cw>max){ t.setAttribute("textLength",Math.max(40,max)); t.setAttribute("lengthAdjust","spacingAndGlyphs"); } };
    V.nodes.forEach(n=>{
      const c=tok(n.color||"k2"), kind=n.kind||"box";
      const g=S("g",{class:"node",tabindex:0,role:"button","aria-label":(n.glyph?n.glyph+". ":"")+n.title+". "+(n.layer||"")+". Press Enter for details.",style:"--glow:"+c},gNode);
      S("rect",{class:"body",x:n.x,y:n.y,width:n.w,height:n.h,rx:kind==="band"?14:18,"fill-opacity":.2,"stroke-width":3.5,style:"fill:"+c+";stroke:"+c},g);
      const T=(txt,x,y,size,cls,anchor)=>{const t=S("text",{class:cls,x,y,"font-size":size,"text-anchor":anchor||"start"},g);t.textContent=txt;return t;};
      if(kind==="tall"){
        const cx=n.x+n.w/2, lines=n.lines||[], gs=n.glyph?(n.glyph.length>2?40:n.glyph.length>1?52:64):38;
        const H=gs+10+22+lines.length*18, y0=n.y+n.h/2-H/2;
        if(n.glyph) T(n.glyph,cx,y0+gs*0.86,gs,"gl","middle"); else T(n.icon||"",cx,y0+gs*0.86,gs,"t1","middle");
        fit(T(n.title,cx,y0+gs+10+16,18,"t1","middle"),n.title,n.w-16,10.4);
        lines.forEach((l,i)=>fit(T(l,cx,y0+gs+10+22+14+i*18,13,"t2","middle"),l,n.w-16,6.8));
      } else if(kind==="band"){
        T(n.icon||"",n.x+16,n.y+n.h/2+9,26,"t1");
        if(n.h<50){ const tw=n.title.length*9.6; fit(T(n.title,n.x+54,n.y+n.h/2+6,16.5,"t1"),n.title,tw,9.6); if(n.sub) fit(T(n.sub,n.x+54+tw+14,n.y+n.h/2+5.5,13,"t2"),n.sub,n.w-54-tw-30,6.8); }
        else { fit(T(n.title,n.x+54,n.y+n.h/2-1,16.5,"t1"),n.title,n.w-70,9.6); if(n.sub) fit(T(n.sub,n.x+54,n.y+n.h/2+17,13,"t2"),n.sub,n.w-70,6.8); }
      } else {
        let tx=n.x+50;
        if(n.glyph){ const gs=n.glyph.length>2?22:n.glyph.length>1?27:32; T(n.glyph,n.x+14,n.y+n.h/2+gs*0.36,gs,"gl"); tx=n.x+14+n.glyph.length*gs*1.04+12; }
        else T(n.icon||"",n.x+14,n.y+n.h/2+10,26,"t1");
        fit(T(n.title,tx,n.y+n.h/2-3,16.5,"t1"),n.title,n.x+n.w-tx-10,9.6); if(n.sub) fit(T(n.sub,tx,n.y+n.h/2+17,13,"t2"),n.sub,n.x+n.w-tx-10,6.8);
      }
      g.addEventListener("click",()=>selectNode(n.id));
      g.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); selectNode(n.id); } });
      nodeEls[n.id]=g;
    });

    function applyFocus(ids,isOn,sel,lit){
      const any=ids&&ids.size>0;
      Object.entries(nodeEls).forEach(([id,g])=>{ g.classList.toggle("dim",any&&!ids.has(id)); g.classList.toggle("sel",id===sel); g.classList.toggle("lit",!!lit&&any&&ids.has(id)); });
      edgeEls.forEach(e=>{ const on=isOn?isOn(e):false; e.g.classList.toggle("on",on); e.g.classList.toggle("dim",any&&!on); });
    }
    const setStory=(n,h,t)=>{ $(".story .n",side).textContent=n; $(".story .h",side).textContent=h; $(".story .t",side).textContent=t; };
    function resetDetail(){ const d=$(".detail",side); d.style.setProperty("--c","var(--accent)"); d.innerHTML='<h3>Tap any block</h3><p class="hintp">See what it does, an example, and where data goes next.</p>'; }
    function markDots(){ $$(".dot",side).forEach((b,i)=>{ if(i===stage)b.setAttribute("aria-current","step"); else b.removeAttribute("aria-current"); b.classList.toggle("seen",seen.has(i)&&i!==stage); }); }
    function clearPersona(){ persona=null; $$(".persona .f",side).forEach(b=>b.setAttribute("aria-pressed","false")); }
    const neighbors=id=>{ const s=new Set([id]); (V.edges||[]).forEach(([a,b])=>{ if(a===id)s.add(b); if(b===id)s.add(a); }); return s; };

    function selectNode(id){
      stopTour(); stage=-1; markDots(); clearPersona();
      const n=byId[id], ids=neighbors(id);
      if((n.kind||"box")==="band") V.nodes.forEach(x=>{ if(x.kind!=="band") ids.add(x.id); });
      applyFocus(ids,e=>e.a===id||e.b===id,id,false);
      const d=$(".detail",side); d.style.setProperty("--c",tok(n.color||"k2"));
      const outs=(V.edges||[]).filter(e=>e[0]===id).map(e=>e[1]), ins=(V.edges||[]).filter(e=>e[1]===id).map(e=>e[0]);
      const people=(n.who||[]).map(w=>(V.people.find(p=>p.id===w)||{}).name).filter(Boolean).join(", ");
      d.innerHTML=""; d.appendChild(el("span","layer",n.layer||"")); d.appendChild(el("h3",null,(n.glyph||n.icon||"")+" "+n.title));
      const dl=el("dl"); const row=(k,v)=>{ dl.appendChild(el("dt",null,k)); dl.appendChild(el("dd",null,v)); };
      if(n.does) row("Does",n.does); if(n.example) row("Example",n.example); if(people) row("Used by",people); d.appendChild(dl);
      const nx=el("div","next"); const mk=(l,i)=>{ const b=el("button","f",l+" "+byId[i].title); b.type="button"; b.addEventListener("click",()=>selectNode(i)); nx.appendChild(b); };
      ins.forEach(i=>mk("←",i)); outs.forEach(o=>mk("→",o)); d.appendChild(nx);
      const say=n.speak||(V.speak?n.glyph:""); if(canSpeak&&say){ const sb=el("button","btn ghost","🔊 Listen"); sb.type="button"; sb.style.marginTop="8px"; sb.addEventListener("click",()=>speak(say,SAYLANG)); d.appendChild(sb); }
      setStory("Block",n.title,n.does||"");
    }

    if(V.people&&V.people.length){
      const pb=$(".persona",side); pb.hidden=false; pb.setAttribute("aria-label","Show what a role uses");
      V.people.forEach(p=>{
        const b=el("button","f",p.name); b.type="button"; b.style.setProperty("--c",tok(p.color)); b.setAttribute("aria-pressed","false");
        b.addEventListener("click",()=>{
          stopTour(); stage=-1; markDots();
          const on=persona!==p.id; clearPersona(); if(on){ persona=p.id; b.setAttribute("aria-pressed","true"); }
          if(!on){ applyFocus(null,null,null); resetDetail(); setStory("Ready","Press Play",V.intro||""); return; }
          const ids=new Set(V.nodes.filter(n=>(n.who||[]).includes(p.id)).map(n=>n.id));
          applyFocus(ids,e=>ids.has(e.a)&&ids.has(e.b),null,true);
          setStory("Role lens",p.name,"Lit blocks are the ones this role uses. "+[...ids].filter(i=>byId[i].kind!=="band").length+" blocks. Tap one to learn more.");
        });
        pb.appendChild(b);
      });
    }

    V.stages.forEach((s,i)=>{ const b=el("button","dot",String(i+1)); b.type="button"; b.title=s.name; b.setAttribute("aria-label","Stage "+(i+1)+": "+s.name); b.addEventListener("click",()=>{ stopTour(); showStage(i); }); $(".dots",side).appendChild(b); });
    function showStage(i){
      stage=clamp(i,0,last); clearPersona();
      const s=V.stages[stage], ids=new Set(s.nodes);
      applyFocus(ids,e=>ids.has(e.a)&&ids.has(e.b),null,true);
      setStory("Stage "+(stage+1)+" of "+V.stages.length+" · "+s.name,s.headline,s.text); seen.add(stage); markDots(); resetDetail();
    }
    const label=()=>$(".play",side).textContent=timer?"❚❚ Pause":(started&&stage>=last?"↻ Replay":"▶ Play");
    function startTour(){ if(timer)return; started=true; if(stage<0||stage>=last) showStage(0); timer=setInterval(()=>{ if(stage>=last){ stopTour(); return; } showStage(stage+1); label(); },4300); label(); }
    function stopTour(){ if(timer){ clearInterval(timer); timer=null; } label(); }
    $(".play",side).addEventListener("click",()=>{ timer?stopTour():startTour(); });
    $(".next",side).addEventListener("click",()=>{ stopTour(); showStage(stage<0?0:stage+1); });
    $(".prev",side).addEventListener("click",()=>{ stopTour(); showStage(stage<0?last:stage-1); });
    $(".clr",side).addEventListener("click",()=>{ stopTour(); stage=-1; started=false; clearPersona(); markDots(); applyFocus(null,null,null); resetDetail(); setStory("Ready","Press Play",V.intro||""); label(); });
    setStory("Ready","Press Play",V.intro||""); resetDetail();
    return { onShow(){ if(!started&&!reduce) startTour(); }, onHide(){ stopTour(); }, showStage:i=>{ stopTour(); showStage(i); }, selectNode };
  }

  /* ---------- catalog view ---------- */
  function catalogView(host,V){
    host.classList.add("plain");
    const cols=el("div","cols"); cols.style.setProperty("--n",V.layers.length); host.appendChild(cols);
    V.layers.forEach(L=>{
      const c=tok(L.color), col=el("div","col"); col.style.setProperty("--c",c);
      col.appendChild(el("span","e",L.icon||"")); col.appendChild(el("h3",null,L.name));
      V.items.filter(i=>i.layer===L.id).forEach(i=>{ const b=el("button","chipb"); b.type="button"; b.appendChild(el("span","cn",i.name)); if(i.pinyin) b.appendChild(el("small",null,i.pinyin)); b.addEventListener("click",()=>openPop(L.name,c,i.name,i.pinyin,i.does,i.more,i.speak||(V.speak?i.name:""))); col.appendChild(b); });
      cols.appendChild(col);
    });
    if(V.note) host.appendChild(el("p","catnote",V.note));
    return {};
  }

  /* ---------- ideas view ---------- */
  function ideasView(host,V,reg){
    host.classList.add("plain");
    const wrap=el("div","ideas"); host.appendChild(wrap);
    V.cards.forEach((o,i)=>{
      const d=el("article","idea"); d.style.setProperty("--c",tok(o.color));
      d.appendChild(el("span","no",String(i+1))); d.appendChild(el("span","em",o.icon||"")); d.appendChild(el("h2",null,o.title)); d.appendChild(el("p",null,o.text));
      if(o.go){ const b=el("button","btn",o.button||"Show me →"); b.type="button"; b.addEventListener("click",()=>{ const t=reg[o.go.view]; setTab(o.go.view); if(t&&t.api){ if(o.go.node&&t.api.selectNode) t.api.selectNode(o.go.node); else if(o.go.stage!=null&&t.api.showStage) t.api.showStage(o.go.stage); } }); d.appendChild(b); }
      wrap.appendChild(d);
    });
    return {};
  }


  /* ---------- trace view: write on a practice grid, guide fades each round ---------- */
  function traceView(host,V){
    host.innerHTML='<div class="viz tracebox"><canvas class="tc" aria-label="Writing area. Draw with a mouse, a finger or a pen."></canvas></div>'+
      '<aside class="side"><div class="story" aria-live="polite"><div class="n"></div><div class="h"></div><div class="t"></div></div>'+
      '<div class="stars" aria-live="polite"></div><div class="items" role="group" aria-label="Pick one to write"></div>'+
      '<div class="ctrl"><button class="btn done">✓ Done</button><button class="btn ghost undo">↶ Undo</button><button class="btn ghost clr">Clear</button><button class="btn ghost guide">👁 Guide</button><button class="btn ghost say">🔊 Listen</button></div></aside>';
    const cv=$("canvas",host), ctx=cv.getContext("2d"), side=$(".side",host), items=V.items, rep=V.repeat||3;
    const counts=items.map(()=>0), alphas=[.34,.15,0];
    let idx=0, strokes=[], cur=null, force=null;
    const css=n=>getComputedStyle(root).getPropertyValue(n).trim();
    const KAI='"Kaiti SC","STKaiti","KaiTi","BiauKai","Songti SC","PingFang SC",serif';
    const S=600;
    function alpha(){ return force!==null?force:alphas[Math.min(counts[idx],alphas.length-1)]; }
    function size(){ const n=Array.from(items[idx].text).length; cv.width=S*n; cv.height=S; }
    function draw(){
      const chars=Array.from(items[idx].text), n=chars.length; ctx.clearRect(0,0,cv.width,cv.height);
      ctx.fillStyle=css("--card2")||"#fff"; ctx.fillRect(0,0,cv.width,cv.height);
      const line=css("--line"), hl=css("--hl"), ink=css("--ink"), acc=css("--accent");
      chars.forEach((ch,i)=>{ const x=i*S;
        ctx.save(); ctx.strokeStyle=line; ctx.lineWidth=4; ctx.strokeRect(x+6,6,S-12,S-12);
        ctx.setLineDash([14,12]); ctx.lineWidth=2.5; ctx.beginPath();
        ctx.moveTo(x+S/2,10); ctx.lineTo(x+S/2,S-10); ctx.moveTo(x+10,S/2); ctx.lineTo(x+S-10,S/2);
        ctx.moveTo(x+10,10); ctx.lineTo(x+S-10,S-10); ctx.moveTo(x+S-10,10); ctx.lineTo(x+10,S-10); ctx.stroke(); ctx.restore();
        const a=alpha(); if(a>0){ ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=ink; ctx.font=Math.round(S*0.8)+"px "+KAI; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(ch,x+S/2,S/2+S*0.04); ctx.restore(); }
      });
      ctx.save(); ctx.strokeStyle=acc; ctx.lineWidth=17; ctx.lineCap="round"; ctx.lineJoin="round";
      strokes.concat(cur?[cur]:[]).forEach(st=>{ ctx.beginPath(); st.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); if(st.length===1) ctx.lineTo(st[0][0]+.1,st[0][1]); ctx.stroke(); });
      ctx.restore();
    }
    const pt=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height]; };
    cv.addEventListener("pointerdown",e=>{ cv.setPointerCapture(e.pointerId); cur=[pt(e)]; draw(); });
    cv.addEventListener("pointermove",e=>{ if(!cur)return; cur.push(pt(e)); draw(); });
    const end=()=>{ if(cur){ strokes.push(cur); cur=null; draw(); } };
    cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
    const story=(n,h,t)=>{ $(".story .n",side).textContent=n; $(".story .h",side).textContent=h; $(".story .t",side).textContent=t; };
    function info(msg){
      const it=items[idx]; $(".stars",side).textContent=Array.from({length:rep},(_,i)=>i<counts[idx]?"⭐":"☆").join(" ");
      const hint=counts[idx]>=rep?"Finished!":counts[idx]===rep-1?"Last round. The guide is gone. Write from memory.":counts[idx]===0?"Trace the grey shape.":"The guide is lighter now.";
      story("Write it · "+(idx+1)+" of "+items.length,it.text+(it.pinyin?"  "+it.pinyin:""),msg||[it.meaning,it.note,hint].filter(Boolean).join(" · "));
      $$(".f",side).forEach((b,i)=>{ b.textContent=items[i].text+(counts[i]>=rep?" ✓":""); b.setAttribute("aria-pressed",String(i===idx)); });
    }
    function pick(i){ idx=i; strokes=[]; cur=null; force=null; size(); draw(); info(); }
    items.forEach((it,i)=>{ const b=el("button","f",it.text); b.type="button"; b.style.fontFamily=KAI; b.style.fontSize="1.15rem"; b.addEventListener("click",()=>pick(i)); $(".items",side).appendChild(b); });
    $(".done",side).addEventListener("click",()=>{
      if(!strokes.length){ info("Write first. Then press Done."); return; }
      if(counts[idx]<rep) counts[idx]++; strokes=[]; force=null; draw();
      const all=counts.every(c=>c>=rep);
      info(all?"You wrote every one "+rep+" times. 🎉":counts[idx]>=rep?"Great! "+items[idx].text+" is finished. Pick the next one.":null);
    });
    $(".undo",side).addEventListener("click",()=>{ strokes.pop(); draw(); });
    $(".clr",side).addEventListener("click",()=>{ strokes=[]; draw(); });
    $(".guide",side).addEventListener("click",()=>{ force=alpha()>0?0:.3; draw(); });
    const sayb=$(".say",side); if(!canSpeak) sayb.hidden=true;
    sayb.addEventListener("click",()=>speak(items[idx].speak||items[idx].text,SAYLANG));
    window.addEventListener("anyhow-restyle",draw);
    size(); draw(); info();
    return {};
  }

  /* ---------- views + tabs ---------- */
  const reg={}, tabsEl=$("#tabs"), stageEl=$("#stage");
  D.views.forEach((V,idx)=>{
    const tab=el("button","tab",(V.icon?V.icon+" ":"")+V.tab); tab.type="button"; tab.setAttribute("role","tab"); tab.id="t-"+V.id; tab.setAttribute("aria-controls","v-"+V.id);
    tabsEl.appendChild(tab);
    const sec=el("section","view"); sec.id="v-"+V.id; sec.setAttribute("role","tabpanel"); sec.setAttribute("aria-labelledby",tab.id); stageEl.appendChild(sec);
    const api=V.type==="diagram"?diagramView(sec,V,reg):V.type==="catalog"?catalogView(sec,V):V.type==="trace"?traceView(sec,V):ideasView(sec,V,reg);
    reg[V.id]={tab,sec,api};
    tab.addEventListener("click",()=>setTab(V.id));
  });
  function setTab(id){
    Object.entries(reg).forEach(([k,r])=>{ const on=k===id; r.tab.setAttribute("aria-selected",String(on)); r.tab.tabIndex=on?0:-1; r.sec.hidden=!on; if(r.api&&r.api.onShow){ on?r.api.onShow():r.api.onHide(); } });
  }
  tabsEl.addEventListener("keydown",e=>{
    if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft") return;
    const ids=Object.keys(reg), cur=ids.findIndex(k=>reg[k].tab.getAttribute("aria-selected")==="true"), n=ids[(cur+(e.key==="ArrowRight"?1:ids.length-1))%ids.length];
    setTab(n); reg[n].tab.focus();
  });
  setTab(D.views[0].id);
})();
