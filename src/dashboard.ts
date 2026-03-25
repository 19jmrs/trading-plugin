import { Trade, AccountEvent, TradeStats, TradeFilters, StreakInfo } from "./types";

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:     "var(--background-primary)",
  card:   "var(--background-secondary)",
  border: "var(--background-modifier-border)",
  text:   "var(--text-normal)",
  muted:  "var(--text-muted)",
  faint:  "var(--text-faint)",
  green:  "#4ade80",
  red:    "#f87171",
  yellow: "#facc15",
  orange: "#fb923c",
  blue:   "#60a5fa",
  purple: "#a78bfa",
};
const F = "var(--font-interface),var(--font-text),monospace";
const pc = (v: number) => v >= 0 ? C.green : C.red;
const fmtUSD = (v: number) => { const a = Math.abs(v).toFixed(2); return v < 0 ? `-$${a}` : `$${a}`; };
const fmt = (v: number, d = 2) => v.toFixed(d);

// ─── DOM helpers ──────────────────────────────────────────────────────────────
function div(p: HTMLElement, style = ""): HTMLElement {
  return p.createEl("div", { attr: { style } });
}
function card(p: HTMLElement, style = ""): HTMLElement {
  return div(p, `background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:16px;${style}`);
}
function cardTitle(p: HTMLElement, t: string): void {
  p.createEl("div", { text: t, attr: { style: `color:${C.muted};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;font-family:${F};` } });
}
function badge(p: HTMLElement, text: string, color: string, bg: string): void {
  p.createEl("span", { text, attr: { style: `background:${bg};color:${color};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;font-family:${F};` } });
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────
const NS = "http://www.w3.org/2000/svg";
function svg(p: HTMLElement, w: number, h: number): SVGSVGElement {
  const s = document.createElementNS(NS, "svg") as SVGSVGElement;
  s.setAttribute("viewBox", `0 0 ${w} ${h}`); s.setAttribute("width","100%"); s.setAttribute("height",String(h));
  p.appendChild(s); return s;
}
function sLine(s: SVGSVGElement, x1:number,y1:number,x2:number,y2:number,c:string,w=1):void {
  const e=document.createElementNS(NS,"line");
  e.setAttribute("x1",String(x1));e.setAttribute("y1",String(y1));e.setAttribute("x2",String(x2));e.setAttribute("y2",String(y2));
  e.setAttribute("stroke",c);e.setAttribute("stroke-width",String(w));s.appendChild(e);
}
function sPath(s:SVGSVGElement,d:string,stroke:string,fill="none",w=2):void {
  const e=document.createElementNS(NS,"path");
  e.setAttribute("d",d);e.setAttribute("stroke",stroke);e.setAttribute("stroke-width",String(w));e.setAttribute("fill",fill);
  e.setAttribute("stroke-linejoin","round");e.setAttribute("stroke-linecap","round");s.appendChild(e);
}
function sRect(s:SVGSVGElement,x:number,y:number,w:number,h:number,fill:string,rx=2,title=""): SVGRectElement {
  const e=document.createElementNS(NS,"rect") as SVGRectElement;
  e.setAttribute("x",String(x));e.setAttribute("y",String(y));e.setAttribute("width",String(Math.max(0,w)));e.setAttribute("height",String(Math.max(0,h)));
  e.setAttribute("fill",fill);e.setAttribute("rx",String(rx));
  if(title){const t=document.createElementNS(NS,"title");t.textContent=title;e.appendChild(t);}
  s.appendChild(e);return e;
}
function sText(s:SVGSVGElement,x:number,y:number,text:string,c:string,sz=9,anchor="middle"):void {
  const e=document.createElementNS(NS,"text");
  e.setAttribute("x",String(x));e.setAttribute("y",String(y));e.setAttribute("fill",c);e.setAttribute("font-size",String(sz));
  e.setAttribute("text-anchor",anchor);e.setAttribute("font-family",F);e.textContent=text;s.appendChild(e);
}
function sCircle(s:SVGSVGElement,cx:number,cy:number,r:number,fill:string,opacity=0.75,title=""):SVGCircleElement {
  const e=document.createElementNS(NS,"circle") as SVGCircleElement;
  e.setAttribute("cx",String(cx));e.setAttribute("cy",String(cy));e.setAttribute("r",String(r));e.setAttribute("fill",fill);e.setAttribute("opacity",String(opacity));
  if(title){const t=document.createElementNS(NS,"title");t.textContent=title;e.appendChild(t);}
  s.appendChild(e);return e;
}

// ─── Tooltip helper (shared) ──────────────────────────────────────────────────
function makeTooltip(container: HTMLElement): HTMLElement {
  // Append to body so position:fixed works correctly with viewport coordinates
  const tt = document.body.createEl("div", { attr: { style: `position:fixed;background:#1a1a1a;border:1px solid ${C.border};border-radius:8px;padding:10px 14px;font-family:${F};font-size:11px;color:${C.text};z-index:99999;pointer-events:none;display:none;min-width:160px;box-shadow:0 4px 24px rgba(0,0,0,0.6);` } });
  // Clean up when container is removed
  const obs = new MutationObserver(() => {
    if (!document.body.contains(container)) { tt.remove(); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  return tt;
}
function positionTooltip(tt: HTMLElement, e: MouseEvent): void {
  const TW = 200;
  const TH = 100;
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  // Center above cursor
  let x = e.clientX - TW / 2;
  let y = e.clientY - TH - 14;
  // Clamp to viewport
  x = Math.max(8, Math.min(x, VW - TW - 8));
  if (y < 8) y = e.clientY + 16;          // flip below if not enough room above
  if (y + TH > VH - 8) y = VH - TH - 8;  // clamp bottom
  tt.style.left = `${x}px`;
  tt.style.top  = `${y}px`;
}
function showTooltip(tt: HTMLElement, e: MouseEvent, content: (el: HTMLElement) => void): void {
  tt.empty(); content(tt); tt.style.display="block"; positionTooltip(tt, e);
}
function moveTooltip(tt: HTMLElement, e: MouseEvent): void { positionTooltip(tt, e); }
function hideTooltip(tt: HTMLElement): void { tt.style.display="none"; }

// ─── Clickable trade count helper ─────────────────────────────────────────────
function tradeCountEl(
  parent: HTMLElement,
  count: number,
  trades: Trade[],
  openFile: (p: string) => void,
  onShowTrades: (trades: Trade[]) => void
): void {
  const el = parent.createEl("span", {
    text: `${count} trade${count !== 1 ? "s" : ""}`,
    attr: { style: `color:${C.blue};font-size:11px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;font-family:${F};` }
  });
  el.addEventListener("click", () => onShowTrades(trades));
}

// ─── Expand modal ────────────────────────────────────────────────────────────
function showExpandModal(title: string, renderFn: (container: HTMLElement) => void): void {
  // Overlay
  const overlay = document.body.createEl("div", { attr: { style: `
    position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99990;
    display:flex;align-items:center;justify-content:center;
    backdrop-filter:blur(4px);
  `}});

  // Modal box
  const modal = overlay.createEl("div", { attr: { style: `
    background:var(--background-secondary);
    border:1px solid var(--background-modifier-border);
    border-radius:14px;padding:24px;
    width:90vw;max-width:1100px;
    max-height:85vh;overflow-y:auto;
    position:relative;
  `}});

  // Header
  const hdr = modal.createEl("div", { attr: { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;" }});
  hdr.createEl("div", { text: title, attr: { style: `color:var(--text-normal);font-size:16px;font-weight:700;font-family:${F};` }});
  const closeBtn = hdr.createEl("button", { text: "✕", attr: { style: `
    background:transparent;border:1px solid var(--background-modifier-border);
    color:var(--text-muted);border-radius:6px;padding:4px 10px;
    cursor:pointer;font-size:14px;font-family:${F};
  `}});

  // Chart container — larger size
  const chartWrap = modal.createEl("div", { attr: { style: "width:100%;" }});
  renderFn(chartWrap);

  // Close handlers
  const close = () => overlay.remove();
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
  });
}

// Add expand button to a card
function addExpandBtn(parent: HTMLElement, title: string, renderFn: (container: HTMLElement) => void): void {
  const btn = parent.createEl("button", { text: "⤢", attr: { style: `
    background:transparent;border:1px solid var(--background-modifier-border);
    color:var(--text-muted);border-radius:4px;padding:1px 6px;
    cursor:pointer;font-size:11px;float:right;margin-top:-2px;
    font-family:${F};
  `}});
  btn.setAttribute("title", "Expand chart");
  btn.addEventListener("click", () => showExpandModal(title, renderFn));
}

// ─── Equity Curve with hover crosshair ───────────────────────────────────────
function renderEquity(parent: HTMLElement, data: {date:string;value:number}[], chartW=500): void {
  if (data.length < 2) { parent.createEl("div",{text:"No data",attr:{style:`color:${C.muted};font-size:11px;`}}); return; }
  const W=chartW,H=Math.round(chartW*0.28),P={t:10,r:10,b:20,l:70};
  const W2=W-P.l-P.r, H2=H-P.t-P.b;
  const vals=data.map(d=>d.value), minV=Math.min(...vals), maxV=Math.max(...vals), range=maxV-minV||1;
  const sx=(i:number)=>P.l+(i/(data.length-1))*W2;
  const sy=(v:number)=>P.t+H2-((v-minV)/range)*H2;
  const s=svg(parent,W,H);
  [0,0.25,0.5,0.75,1].forEach(p=>{
    const y=P.t+H2*(1-p), v=minV+range*p;
    sLine(s,P.l,y,W-P.r,y,"rgba(255,255,255,0.04)");
    sText(s,P.l-4,y+3,fmtUSD(v),C.muted,8,"end");
  });
  let fill=`M ${sx(0)} ${sy(data[0].value)}`;
  data.forEach((d,i)=>{ if(i>0) fill+=` L ${sx(i)} ${sy(d.value)}`; });
  fill+=` L ${sx(data.length-1)} ${P.t+H2} L ${sx(0)} ${P.t+H2} Z`;
  sPath(s,fill,"none","rgba(96,165,250,0.08)");
  let line=`M ${sx(0)} ${sy(data[0].value)}`;
  data.forEach((d,i)=>{ if(i>0) line+=` L ${sx(i)} ${sy(d.value)}`; });
  sPath(s,line,C.blue,"none",2);

  // Hover crosshair
  const vLine=document.createElementNS(NS,"line") as SVGLineElement;
  vLine.setAttribute("stroke","rgba(255,255,255,0.2)"); vLine.setAttribute("stroke-width","1");
  vLine.setAttribute("stroke-dasharray","4,3"); vLine.style.display="none"; s.appendChild(vLine);
  const hLine=document.createElementNS(NS,"line") as SVGLineElement;
  hLine.setAttribute("stroke","rgba(255,255,255,0.2)"); hLine.setAttribute("stroke-width","1");
  hLine.setAttribute("stroke-dasharray","4,3"); hLine.style.display="none"; s.appendChild(hLine);
  const dot=sCircle(s,0,0,4,C.blue,1);
  dot.style.display="none";
  const tt=makeTooltip(parent);

  s.addEventListener("mousemove",(e:MouseEvent)=>{
    const rect=s.getBoundingClientRect();
    // Convert mouse position to SVG viewBox coordinates
    // rect.width is the actual rendered pixel width, W is the viewBox width
    const svgX = ((e.clientX - rect.left) / rect.width)  * W;
    const svgY = ((e.clientY - rect.top)  / rect.height) * H;
    if(svgX<P.l||svgX>W-P.r||svgY<P.t||svgY>P.t+H2){
      vLine.style.display="none"; hLine.style.display="none"; dot.style.display="none"; hideTooltip(tt); return;
    }
    const frac = (svgX - P.l) / W2;
    const idx  = Math.max(0, Math.min(Math.round(frac*(data.length-1)), data.length-1));
    const d    = data[idx];
    const cx   = sx(idx), cy = sy(d.value);
    vLine.setAttribute("x1",String(cx));vLine.setAttribute("y1",String(P.t));vLine.setAttribute("x2",String(cx));vLine.setAttribute("y2",String(P.t+H2));
    hLine.setAttribute("x1",String(P.l));hLine.setAttribute("y1",String(cy));hLine.setAttribute("x2",String(W-P.r));hLine.setAttribute("y2",String(cy));
    dot.setAttribute("cx",String(cx));dot.setAttribute("cy",String(cy));
    [vLine,hLine,dot].forEach(el=>el.style.display="");
    showTooltip(tt,e,(el)=>{
      el.createEl("div",{text:d.date,attr:{style:`color:${C.muted};font-size:10px;margin-bottom:3px;font-weight:700;`}});
      el.createEl("div",{text:fmtUSD(d.value),attr:{style:`color:${C.blue};font-size:14px;font-weight:700;`}});
    });
  });
  s.addEventListener("mouseleave",()=>{ vLine.style.display="none"; hLine.style.display="none"; dot.style.display="none"; hideTooltip(tt); });
}

// ─── Drawdown with hover ─────────────────────────────────────────────────────
function renderDrawdown(parent: HTMLElement, data: {date:string;value:number}[], chartW=500): void {
  if (data.length < 2) return;
  const W=chartW,H=Math.round(chartW*0.18),P={t:5,r:10,b:20,l:50};
  const W2=W-P.l-P.r, H2=H-P.t-P.b;
  const minV=Math.min(...data.map(d=>d.value));
  const sy=(v:number)=>P.t+((v/(minV||-1))*H2);
  const sx=(i:number)=>P.l+(i/(data.length-1))*W2;
  const s=svg(parent,W,H);
  sLine(s,P.l,P.t,W-P.r,P.t,"rgba(255,255,255,0.04)");
  let fill=`M ${sx(0)} ${P.t}`;
  data.forEach((d,i)=>{ fill+=` L ${sx(i)} ${sy(d.value)}`; });
  fill+=` L ${sx(data.length-1)} ${P.t} Z`;
  sPath(s,fill,"none","rgba(248,113,113,0.15)");
  let line=`M ${sx(0)} ${P.t}`;
  data.forEach((d,i)=>{ if(i>0) line+=` L ${sx(i)} ${sy(d.value)}`; });
  sPath(s,line,C.red,"none",1.5);
  sText(s,P.l-4,sy(minV)+3,`${fmt(minV,1)}%`,C.red,8,"end");
  sText(s,P.l-4,P.t+6,"0%",C.muted,8,"end");

  // Hover
  const vl=document.createElementNS(NS,"line") as SVGLineElement;
  vl.setAttribute("stroke","rgba(255,255,255,0.2)");vl.setAttribute("stroke-width","1");vl.setAttribute("stroke-dasharray","4,3");vl.style.display="none";s.appendChild(vl);
  const dot=sCircle(s,0,0,4,C.red,1); dot.style.display="none";
  const tt=makeTooltip(parent);
  s.addEventListener("mousemove",(e:MouseEvent)=>{
    const rect=s.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    if(svgX<P.l||svgX>W-P.r){ vl.style.display="none"; dot.style.display="none"; hideTooltip(tt); return; }
    const idx  = Math.max(0, Math.min(Math.round(((svgX-P.l)/W2)*(data.length-1)), data.length-1));
    const d    = data[idx];
    const cx   = sx(idx), cy = sy(d.value);
    vl.setAttribute("x1",String(cx));vl.setAttribute("y1",String(P.t));vl.setAttribute("x2",String(cx));vl.setAttribute("y2",String(P.t+H2));
    dot.setAttribute("cx",String(cx));dot.setAttribute("cy",String(cy));
    [vl,dot].forEach(el=>el.style.display="");
    showTooltip(tt,e,(el)=>{
      el.createEl("div",{text:d.date,attr:{style:`color:${C.muted};font-size:10px;margin-bottom:3px;font-weight:700;`}});
      el.createEl("div",{text:`${fmt(d.value,2)}%`,attr:{style:`color:${C.red};font-size:14px;font-weight:700;`}});
    });
  });
  s.addEventListener("mouseleave",()=>{ vl.style.display="none"; dot.style.display="none"; hideTooltip(tt); });
}

// ─── Monthly P&L bars ─────────────────────────────────────────────────────────
function renderMonthlyBars(parent: HTMLElement, data: {month:string;pnl:number;count:number}[], trades: Trade[], onShowTrades: (t:Trade[])=>void): void {
  if (!data.length) return;
  const W=500,H=130,P={t:10,r:10,b:30,l:70};
  const W2=W-P.l-P.r, H2=H-P.t-P.b;
  const maxAbs=Math.max(...data.map(d=>Math.abs(d.pnl)),1);
  const barW=Math.max(8,(W2/data.length)-4);
  const midY=P.t+H2/2;
  const s=svg(parent,W,H);
  sLine(s,P.l,midY,W-P.r,midY,"rgba(255,255,255,0.08)");
  sText(s,P.l-4,midY+3,"$0",C.muted,8,"end");
  sText(s,P.l-4,P.t+4,fmtUSD(maxAbs),C.muted,8,"end");
  sText(s,P.l-4,P.t+H2-2,fmtUSD(-maxAbs),C.muted,8,"end");
  data.forEach((d,i)=>{
    const x=P.l+(i/data.length)*W2+(W2/data.length-barW)/2;
    const barH=(Math.abs(d.pnl)/maxAbs)*(H2/2);
    const isPos=d.pnl>=0;
    const title=`${d.month}: ${fmtUSD(d.pnl)} (${d.count} trades)`;
    sRect(s,x,isPos?midY-barH:midY,barW,barH,isPos?C.green:C.red,2,title);
    // Month label
    const mo=d.month.slice(5); // MM
    sText(s,x+barW/2,H-5,mo,C.muted,8);
  });
}

// ─── Streak widget ────────────────────────────────────────────────────────────
function renderStreak(parent: HTMLElement, streak: StreakInfo, trades: Trade[], onShowTrades: (t:Trade[])=>void): void {
  const wrap = div(parent, "display:flex;flex-direction:column;gap:12px;");

  // Last 5 trades row
  const row5 = div(wrap, "display:flex;align-items:center;gap:8px;flex-wrap:wrap;");
  row5.createEl("span", { text:"Last 5:", attr:{ style:`color:${C.muted};font-size:11px;font-weight:700;` } });
  const tt5 = makeTooltip(wrap);
  streak.last5.forEach(({ trade: t, is_winner: w }) => {
    const dot = row5.createEl("div", {
      text: w ? "W" : "L",
      attr: { style: `width:28px;height:28px;border-radius:50%;background:${w?C.green:C.red};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#000;flex-shrink:0;cursor:pointer;` }
    });
    dot.addEventListener("mouseenter", (e: MouseEvent) => {
      showTooltip(tt5, e, (el) => {
        el.createEl("div",{text:`${t.exit_date}  ${t.exit_time}`,attr:{style:`color:${C.muted};font-size:10px;margin-bottom:5px;font-weight:700;`}});
        const row = div(el,"display:flex;justify-content:space-between;gap:20px;");
        row.createEl("span",{text:`${t.symbol} ${t.dir.toUpperCase()}`,attr:{style:`color:${C.text};font-weight:700;`}});
        row.createEl("span",{text:fmtUSD(t.pnl),attr:{style:`color:${pc(t.pnl)};font-weight:700;`}});
        const row2 = div(el,"display:flex;justify-content:space-between;gap:20px;margin-top:3px;");
        row2.createEl("span",{text:t.strategy||"—",attr:{style:`color:${C.muted};font-size:10px;`}});
        row2.createEl("span",{text:`${t.r_multiple}R · Grade ${t.grade}`,attr:{style:`color:${pc(t.r_multiple)};font-size:10px;`}});
      });
    });
    dot.addEventListener("mousemove",(e:MouseEvent)=>moveTooltip(tt5,e));
    dot.addEventListener("mouseleave",()=>hideTooltip(tt5));
    dot.addEventListener("click",()=>onShowTrades([t]));
  });
  if (!streak.last5.length) row5.createEl("span",{text:"No trades yet",attr:{style:`color:${C.faint};font-size:11px;`}});

  // Momentum badge
  if (streak.last5.length >= 2) {
    const mConf = streak.momentum === "hot"
      ? { label:"🔥 Hot", color:"#facc15", bg:"rgba(250,204,21,0.15)" }
      : streak.momentum === "cold"
      ? { label:"❄️ Cold", color:"#60a5fa", bg:"rgba(96,165,250,0.15)" }
      : { label:"〰️ Mixed", color:C.muted, bg:"rgba(255,255,255,0.05)" };
    row5.createEl("span", { text:mConf.label, attr:{ style:`color:${mConf.color};background:${mConf.bg};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;font-family:${F};` } });
  }

  // Current streak
  const curLabel = streak.current_streak > 0
    ? `${streak.current_streak} win streak 🔥`
    : streak.current_streak < 0
    ? `${Math.abs(streak.current_streak)} loss streak ❄️`
    : "No active streak";
  const curColor = streak.current_streak > 0 ? C.green : streak.current_streak < 0 ? C.red : C.muted;
  div(wrap,"").createEl("div",{ text:curLabel, attr:{ style:`color:${curColor};font-size:13px;font-weight:700;font-family:${F};` } });

  // Longest streaks
  const records = div(wrap, "display:flex;gap:16px;");
  const rWin = div(records, `background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:10px 14px;flex:1;`);
  rWin.createEl("div",{text:"Longest Win Streak",attr:{style:`color:${C.muted};font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;`}});
  rWin.createEl("div",{text:`${streak.longest_win} trades`,attr:{style:`color:${C.green};font-size:18px;font-weight:700;font-family:${F};`}});

  const rLoss = div(records, `background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:10px 14px;flex:1;`);
  rLoss.createEl("div",{text:"Longest Loss Streak",attr:{style:`color:${C.muted};font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;`}});
  rLoss.createEl("div",{text:`${streak.longest_loss} trades`,attr:{style:`color:${C.red};font-size:18px;font-weight:700;font-family:${F};`}});
}

// ─── Largest win / loss ───────────────────────────────────────────────────────
function renderLargest(parent: HTMLElement, stats: TradeStats, openFile: (p:string)=>void): void {
  const wrap = div(parent, "display:grid;grid-template-columns:1fr 1fr;gap:12px;");

  const makeCard = (label: string, trade: Trade|undefined, pnl: number, color: string, bg: string) => {
    const c = div(wrap, `background:${bg};border:1px solid ${color}33;border-radius:10px;padding:14px;`);
    c.createEl("div",{text:label,attr:{style:`color:${C.muted};font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;font-family:${F};`}});
    if (!trade) { c.createEl("div",{text:"No trades yet",attr:{style:`color:${C.faint};font-size:11px;`}}); return; }
    c.createEl("div",{text:fmtUSD(pnl),attr:{style:`color:${color};font-size:24px;font-weight:700;font-family:${F};margin-bottom:4px;`}});
    const meta = div(c,"display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;");
    meta.createEl("span",{text:trade.symbol,attr:{style:`color:${C.text};font-weight:700;font-size:12px;font-family:${F};`}});
    meta.createEl("span",{text:trade.strategy||"—",attr:{style:`color:${C.muted};font-size:11px;`}});
    meta.createEl("span",{text:trade.exit_date,attr:{style:`color:${C.faint};font-size:11px;`}});
    const link = c.createEl("div",{text:"→ Open note",attr:{style:`color:${C.blue};font-size:10px;cursor:pointer;margin-top:6px;font-family:${F};`}});
    link.addEventListener("click",()=>openFile(trade.exit_file));
  };

  makeCard("Largest Win",  stats.largest_win_trade,  stats.largest_win,          C.green, "rgba(74,222,128,0.06)");
  makeCard("Largest Loss", stats.largest_loss_trade, -(stats.largest_loss ?? 0), C.red,   "rgba(248,113,113,0.06)");
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function renderCalendar(
  parent: HTMLElement,
  daily: {date:string;pnl:number;count:number}[],
  weekly: {week:string;pnl:number;count:number}[],
  trades: Trade[],
  openFile: (p:string)=>void,
  onShowTrades: (t:Trade[])=>void
): void {
  if (!daily.length) { parent.createEl("div",{text:"No trades yet",attr:{style:`color:${C.muted};font-size:11px;`}}); return; }

  const byDate: Record<string,{pnl:number;count:number}> = {};
  daily.forEach(d=>{ byDate[d.date]={pnl:d.pnl,count:d.count}; });

  const tradesByDate: Record<string,Trade[]> = {};
  trades.forEach(t=>{ if(!tradesByDate[t.exit_date]) tradesByDate[t.exit_date]=[]; tradesByDate[t.exit_date].push(t); });

  const byWeek: Record<string,{pnl:number;count:number}> = {};
  weekly.forEach(w=>{ byWeek[w.week]={pnl:w.pnl,count:w.count}; });

  const maxAbs=Math.max(...Object.values(byDate).map(v=>Math.abs(v.pnl)),1);
  const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DN=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  const now=new Date();
  let curY=now.getFullYear(), curM=now.getMonth()+1;

  function wKey(y:number,m:number,d:number):string {
    const dt=new Date(y,m-1,d);
    const dow=dt.getDay(), off=dow===0?-6:1-dow;
    const mon=new Date(y,m-1,d+off);
    return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;
  }

  const wrap=div(parent,"");
  const tt=makeTooltip(parent);

  function renderMonth(y:number,m:number):void {
    wrap.empty();

    // Header
    const hdr=div(wrap,"display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;");
    const prevBtn=hdr.createEl("button",{text:"←",attr:{style:`background:transparent;border:1px solid ${C.border};color:${C.muted};border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;`}});
    hdr.createEl("div",{text:`${MN[m-1]} ${y}`,attr:{style:`color:${C.text};font-size:15px;font-weight:700;font-family:${F};`}});
    const nextBtn=hdr.createEl("button",{text:"→",attr:{style:`background:transparent;border:1px solid ${C.border};color:${C.muted};border-radius:6px;padding:4px 12px;cursor:pointer;font-size:14px;`}});

    prevBtn.addEventListener("click",()=>{ if(m===1){curY--;curM=12;}else{curM--;} renderMonth(curY,curM); });
    nextBtn.addEventListener("click",()=>{ if(m===12){curY++;curM=1;}else{curM++;} renderMonth(curY,curM); });

    const grid=div(wrap,"display:grid;grid-template-columns:repeat(7,1fr) 90px;gap:4px;");
    DN.forEach(d=>grid.createEl("div",{text:d,attr:{style:`color:${C.muted};font-size:10px;text-align:center;padding:4px 0;font-family:${F};font-weight:700;`}}));
    grid.createEl("div",{text:"WEEK",attr:{style:`color:${C.muted};font-size:10px;text-align:center;padding:4px 0;font-family:${F};font-weight:700;`}});

    const firstDay=new Date(y,m-1,1);
    const startDow=firstDay.getDay();
    const startOff=startDow===0?-6:1-startDow;
    const dim=new Date(y,m,0).getDate();
    const totalWeeks=Math.ceil((dim+(startDow===0?6:startDow-1))/7);

    for(let w=0;w<totalWeeks;w++){
      const wOff=startOff+w*7;
      const wDate=new Date(y,m-1,1+wOff);
      const wk=wKey(wDate.getFullYear(),wDate.getMonth()+1,wDate.getDate());

      for(let d=0;d<7;d++){
        const dayNum=1+wOff+d;
        const inMonth=dayNum>=1&&dayNum<=dim;
        const ds=inMonth?`${y}-${String(m).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`:"";
        const data=ds?byDate[ds]:undefined;
        const cell=div(grid,`border-radius:6px;padding:6px;min-height:64px;position:relative;font-family:${F};`);

        if(!inMonth){ cell.style.background="transparent"; continue; }

        if(data){
          const intensity=Math.min(Math.abs(data.pnl)/maxAbs,1);
          const alpha=0.2+intensity*0.7;
          cell.style.background=data.pnl>=0?`rgba(74,222,128,${alpha})`:`rgba(248,113,113,${alpha})`;
          cell.style.cursor="pointer";

          // Day number — click to open daily note
          const dayEl=cell.createEl("div",{text:String(dayNum),attr:{style:`color:rgba(255,255,255,0.8);font-size:10px;font-weight:700;cursor:pointer;`}});
          dayEl.addEventListener("click",(e)=>{
            e.stopPropagation();
            // Find the daily note file path for this date
            const dayTrades=tradesByDate[ds]??[];
            if(dayTrades.length) openFile(dayTrades[0].exit_file);
          });

          cell.createEl("div",{text:fmtUSD(data.pnl),attr:{style:`color:#fff;font-size:11px;font-weight:700;margin-top:3px;`}});

          // Trade count — clickable
          const countEl=cell.createEl("div",{text:`${data.count} trade${data.count!==1?"s":""}`,attr:{style:`color:rgba(255,255,255,0.75);font-size:9px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;`}});
          countEl.addEventListener("click",(e)=>{ e.stopPropagation(); onShowTrades(tradesByDate[ds]??[]); });

          // Hover tooltip
          cell.addEventListener("mouseenter",(e:MouseEvent)=>{
            showTooltip(tt,e,(el)=>{
              el.createEl("div",{text:ds,attr:{style:`color:${C.muted};font-size:10px;margin-bottom:6px;font-weight:700;`}});
              (tradesByDate[ds]??[]).forEach(t=>{
                const row=div(el,"display:flex;justify-content:space-between;gap:16px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);");
                row.createEl("span",{text:`${t.symbol} ${t.dir.toUpperCase()}`,attr:{style:`color:${C.text};font-weight:700;`}});
                row.createEl("span",{text:fmtUSD(t.pnl),attr:{style:`color:${pc(t.pnl)};font-weight:700;`}});
              });
              const tot=div(el,"display:flex;justify-content:space-between;margin-top:6px;padding-top:4px;");
              tot.createEl("span",{text:"Total",attr:{style:`color:${C.muted};font-size:10px;`}});
              tot.createEl("span",{text:fmtUSD(data.pnl),attr:{style:`color:${pc(data.pnl)};font-weight:700;`}});
            });
          });
          cell.addEventListener("mousemove",(e:MouseEvent)=>moveTooltip(tt,e));
          cell.addEventListener("mouseleave",()=>hideTooltip(tt));
        } else {
          cell.style.background="rgba(255,255,255,0.03)";
          cell.createEl("div",{text:String(dayNum),attr:{style:`color:${C.muted};font-size:10px;font-weight:700;`}});
        }
      }

      // Week cell
      const wkData=byWeek[wk];
      const wkCell=div(grid,`border-radius:6px;padding:8px;min-height:64px;font-family:${F};`);
      if(wkData){
        const isP=wkData.pnl>=0;
        wkCell.style.background=isP?"rgba(74,222,128,0.1)":"rgba(248,113,113,0.1)";
        wkCell.style.border=`1px solid ${isP?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.2)"}`;
        wkCell.createEl("div",{text:"WEEK",attr:{style:`color:${C.muted};font-size:9px;font-weight:700;`}});
        wkCell.createEl("div",{text:fmtUSD(wkData.pnl),attr:{style:`color:${isP?C.green:C.red};font-size:12px;font-weight:700;margin-top:4px;`}});
        const wkTrades=trades.filter(t=>wk===wKey(...(t.exit_date.split("-").map(Number) as [number,number,number])));
        const wkCount=wkCell.createEl("div",{text:`${wkData.count} trades`,attr:{style:`color:${C.muted};font-size:9px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;`}});
        wkCount.addEventListener("click",()=>onShowTrades(wkTrades));
      } else {
        wkCell.style.background="rgba(255,255,255,0.02)";
      }
    }
  }

  renderMonth(curY,curM);
}

// ─── Entry time slots 13:00–22:00 in 30min buckets ───────────────────────────
function renderTimeSlots(parent: HTMLElement, data: {slot:string;pnl:number;winners:number;losers:number}[]): void {
  const active=data.filter(d=>d.winners+d.losers>0);
  if(!active.length){ parent.createEl("div",{text:"No trades in 13:00–22:00",attr:{style:`color:${C.muted};font-size:11px;`}}); return; }

  const maxTotal=Math.max(...data.map(d=>d.winners+d.losers),1);
  const maxPnlAbs=Math.max(...data.map(d=>Math.abs(d.pnl)),1);
  const W=600, H=160, P={t:10,r:10,b:40,l:10};
  const W2=W-P.l-P.r, H2=H-P.t-P.b;
  const barW=Math.floor(W2/data.length)-2;
  const midY=P.t+H2*0.5;
  const s=svg(parent,W,H);

  sLine(s,P.l,midY,W-P.r,midY,"rgba(255,255,255,0.06)");

  data.forEach((d,i)=>{
    const x=P.l+(i/data.length)*W2;
    const total=d.winners+d.losers;
    const isP=d.pnl>=0;
    const intensity=total>0?Math.min(Math.abs(d.pnl)/maxPnlAbs,1):0;
    const alpha=0.15+intensity*0.75;

    if(total>0){
      // P&L bar (background)
      const barH=(Math.abs(d.pnl)/maxPnlAbs)*(H2*0.4);
      sRect(s,x,isP?midY-barH:midY,barW,barH,isP?`rgba(74,222,128,${alpha})`:`rgba(248,113,113,${alpha})`,2,`${d.slot}: ${fmtUSD(d.pnl)}`);

      // Winner/loser stacked above midline
      const wH=d.winners>0?(d.winners/maxTotal)*(H2*0.45):0;
      const lH=d.losers >0?(d.losers /maxTotal)*(H2*0.45):0;
      if(wH>0) sRect(s,x+barW*0.1,midY-H2*0.5,barW*0.35,wH,C.green,2,`Winners: ${d.winners}`);
      if(lH>0) sRect(s,x+barW*0.55,midY-H2*0.5,barW*0.35,lH,C.red,2,`Losers: ${d.losers}`);

      // Count label
      if(total>0) sText(s,x+barW/2,midY-H2*0.5-4,String(total),C.muted,8);
    }

    // Slot label every other slot
    if(i%2===0){
      sText(s,x+barW/2,H-5,d.slot.slice(0,5),C.muted,7);
    }
  });

  // Legend
  const legend=div(parent,"display:flex;gap:16px;margin-top:6px;");
  legend.createEl("span",{text:"▬ P&L bar",attr:{style:`color:${C.muted};font-size:10px;`}});
  legend.createEl("span",{text:"■ Winners",attr:{style:`color:${C.green};font-size:10px;`}});
  legend.createEl("span",{text:"■ Losers",attr:{style:`color:${C.red};font-size:10px;`}});
}

// ─── Duration chart ───────────────────────────────────────────────────────────
function renderDuration(parent: HTMLElement, data: {bucket:string;winners:number;losers:number}[]): void {
  const maxVal=Math.max(...data.map(d=>d.winners+d.losers),1);
  const W=300, fullH=data.length*46+20, barW=W-80;
  const s=svg(parent,W,fullH);
  data.forEach((d,i)=>{
    const y=10+i*46;
    sText(s,0,y+14,d.bucket,C.muted,9,"start");
    const wW=d.winners>0?(d.winners/maxVal)*barW:0;
    const lW=d.losers >0?(d.losers /maxVal)*barW:0;
    sRect(s,50,y,   wW,14,C.green,3,`Winners: ${d.winners}`);
    sRect(s,50,y+18,lW,14,C.red,  3,`Losers: ${d.losers}`);
    if(d.winners>0) sText(s,50+wW+4,y+11,   String(d.winners),C.green,9,"start");
    if(d.losers >0) sText(s,50+lW+4,y+11+18,String(d.losers), C.red,  9,"start");
  });
}

// ─── Strategy table (sortable) ────────────────────────────────────────────────
function renderStrategyTable(parent: HTMLElement, stats: TradeStats, trades: Trade[], onShowTrades:(t:Trade[])=>void): void {
  const strategies=Object.values(stats.pnl_by_strategy);
  if(!strategies.length){ parent.createEl("div",{text:"No strategy data",attr:{style:`color:${C.muted};font-size:11px;`}}); return; }

  type StKey="strategy"|"trade_count"|"win_rate"|"profit_factor"|"avg_r"|"net_pnl";
  let sortKey:StKey="net_pnl"; let sortAsc=false;
  const cols:{label:string;key:StKey}[]=[
    {label:"Strategy",    key:"strategy"},
    {label:"Trades",      key:"trade_count"},
    {label:"Win %",       key:"win_rate"},
    {label:"P. Factor",   key:"profit_factor"},
    {label:"Avg R",       key:"avg_r"},
    {label:"Net P&L",     key:"net_pnl"},
  ];

  const table=parent.createEl("table",{attr:{style:`width:100%;border-collapse:collapse;font-size:12px;font-family:${F};`}});
  const thead=table.createEl("thead");
  const tbody=table.createEl("tbody");

  const renderHeader=()=>{
    thead.empty();
    const hr=thead.createEl("tr",{attr:{style:`background:var(--background-primary);`}});
    cols.forEach(col=>{
      const isAct=col.key===sortKey;
      const arr=isAct?(sortAsc?" ↑":" ↓"):" ↕";
      const th=hr.createEl("th",{text:col.label+arr,attr:{style:`color:${isAct?C.blue:C.muted};text-align:left;padding:6px 10px;border-bottom:1px solid ${C.border};font-weight:700;font-size:10px;letter-spacing:1px;white-space:nowrap;cursor:pointer;user-select:none;`}});
      th.addEventListener("click",()=>{ if(sortKey===col.key) sortAsc=!sortAsc; else{sortKey=col.key;sortAsc=false;} renderHeader(); renderRows(); });
    });
  };

  const renderRows=()=>{
    tbody.empty();
    const sorted=[...strategies].sort((a,b)=>{
      const av=(a as any)[sortKey], bv=(b as any)[sortKey];
      const cmp=typeof av==="number"?av-bv:String(av).localeCompare(String(bv));
      return sortAsc?cmp:-cmp;
    });
    sorted.forEach(s=>{
      const tr=tbody.createEl("tr",{attr:{style:`border-bottom:1px solid ${C.border};`}});
      tr.addEventListener("mouseenter",()=>tr.style.background="rgba(255,255,255,0.02)");
      tr.addEventListener("mouseleave",()=>tr.style.background="");
      const stTrades=trades.filter(t=>t.strategy===s.strategy);
      const cells=[
        {v:s.strategy,c:C.text,bold:true},
        {v:String(s.trade_count),c:C.blue,click:()=>onShowTrades(stTrades)},
        {v:`${s.win_rate}%`,c:s.win_rate>=50?C.green:C.red},
        {v:s.profit_factor===Infinity?"∞":String(s.profit_factor),c:s.profit_factor>=1?C.green:C.red},
        {v:String(s.avg_r),c:s.avg_r>=0?C.green:C.red},
        {v:fmtUSD(s.net_pnl),c:pc(s.net_pnl),bold:true},
      ];
      cells.forEach((cell:any)=>{
        const td=tr.createEl("td",{attr:{style:`padding:8px 10px;`}});
        const span=td.createEl("span",{text:cell.v,attr:{style:`color:${cell.c};${cell.bold?"font-weight:700;":""}${cell.click?"cursor:pointer;text-decoration:underline;text-underline-offset:2px;":""}`}});
        if(cell.click) span.addEventListener("click",cell.click);
      });
    });
  };

  renderHeader(); renderRows();
}

// ─── Grade breakdown ──────────────────────────────────────────────────────────
function renderGrades(parent: HTMLElement, stats: TradeStats, trades: Trade[], onShowTrades:(t:Trade[])=>void): void {
  const gColors: Record<string,string>={A:C.green,B:C.blue,C:C.yellow,D:C.red};
  const wrap=div(parent,"display:grid;grid-template-columns:repeat(4,1fr);gap:8px;");
  Object.values(stats.pnl_by_grade).forEach(g=>{
    const c=card(wrap,"padding:12px;");
    c.createEl("div",{text:`Grade ${g.grade}`,attr:{style:`color:${gColors[g.grade]};font-size:14px;font-weight:700;font-family:${F};`}});
    const gTrades=trades.filter(t=>t.grade===g.grade);
    const countEl=c.createEl("div",{text:`${g.trade_count} trades`,attr:{style:`color:${C.blue};font-size:10px;margin-top:2px;cursor:pointer;text-decoration:underline;text-underline-offset:2px;font-family:${F};`}});
    countEl.addEventListener("click",()=>onShowTrades(gTrades));
    c.createEl("div",{text:fmtUSD(g.net_pnl),attr:{style:`color:${pc(g.net_pnl)};font-size:16px;font-weight:700;margin-top:6px;font-family:${F};`}});
    c.createEl("div",{text:`WR: ${g.win_rate}% · Avg R: ${g.avg_r}`,attr:{style:`color:${C.muted};font-size:10px;margin-top:2px;font-family:${F};`}});
  });
}

// ─── Market correlation ───────────────────────────────────────────────────────
function renderCorrelation(parent: HTMLElement, data: {score:number;pnl:number;date:string;symbol:string}[], chartW=500): void {
  if(data.length<3){
    const msg=div(parent,"");
    msg.createEl("div",{text:`${data.length} trades have market score data (need at least 3).`,attr:{style:`color:${C.muted};font-size:11px;margin-bottom:6px;`}});
    msg.createEl("div",{text:"To populate this chart: open each daily note in Live Preview so the Dataview block writes the 'score' frontmatter value, then rebuild the cache.",attr:{style:`color:${C.faint};font-size:10px;`}});
    return;
  }
  const W=chartW,H=Math.round(chartW*0.28),P={t:10,r:10,b:28,l:70};
  const W2=W-P.l-P.r, H2=H-P.t-P.b;
  const pnls=data.map(d=>d.pnl);
  const minP=Math.min(...pnls), maxP=Math.max(...pnls), rangeP=maxP-minP||1;
  const midY=P.t+H2/2;
  // Fixed 0-100 X scale matching your market score range
  const sx=(sc:number)=>P.l+(sc/100)*W2;
  const sy=(p:number)=>P.t+H2-((p-minP)/rangeP)*H2;
  const s=svg(parent,W,H);
  sLine(s,P.l,midY,W-P.r,midY,"rgba(255,255,255,0.05)");
  sText(s,P.l-4,midY+3,"$0",C.muted,8,"end");
  // Fixed X axis markers at grade thresholds
  const xMarkers = [0, 15, 30, 50, 75, 100];
  xMarkers.forEach(v => {
    const x = P.l + (v / 100) * W2;
    sLine(s, x, P.t, x, P.t+H2, "rgba(255,255,255,0.04)");
    sText(s, x, H-5, String(v), C.muted, 8);
  });
  sText(s,W/2,H-5,"",C.muted,9,"middle"); // spacer
  data.forEach(d=>{
    sCircle(s,sx(d.score),sy(d.pnl),5,pc(d.pnl),0.7,`${d.date} ${d.symbol}: Score ${d.score}, P&L ${fmtUSD(d.pnl)}`);
  });
}

// ─── Trades list (full view, sortable) ────────────────────────────────────────
function renderTradesList(parent: HTMLElement, trades: Trade[], openFile:(p:string)=>void): void {
  if(!trades.length){ parent.createEl("div",{text:"No trades for this period",attr:{style:`color:${C.muted};font-size:12px;padding:24px;text-align:center;font-family:${F};`}}); return; }

  type SortKey = "entry_date"|"symbol"|"pnl"|"pnl_pct"|"r_multiple"|"exit_date"|"strategy"|"grade"|"hold_days";
  let sortKey: SortKey = "entry_date";
  let sortAsc = false;

  const cols: { label:string; key?:SortKey; align?:string }[] = [
    { label:"Open",     key:"entry_date" },
    { label:"Symbol",   key:"symbol" },
    { label:"Status" },
    { label:"Close",    key:"exit_date" },
    { label:"Entry" },
    { label:"Avg Exit" },
    { label:"Net P&L",  key:"pnl" },
    { label:"ROI",      key:"pnl_pct" },
    { label:"R",        key:"r_multiple" },
    { label:"Side" },
    { label:"Strategy", key:"strategy" },
    { label:"Grade",    key:"grade" },
    { label:"Days",     key:"hold_days" },
    { label:"Exits" },
  ];

  const wrap = div(parent,"overflow-x:auto;");
  const table=wrap.createEl("table",{attr:{style:`width:100%;border-collapse:collapse;font-size:12px;font-family:${F};`}});
  const thead=table.createEl("thead");
  const tbody=table.createEl("tbody");

  const renderHeader = () => {
    thead.empty();
    const hr=thead.createEl("tr",{attr:{style:`background:var(--background-secondary);position:sticky;top:0;z-index:1;`}});
    cols.forEach(col=>{
      const isActive = col.key === sortKey;
      const arrow = col.key ? (isActive ? (sortAsc ? " ↑" : " ↓") : " ↕") : "";
      const th=hr.createEl("th",{text:col.label+arrow,attr:{style:`color:${isActive?C.blue:C.muted};text-align:left;padding:8px 10px;border-bottom:1px solid ${C.border};font-weight:700;font-size:10px;letter-spacing:1px;white-space:nowrap;${col.key?"cursor:pointer;user-select:none;":""}`}});
      if(col.key){
        const k=col.key;
        th.addEventListener("click",()=>{
          if(sortKey===k) sortAsc=!sortAsc;
          else { sortKey=k; sortAsc=false; }
          renderHeader();
          renderRows();
        });
      }
    });
  };

  const getSortVal = (t: Trade, k: SortKey): any => {
    if(k==="entry_date") return t.entry_date;
    if(k==="exit_date")  return t.exit_date;
    if(k==="symbol")     return t.symbol;
    if(k==="pnl")        return t.pnl;
    if(k==="pnl_pct")    return t.pnl_pct;
    if(k==="r_multiple") return t.r_multiple;
    if(k==="strategy")   return t.strategy||"";
    if(k==="grade")      return t.grade;
    if(k==="hold_days")  return t.hold_days;
    return "";
  };

  const renderRows = () => {
    tbody.empty();
    const sorted=[...trades].sort((a,b)=>{
      const av=getSortVal(a,sortKey), bv=getSortVal(b,sortKey);
      const cmp=typeof av==="number"?av-bv:String(av).localeCompare(String(bv));
      return sortAsc?cmp:-cmp;
    });
    const gC: Record<string,string>={A:C.green,B:C.blue,C:C.yellow,D:C.red};
    sorted.forEach(t=>{
      const tr=tbody.createEl("tr",{attr:{style:`border-bottom:1px solid ${C.border};cursor:pointer;`}});
      tr.addEventListener("mouseenter",()=>tr.style.background="rgba(255,255,255,0.02)");
      tr.addEventListener("mouseleave",()=>tr.style.background="");
      tr.addEventListener("click",()=>openFile(t.exit_file));
      const sLabel=t.is_partial?"PARTIAL":t.is_winner?"WIN":"LOSS";
      const sBg=t.is_partial?"rgba(250,204,21,0.15)":t.is_winner?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)";
      const sC=t.is_partial?C.yellow:t.is_winner?C.green:C.red;
      [
        {v:t.entry_date,      c:C.muted},
        {v:t.symbol,          c:C.text,bold:true},
        {v:sLabel,            c:sC,bg:sBg,pill:true},
        {v:t.exit_date,       c:C.muted},
        {v:`$${t.entry_price}`,c:C.text},
        {v:`$${t.exit_price}`, c:C.text},
        {v:fmtUSD(t.pnl),     c:pc(t.pnl),bold:true},
        {v:`${fmt(t.pnl_pct,2)}%`,c:pc(t.pnl)},
        {v:`${t.r_multiple}R`, c:pc(t.r_multiple)},
        {v:t.dir.toUpperCase(),c:t.dir==="long"?C.blue:C.orange},
        {v:t.strategy||"—",   c:C.muted},
        {v:t.grade,            c:gC[t.grade]},
        {v:String(t.hold_days),c:C.muted},
        {v:String(t.exit_count),c:C.muted},
      ].forEach((cell:any)=>{
        const td=tr.createEl("td",{attr:{style:`padding:9px 10px;white-space:nowrap;`}});
        if(cell.pill){ badge(td,cell.v,cell.c,cell.bg); }
        else { td.createEl("span",{text:cell.v,attr:{style:`color:${cell.c};${cell.bold?"font-weight:700;":""}`}}); }
      });
    });
  };

  renderHeader();
  renderRows();
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
function renderStatsBar(parent: HTMLElement, stats: TradeStats, trades: Trade[], onShowTrades:(t:Trade[])=>void, openFile:(p:string)=>void): void {
  const wrap=div(parent,`display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;padding:12px 16px;`);
  const items=[
    {label:"Net P&L",      value:fmtUSD(stats.net_pnl),      color:pc(stats.net_pnl)},
    {label:"Win Rate",     value:`${stats.win_rate}%`,        color:stats.win_rate>=50?C.green:C.red},
    {label:"Profit Factor",value:stats.profit_factor===Infinity?"∞":String(stats.profit_factor), color:stats.profit_factor>=1?C.green:C.red},
    {label:"Day Win %",    value:`${stats.day_win_rate}%`,    color:stats.day_win_rate>=50?C.green:C.red},
    {label:"Avg Win",      value:fmtUSD(stats.avg_win),       color:C.green},
    {label:"Avg Loss",     value:fmtUSD(stats.avg_loss),      color:C.red},
    {label:"Largest Win",  value:fmtUSD(stats.largest_win),   color:C.green, click:()=>stats.largest_win_trade&&openFile(stats.largest_win_trade.exit_file)},
    {label:"Largest Loss", value:fmtUSD(-stats.largest_loss), color:C.red,   click:()=>stats.largest_loss_trade&&openFile(stats.largest_loss_trade.exit_file)},
    {label:"Avg W/L Ratio", value:String(stats.avg_win_loss_ratio), color:stats.avg_win_loss_ratio>=1?C.green:C.red, extra: stats.avg_win>0||stats.avg_loss>0 ? {win:stats.avg_win, loss:stats.avg_loss} : null},
    {label:"Avg R",        value:`${stats.avg_r_multiple}R`,  color:stats.avg_r_multiple>=0?C.green:C.red},
    {label:"Max DD",       value:`${stats.max_drawdown_pct.toFixed(1)}%`, color:C.red},
    {label:"ROI",          value:`${stats.overall_roi}%`,     color:pc(stats.overall_roi)},
    {label:"Balance",      value:fmtUSD(stats.current_balance),color:C.blue},
    {label:"Trades",       value:`${stats.trade_count} (${stats.exit_count} exits)`, color:C.text, click:()=>onShowTrades(trades)},
  ];
  items.forEach((item:any)=>{
    const c=div(wrap,`background:${C.card};border:1px solid ${C.border};border-radius:10px;padding:10px;`);
    c.createEl("div",{text:item.label,attr:{style:`color:${C.muted};font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;font-family:${F};`}});
    const valEl=c.createEl("div",{text:item.value,attr:{style:`color:${item.color};font-size:18px;font-weight:700;font-family:${F};${item.click?"cursor:pointer;text-decoration:underline;text-underline-offset:3px;":""}`}});
    if(item.click) valEl.addEventListener("click",item.click);
    // Win/loss ratio bar (like Tradezella)
    if(item.extra){
      const barWrap=div(c,"display:flex;align-items:center;gap:4px;margin-top:6px;");
      const total=item.extra.win+item.extra.loss;
      const winPct=total>0?(item.extra.win/total)*100:50;
      const bar=div(barWrap,`flex:1;height:6px;border-radius:3px;overflow:hidden;display:flex;`);
      div(bar,`width:${winPct}%;background:${C.green};`);
      div(bar,`flex:1;background:${C.red};`);
      barWrap.createEl("span",{text:`$${item.extra.win.toFixed(0)}`,attr:{style:`color:${C.green};font-size:9px;font-weight:700;font-family:${F};`}});
      barWrap.createEl("span",{text:`-$${item.extra.loss.toFixed(0)}`,attr:{style:`color:${C.red};font-size:9px;font-weight:700;font-family:${F};`}});
    }
  });
}

// ─── Filters ──────────────────────────────────────────────────────────────────
function renderFilters(parent: HTMLElement, trades: Trade[], filters: TradeFilters, onChange:(f:TradeFilters)=>void): void {
  const wrap=div(parent,`display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:10px 16px;background:${C.card};border-bottom:1px solid ${C.border};`);
  const selSt=`background:var(--background-primary);color:${C.text};border:1px solid ${C.border};border-radius:6px;padding:5px 8px;font-size:11px;font-family:${F};cursor:pointer;`;
  const btnSt=`background:var(--background-primary);color:${C.muted};border:1px solid ${C.border};border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:${F};`;
  const actSt=`background:rgba(96,165,250,0.15);color:${C.blue};border:1px solid ${C.blue};border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:${F};`;

  const strategies=[...new Set(trades.map(t=>t.strategy).filter(Boolean))];
  const accounts  =[...new Set(trades.map(t=>t.account).filter(Boolean))];
  const symbols   =[...new Set(trades.map(t=>t.symbol).filter(Boolean))];

  const presets=[
    {label:"All",days:0},{label:"1W",days:7},{label:"1M",days:30},
    {label:"3M",days:90},{label:"6M",days:180},{label:"YTD",days:-1}
  ];

  const isActive=(days:number)=>{
    if(days===0)  return !filters.date_from&&!filters.date_to;
    if(days===-1){ const ytd=new Date();ytd.setMonth(0);ytd.setDate(1); return filters.date_from===ytd.toISOString().split("T")[0]&&!filters.date_to; }
    const from=new Date(); from.setDate(from.getDate()-days);
    return filters.date_from===from.toISOString().split("T")[0]&&!filters.date_to;
  };

  presets.forEach(p=>{
    const btn=wrap.createEl("button",{text:p.label,attr:{style:isActive(p.days)?actSt:btnSt}});
    btn.addEventListener("click",()=>{
      if(p.days===0){ onChange({...filters,date_from:undefined,date_to:undefined}); }
      else if(p.days===-1){ const ytd=new Date();ytd.setMonth(0);ytd.setDate(1); onChange({...filters,date_from:ytd.toISOString().split("T")[0],date_to:undefined}); }
      else{ const from=new Date();from.setDate(from.getDate()-p.days); onChange({...filters,date_from:from.toISOString().split("T")[0],date_to:undefined}); }
    });
  });

  const fromIn=wrap.createEl("input",{attr:{type:"date",value:filters.date_from??"",style:selSt}}) as HTMLInputElement;
  fromIn.addEventListener("change",()=>onChange({...filters,date_from:fromIn.value||undefined}));
  wrap.createEl("span",{text:"→",attr:{style:`color:${C.muted};font-size:11px;`}});
  const toIn=wrap.createEl("input",{attr:{type:"date",value:filters.date_to??"",style:selSt}}) as HTMLInputElement;
  toIn.addEventListener("change",()=>onChange({...filters,date_to:toIn.value||undefined}));

  const mkSel=(label:string,opts:string[],val:string,key:keyof TradeFilters)=>{
    const sel=wrap.createEl("select",{attr:{style:selSt}}) as HTMLSelectElement;
    sel.createEl("option",{text:label,attr:{value:""}});
    opts.forEach(o=>{ const op=sel.createEl("option",{text:o,attr:{value:o}}); if(val===o) op.setAttribute("selected","true"); });
    sel.addEventListener("change",()=>onChange({...filters,[key]:sel.value||undefined}));
  };
  mkSel("All Accounts",  accounts,   filters.account  ??"","account");
  mkSel("All Strategies",strategies, filters.strategy ??"","strategy");
  mkSel("All Grades",    ["A","B","C","D"],filters.grade??"","grade");
  mkSel("Long/Short",    ["long","short"],  filters.dir  ??"","dir");
  mkSel("All Symbols",   symbols,    filters.symbol   ??"","symbol");

  const rebuildBtn=wrap.createEl("button",{text:"⟳ Rebuild",attr:{style:`${btnSt}margin-left:auto;`}});
  rebuildBtn.addEventListener("click",()=>{
    rebuildBtn.textContent="Building...";
    (window as any).app?.commands?.executeCommandById("trading-journal:rebuild-trading-cache");
    setTimeout(()=>{ rebuildBtn.textContent="⟳ Rebuild"; },4000);
  });
}

// ─── Main render ──────────────────────────────────────────────────────────────
export function renderDashboard(
  container: HTMLElement,
  stats: TradeStats,
  trades: Trade[],
  events: AccountEvent[],
  filters: TradeFilters,
  onFilterChange: (f:TradeFilters)=>void,
  openFile: (p:string)=>void
): void {
  container.style.cssText=`background:${C.bg};min-height:100%;font-family:${F};color:${C.text};`;

  let showTradesList=false;
  let tradeListData: Trade[] = trades;

  const redraw=()=>{
    container.empty();
    container.style.cssText=`background:${C.bg};min-height:100%;font-family:${F};color:${C.text};`;

    // Header
    const hdr=div(container,`display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid ${C.border};background:${C.card};`);
    hdr.createEl("div",{text:"Trading Dashboard",attr:{style:`color:${C.text};font-size:18px;font-weight:700;font-family:${F};`}});
    const hRight=div(hdr,"display:flex;align-items:center;gap:8px;");
    hRight.createEl("div",{text:`${trades.length} total trades`,attr:{style:`color:${C.muted};font-size:11px;`}});

    const actTab=`background:rgba(96,165,250,0.15);color:${C.blue};border:1px solid ${C.blue};border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:${F};`;
    const inTab =`background:transparent;color:${C.muted};border:1px solid ${C.border};border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:${F};`;
    const dashBtn  =hRight.createEl("button",{text:"Dashboard",attr:{style:!showTradesList?actTab:inTab}});
    const tradesBtn=hRight.createEl("button",{text:"Trades",    attr:{style:showTradesList ?actTab:inTab}});
    dashBtn.addEventListener("click",()=>{ showTradesList=false; redraw(); });
    tradesBtn.addEventListener("click",()=>{ showTradesList=true; tradeListData=trades; redraw(); });

    const onShowTrades=(t:Trade[])=>{ showTradesList=true; tradeListData=t; redraw(); };

    renderFilters(container, trades, filters, (f)=>{ onFilterChange(f); });

    if(showTradesList){
      renderTradesList(div(container,"padding:16px;"), tradeListData, openFile);
      return;
    }

    renderStatsBar(container, stats, trades, onShowTrades, openFile);

    // Row 1: Equity + Drawdown
    const g1=div(container,"display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px 0;");
    const eq=card(g1);
    addExpandBtn(eq,"Equity Curve",(c)=>renderEquity(c,stats.equity_curve,900));
    cardTitle(eq,"Equity Curve");
    renderEquity(eq,stats.equity_curve);
    const dd=card(g1);
    addExpandBtn(dd,"Drawdown",(c)=>renderDrawdown(c,stats.drawdown_curve,900));
    cardTitle(dd,"Drawdown");
    renderDrawdown(dd,stats.drawdown_curve);

    // Row 2: Monthly bars + Streak
    const g2=div(container,"display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px 0;");
    const mb=card(g2); cardTitle(mb,"Monthly P&L");       renderMonthlyBars(mb,stats.monthly_pnl,trades,onShowTrades);
    const sk=card(g2); cardTitle(sk,"Win/Loss Streak");   renderStreak(sk,stats.streak,trades,onShowTrades);

    // Largest win/loss
    const lw=card(container,"margin:12px 16px 0;");
    cardTitle(lw,"Largest Win & Loss");
    renderLargest(lw,stats,openFile);

    // Calendar
    const cal=card(container,"margin:12px 16px 0;overflow-x:auto;");
    cardTitle(cal,"P&L Calendar");
    renderCalendar(cal,stats.daily_pnl,stats.weekly_pnl,trades,openFile,onShowTrades);

    // Row 3: Time slots + Duration
    const g3=div(container,"display:grid;grid-template-columns:3fr 2fr;gap:12px;padding:12px 16px 0;");
    const ts=card(g3); cardTitle(ts,"Entry Time Performance (13:00–22:00, 30min)"); renderTimeSlots(ts,stats.pnl_by_slot);
    const dr=card(g3); cardTitle(dr,"Trade Duration");                               renderDuration(dr,stats.duration_by_outcome);

    // Strategy table
    const st=card(container,"margin:12px 16px 0;");
    cardTitle(st,"Strategy Breakdown");
    renderStrategyTable(st,stats,trades,onShowTrades);

    // Grade breakdown
    const gr=card(container,"margin:12px 16px 0;");
    cardTitle(gr,"Grade Breakdown");
    renderGrades(gr,stats,trades,onShowTrades);

    // Market correlation
    const mc=card(container,"margin:12px 16px 16px;");
    addExpandBtn(mc,"Market Conditions vs P&L",(c)=>renderCorrelation(c,stats.market_correlation,900));
    cardTitle(mc,"Market Conditions vs P&L");
    renderCorrelation(mc,stats.market_correlation);
  };

  redraw();
}
