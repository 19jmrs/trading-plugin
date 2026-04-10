import { Trade, TradeRow, AccountEvent, TradeStats, TradeFilters, StreakInfo } from "./types";
import { MarketMonitorDashboardData, MarketMonitorMath, MarketMonitorTableRow, HighLowRow, AdvanceDeclineRow, PerformanceTrackRow, OpenPositionAnalytics } from "./market-monitor";

export interface DashboardRenderState {
  activeTab: "dashboard" | "trades" | "market";
  marketVisibleRows: number;
  marketDateFrom: string;
  marketDateTo: string;
  performanceVisibleRows: number;
  performanceDateFrom: string;
  performanceDateTo: string;
  chartDateFrom: string;
  chartDateTo: string;
}

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
function sLine(s: SVGSVGElement, x1:number,y1:number,x2:number,y2:number,c:string,w=1): SVGLineElement {
  const e=document.createElementNS(NS,"line") as SVGLineElement;
  e.setAttribute("x1",String(x1));e.setAttribute("y1",String(y1));e.setAttribute("x2",String(x2));e.setAttribute("y2",String(y2));
  e.setAttribute("stroke",c);e.setAttribute("stroke-width",String(w));s.appendChild(e); return e;
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

function addExpandLink(parent: HTMLElement, title: string, renderFn: (container: HTMLElement) => void): void {
  const btn = parent.createEl("button", { text: "Expand ↗", attr: { style: `
    background:transparent;border:none;color:${C.blue};padding:0;float:right;
    cursor:pointer;font-size:10px;font-family:${F};font-weight:700;margin-top:1px;
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

  type SortKey = "entry_date"|"symbol"|"entry_size"|"filled_size"|"pnl"|"pnl_pct"|"r_multiple"|"trade_total_pnl"|"trade_total_pnl_pct"|"trade_total_r"|"exit_date"|"strategy"|"grade"|"hold_days";
  let sortKey: SortKey = "entry_date";
  let sortAsc = false;

  const cols: { label:string; key?:SortKey; align?:string }[] = [
    { label:"Open",     key:"entry_date" },
    { label:"Symbol",   key:"symbol" },
    { label:"Status" },
    { label:"Close",    key:"exit_date" },
    { label:"Entry" },
    { label:"Avg Exit" },
    { label:"Entry Shares", key:"entry_size" },
    { label:"Shares",   key:"filled_size" },
    { label:"Net P&L",  key:"pnl" },
    { label:"ROI",      key:"pnl_pct" },
    { label:"R",        key:"r_multiple" },
    { label:"Trade P&L", key:"trade_total_pnl" },
    { label:"Trade ROI", key:"trade_total_pnl_pct" },
    { label:"Trade R",   key:"trade_total_r" },
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

  const aggregateByBase = new Map<string, { pnl: number; filled: number; exitCount: number; entryPrice: number; entrySize: number; targetSl: number }>();
  trades.forEach(t => {
    const baseId = t.trade_id.replace(/#\d+$/, "");
    const cur = aggregateByBase.get(baseId) ?? { pnl: 0, filled: 0, exitCount: 0, entryPrice: t.entry_price, entrySize: t.entry_size, targetSl: t.target_sl };
    cur.pnl += t.pnl;
    cur.filled += t.filled_size;
    cur.exitCount = Math.max(cur.exitCount, t.exit_count);
    aggregateByBase.set(baseId, cur);
  });

  const getTradeTotals = (t: Trade) => {
    const baseId = t.trade_id.replace(/#\d+$/, "");
    const agg = aggregateByBase.get(baseId)!;
    const totalPnl = agg?.pnl ?? t.pnl;
    const totalPnlPct = agg && agg.entryPrice * agg.entrySize > 0 ? (totalPnl / (agg.entryPrice * agg.entrySize)) * 100 : 0;
    const riskPerUnit = Math.abs((agg?.entryPrice ?? t.entry_price) - (agg?.targetSl ?? t.target_sl));
    const totalR = agg && riskPerUnit > 0 && agg.entrySize > 0 ? totalPnl / (riskPerUnit * agg.entrySize) : 0;
    return { totalPnl, totalPnlPct, totalR };
  };

  const getSortVal = (t: Trade, k: SortKey): any => {
    const totals = getTradeTotals(t);
    if(k==="entry_date") return t.entry_date;
    if(k==="exit_date")  return t.exit_date;
    if(k==="symbol")     return t.symbol;
    if(k==="entry_size") return t.entry_size;
    if(k==="filled_size") return t.filled_size;
    if(k==="pnl")        return t.pnl;
    if(k==="pnl_pct")    return t.pnl_pct;
    if(k==="r_multiple") return t.r_multiple;
    if(k==="trade_total_pnl") return totals.totalPnl;
    if(k==="trade_total_pnl_pct") return totals.totalPnlPct;
    if(k==="trade_total_r") return totals.totalR;
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
      const totals = getTradeTotals(t);
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
        {v:String(t.entry_size), c:C.text},
        {v:String(t.filled_size), c:C.text},
        {v:fmtUSD(t.pnl),     c:pc(t.pnl),bold:true},
        {v:`${fmt(t.pnl_pct,2)}%`,c:pc(t.pnl)},
        {v:`${t.r_multiple}R`, c:pc(t.r_multiple)},
        {v:fmtUSD(totals.totalPnl), c:pc(totals.totalPnl), bold:true},
        {v:`${fmt(totals.totalPnlPct,2)}%`, c:pc(totals.totalPnl)},
        {v:`${fmt(totals.totalR,2)}R`, c:pc(totals.totalR)},
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
function uniqueTradeDirStats(trades: Trade[]): { longPct: number; shortPct: number; total: number } {
  const byId = new Map<string, "long" | "short">();
  trades.forEach(t => {
    const baseId = t.trade_id.replace(/#\d+$/, "");
    if (!byId.has(baseId)) byId.set(baseId, t.dir);
  });
  const total = byId.size;
  const longCount = [...byId.values()].filter(v => v === "long").length;
  const shortCount = [...byId.values()].filter(v => v === "short").length;
  return {
    longPct: total ? parseFloat(((longCount / total) * 100).toFixed(1)) : 0,
    shortPct: total ? parseFloat(((shortCount / total) * 100).toFixed(1)) : 0,
    total,
  };
}

function renderStatsBar(parent: HTMLElement, stats: TradeStats, trades: Trade[], openAnalytics: OpenPositionAnalytics, onShowTrades:(t:Trade[])=>void, openFile:(p:string)=>void): void {
  const wrap=div(parent,`display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;padding:12px 16px;`);
  const dirStats = uniqueTradeDirStats(trades);
  const items=[
    {label:"Net P&L",      value:fmtUSD(stats.net_pnl),      color:pc(stats.net_pnl)},
    {label:"Net+Unreal",   value:fmtUSD(stats.net_pnl + openAnalytics.totalUnrealizedPnl), color:pc(stats.net_pnl + openAnalytics.totalUnrealizedPnl)},
    {label:"Win Rate",     value:`${stats.win_rate}%`,        color:stats.win_rate>=50?C.green:C.red},
    {label:"Profit Factor",value:stats.profit_factor===Infinity?"∞":String(stats.profit_factor), color:stats.profit_factor>=1?C.green:C.red},
    {label:"Day Win %",    value:`${stats.day_win_rate}%`,    color:stats.day_win_rate>=50?C.green:C.red},
    {label:"Avg Win",      value:fmtUSD(stats.avg_win),       color:C.green},
    {label:"Avg Loss",     value:fmtUSD(stats.avg_loss),      color:C.red},
    {label:"Largest Win",  value:fmtUSD(stats.largest_win),   color:C.green, click:()=>stats.largest_win_trade&&openFile(stats.largest_win_trade.exit_file)},
    {label:"Largest Loss", value:fmtUSD(-stats.largest_loss), color:C.red,   click:()=>stats.largest_loss_trade&&openFile(stats.largest_loss_trade.exit_file)},
    {label:"Avg W/L Ratio", value:String(stats.avg_win_loss_ratio), color:stats.avg_win_loss_ratio>=1?C.green:C.red, extra: stats.avg_win>0||stats.avg_loss>0 ? {win:stats.avg_win, loss:stats.avg_loss} : null},
    {label:"Avg R",        value:`${stats.avg_r_multiple}R`,  color:stats.avg_r_multiple>=0?C.green:C.red},
    {label:"Avg R Win",    value:`${stats.avg_r_win}R`,       color:C.green},
    {label:"Avg R Loss",   value:`${stats.avg_r_loss}R`,      color:C.red},
    {label:"Gain to Pain", value:stats.gain_to_pain===Infinity?"∞":String(stats.gain_to_pain), color:stats.gain_to_pain>=1?C.green:C.red},
    {label:"Max DD",       value:`${stats.max_drawdown_pct.toFixed(1)}%`, color:C.red},
    {label:"ROI",          value:`${stats.overall_roi}%`,     color:pc(stats.overall_roi)},
    {label:"Balance",      value:fmtUSD(stats.current_balance),color:C.blue},
    {label:"Bal+Unreal",   value:fmtUSD(stats.current_balance + openAnalytics.totalUnrealizedPnl),color:C.blue},
    {label:"Long %",       value:`${dirStats.longPct}%`, color:dirStats.longPct>=50?C.green:C.text},
    {label:"Short %",      value:`${dirStats.shortPct}%`, color:dirStats.shortPct>=50?C.red:C.text},
    {label:"Unrealized R", value:`${openAnalytics.totalUnrealizedR}R`, color:openAnalytics.totalUnrealizedR>=0?C.green:C.red},
    {label:"Open Risk",    value:fmtUSD(openAnalytics.totalOpenRiskToStop), color:C.orange},
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

  const monthStartIso = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  };
  const ytdStartIso = () => {
    const d = new Date();
    d.setMonth(0); d.setDate(1);
    return d.toISOString().split("T")[0];
  };

  const presets=[
    {label:"All",days:0},{label:"1W",days:7},{label:"MTD",days:-2},{label:"1M",days:30},
    {label:"3M",days:90},{label:"6M",days:180},{label:"YTD",days:-1}
  ];

  const isActive=(days:number)=>{
    if(days===0)  return !filters.date_from&&!filters.date_to;
    if(days===-1) return filters.date_from===ytdStartIso()&&!filters.date_to;
    if(days===-2) return filters.date_from===monthStartIso()&&!filters.date_to;
    const from=new Date(); from.setDate(from.getDate()-days);
    return filters.date_from===from.toISOString().split("T")[0]&&!filters.date_to;
  };

  presets.forEach(p=>{
    const btn=wrap.createEl("button",{text:p.label,attr:{style:isActive(p.days)?actSt:btnSt}});
    btn.addEventListener("click",()=>{
      if(p.days===0){ onChange({...filters,date_from:undefined,date_to:undefined}); }
      else if(p.days===-1){ onChange({...filters,date_from:ytdStartIso(),date_to:undefined}); }
      else if(p.days===-2){ onChange({...filters,date_from:monthStartIso(),date_to:undefined}); }
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

function valueStyle(color: string, extra = ""): string {
  return `color:${color};font-weight:700;${extra}`;
}

function rowPairStyles(left: number, right: number): [string, string] {
  if (left > right) return [valueStyle(C.green), valueStyle(C.red)];
  if (left < right) return [valueStyle(C.red), valueStyle(C.green)];
  return ["color:var(--text-normal);font-weight:700;", "color:var(--text-normal);font-weight:700;"];
}

function metricCell(parent: HTMLElement, label: string, value: string): void {
  const m = card(parent, "padding:12px;");
  m.createEl("div", { text: label, attr: { style: `color:${C.muted};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;font-family:${F};` } });
  m.createEl("div", { text: value, attr: { style: `color:${C.text};font-size:18px;font-weight:700;font-family:${F};` } });
}

function filterOpenRows(openRows: TradeRow[], filters: TradeFilters): TradeRow[] {
  return openRows.filter(r => {
    const grade = (r.trade_score ?? 0) >= 40 ? "A" : (r.trade_score ?? 0) >= 30 ? "B" : (r.trade_score ?? 0) >= 15 ? "C" : "D";
    if (filters.date_from && r.date < filters.date_from) return false;
    if (filters.date_to && r.date > filters.date_to) return false;
    if (filters.account && r.account !== filters.account) return false;
    if (filters.strategy && r.strategy !== filters.strategy) return false;
    if (filters.dir && r.dir !== filters.dir) return false;
    if (filters.grade && grade !== filters.grade) return false;
    if (filters.symbol && r.symbol.toUpperCase() !== filters.symbol.toUpperCase()) return false;
    return true;
  });
}

function polar(cx: number, cy: number, r: number, a: number): { x: number; y: number } {
  const rad = (a - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutPath(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number): string {
  const p1 = polar(cx, cy, rOuter, start);
  const p2 = polar(cx, cy, rOuter, end);
  const p3 = polar(cx, cy, rInner, end);
  const p4 = polar(cx, cy, rInner, start);
  const large = end - start > 180 ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

function renderOpenPositionDetails(parent: HTMLElement, analytics: OpenPositionAnalytics, openFile: (p:string)=>void): void {
  if (!analytics.positions.length) {
    parent.createEl("div", { text: "No open positions", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }

  const tableWrap = div(parent, "overflow:auto;border:1px solid var(--background-modifier-border);border-radius:8px;");
  const table = tableWrap.createEl("table", { attr: { style: `width:100%;border-collapse:collapse;font-size:11px;font-family:${F};min-width:1120px;` } });
  const thead = table.createEl("thead");
  const tbody = table.createEl("tbody");
  const hdr = thead.createEl("tr", { attr: { style: `background:${C.card};` } });
  ["Symbol","Initial Shares","Current Shares","Open Value","Current Value","Real %","Unreal %","Real R","Unreal R","Total R","Last Close"].forEach(h => {
    hdr.createEl("th", { text: h, attr: { style: `padding:8px;border-bottom:1px solid ${C.border};text-align:right;color:${C.muted};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;` } });
  });

  analytics.positions.forEach(p => {
    const tr = tbody.createEl("tr", { attr: { style: `border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;` } });
    tr.addEventListener("click", () => openFile(p.entryFile));
    const cells = [
      { text: `${p.symbol} ${p.dir.toUpperCase()}`, style: `padding:8px;text-align:left;color:${C.text};font-weight:700;white-space:nowrap;` },
      { text: fmt(p.entrySize, 0), style: `padding:8px;text-align:right;color:${C.text};` },
      { text: fmt(p.remainingSize, 0), style: `padding:8px;text-align:right;color:${C.text};font-weight:700;` },
      { text: fmtUSD(p.openingValue), style: `padding:8px;text-align:right;color:${C.text};` },
      { text: fmtUSD(p.currentValue), style: `padding:8px;text-align:right;color:${C.blue};font-weight:700;` },
      { text: `${p.realizedPct >= 0 ? "+" : ""}${fmt(p.realizedPct)}%`, style: `padding:8px;text-align:right;color:${pc(p.realizedPct)};font-weight:700;` },
      { text: `${p.unrealizedPct >= 0 ? "+" : ""}${fmt(p.unrealizedPct)}%`, style: `padding:8px;text-align:right;color:${pc(p.unrealizedPct)};font-weight:700;` },
      { text: `${p.realizedR}R`, style: `padding:8px;text-align:right;color:${p.realizedR >= 0 ? C.green : C.red};font-weight:700;` },
      { text: `${p.unrealizedR}R`, style: `padding:8px;text-align:right;color:${p.unrealizedR >= 0 ? C.green : C.red};font-weight:700;` },
      { text: `${p.totalR}R`, style: `padding:8px;text-align:right;color:${p.totalR >= 0 ? C.green : C.red};font-weight:700;` },
      { text: p.latestClose ? `$${fmt(p.latestClose.close)}` : "—", style: `padding:8px;text-align:right;color:${C.muted};` },
    ];
    cells.forEach(cell => tr.createEl("td", { text: cell.text, attr: { style: cell.style } }));
  });
}

function renderOpenPositionsPie(parent: HTMLElement, openRows: TradeRow[], balance: number, openFile: (p:string)=>void): void {
  const grouped = new Map<string, { label: string; value: number; filePath?: string }>();
  openRows.forEach(r => {
    const key = r.symbol;
    const current = grouped.get(key);
    const value = r.price * r.size;
    grouped.set(key, { label: key, value: (current?.value ?? 0) + value, filePath: current?.filePath ?? r.filePath });
  });

  const positions = [...grouped.values()].sort((a, b) => b.value - a.value);
  const openValue = positions.reduce((sum, p) => sum + p.value, 0);
  const cashValue = Math.max(0, balance - openValue);
  const slices = [...positions, { label: "Cash", value: cashValue, filePath: undefined }].filter(s => s.value > 0);
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  const colors = [C.blue, C.green, C.purple, C.yellow, C.orange, "#f472b6", "#34d399", "#fb7185", "#22d3ee", "#c084fc", "#94a3b8"];

  const wrap = div(parent, "display:grid;grid-template-columns:minmax(240px,320px) 1fr;gap:18px;align-items:center;");
  const left = div(wrap, "display:flex;justify-content:center;");
  const legend = div(wrap, "display:flex;flex-direction:column;gap:8px;");
  const W = 260, H = 220, cx = 120, cy = 110, rOuter = 78, rInner = 44;
  const s = svg(left, W, H);
  const tt = makeTooltip(parent);

  let angle = 0;
  slices.forEach((slice, idx) => {
    const pct = slice.value / total;
    const start = angle;
    const end = angle + pct * 360;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", donutPath(cx, cy, rOuter, rInner, start, end));
    path.setAttribute("fill", colors[idx % colors.length]);
    path.style.cursor = slice.filePath ? "pointer" : "default";
    s.appendChild(path);
    path.addEventListener("mouseenter", (e: MouseEvent) => showTooltip(tt, e, el => {
      el.createEl("div", { text: slice.label, attr: { style: `color:${C.text};font-weight:700;margin-bottom:4px;` } });
      el.createEl("div", { text: `${fmtUSD(slice.value)} · ${fmt(pct * 100, 1)}%`, attr: { style: `color:${colors[idx % colors.length]};` } });
    }));
    path.addEventListener("mousemove", (e: MouseEvent) => moveTooltip(tt, e));
    path.addEventListener("mouseleave", () => hideTooltip(tt));
    if (slice.filePath) path.addEventListener("click", () => openFile(slice.filePath!));
    angle = end;
  });

  sText(s, cx, cy - 6, "Open", C.muted, 10, "middle");
  sText(s, cx, cy + 14, fmtUSD(openValue), C.text, 12, "middle");

  slices.forEach((slice, idx) => {
    const pct = slice.value / total;
    const row = div(legend, `display:grid;grid-template-columns:14px 1fr auto auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);${slice.filePath?"cursor:pointer;":""}`);
    row.createEl("div", { attr: { style: `width:10px;height:10px;border-radius:50%;background:${colors[idx % colors.length]};` } });
    row.createEl("div", { text: slice.label, attr: { style: `color:${C.text};font-size:11px;font-weight:700;font-family:${F};` } });
    row.createEl("div", { text: `${fmt(pct * 100, 1)}%`, attr: { style: `color:${C.muted};font-size:11px;font-family:${F};` } });
    row.createEl("div", { text: fmtUSD(slice.value), attr: { style: `color:${C.text};font-size:11px;font-family:${F};` } });
    if (slice.filePath) row.addEventListener("click", () => openFile(slice.filePath!));
  });
}

function filterByDateRange<T extends { dateIso: string }>(rows: T[], from?: string, to?: string): T[] {
  return rows.filter(row => (!from || row.dateIso >= from) && (!to || row.dateIso <= to));
}

function latestRows<T>(rows: T[], count: number): T[] {
  return rows.slice(0, count);
}

function lastNDaysIso(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() - days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatChartTick(dateIso: string): string {
  const m = dateIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateIso;
  return `${m[2]}-${m[3]}`;
}

function seriesSma(values: Array<number | null>, period: number): Array<number | null> {
  const out: Array<number | null> = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) continue;
    const slice = values.slice(i + 1 - period, i + 1);
    if (slice.some(v => v === null)) continue;
    const nums = slice as number[];
    out[i] = nums.reduce((sum, value) => sum + value, 0) / period;
  }
  return out;
}

function chartPanel(parent: HTMLElement): HTMLElement {
  return div(parent, `background:#10192d;border:1px solid rgba(148,163,184,0.18);border-radius:12px;padding:12px 12px 10px;`);
}

function drawXAxisTicks(s: SVGSVGElement, dates: string[], sx: (i: number) => number, y: number): void {
  const tickCount = Math.min(5, dates.length);
  for (let i = 0; i < tickCount; i++) {
    const idx = Math.round((i / Math.max(tickCount - 1, 1)) * (dates.length - 1));
    sText(s, sx(idx), y, formatChartTick(dates[idx]), C.faint, 8, "middle");
  }
}

function renderOscillatorHistogram(
  parent: HTMLElement,
  data: { date: string; value: number }[],
  footerLeft?: string,
  footerLegend?: Array<{ label: string; color: string }>,
  chartW = 900
): void {
  if (!data.length) {
    parent.createEl("div", { text: "No data", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }

  const panel = chartPanel(parent);
  const W = chartW, H = Math.round(chartW * 0.26), P = { t: 10, r: 10, b: 28, l: 10 };
  const W2 = W - P.l - P.r, H2 = H - P.t - P.b;
  const minV = Math.min(...data.map(d => d.value), 0), maxV = Math.max(...data.map(d => d.value), 0);
  const range = maxV - minV || 1;
  const zeroY = P.t + H2 - ((0 - minV) / range) * H2;
  const targetStep = Math.min(22, Math.max(12, W2 / Math.max(data.length, 1)));
  const drawWidth = Math.min(W2, Math.max(data.length * targetStep, data.length * 6));
  const startX = P.l + (W2 - drawWidth) / 2;
  const step = drawWidth / Math.max(data.length, 1);
  const bw = Math.max(5, Math.min(18, step * 0.94));
  const s = svg(panel, W, H);
  const tt = makeTooltip(panel);
  const cross = sLine(s, P.l, P.t, P.l, P.t + H2, "rgba(148,163,184,0.35)");
  cross.style.display = "none";

  sLine(s, P.l, zeroY, W - P.r, zeroY, "rgba(148,163,184,0.18)");
  [0.25, 0.5, 0.75].forEach(frac => {
    const y = P.t + frac * H2;
    sLine(s, P.l, y, W - P.r, y, "rgba(148,163,184,0.08)");
  });

  data.forEach((d, i) => {
    const x = startX + i * step + (step - bw) / 2;
    const y = P.t + H2 - ((d.value - minV) / range) * H2;
    const top = Math.min(zeroY, y);
    const h = Math.max(1, Math.abs(zeroY - y));
    sRect(s, x, top, bw, h, d.value >= 0 ? "#35d2a0" : "#ff7d72", 1.5, `${d.date}: ${fmt(d.value, 0)}`);

    const hit = sRect(s, startX + i * step, P.t, Math.max(step, 6), H2, "transparent", 0);
    hit.style.cursor = "crosshair";
    const showBarTooltip = (e: MouseEvent) => {
      cross.setAttribute("x1", String(x + bw / 2));
      cross.setAttribute("x2", String(x + bw / 2));
      cross.style.display = "block";
      showTooltip(tt, e, el => {
        el.createEl("div", { text: d.date, attr: { style: `color:${C.text};font-weight:700;margin-bottom:4px;` } });
        el.createEl("div", { text: `Value: ${fmt(d.value, 0)}`, attr: { style: `color:${d.value >= 0 ? C.green : C.red};` } });
      });
    };
    hit.addEventListener("mouseenter", showBarTooltip);
    hit.addEventListener("mousemove", e => { showBarTooltip(e); moveTooltip(tt, e); });
    hit.addEventListener("mouseleave", () => { cross.style.display = "none"; hideTooltip(tt); });
  });

  drawXAxisTicks(s, data.map(d => d.date), i => startX + i * step + step / 2, H - 6);

  const footer = div(panel, "display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;flex-wrap:wrap;");
  footer.createEl("div", { text: footerLeft ?? "", attr: { style: `color:${C.text};font-size:11px;font-family:${F};font-weight:700;` } });
  if (footerLegend?.length) {
    const legend = div(footer, "display:flex;gap:12px;align-items:center;flex-wrap:wrap;");
    footerLegend.forEach(item => {
      const entry = div(legend, "display:flex;gap:6px;align-items:center;");
      entry.createEl("span", { text: "▌", attr: { style: `color:${item.color};font-size:12px;line-height:1;` } });
      entry.createEl("span", { text: item.label, attr: { style: `color:${C.muted};font-size:10px;font-family:${F};` } });
    });
  }
}

function renderDualLineChart(
  parent: HTMLElement,
  primary: { date: string; value: number | null }[],
  secondary: { date: string; value: number | null }[],
  footerLeft: string,
  primaryLabel: string,
  secondaryLabel: string,
  chartW = 900
): void {
  const paired = primary
    .map((p, i) => ({ date: p.date, p: p.value, s: secondary[i]?.value ?? null }))
    .filter(row => row.p !== null || row.s !== null);

  if (paired.length < 2) {
    parent.createEl("div", { text: "Not enough data", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }

  const vals = paired.flatMap(row => [row.p, row.s]).filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length < 2) {
    parent.createEl("div", { text: "Not enough data", attr: { style: `color:${C.muted};font-size:11px;` } });
    return;
  }

  const panel = chartPanel(parent);
  const W = chartW, H = Math.round(chartW * 0.26), P = { t: 10, r: 10, b: 28, l: 10 };
  const W2 = W - P.l - P.r, H2 = H - P.t - P.b;
  const minV = Math.min(...vals), maxV = Math.max(...vals), range = maxV - minV || 1;
  const sx = (i: number) => P.l + (i / Math.max(paired.length - 1, 1)) * W2;
  const sy = (v: number) => P.t + H2 - ((v - minV) / range) * H2;
  const s = svg(panel, W, H);
  const tt = makeTooltip(panel);
  const cross = sLine(s, P.l, P.t, P.l, P.t + H2, "rgba(148,163,184,0.35)");
  cross.style.display = "none";
  const dot1 = sCircle(s, P.l, P.t, 3.5, "#4f8dfd", 1);
  const dot2 = sCircle(s, P.l, P.t, 3.5, "#d4a514", 1);
  dot1.style.display = "none";
  dot2.style.display = "none";

  [0.2, 0.5, 0.8].forEach(frac => {
    const y = P.t + frac * H2;
    sLine(s, P.l, y, W - P.r, y, "rgba(148,163,184,0.08)");
  });

  const buildPath = (key: "p" | "s") => {
    let path = "";
    paired.forEach((row, i) => {
      const value = row[key];
      if (value === null) return;
      const cmd = path ? "L" : "M";
      path += ` ${cmd} ${sx(i)} ${sy(value)}`;
    });
    return path.trim();
  };

  const primaryPath = buildPath("p");
  const secondaryPath = buildPath("s");
  if (primaryPath) sPath(s, primaryPath, "#4f8dfd", "none", 2.2);
  if (secondaryPath) sPath(s, secondaryPath, "#d4a514", "none", 1.8);

  paired.forEach((row, i) => {
    const left = i === 0 ? P.l : (sx(i - 1) + sx(i)) / 2;
    const right = i === paired.length - 1 ? W - P.r : (sx(i) + sx(i + 1)) / 2;
    const hit = sRect(s, left, P.t, Math.max(6, right - left), H2, "transparent", 0);
    hit.style.cursor = "crosshair";
    const showPointTooltip = (e: MouseEvent) => {
      const x = sx(i);
      cross.setAttribute("x1", String(x));
      cross.setAttribute("x2", String(x));
      cross.style.display = "block";
      if (row.p !== null) {
        dot1.setAttribute("cx", String(x));
        dot1.setAttribute("cy", String(sy(row.p)));
        dot1.style.display = "block";
      } else dot1.style.display = "none";
      if (row.s !== null) {
        dot2.setAttribute("cx", String(x));
        dot2.setAttribute("cy", String(sy(row.s)));
        dot2.style.display = "block";
      } else dot2.style.display = "none";
      showTooltip(tt, e, el => {
        el.createEl("div", { text: row.date, attr: { style: `color:${C.text};font-weight:700;margin-bottom:4px;` } });
        if (row.p !== null) el.createEl("div", { text: `${primaryLabel}: ${fmt(row.p, 0)}`, attr: { style: `color:#4f8dfd;` } });
        if (row.s !== null) el.createEl("div", { text: `${secondaryLabel}: ${fmt(row.s, 0)}`, attr: { style: `color:#d4a514;` } });
      });
    };
    hit.addEventListener("mouseenter", showPointTooltip);
    hit.addEventListener("mousemove", e => { showPointTooltip(e); moveTooltip(tt, e); });
    hit.addEventListener("mouseleave", () => {
      cross.style.display = "none";
      dot1.style.display = "none";
      dot2.style.display = "none";
      hideTooltip(tt);
    });
  });

  drawXAxisTicks(s, paired.map(row => row.date), sx, H - 6);

  const footer = div(panel, "display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;flex-wrap:wrap;");
  footer.createEl("div", { text: footerLeft, attr: { style: `color:${C.text};font-size:11px;font-family:${F};font-weight:700;` } });
  const legend = div(footer, "display:flex;gap:12px;align-items:center;flex-wrap:wrap;");
  [[primaryLabel, "#4f8dfd"], [secondaryLabel, "#d4a514"]].forEach(([label, color]) => {
    const entry = div(legend, "display:flex;gap:6px;align-items:center;");
    entry.createEl("span", { text: "—", attr: { style: `color:${color};font-size:14px;line-height:1;font-weight:700;` } });
    entry.createEl("span", { text: label, attr: { style: `color:${C.muted};font-size:10px;font-family:${F};` } });
  });
}

function renderMarketMonitorTable(
  parent: HTMLElement,
  rows: MarketMonitorTableRow[],
  visibleRows: number,
  onLoadMore: () => void,
  dateFrom: string,
  dateTo: string,
  onDateChange: (field: "from" | "to", value: string) => void
): void {
  const controls = div(parent, "display:flex;gap:8px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px;");
  const left = div(controls, "display:flex;gap:8px;align-items:end;flex-wrap:wrap;");
  [["From", dateFrom, "from"], ["To", dateTo, "to"]].forEach(([label, value, field]) => {
    const wrap = div(left, "display:flex;flex-direction:column;gap:4px;");
    wrap.createEl("label", { text: String(label), attr: { style: `color:${C.muted};font-size:10px;font-family:${F};` } });
    const input = wrap.createEl("input", { type: "date", value: String(value), attr: { style: `background:${C.card};border:1px solid ${C.border};color:${C.text};padding:6px 8px;border-radius:6px;font-family:${F};font-size:11px;` } });
    input.addEventListener("change", () => onDateChange(field as "from" | "to", input.value));
  });
  const clearBtn = left.createEl("button", { text: "Clear", attr: { style: `background:transparent;border:1px solid ${C.border};color:${C.muted};border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;font-family:${F};height:32px;` } });
  clearBtn.addEventListener("click", () => { onDateChange("from", ""); onDateChange("to", ""); });

  controls.createEl("div", { text: `Showing ${Math.min(rows.length, visibleRows)} / ${rows.length} rows`, attr: { style: `color:${C.muted};font-size:11px;font-family:${F};` } });

  const wrap = div(parent, "overflow:auto;border:1px solid var(--background-modifier-border);border-radius:8px;");
  const table = wrap.createEl("table", { attr: { style: `width:100%;border-collapse:collapse;font-size:11px;font-family:${F};min-width:1400px;` } });
  const thead = table.createEl("thead");
  const tbody = table.createEl("tbody");
  const hdr = thead.createEl("tr", { attr: { style: `background:${C.card};position:sticky;top:0;` } });
  ["Date","4%+ Up","4%+ Down","5d Ratio","10d Ratio","25%+ Q Up","25%+ Q Down","25%+ M Up","25%+ M Down","50%+ M Up","50%+ M Down","13%+ 34d Up","13%+ 34d Down","T2108"].forEach(h => {
    hdr.createEl("th", { text: h, attr: { style: `padding:8px;border-bottom:1px solid ${C.border};text-align:right;color:${C.muted};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;` } });
  });

  latestRows(rows, visibleRows).forEach(row => {
    const tr = tbody.createEl("tr", { attr: { style: `border-bottom:1px solid rgba(255,255,255,0.05);` } });
    const pair1 = rowPairStyles(row.up4, row.down4);
    const pair2 = rowPairStyles(row.upQuarter25, row.downQuarter25);
    const pair3 = rowPairStyles(row.upMonth25, row.downMonth25);
    const pair4 = rowPairStyles(row.upMonth50, row.downMonth50);
    const pair5 = rowPairStyles(row.up34, row.down34);
    const cells: Array<{ text: string; style?: string }> = [
      { text: row.dateDisplay, style: `padding:8px;text-align:left;color:${C.text};font-weight:700;white-space:nowrap;` },
      { text: String(row.up4), style: `padding:8px;text-align:right;${pair1[0]}` },
      { text: String(row.down4), style: `padding:8px;text-align:right;${pair1[1]}` },
      { text: row.ratio5 === null ? "-" : fmt(row.ratio5), style: `padding:8px;text-align:right;font-weight:700;background:${row.ratio5 !== null && row.ratio5 >= 1 ? "rgba(74,222,128,0.12)" : "transparent"};color:${row.ratio5 !== null && row.ratio5 >= 1 ? C.green : C.text};` },
      { text: row.ratio10 === null ? "-" : fmt(row.ratio10), style: `padding:8px;text-align:right;font-weight:700;background:${row.ratio10 !== null && row.ratio10 >= 1 ? "rgba(74,222,128,0.12)" : "transparent"};color:${row.ratio10 !== null && row.ratio10 >= 1 ? C.green : C.text};` },
      { text: String(row.upQuarter25), style: `padding:8px;text-align:right;${pair2[0]}` },
      { text: String(row.downQuarter25), style: `padding:8px;text-align:right;${pair2[1]}` },
      { text: String(row.upMonth25), style: `padding:8px;text-align:right;${pair3[0]}` },
      { text: String(row.downMonth25), style: `padding:8px;text-align:right;${pair3[1]}` },
      { text: String(row.upMonth50), style: `padding:8px;text-align:right;${pair4[0]}` },
      { text: String(row.downMonth50), style: `padding:8px;text-align:right;${pair4[1]}` },
      { text: String(row.up34), style: `padding:8px;text-align:right;${pair5[0]}` },
      { text: String(row.down34), style: `padding:8px;text-align:right;${pair5[1]}` },
      { text: row.t2108 === null ? "-" : fmt(row.t2108), style: `padding:8px;text-align:right;font-weight:700;color:${row.t2108 !== null && row.t2108 < 20 ? C.green : C.text};background:${row.t2108 !== null && row.t2108 < 20 ? "rgba(74,222,128,0.12)" : "transparent"};` },
    ];
    cells.forEach(cell => tr.createEl("td", { text: cell.text, attr: { style: cell.style ?? "padding:8px;" } }));
  });

  if (rows.length > visibleRows) {
    const moreWrap = div(parent, "display:flex;justify-content:center;margin-top:12px;");
    const more = moreWrap.createEl("button", { text: "Show 5 more", attr: { style: `background:transparent;border:1px solid ${C.border};color:${C.blue};border-radius:6px;padding:7px 12px;cursor:pointer;font-size:11px;font-family:${F};` } });
    more.addEventListener("click", onLoadMore);
  }
}

function renderMarketMonitorStats(parent: HTMLElement, rows: MarketMonitorTableRow[]): void {
  const ratios5 = rows.map(r => r.ratio5).filter((v): v is number => v !== null);
  const ratios10 = rows.map(r => r.ratio10).filter((v): v is number => v !== null);
  const t2108 = rows.map(r => r.t2108).filter((v): v is number => v !== null);
  const grid = div(parent, "display:grid;grid-template-columns:repeat(6,minmax(140px,1fr));gap:10px;margin-bottom:12px;");
  metricCell(grid, "Avg 5 Day Ratio", ratios5.length ? fmt(MarketMonitorMath.average(ratios5) ?? 0) : "-");
  metricCell(grid, "Avg 10 Day Ratio", ratios10.length ? fmt(MarketMonitorMath.average(ratios10) ?? 0) : "-");
  metricCell(grid, "Max 4% Up", rows.length ? String(Math.max(...rows.map(r => r.up4))) : "-");
  metricCell(grid, "Max 4% Down", rows.length ? String(Math.max(...rows.map(r => r.down4))) : "-");
  metricCell(grid, "T2108 Max / Min", t2108.length ? `${fmt(Math.max(...t2108), 0)} / ${fmt(Math.min(...t2108), 0)}` : "-");
  metricCell(grid, "T2108 Avg", t2108.length ? fmt(MarketMonitorMath.average(t2108) ?? 0) : "-");
}

function renderPerformanceTrackStats(parent: HTMLElement, rows: PerformanceTrackRow[]): void {
  const metrics = [
    { label: "8%+ Up 5d", values: rows.map(r => r.up8_5d) },
    { label: "8%+ Down 5d", values: rows.map(r => r.down8_5d) },
    { label: "20%+ Up 5d", values: rows.map(r => r.up20_5d) },
    { label: "20%+ Down 5d", values: rows.map(r => r.down20_5d) },
    { label: "%Above 21SMA", values: rows.map(r => r.above21sma) },
    { label: "%Above 200SMA", values: rows.map(r => r.above200sma) },
  ];
  const grid = div(parent, "display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px;");
  metrics.forEach(metric => {
    const vals = metric.values;
    const avg = vals.length ? MarketMonitorMath.average(vals) ?? 0 : null;
    const min = vals.length ? Math.min(...vals) : null;
    const max = vals.length ? Math.max(...vals) : null;
    const c = card(grid, "padding:12px;");
    c.createEl("div", { text: metric.label, attr: { style: `color:${C.muted};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;font-family:${F};` } });
    c.createEl("div", { text: avg === null ? "-" : `Avg ${fmt(avg, 1)}`, attr: { style: `color:${C.text};font-size:16px;font-weight:700;font-family:${F};margin-bottom:4px;` } });
    c.createEl("div", { text: min === null || max === null ? "-" : `Min ${fmt(min, 1)} · Max ${fmt(max, 1)}`, attr: { style: `color:${C.muted};font-size:10px;font-family:${F};` } });
  });
}

function renderPerformanceTracksTable(
  parent: HTMLElement,
  rows: PerformanceTrackRow[],
  visibleRows: number,
  onLoadMore: () => void,
  dateFrom: string,
  dateTo: string,
  onDateChange: (field: "from" | "to", value: string) => void
): void {
  const avg21 = rows.length ? MarketMonitorMath.average(rows.map(r => r.above21sma)) ?? 0 : 0;
  const avg200 = rows.length ? MarketMonitorMath.average(rows.map(r => r.above200sma)) ?? 0 : 0;
  const controls = div(parent, "display:flex;gap:8px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin-bottom:12px;");
  const left = div(controls, "display:flex;gap:8px;align-items:end;flex-wrap:wrap;");
  [["From", dateFrom, "from"], ["To", dateTo, "to"]].forEach(([label, value, field]) => {
    const wrap = div(left, "display:flex;flex-direction:column;gap:4px;");
    wrap.createEl("label", { text: String(label), attr: { style: `color:${C.muted};font-size:10px;font-family:${F};` } });
    const input = wrap.createEl("input", { type: "date", value: String(value), attr: { style: `background:${C.card};border:1px solid ${C.border};color:${C.text};padding:6px 8px;border-radius:6px;font-family:${F};font-size:11px;` } });
    input.addEventListener("change", () => onDateChange(field as "from" | "to", input.value));
  });
  const clearBtn = left.createEl("button", { text: "Clear", attr: { style: `background:transparent;border:1px solid ${C.border};color:${C.muted};border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;font-family:${F};height:32px;` } });
  clearBtn.addEventListener("click", () => { onDateChange("from", ""); onDateChange("to", ""); });
  controls.createEl("div", { text: `Showing ${Math.min(rows.length, visibleRows)} / ${rows.length} rows`, attr: { style: `color:${C.muted};font-size:11px;font-family:${F};` } });

  const wrap = div(parent, "overflow:auto;border:1px solid var(--background-modifier-border);border-radius:8px;");
  const table = wrap.createEl("table", { attr: { style: `width:100%;border-collapse:collapse;font-size:11px;font-family:${F};min-width:920px;` } });
  const thead = table.createEl("thead");
  const tbody = table.createEl("tbody");
  const hdr = thead.createEl("tr", { attr: { style: `background:${C.card};position:sticky;top:0;` } });
  ["Date","8%+ Up 5d","8%+ Down 5d","20%+ Up 5d","20%+ Down 5d","%Above 21SMA","%Above 200SMA"].forEach(h => {
    hdr.createEl("th", { text: h, attr: { style: `padding:8px;border-bottom:1px solid ${C.border};text-align:right;color:${C.muted};font-size:10px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;` } });
  });

  latestRows(rows, visibleRows).forEach(row => {
    const tr = tbody.createEl("tr", { attr: { style: `border-bottom:1px solid rgba(255,255,255,0.05);` } });
    const pair8 = rowPairStyles(row.up8_5d, row.down8_5d);
    const pair20 = rowPairStyles(row.up20_5d, row.down20_5d);
    const cells: Array<{ text: string; style: string }> = [
      { text: row.dateDisplay, style: `padding:8px;text-align:left;color:${C.text};font-weight:700;white-space:nowrap;` },
      { text: fmt(row.up8_5d, 0), style: `padding:8px;text-align:right;${pair8[0]}` },
      { text: fmt(row.down8_5d, 0), style: `padding:8px;text-align:right;${pair8[1]}` },
      { text: fmt(row.up20_5d, 0), style: `padding:8px;text-align:right;${pair20[0]}` },
      { text: fmt(row.down20_5d, 0), style: `padding:8px;text-align:right;${pair20[1]}` },
      { text: fmt(row.above21sma, 1), style: `padding:8px;text-align:right;font-weight:700;color:${row.above21sma >= avg21 ? C.green : C.red};` },
      { text: fmt(row.above200sma, 1), style: `padding:8px;text-align:right;font-weight:700;color:${row.above200sma >= avg200 ? C.green : C.red};` },
    ];
    cells.forEach(cell => tr.createEl("td", { text: cell.text, attr: { style: cell.style } }));
  });

  if (rows.length > visibleRows) {
    const moreWrap = div(parent, "display:flex;justify-content:center;margin-top:12px;");
    const more = moreWrap.createEl("button", { text: "Show 5 more", attr: { style: `background:transparent;border:1px solid ${C.border};color:${C.blue};border-radius:6px;padding:7px 12px;cursor:pointer;font-size:11px;font-family:${F};` } });
    more.addEventListener("click", onLoadMore);
  }
}

function renderMarketCharts(
  parent: HTMLElement,
  highLowRows: HighLowRow[],
  adRows: AdvanceDeclineRow[],
  chartFrom: string,
  chartTo: string,
  onChartRange: (from: string, to: string) => void
): void {
  const controls = div(parent, "display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:12px;");
  const btnWrap = div(controls, "display:flex;gap:8px;flex-wrap:wrap;");
  [
    ["1M", 30],
    ["3M", 90],
    ["6M", 180],
    ["1Y", 365],
  ].forEach(([label, days]) => {
    const active = chartFrom === lastNDaysIso(days as number) && chartTo === "";
    const btn = btnWrap.createEl("button", { text: String(label), attr: { style: `${active ? `background:rgba(96,165,250,0.15);color:${C.blue};border:1px solid ${C.blue};` : `background:transparent;color:${C.muted};border:1px solid ${C.border};`}border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;font-family:${F};` } });
    btn.addEventListener("click", () => onChartRange(lastNDaysIso(days as number), ""));
  });
  const allBtn = btnWrap.createEl("button", { text: "All", attr: { style: `${!chartFrom && !chartTo ? `background:rgba(96,165,250,0.15);color:${C.blue};border:1px solid ${C.blue};` : `background:transparent;color:${C.muted};border:1px solid ${C.border};`}border-radius:6px;padding:6px 10px;cursor:pointer;font-size:11px;font-family:${F};` } });
  allBtn.addEventListener("click", () => onChartRange("", ""));
  controls.createEl("div", { text: "Chart range", attr: { style: `color:${C.muted};font-size:11px;font-family:${F};` } });

  const highLowSeries = MarketMonitorMath.sortAscByDate(filterByDateRange(highLowRows, chartFrom || undefined, chartTo || undefined));
  const adSeries = MarketMonitorMath.sortAscByDate(filterByDateRange(adRows, chartFrom || undefined, chartTo || undefined));
  const summationValues = adSeries.map(r => r.summation);
  const summationSma10 = seriesSma(summationValues, 10);
  const latestMc = [...adSeries].reverse().find(r => r.mcclellan !== null)?.mcclellan ?? null;
  const latestSum = [...adSeries].reverse().find(r => r.summation !== null)?.summation ?? null;
  const latestSma = [...summationSma10].reverse().find(v => v !== null) ?? null;
  const latestHl = highLowSeries.length ? highLowSeries[highLowSeries.length - 1].net : null;
  const latestHigh = highLowSeries.length ? highLowSeries[highLowSeries.length - 1].high52 : 0;
  const latestLow = highLowSeries.length ? highLowSeries[highLowSeries.length - 1].low52 : 0;

  const stack = div(parent, "display:grid;grid-template-columns:1fr;gap:12px;");

  const mcoData = adSeries.filter(r => r.mcclellan !== null).map(r => ({ date: r.dateIso, value: r.mcclellan ?? 0 }));
  const sumPrimary = adSeries.map(r => ({ date: r.dateIso, value: r.summation }));
  const sumSecondary = adSeries.map((r, i) => ({ date: r.dateIso, value: summationSma10[i] }));
  const hlData = highLowSeries.map(r => ({ date: r.dateIso, value: r.net }));

  const mc = card(stack);
  cardTitle(mc, "McClellan Oscillator");
  if (adSeries.length < 39) {
    mc.createEl("div", { text: `Need at least 39 Advance/Decline rows to calculate McClellan Oscillator (${adSeries.length} loaded).`, attr: { style: `color:${C.muted};font-size:11px;` } });
  } else {
    addExpandLink(mc, "McClellan Oscillator", c => renderOscillatorHistogram(c, mcoData, latestMc === null ? "" : `MCO ${fmt(latestMc, 0)}`, [], 1100));
    renderOscillatorHistogram(
      mc,
      mcoData,
      latestMc === null ? "" : `MCO ${fmt(latestMc, 0)}`,
      [],
      900
    );
  }

  const si = card(stack);
  cardTitle(si, "Summation Index + 10 SMA");
  if (adSeries.length < 39) {
    si.createEl("div", { text: `Need at least 39 Advance/Decline rows to calculate Summation Index (${adSeries.length} loaded).`, attr: { style: `color:${C.muted};font-size:11px;` } });
  } else {
    addExpandLink(si, "Summation Index + 10 SMA", c => renderDualLineChart(c, sumPrimary, sumSecondary, latestSum === null ? "" : `MCSI ${fmt(latestSum, 0)}`, latestSum === null ? "MCSI" : `MCSI ${fmt(latestSum, 0)}`, latestSma === null ? "10 SMA" : `10 SMA ${fmt(latestSma, 0)}`, 1100));
    renderDualLineChart(
      si,
      sumPrimary,
      sumSecondary,
      latestSum === null ? "" : `MCSI ${fmt(latestSum, 0)}`,
      latestSum === null ? "MCSI" : `MCSI ${fmt(latestSum, 0)}`,
      latestSma === null ? "10 SMA" : `10 SMA ${fmt(latestSma, 0)}`,
      900
    );
  }

  const hl = card(stack);
  addExpandLink(hl, "52-Week H/L Oscillator", c => renderOscillatorHistogram(c, hlData, latestHl === null ? "" : `${fmt(latestHl, 0)} (${fmt(latestHigh, 0)}H / ${fmt(latestLow, 0)}L)`, [
      { label: "Net Highs", color: "#35d2a0" },
      { label: "Net Lows", color: "#ff7d72" },
    ], 1100));
  cardTitle(hl, "52-Week H/L Oscillator");
  renderOscillatorHistogram(
    hl,
    hlData,
    latestHl === null ? "" : `${fmt(latestHl, 0)} (${fmt(latestHigh, 0)}H / ${fmt(latestLow, 0)}L)`,
    [
      { label: "Net Highs", color: "#35d2a0" },
      { label: "Net Lows", color: "#ff7d72" },
    ],
    900
  );
}

function renderMarketMonitorView(
  container: HTMLElement,
  marketData: MarketMonitorDashboardData | null,
  visibleRows: number,
  onLoadMore: () => void,
  tableFrom: string,
  tableTo: string,
  onTableDateChange: (field: "from" | "to", value: string) => void,
  performanceVisibleRows: number,
  onPerformanceLoadMore: () => void,
  performanceDateFrom: string,
  performanceDateTo: string,
  onPerformanceDateChange: (field: "from" | "to", value: string) => void,
  chartFrom: string,
  chartTo: string,
  onChartRange: (from: string, to: string) => void
): void {
  if (!marketData) {
    const empty = card(container, "margin:12px 16px 16px;");
    cardTitle(empty, "Market Monitor");
    empty.createEl("div", { text: "Market Data.md could not be loaded or parsed.", attr: { style: `color:${C.muted};font-size:12px;` } });
    return;
  }

  const filteredRows = filterByDateRange(marketData.monitorRows, tableFrom || undefined, tableTo || undefined);
  const statsCard = card(container, "margin:12px 16px 0;");
  cardTitle(statsCard, "Market Monitor Stats");
  renderMarketMonitorStats(statsCard, filteredRows);

  const tableCard = card(container, "margin:12px 16px 0;");
  cardTitle(tableCard, "Market Monitor Table");
  renderMarketMonitorTable(tableCard, filteredRows, visibleRows, onLoadMore, tableFrom, tableTo, onTableDateChange);

  const performanceRows = filterByDateRange(marketData.performanceTrackRows, performanceDateFrom || undefined, performanceDateTo || undefined);
  const perfStats = card(container, "margin:12px 16px 0;");
  cardTitle(perfStats, "Performance Tracks Stats");
  renderPerformanceTrackStats(perfStats, performanceRows);

  const perfTable = card(container, "margin:12px 16px 0;");
  cardTitle(perfTable, "Performance Tracks");
  renderPerformanceTracksTable(perfTable, performanceRows, performanceVisibleRows, onPerformanceLoadMore, performanceDateFrom, performanceDateTo, onPerformanceDateChange);

  const chartCard = card(container, "margin:12px 16px 16px;");
  cardTitle(chartCard, "Breadth Charts");
  renderMarketCharts(chartCard, marketData.highLowRows, marketData.advanceDeclineRows, chartFrom, chartTo, onChartRange);
}

// ─── Main render ──────────────────────────────────────────────────────────────
export function renderDashboard(
  container: HTMLElement,
  stats: TradeStats,
  trades: Trade[],
  openRows: TradeRow[],
  openAnalytics: OpenPositionAnalytics,
  events: AccountEvent[],
  filters: TradeFilters,
  onFilterChange: (f:TradeFilters)=>void,
  openFile: (p:string)=>void,
  marketData: MarketMonitorDashboardData | null,
  state: DashboardRenderState
): void {
  container.style.cssText=`background:${C.bg};height:100%;display:flex;flex-direction:column;overflow:hidden;font-family:${F};color:${C.text};`;

  let tradeListData: Trade[] = trades;

  const redraw=()=>{
    container.empty();
    container.style.cssText=`background:${C.bg};height:100%;display:flex;flex-direction:column;overflow:hidden;font-family:${F};color:${C.text};`;

    // Header
    const hdr=div(container,`display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid ${C.border};background:${C.card};flex-shrink:0;position:sticky;top:0;z-index:50;`);
    hdr.createEl("div",{text:"Trading Dashboard",attr:{style:`color:${C.text};font-size:18px;font-weight:700;font-family:${F};`}});
    const hRight=div(hdr,"display:flex;align-items:center;gap:8px;flex-wrap:wrap;");
    hRight.createEl("div",{text:`${trades.length} total trades`,attr:{style:`color:${C.muted};font-size:11px;`}});

    const actTab=`background:rgba(96,165,250,0.15);color:${C.blue};border:1px solid ${C.blue};border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:${F};`;
    const inTab =`background:transparent;color:${C.muted};border:1px solid ${C.border};border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:${F};`;
    const dashBtn  =hRight.createEl("button",{text:"Dashboard",attr:{style:state.activeTab==="dashboard"?actTab:inTab}});
    const tradesBtn=hRight.createEl("button",{text:"Trades",attr:{style:state.activeTab==="trades"?actTab:inTab}});
    const marketBtn=hRight.createEl("button",{text:"Market Monitor",attr:{style:state.activeTab==="market"?actTab:inTab}});
    dashBtn.addEventListener("click",()=>{ state.activeTab="dashboard"; redraw(); });
    tradesBtn.addEventListener("click",()=>{ state.activeTab="trades"; tradeListData=trades; redraw(); });
    marketBtn.addEventListener("click",()=>{ state.activeTab="market"; redraw(); });

    const onShowTrades=(t:Trade[])=>{ state.activeTab="trades"; tradeListData=t; redraw(); };

    if(state.activeTab!=="market") renderFilters(container, trades, filters, (f)=>{ onFilterChange(f); });

    const content = div(container, "flex:1;min-height:0;overflow-y:auto;");

    if(state.activeTab==="trades"){
      renderTradesList(div(content,"padding:16px;height:100%;box-sizing:border-box;"), tradeListData, openFile);
      return;
    }
    if(state.activeTab==="market"){
      renderMarketMonitorView(
        content,
        marketData,
        state.marketVisibleRows,
        ()=>{ state.marketVisibleRows += 5; redraw(); },
        state.marketDateFrom,
        state.marketDateTo,
        (field, value)=>{ if(field==="from") state.marketDateFrom=value; else state.marketDateTo=value; state.marketVisibleRows=20; redraw(); },
        state.performanceVisibleRows,
        ()=>{ state.performanceVisibleRows += 5; redraw(); },
        state.performanceDateFrom,
        state.performanceDateTo,
        (field, value)=>{ if(field==="from") state.performanceDateFrom=value; else state.performanceDateTo=value; state.performanceVisibleRows=15; redraw(); },
        state.chartDateFrom,
        state.chartDateTo,
        (from, to)=>{ state.chartDateFrom=from; state.chartDateTo=to; redraw(); }
      );
      return;
    }

    renderStatsBar(content, stats, trades, openAnalytics, onShowTrades, openFile);

    const filteredOpenRows = filterOpenRows(openRows, filters);
    const op=card(content,"margin:0 16px 0;");
    cardTitle(op,"Open Positions vs Cash");
    renderOpenPositionsPie(op, filteredOpenRows, stats.current_balance, openFile);

    const od=card(content,"margin:12px 16px 0;");
    cardTitle(od,"Open Position Details");
    renderOpenPositionDetails(od, openAnalytics, openFile);

    // Row 1: Equity + Drawdown
    const g1=div(content,"display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px 0;");
    const eq=card(g1);
    addExpandBtn(eq,"Equity Curve",(c)=>renderEquity(c,stats.equity_curve,900));
    cardTitle(eq,"Equity Curve");
    renderEquity(eq,stats.equity_curve);
    const dd=card(g1);
    addExpandBtn(dd,"Drawdown",(c)=>renderDrawdown(c,stats.drawdown_curve,900));
    cardTitle(dd,"Drawdown");
    renderDrawdown(dd,stats.drawdown_curve);

    // Row 2: Monthly bars + Streak
    const g2=div(content,"display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 16px 0;");
    const mb=card(g2); cardTitle(mb,"Monthly P&L");       renderMonthlyBars(mb,stats.monthly_pnl,trades,onShowTrades);
    const sk=card(g2); cardTitle(sk,"Win/Loss Streak");   renderStreak(sk,stats.streak,trades,onShowTrades);

    // Largest win/loss
    const lw=card(content,"margin:12px 16px 0;");
    cardTitle(lw,"Largest Win & Loss");
    renderLargest(lw,stats,openFile);

    // Calendar
    const cal=card(content,"margin:12px 16px 0;overflow-x:auto;");
    cardTitle(cal,"P&L Calendar");
    renderCalendar(cal,stats.daily_pnl,stats.weekly_pnl,trades,openFile,onShowTrades);

    // Row 3: Time slots + Duration
    const g3=div(content,"display:grid;grid-template-columns:3fr 2fr;gap:12px;padding:12px 16px 0;");
    const ts=card(g3); cardTitle(ts,"Entry Time Performance (13:00–22:00, 30min)"); renderTimeSlots(ts,stats.pnl_by_slot);
    const dr=card(g3); cardTitle(dr,"Trade Duration");                               renderDuration(dr,stats.duration_by_outcome);

    // Strategy table
    const st=card(content,"margin:12px 16px 0;");
    cardTitle(st,"Strategy Breakdown");
    renderStrategyTable(st,stats,trades,onShowTrades);

    // Grade breakdown
    const gr=card(content,"margin:12px 16px 0;");
    cardTitle(gr,"Grade Breakdown");
    renderGrades(gr,stats,trades,onShowTrades);

    // Market correlation
    const mc=card(content,"margin:12px 16px 16px;");
    addExpandBtn(mc,"Market Conditions vs P&L",(c)=>renderCorrelation(c,stats.market_correlation,900));
    cardTitle(mc,"Market Conditions vs P&L");
    renderCorrelation(mc,stats.market_correlation);
  };

  redraw();
}
