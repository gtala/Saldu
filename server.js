/**
 * Dashboard de gastos por mes (Google Sheets) + health.
 */
const http = require("http");
const https = require("https");
const { fetchMonthlyTotals } = require("./sheets");

const DOLAR_CRIPTO_URL = "https://dolarapi.com/v1/dolares/cripto";

function fetchDolarCriptoJson() {
  return new Promise((resolve, reject) => {
    const req = https.get(
      DOLAR_CRIPTO_URL,
      { headers: { Accept: "application/json", "User-Agent": "gastos-web-preview/1" } },
      (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`DolarApi HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("timeout DolarApi"));
    });
  });
}

const PORT = Number(process.env.PORT) || 3847;
const HOST = process.env.HOST || "127.0.0.1";

function dashboardHtml() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#0a0c10" />
  <title>Gastos y patrimonio</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"><\/script>
  <style>
    :root {
      --bg: #080a0e;
      --card: #11151c;
      --border: #2a3344;
      --text: #eef1f5;
      --muted: #94a3b8;
      --font: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
      --display: "Fraunces", Georgia, "Times New Roman", serif;
      --radius: 16px;
      --radius-sm: 12px;
      --shadow: 0 12px 40px rgba(0,0,0,0.35);
    }
    html { -webkit-text-size-adjust: 100%; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      -webkit-tap-highlight-color: transparent;
      padding-left: env(safe-area-inset-left, 0);
      padding-right: env(safe-area-inset-right, 0);
      padding-bottom: env(safe-area-inset-bottom, 0);
      background-image:
        radial-gradient(ellipse 120% 80% at 50% -20%, rgba(45, 106, 79, 0.16), transparent 50%),
        radial-gradient(ellipse 100% 60% at 100% 100%, rgba(120, 80, 40, 0.08), transparent 45%);
    }
    .wrap {
      max-width: 1100px;
      margin: 0 auto;
      padding: max(1rem, env(safe-area-inset-top, 12px)) max(1.15rem, env(safe-area-inset-right, 12px)) 2.25rem max(1.15rem, env(safe-area-inset-left, 12px));
    }
    header {
      margin-bottom: 1.35rem;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1.1rem;
    }
    .header-text { flex: 1 1 280px; min-width: 0; }
    .dashboard-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .view-tabs {
      display: inline-flex;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #1e2530;
      background: #0a0d12;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .view-tabs button {
      appearance: none;
      border: none;
      border-right: 1px solid #1e2530;
      background: #121820;
      color: #8b9aaf;
      padding: 0.55rem 1rem;
      font-size: 0.86rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      min-height: 44px;
      line-height: 1.2;
      transition: background 0.15s, color 0.15s;
    }
    .view-tabs button:last-child { border-right: none; }
    .view-tabs button:hover { color: #cbd5e1; background: #171d27; }
    .view-tabs button[aria-selected="true"] {
      background: #81c784;
      color: #0d120f;
    }
    .view-tabs button[aria-selected="true"]:hover { background: #7cb87e; color: #0a0e0c; }
    .view-tabs button:focus-visible {
      outline: 2px solid #81c784;
      outline-offset: 2px;
      z-index: 1;
    }
    .toolbar-month {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .toolbar-month label {
      font-size: 0.8rem;
      color: var(--muted);
      font-weight: 500;
    }
    .toolbar-month select {
      appearance: none;
      -webkit-appearance: none;
      background-color: var(--card);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.55rem 2rem 0.55rem 0.75rem;
      border-radius: var(--radius-sm);
      font-family: inherit;
      font-size: 0.9rem;
      font-weight: 600;
      min-height: 42px;
      line-height: 1.2;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      background-image:
        linear-gradient(45deg, transparent 50%, #9fb0c7 50%),
        linear-gradient(135deg, #9fb0c7 50%, transparent 50%);
      background-position:
        calc(100% - 14px) calc(50% - 1px),
        calc(100% - 9px) calc(50% - 1px);
      background-size: 5px 5px, 5px 5px;
      background-repeat: no-repeat;
    }
    .toolbar-month select:focus {
      outline: none;
      border-color: rgba(82, 183, 136, 0.55);
      box-shadow: 0 0 0 3px rgba(82, 183, 136, 0.2);
    }
    .toolbar-month[hidden] { display: none !important; }
    .currency-toolbar {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .currency-toggle {
      display: inline-flex;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #1e2530;
      background: #0a0d12;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .currency-toggle button {
      appearance: none;
      border: none;
      border-right: 1px solid #1e2530;
      background: #121820;
      color: #8b9aaf;
      padding: 0.45rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      min-height: 40px;
      line-height: 1.2;
      transition: background 0.15s, color 0.15s;
    }
    .currency-toggle button:last-child { border-right: none; }
    .currency-toggle button:hover { color: #cbd5e1; background: #171d27; }
    .currency-toggle button[aria-pressed="true"] {
      background: #3d5a80;
      color: #e8eef5;
    }
    .currency-toggle button[aria-pressed="true"]:hover { background: #354d6e; }
    .currency-toggle button:focus-visible {
      outline: 2px solid #81c784;
      outline-offset: 2px;
      z-index: 1;
    }
    .currency-toggle button:disabled {
      opacity: 0.55;
      cursor: wait;
    }
    .currency-meta {
      font-size: 0.72rem;
      color: var(--muted);
      max-width: 18rem;
      line-height: 1.35;
    }
    .currency-meta[hidden] { display: none !important; }
    .view-panel { margin-bottom: 0.25rem; }
    .view-panel[hidden] { display: none !important; }
    .empty-income {
      color: var(--muted);
      font-size: 0.92rem;
      line-height: 1.5;
      margin: 0;
    }
    h1 {
      font-family: var(--display);
      font-weight: 600;
      font-size: clamp(1.35rem, 4.5vw, 1.75rem);
      letter-spacing: -0.03em;
      margin: 0 0 0.5rem;
      line-height: 1.15;
    }
    .sub {
      color: var(--muted);
      font-size: 0.94rem;
      line-height: 1.55;
      max-width: 38rem;
      margin: 0;
      font-weight: 400;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      flex: 0 1 auto;
    }
    .toolbar label { font-size: 0.8rem; color: var(--muted); font-weight: 500; }
    .toolbar select {
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.55rem 0.95rem;
      border-radius: var(--radius-sm);
      font-family: inherit;
      font-size: 0.92rem;
      min-width: 11rem;
      min-height: 44px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .toolbar select:focus {
      outline: none;
      border-color: rgba(82, 183, 136, 0.55);
      box-shadow: 0 0 0 3px rgba(82, 183, 136, 0.2);
    }
    .legend {
      display: flex; align-items: center; gap: 0.5rem; font-size: 0.74rem; color: var(--muted);
      white-space: nowrap;
    }
    .legend-bar {
      width: min(120px, 28vw); height: 8px; border-radius: 999px;
      background: linear-gradient(90deg, #1e3d32 0%, #c94a4a 100%);
      box-shadow: inset 0 1px 2px rgba(0,0,0,0.25);
    }
    .gastos-section {
      margin-top: 0.25rem;
    }
    .gastos-section-title {
      font-family: var(--display);
      font-size: 1.02rem;
      font-weight: 600;
      color: #cbd5e1;
      margin: 0 0 0.65rem;
      letter-spacing: -0.02em;
    }
    .month-total-panel {
      margin: 0 0 0.8rem;
      padding: 0.9rem 0.95rem 0.8rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: linear-gradient(170deg, rgba(19,24,34,.95) 0%, rgba(12,16,23,.95) 100%);
    }
    .month-total-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.8rem;
      flex-wrap: wrap;
      margin-bottom: 0.55rem;
    }
    .month-total-label {
      color: var(--muted);
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      text-transform: uppercase;
    }
    .month-total-value {
      color: #e8f1ff;
      font-size: clamp(1rem, 3.6vw, 1.28rem);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
    }
    .month-total-sub {
      color: var(--muted);
      font-size: 0.76rem;
      line-height: 1.35;
    }
    .month-ruler-track {
      position: relative;
      height: 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.07);
    }
    .month-ruler-fill {
      position: absolute;
      inset: 0 auto 0 0;
      width: 0%;
      background: linear-gradient(90deg, #2d6a4f 0%, #7bc67f 55%, #d5cf68 100%);
    }
    .month-ruler-ticks {
      position: relative;
      margin-top: 0.38rem;
      height: 18px;
      overflow: hidden;
      padding: 0 2px;
    }
    .month-ruler-tick {
      position: absolute;
      top: 0;
      width: 1px;
      height: 8px;
      background: rgba(255,255,255,0.35);
      transform: translateX(-0.5px);
    }
    .month-ruler-tick-label {
      position: absolute;
      top: 8px;
      transform: translateX(-50%);
      color: var(--muted);
      font-size: 0.64rem;
      line-height: 1;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .month-ruler-tick-label.is-start {
      transform: translateX(0);
    }
    .month-ruler-tick-label.is-end {
      transform: translateX(-100%);
    }

    .month-balance-panel {
      margin: 0 0 0.85rem;
      padding: 1rem 1.05rem 0.95rem;
      border-radius: var(--radius-sm);
      border: 2px solid rgba(255,255,255,0.12);
      background: linear-gradient(165deg, rgba(22,28,38,.98) 0%, rgba(12,16,23,.98) 100%);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .month-balance-panel.is-surplus {
      border-color: rgba(82, 183, 136, 0.7);
      box-shadow: 0 0 32px rgba(46, 125, 80, 0.28), inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .month-balance-panel.is-deficit {
      border-color: rgba(232, 93, 111, 0.6);
      box-shadow: 0 0 32px rgba(201, 74, 74, 0.22), inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .month-balance-panel.is-even-panel {
      border-color: rgba(148, 163, 184, 0.35);
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }
    .balance-pill {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0.28rem 0.55rem;
      border-radius: 999px;
      margin-bottom: 0.45rem;
    }
    .is-surplus .balance-pill { background: rgba(82, 183, 136, 0.22); color: #b8f0cd; }
    .is-deficit .balance-pill { background: rgba(232, 93, 111, 0.2); color: #f5c2c9; }
    .is-even-panel .balance-pill { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; }
    .balance-net-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 0.65rem;
    }
    .balance-net-label { color: var(--muted); font-size: 0.8rem; font-weight: 600; }
    .balance-net-value {
      font-size: clamp(1.35rem, 6.5vw, 2.45rem);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      line-height: 1.05;
      letter-spacing: -0.02em;
    }
    .is-surplus .balance-net-value { color: #7dd89a; }
    .is-deficit .balance-net-value { color: #f5a0aa; }
    .balance-net-value.is-even { color: #cbd5e1; }
    .balance-split-wrap { margin-top: 0.2rem; }
    .balance-split-labels {
      display: flex; justify-content: space-between;
      font-size: 0.74rem; color: var(--muted); margin-bottom: 0.35rem;
    }
    .balance-split-track {
      display: flex;
      height: 16px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .balance-split-ing {
      background: linear-gradient(90deg, #1b4332, #52b788);
      min-width: 0;
      transition: width 0.4s ease;
    }
    .balance-split-gas {
      background: linear-gradient(90deg, #7f1d1d, #e85d6f);
      min-width: 0;
      transition: width 0.4s ease;
    }
    .balance-bars-detail {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem 0.75rem;
      margin-top: 0.7rem;
      font-size: 0.78rem;
      color: #c5d0de;
    }
    .balance-bars-detail strong { font-variant-numeric: tabular-nums; color: #e8f0f8; }
    .treemap-wrap {
      background: linear-gradient(165deg, #141a24 0%, #0e1218 100%);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      min-height: 280px;
      padding: 12px;
      box-shadow: var(--shadow);
    }
    .treemap-host { width: 100%; min-height: 260px; }
    #treemap-root { width: 100%; display: block; max-width: 100%; }
    .treemap-wrap svg { display: block; width: 100%; height: auto; vertical-align: top; border-radius: 10px; }
    .treemap-wrap .cell-rect { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25)); }
    .treemap-wrap .cell { cursor: pointer; }
    .treemap-wrap .cell:focus-visible .cell-rect,
    .treemap-wrap .cell-rect.is-selected {
      stroke: rgba(255,255,255,0.75);
      stroke-width: 2.2;
    }
    .cell-label { pointer-events: none; fill: rgba(255,255,255,0.92); font-weight: 600; }
    .cell-sub { pointer-events: none; fill: rgba(255,255,255,0.72); font-weight: 500; }
    .category-detail {
      margin-top: 0.9rem;
      padding: 0.95rem 1rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
      background: rgba(17, 21, 28, 0.82);
    }
    .category-detail[hidden] { display: none !important; }
    .cat-detail-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.7rem;
      flex-wrap: wrap;
    }
    .cat-detail-title {
      font-weight: 700;
      color: #dbe5f1;
      font-size: 0.95rem;
    }
    .cat-detail-meta {
      color: var(--muted);
      font-size: 0.8rem;
    }
    .cat-detail-close {
      appearance: none;
      border: 1px solid var(--border);
      background: #111722;
      color: #cbd5e1;
      border-radius: 8px;
      padding: 0.35rem 0.6rem;
      font-size: 0.78rem;
      cursor: pointer;
      min-height: 34px;
    }
    .cat-detail-close:hover { background: #172130; }
    .cat-detail-list {
      display: grid;
      gap: 0.45rem;
      max-height: 260px;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      padding-right: 2px;
    }
    .cat-detail-row {
      display: grid;
      grid-template-columns: 98px minmax(0, 1fr) auto;
      gap: 0.55rem;
      align-items: center;
      font-size: 0.82rem;
      border-bottom: 1px dashed rgba(255,255,255,0.08);
      padding-bottom: 0.38rem;
    }
    .cat-detail-row:last-child { border-bottom: none; padding-bottom: 0; }
    .cat-date { color: var(--muted); font-variant-numeric: tabular-nums; }
    .cat-desc { color: #d7deea; overflow-wrap: anywhere; }
    .cat-amt { color: #eaf1fb; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .loader {
      padding: 3rem 1.25rem;
      text-align: center;
      color: var(--muted);
      font-size: 0.95rem;
    }
    .error {
      background: rgba(232, 93, 111, 0.12);
      border: 1px solid rgba(232, 93, 111, 0.35);
      color: #f0b4bc;
      padding: 1rem 1.25rem;
      border-radius: var(--radius-sm);
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .error code { font-size: 0.82rem; background: rgba(0,0,0,.25); padding: 0.15rem 0.4rem; border-radius: 4px; }
    .hint { font-size: 0.85rem; color: var(--warn, #d4a574); margin-top: 0.75rem; }
    .empty { color: var(--muted); text-align: center; padding: 2.5rem 1.25rem; line-height: 1.55; font-size: 0.95rem; }
    .income-panel {
      margin-bottom: 1.25rem;
      padding: 1.1rem 1.2rem;
      background: rgba(45, 106, 79, 0.12);
      border: 1px solid rgba(45, 106, 79, 0.35);
      border-radius: var(--radius);
      box-shadow: 0 4px 24px rgba(0,0,0,0.2);
    }
    .income-panel h2 {
      font-family: var(--display);
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0 0 0.65rem;
      color: #a8d4ba;
    }
    .income-total { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--text); }
    .income-bars { display: flex; flex-direction: column; gap: 0.5rem; }
    .income-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.75rem; align-items: center; font-size: 0.88rem; }
    .income-row .bar-wrap {
      height: 10px;
      background: rgba(255,255,255,0.06);
      border-radius: 5px;
      overflow: hidden;
    }
    .income-row .bar-fill {
      height: 100%;
      border-radius: 5px;
      background: linear-gradient(90deg, #2d6a4f, #52b788);
      min-width: 4px;
    }
    .income-row .amt { color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .income-block { margin-bottom: 0.65rem; }
    .income-block:last-child { margin-bottom: 0; }
    .patrimonio-panel {
      margin-bottom: 1.35rem;
      padding: 1.15rem 1.25rem;
      background: rgba(201, 162, 39, 0.08);
      border: 1px solid rgba(201, 162, 39, 0.35);
      border-radius: var(--radius);
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    }
    .patrimonio-panel h2 {
      font-family: var(--display);
      font-size: 1.08rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
      color: #e8c96b;
    }
    .patrimonio-panel .pat-sub { font-size: 0.82rem; color: var(--muted); margin: 0 0 1rem; line-height: 1.45; }
    .patrimonio-latest {
      font-size: 1.25rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      margin-bottom: 1rem;
      color: var(--text);
    }
    .patrimonio-chart-wrap { width: 100%; overflow-x: auto; margin-bottom: 1rem; }
    .patrimonio-chart-wrap svg { display: block; max-width: 100%; height: auto; }
    .patrimonio-line { fill: none; stroke: #e8c96b; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
    .patrimonio-dot { fill: #fff4d4; stroke: #e8c96b; stroke-width: 2; cursor: pointer; }
    .patrimonio-dot.is-selected { fill: #ffe59b; stroke: #fff3ce; stroke-width: 2.6; }
    .patrimonio-axis text { fill: var(--muted); font-size: 0.72rem; }
    .patrimonio-axis line, .patrimonio-axis path { stroke: var(--border); }
    .patrimonio-detail {
      margin: 0 0 1rem;
      padding: 0.85rem 0.9rem;
      border-radius: var(--radius-sm);
      border: 1px solid rgba(232, 201, 107, 0.34);
      background: rgba(16, 19, 26, 0.78);
    }
    .patrimonio-detail[hidden] { display: none !important; }
    .patrimonio-detail-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.7rem;
      flex-wrap: wrap;
      margin-bottom: 0.7rem;
    }
    .patrimonio-detail-title {
      color: #f6e7b8;
      font-size: 0.92rem;
      font-weight: 700;
    }
    .patrimonio-detail-meta { color: var(--muted); font-size: 0.78rem; }
    .patrimonio-detail-close {
      appearance: none;
      border: 1px solid var(--border);
      background: #111722;
      color: #cbd5e1;
      border-radius: 8px;
      padding: 0.32rem 0.58rem;
      font-size: 0.76rem;
      cursor: pointer;
      min-height: 34px;
    }
    .patrimonio-detail-close:hover { background: #172130; }
    .patrimonio-detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.45rem 0.7rem;
    }
    .patrimonio-kv {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.6rem;
      border-bottom: 1px dashed rgba(255,255,255,0.08);
      padding-bottom: 0.22rem;
    }
    .patrimonio-kv .k { color: var(--muted); font-size: 0.76rem; }
    .patrimonio-kv .v { color: #eaf1fb; font-size: 0.84rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .patrimonio-detail-note {
      margin-top: 0.55rem;
      color: #cdd6e3;
      font-size: 0.78rem;
      line-height: 1.38;
      overflow-wrap: anywhere;
    }
    .patrimonio-detail-ref {
      margin-top: 0.42rem;
      color: var(--muted);
      font-size: 0.74rem;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .patrimonio-table-wrap { overflow-x: auto; border-radius: var(--radius-sm); border: 1px solid var(--border); -webkit-overflow-scrolling: touch; }
    .patrimonio-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .patrimonio-table th, .patrimonio-table td { padding: 0.55rem 0.65rem; text-align: right; border-bottom: 1px solid var(--border); }
    .patrimonio-table th { background: rgba(0,0,0,.2); color: #c9d2dc; font-weight: 600; text-align: right; white-space: nowrap; }
    .patrimonio-table th:first-child, .patrimonio-table td:first-child { text-align: left; }
    .patrimonio-table tr:last-child td { border-bottom: none; }
    .patrimonio-table tbody tr { cursor: pointer; }
    .patrimonio-table tbody tr:hover { background: rgba(255,255,255,0.03); }
    .patrimonio-table tbody tr.is-selected { background: rgba(232, 201, 107, 0.12); }
    .patrimonio-table .note { max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
    footer {
      margin-top: 1.5rem;
      font-size: 0.78rem;
      color: var(--muted);
      text-align: center;
      line-height: 1.5;
      padding: 0 0.5rem;
      word-break: break-word;
    }
    @media (max-width: 640px) {
      header {
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        text-align: center;
        margin-bottom: 0.85rem;
      }
      /* En desktop, 280px es el ancho mínimo de la columna; en columna móvil el
         mismo flex-basis se aplica al eje vertical y fuerza ~280px de alto vacío. */
      .header-text {
        text-align: center;
        flex: 0 1 auto;
        min-height: 0;
      }
      .sub { display: none; }
      .toolbar {
        justify-content: center;
        padding: 0.35rem 0;
      }
      .toolbar select {
        min-width: 0;
        flex: 1 1 100%;
        max-width: 100%;
      }
      .toolbar-month {
        justify-content: center;
        gap: 0.5rem;
      }
      .toolbar-month label { width: 100%; text-align: center; }
      .toolbar-month select {
        width: min(180px, 70vw);
        min-width: 0;
        font-size: 0.88rem;
      }
      .month-total-panel { padding: 0.75rem 0.72rem 0.72rem; }
      .month-balance-panel { padding: 0.75rem 0.72rem 0.8rem; margin-bottom: 0.65rem; }
      .balance-net-value { font-size: clamp(1.2rem, 7vw, 1.85rem); }
      .month-total-value { font-size: 1.08rem; }
      .month-total-label { font-size: 0.74rem; }
      .month-ruler-tick-label { font-size: 0.6rem; }
      .legend { display: none; }
      .gastos-section-title { text-align: center; }
      .treemap-wrap { padding: 10px; min-height: 240px; }
      .month-total-sub { display: none; }
      .patrimonio-latest { font-size: 1.1rem; }
      .patrimonio-panel .pat-sub { font-size: 0.88rem; }
      .patrimonio-detail { padding: 0.72rem 0.72rem; }
      .patrimonio-detail-grid { grid-template-columns: minmax(0, 1fr); }
      .dashboard-bar {
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: 0.75rem;
        margin-bottom: 0.85rem;
      }
      .view-tabs { width: 100%; justify-content: stretch; }
      .view-tabs button { flex: 1 1 0; min-width: 0; padding-left: 0.5rem; padding-right: 0.5rem; font-size: 0.8rem; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="header-text">
        <h1>Gastos y patrimonio</h1>
        <p class="sub">Elegí una vista con los botones de abajo. <strong>Patrimonio</strong> (USD) · <strong>Ingresos</strong> y <strong>Gastos</strong> usan el mes seleccionado; podés ver montos en <strong>ARS</strong> o <strong>USD</strong> (dólar cripto del día).</p>
      </div>
    </header>
    <nav class="dashboard-bar" aria-label="Vista principal">
      <div class="view-tabs" role="tablist" aria-label="Cambiar vista">
        <button type="button" role="tab" id="tab-patrimonio" data-view="patrimonio" aria-selected="false" aria-controls="panel-patrimonio">Patrimonio</button>
        <button type="button" role="tab" id="tab-ingresos" data-view="ingresos" aria-selected="false" aria-controls="panel-ingresos">Ingresos</button>
        <button type="button" role="tab" id="tab-gastos" data-view="gastos" aria-selected="true" aria-controls="panel-gastos">Gastos</button>
      </div>
      <div class="toolbar-month" id="toolbar-month">
        <label for="month-sel">Mes</label>
        <select id="month-sel" disabled><option>Cargando…</option></select>
        <div class="currency-toolbar">
          <div class="currency-toggle" role="group" aria-label="Moneda (gastos e ingresos)">
            <button type="button" id="cur-ars" data-currency="ARS" aria-pressed="true">ARS</button>
            <button type="button" id="cur-usd" data-currency="USD" aria-pressed="false">USD</button>
          </div>
          <span class="currency-meta" id="currency-meta" hidden></span>
        </div>
        <div class="legend" id="legend-gastos" title="Escala de color respecto al máximo del mes (gastos)">
          <span>Menos</span><div class="legend-bar" aria-hidden="true"></div><span>Más</span>
        </div>
      </div>
    </nav>
    <div id="panel-patrimonio" class="view-panel" role="tabpanel" aria-labelledby="tab-patrimonio" hidden>
      <div id="patrimonio-wrap"></div>
    </div>
    <div id="panel-ingresos" class="view-panel" role="tabpanel" aria-labelledby="tab-ingresos" hidden>
      <div id="income-wrap"></div>
    </div>
    <section id="panel-gastos" class="view-panel gastos-section" role="tabpanel" aria-labelledby="tab-gastos">
      <h2 id="gastos-cat-title" class="gastos-section-title">Gastos por categoría</h2>
      <div id="month-balance" class="month-balance-panel" hidden></div>
      <div id="month-total" class="month-total-panel" hidden></div>
      <div class="treemap-wrap">
        <div id="root" class="treemap-host"><div class="loader">Cargando…</div></div>
      </div>
      <div id="cat-detail" class="category-detail" hidden></div>
    </section>
    <footer id="foot"></footer>
  </div>
  <script>
    var payload = null;

    function apiUrl() {
      var p = window.location.pathname;
      if (!p.endsWith('/')) p += '/';
      return p + 'api/resumen';
    }
    function cotizacionUrl() {
      var p = window.location.pathname;
      if (!p.endsWith('/')) p += '/';
      return p + 'api/cotizacion-cripto';
    }
    function fmt(n) {
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
    }
    function fmtUsd(n) {
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    }
    function fmtUsdCripto(usd) {
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(usd);
    }
    var cotizacionCache = null;
    window.__currency = 'ARS';
    window.__selectedSnapshotKey = '';
    function getVentaCripto() {
      if (!cotizacionCache) return null;
      var v = cotizacionCache.venta;
      if (typeof v === 'string') v = parseFloat(String(v).replace(',', '.'));
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
      return v;
    }
    function formatMoneyArs(ars) {
      if (window.__currency !== 'USD') return fmt(ars);
      var v = getVentaCripto();
      if (v == null) return fmt(ars);
      return fmtUsdCripto(ars / v);
    }
    function displayAmountFromArs(ars) {
      if (window.__currency !== 'USD') return Number(ars) || 0;
      var v = getVentaCripto();
      if (v == null || !Number.isFinite(v) || v <= 0) return Number(ars) || 0;
      return (Number(ars) || 0) / v;
    }
    async function fetchCotizacionCripto() {
      var r = await fetch(cotizacionUrl(), { cache: 'no-store' });
      if (!r.ok) {
        var errJ = {};
        try { errJ = await r.json(); } catch (e2) {}
        throw new Error(errJ.message || errJ.error || ('HTTP ' + r.status));
      }
      cotizacionCache = await r.json();
      return cotizacionCache;
    }
    function updateCurrencyMeta() {
      var el = document.getElementById('currency-meta');
      if (!el) return;
      if (window.__currency !== 'USD') {
        el.hidden = true;
        el.textContent = '';
        return;
      }
      el.hidden = false;
      var vn = getVentaCripto();
      if (vn == null) {
        el.textContent = 'Dólar cripto: cargando…';
        return;
      }
      var fu = cotizacionCache.fechaActualizacion || '';
      var fuTxt = '';
      if (fu) {
        try {
          var d = new Date(fu);
          fuTxt = ' · actualizado ' + d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
        } catch (e) { fuTxt = ''; }
      }
      el.textContent = 'USD al tipo dólar cripto (venta): ' + fmt(vn) + ' por USD' + fuTxt;
    }
    function setCurrencyButtons() {
      var a = document.getElementById('cur-ars');
      var u = document.getElementById('cur-usd');
      if (a) { a.setAttribute('aria-pressed', window.__currency === 'ARS' ? 'true' : 'false'); }
      if (u) { u.setAttribute('aria-pressed', window.__currency === 'USD' ? 'true' : 'false'); }
    }
    async function applyCurrencyChoice(next) {
      if (next !== 'ARS' && next !== 'USD') return;
      var usdBtn = document.getElementById('cur-usd');
      var arsBtn = document.getElementById('cur-ars');
      if (next === 'USD') {
        if (usdBtn) usdBtn.disabled = true;
        try {
          await fetchCotizacionCripto();
          window.__currency = 'USD';
          try { localStorage.setItem('dashboardCurrency', 'USD'); } catch (e) {}
        } catch (e) {
          window.__currency = 'ARS';
          if (arsBtn) arsBtn.setAttribute('aria-pressed', 'true');
          if (usdBtn) usdBtn.setAttribute('aria-pressed', 'false');
          alert('No se pudo obtener la cotización dólar cripto. Seguimos en ARS.' + String.fromCharCode(10) + (e.message || e));
          try { localStorage.setItem('dashboardCurrency', 'ARS'); } catch (e2) {}
        }
        if (usdBtn) usdBtn.disabled = false;
      } else {
        window.__currency = 'ARS';
        try { localStorage.setItem('dashboardCurrency', 'ARS'); } catch (e) {}
      }
      setCurrencyButtons();
      updateCurrencyMeta();
      refreshChartsForView();
    }
    function escapeHtml(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }
    function heatFill(v, maxV) {
      if (maxV <= 0) return '#1e3d32';
      var t = Math.min(1, v / maxV);
      var h = 155 - t * 118;
      var s = 38 + t * 42;
      var l = 24 + t * 18;
      return 'hsl(' + h + ' ' + s + '% ' + l + '%)';
    }
    function renderPatrimonio() {
      var el = document.getElementById('patrimonio-wrap');
      if (!el || !payload) return;
      var p = payload.patrimonio || {};
      var sn = (p.snapshots || []).slice();
      var err = p.error;
      if (err === 'sin_pestana_patrimonio' && sn.length === 0) {
        el.innerHTML = '<section class="patrimonio-panel" aria-label="Patrimonio"><h2>Patrimonio</h2><p class="pat-sub">No se encontró la pestaña <strong>Patrimonio</strong> en la planilla. Creala con el script o a mano para ver la evolución.</p></section>';
        return;
      }
      if (err && sn.length === 0) {
        el.innerHTML = '<section class="patrimonio-panel"><h2>Patrimonio</h2><p class="pat-sub">' + escapeHtml(err) + '</p></section>';
        return;
      }
      if (sn.length === 0) {
        el.innerHTML = '<section class="patrimonio-panel"><h2>Patrimonio</h2><p class="pat-sub">Todavía no hay filas de snapshot en la pestaña Patrimonio.</p></section>';
        return;
      }
      var last = sn[sn.length - 1];
      var chartW = Math.max(280, (el.parentElement && el.parentElement.clientWidth) ? el.parentElement.clientWidth - 32 : 600);
      var margin = { top: 10, right: 12, bottom: 34, left: 52 };
      var innerW = chartW - margin.left - margin.right;
      var innerH = 200;
      var h = innerH + margin.top + margin.bottom;

      function rowDate(d) {
        var t = d.fechaSort;
        if (t) return new Date(t);
        var x = Date.parse(d.fecha);
        return Number.isNaN(x) ? new Date() : new Date(x);
      }
      function snapshotKey(d) {
        return String(d.fecha || '') + '|' + String(d.fechaSort || '');
      }
      var dates = sn.map(rowDate);
      var x0 = d3.min(dates);
      var x1 = d3.max(dates);
      if (x0.getTime() === x1.getTime()) {
        x0 = d3.timeDay.offset(x0, -10);
        x1 = d3.timeDay.offset(x1, 10);
      }
      var yMax = d3.max(sn, function(d) { return d.netoUsd; }) || 1;
      var yMin = Math.min(0, d3.min(sn, function(d) { return d.netoUsd; }) || 0);
      var x = d3.scaleTime().domain([x0, x1]).range([0, innerW]);
      var y = d3.scaleLinear().domain([yMin, yMax * 1.08]).nice().range([innerH, 0]);

      var line = d3.line()
        .x(function(d) { return x(rowDate(d)); })
        .y(function(d) { return y(d.netoUsd); })
        .curve(d3.curveMonotoneX);

      var svg = d3.create('svg')
        .attr('viewBox', '0 0 ' + chartW + ' ' + h)
        .attr('width', chartW)
        .attr('height', h);

      var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      g.append('g')
        .attr('class', 'patrimonio-axis')
        .attr('transform', 'translate(0,' + innerH + ')')
        .call(d3.axisBottom(x).ticks(Math.min(6, sn.length + 2)).tickFormat(d3.timeFormat('%d/%m/%y')));

      g.append('g')
        .attr('class', 'patrimonio-axis')
        .call(d3.axisLeft(y).ticks(5).tickFormat(function(v) { return (v / 1000).toFixed(0) + 'k'; }));

      g.append('path')
        .datum(sn)
        .attr('class', 'patrimonio-line')
        .attr('d', line);

      g.selectAll('circle.pt')
        .data(sn)
        .join('circle')
        .attr('class', 'patrimonio-dot')
        .attr('r', 5)
        .attr('cx', function(d) { return x(rowDate(d)); })
        .attr('cy', function(d) { return y(d.netoUsd); })
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', function(d) { return 'Snapshot ' + (d.fecha || '') + ', neto ' + fmtUsd(d.netoUsd || 0); })
        .attr('data-snapshot-key', function(d) { return snapshotKey(d); });

      var byKey = {};
      sn.forEach(function(s) { byKey[snapshotKey(s)] = s; });

      var rowsHtml = sn.slice().reverse().map(function(d) {
        var key = snapshotKey(d);
        return '<tr class="pat-row" data-snapshot-key="' + escapeHtml(key) + '">'
          + '<td>' + escapeHtml(d.fecha) + '</td>'
          + '<td>' + fmtUsd(d.netoUsd) + '</td>'
          + '<td>' + fmtUsd(d.usdLiquido) + '</td>'
          + '<td>' + fmtUsd(d.btcValorUsd) + '</td>'
          + '<td>' + fmtUsd(d.autoUsd) + '</td>'
          + '<td>' + fmtUsd(d.nexoUsd) + '</td>'
          + '<td>' + fmtUsd(d.deudaUsd) + '</td>'
          + '<td class="note" title="' + escapeHtml(d.notas || '') + '">' + escapeHtml((d.notas || '').slice(0, 80)) + (d.notas && d.notas.length > 80 ? '…' : '') + '</td>'
          + '</tr>';
      }).join('');

      el.innerHTML = ''
        + '<section class="patrimonio-panel" aria-label="Patrimonio en USD">'
        + '<h2>Patrimonio (USD)</h2>'
        + '<p class="pat-sub">Datos de la pestaña <strong>Patrimonio</strong>. El gráfico muestra el <strong>patrimonio neto</strong> por fecha de snapshot; hacé click en un punto para ver la composición.</p>'
        + '<div class="patrimonio-latest">Último snapshot (' + escapeHtml(last.fecha) + '): <strong>' + fmtUsd(last.netoUsd) + '</strong> neto</div>'
        + '<div class="patrimonio-chart-wrap" id="patrimonio-chart-host"></div>'
        + '<div id="patrimonio-detail" class="patrimonio-detail" hidden></div>'
        + '<div class="patrimonio-table-wrap"><table class="patrimonio-table" aria-label="Historial de snapshots">'
        + '<thead><tr>'
        + '<th>Fecha</th><th>Neto USD</th><th>USD líq.</th><th>BTC USD</th><th>Auto USD</th><th>NEXO</th><th>Deuda</th><th>Notas</th>'
        + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>'
        + '</section>';

      var host = document.getElementById('patrimonio-chart-host');
      if (host) host.appendChild(svg.node());

      function renderPatrimonioDetail(snap) {
        var wrap = document.getElementById('patrimonio-detail');
        if (!wrap) return;
        if (!snap) {
          wrap.hidden = true;
          wrap.innerHTML = '';
          return;
        }
        var note = (snap.notas || '').trim();
        var refs = [];
        if (Number(snap.btcCantidad || 0) > 0) refs.push('BTC cantidad: ' + Number(snap.btcCantidad || 0).toLocaleString('es-AR', { maximumFractionDigits: 8 }));
        if (Number(snap.btcSpot || 0) > 0) refs.push('BTC precio snapshot: ' + fmtUsd(snap.btcSpot || 0));
        if (Number(snap.autoArs || 0) > 0) refs.push('Auto ARS (referencia): ' + fmt(snap.autoArs || 0));
        wrap.hidden = false;
        wrap.innerHTML = '<div class="patrimonio-detail-head">'
          + '<div><div class="patrimonio-detail-title">Composición snapshot ' + escapeHtml(snap.fecha || '') + '</div><div class="patrimonio-detail-meta">Desglose de activos y pasivos</div></div>'
          + '<button type="button" class="patrimonio-detail-close" id="pat-detail-close">Cerrar</button>'
          + '</div>'
          + '<div class="patrimonio-detail-grid">'
          + '<div class="patrimonio-kv"><span class="k">Neto USD</span><strong class="v">' + fmtUsd(snap.netoUsd || 0) + '</strong></div>'
          + '<div class="patrimonio-kv"><span class="k">USD líquido</span><span class="v">' + fmtUsd(snap.usdLiquido || 0) + '</span></div>'
          + '<div class="patrimonio-kv"><span class="k">BTC valor USD</span><span class="v">' + fmtUsd(snap.btcValorUsd || 0) + '</span></div>'
          + '<div class="patrimonio-kv"><span class="k">Auto USD</span><span class="v">' + fmtUsd(snap.autoUsd || 0) + '</span></div>'
          + '<div class="patrimonio-kv"><span class="k">NEXO + stable</span><span class="v">' + fmtUsd(snap.nexoUsd || 0) + '</span></div>'
          + '<div class="patrimonio-kv"><span class="k">Deuda USD (resta)</span><span class="v">- ' + fmtUsd(snap.deudaUsd || 0) + '</span></div>'
          + '</div>'
          + (note ? ('<div class="patrimonio-detail-note"><strong>Notas:</strong> ' + escapeHtml(note) + '</div>') : '')
          + (refs.length ? ('<div class="patrimonio-detail-ref"><strong>Referencia:</strong> ' + escapeHtml(refs.join(' · ')) + '</div>') : '');
        var closeBtn = document.getElementById('pat-detail-close');
        if (closeBtn) {
          closeBtn.onclick = function() {
            window.__selectedSnapshotKey = '';
            try { localStorage.removeItem('selectedSnapshotKey'); } catch (e) {}
            highlightSelection('');
            renderPatrimonioDetail(null);
          };
        }
      }

      function highlightSelection(key) {
        d3.selectAll('.patrimonio-dot').classed('is-selected', function(d) { return snapshotKey(d) === key; });
        var rows = document.querySelectorAll('.patrimonio-table tbody tr.pat-row');
        rows.forEach(function(r) {
          r.classList.toggle('is-selected', r.getAttribute('data-snapshot-key') === key);
        });
      }

      function selectSnapshot(key) {
        if (!key || !byKey[key]) return;
        window.__selectedSnapshotKey = key;
        try { localStorage.setItem('selectedSnapshotKey', key); } catch (e) {}
        highlightSelection(key);
        renderPatrimonioDetail(byKey[key]);
      }

      d3.selectAll('.patrimonio-dot')
        .on('click', function(event, d) { selectSnapshot(snapshotKey(d)); })
        .on('keydown', function(event, d) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectSnapshot(snapshotKey(d));
          }
        });

      var tableRows = document.querySelectorAll('.patrimonio-table tbody tr.pat-row');
      tableRows.forEach(function(r) {
        r.addEventListener('click', function() {
          var key = r.getAttribute('data-snapshot-key') || '';
          if (key) selectSnapshot(key);
        });
      });

      var preferredKey = window.__selectedSnapshotKey;
      if (!preferredKey || !byKey[preferredKey]) preferredKey = snapshotKey(last);
      selectSnapshot(preferredKey);
    }
    function renderIncome(month) {
      var wrap = document.getElementById('income-wrap');
      if (!wrap) return;
      var ti = month && (month.totalIngresos != null) ? month.totalIngresos : 0;
      var ic = (month && month.incomeCategories) ? month.incomeCategories.filter(function(c) { return c.total > 0; }) : [];
      if (!ti || ti <= 0 || ic.length === 0) {
        wrap.innerHTML = '<section class="income-panel" aria-label="Ingresos del mes">'
          + '<h2>Ingresos del mes</h2>'
          + '<p class="empty-income">No hay ingresos con <strong>Tipo = Ingreso</strong> en este mes, o los montos están en cero. Cargalos por WhatsApp con mensajes que empiecen con <strong>ingreso</strong>.</p>'
          + '</section>';
        return;
      }
      var parts = ic.map(function(c) {
        var pctOfTotal = ti > 0 ? Math.round((c.total / ti) * 100) : 0;
        return '<div class="income-block">'
          + '<div class="income-row"><span>' + escapeHtml(c.name) + '</span><span class="amt">' + formatMoneyArs(c.total) + ' · ' + pctOfTotal + '%</span></div>'
          + '<div class="income-row"><div class="bar-wrap" style="grid-column:1/-1"><div class="bar-fill" style="width:' + pctOfTotal + '%"></div></div></div>'
          + '</div>';
      }).join('');
      wrap.innerHTML = '<section class="income-panel" aria-label="Ingresos del mes">'
        + '<h2>Ingresos del mes</h2>'
        + '<div class="income-total">Total: ' + formatMoneyArs(ti) + '</div>'
        + '<div class="income-bars">' + parts + '</div>'
        + '</section>';
    }
    function renderCategoryDetail(month, categoryName) {
      var wrap = document.getElementById('cat-detail');
      if (!wrap) return;
      if (!month || !categoryName) {
        wrap.hidden = true;
        wrap.innerHTML = '';
        return;
      }
      var all = (month.categoryDetails && month.categoryDetails[categoryName]) ? month.categoryDetails[categoryName] : [];
      var top = all.slice(0, 80);
      if (!top.length) {
        wrap.hidden = false;
        wrap.innerHTML = '<div class=\"cat-detail-head\"><div class=\"cat-detail-title\">' + escapeHtml(categoryName) + '</div><button type=\"button\" class=\"cat-detail-close\" id=\"cat-detail-close\">Cerrar</button></div><p class=\"empty-income\">No encontré movimientos detallados en esta categoría.</p>';
      } else {
        var rows = top.map(function(r) {
          var fecha = r.fecha || '-';
          var desc = r.descripcion || '(sin descripción)';
          var amtTxt = formatMoneyArs(r.montoArs || 0);
          if (r.moneda === 'USD') {
            amtTxt += ' · USD ' + (Number(r.montoOriginal || 0).toFixed(2));
          }
          return '<div class=\"cat-detail-row\"><div class=\"cat-date\">' + escapeHtml(fecha) + '</div><div class=\"cat-desc\">' + escapeHtml(desc) + '</div><div class=\"cat-amt\">' + escapeHtml(amtTxt) + '</div></div>';
        }).join('');
        wrap.hidden = false;
        wrap.innerHTML = '<div class=\"cat-detail-head\"><div><div class=\"cat-detail-title\">' + escapeHtml(categoryName) + '</div><div class=\"cat-detail-meta\">' + top.length + ' de ' + all.length + ' movimiento(s)</div></div><button type=\"button\" class=\"cat-detail-close\" id=\"cat-detail-close\">Cerrar</button></div><div class=\"cat-detail-list\">' + rows + '</div>';
      }
      var closeBtn = document.getElementById('cat-detail-close');
      if (closeBtn) {
        closeBtn.onclick = function() {
          wrap.hidden = true;
          wrap.innerHTML = '';
          window.__selectedCategory = '';
          var selected = document.querySelectorAll('.cell-rect.is-selected');
          selected.forEach(function(el) { el.classList.remove('is-selected'); });
        };
      }
    }
    function renderMonthBalance(month) {
      var wrap = document.getElementById('month-balance');
      if (!wrap) return;
      if (!month) {
        wrap.hidden = true;
        wrap.innerHTML = '';
        return;
      }
      var ing = Number(month.totalIngresos);
      var gas = Number(month.total);
      if (!Number.isFinite(ing) || ing < 0) ing = 0;
      if (!Number.isFinite(gas) || gas < 0) gas = 0;
      var netArs = ing - gas;
      var sum = ing + gas;
      var pctIng = sum > 0 ? (ing / sum) * 100 : 0;
      var pctGas = sum > 0 ? (gas / sum) * 100 : 0;
      var surplus = netArs > 0;
      var deficit = netArs < 0;
      var even = netArs === 0;
      var panelCls = even ? 'is-even-panel' : (surplus ? 'is-surplus' : 'is-deficit');
      var pill = 'Equilibrio';
      if (even && ing === 0 && gas === 0) pill = 'Sin movimientos';
      else if (even) pill = 'Equilibrio';
      else if (surplus) pill = 'Ganancia del mes';
      else pill = 'Déficit del mes';
      if (ing <= 0 && gas > 0) pill = 'Déficit del mes';
      if (ing > 0 && gas <= 0) pill = 'Ganancia del mes';
      var netCls = 'balance-net-value' + (even ? ' is-even' : '');
      var sign = netArs > 0 ? '+' : (netArs < 0 ? '\u2212' : '');
      var netDisplay = sign + formatMoneyArs(Math.abs(netArs));
      wrap.hidden = false;
      wrap.className = 'month-balance-panel ' + panelCls;
      wrap.innerHTML = ''
        + '<div class="balance-pill">' + escapeHtml(pill) + '</div>'
        + '<div class="balance-net-row">'
        + '<span class="balance-net-label">Ingresos \u2212 gastos</span>'
        + '<span class="' + netCls + '">' + escapeHtml(netDisplay) + '</span>'
        + '</div>'
        + '<div class="balance-split-wrap">'
        + '<div class="balance-split-labels"><span>Ingresos</span><span>Gastos</span></div>'
        + '<div class="balance-split-track">'
        + '<span class="balance-split-ing" style="width:' + pctIng.toFixed(2) + '%"></span>'
        + '<span class="balance-split-gas" style="width:' + pctGas.toFixed(2) + '%"></span>'
        + '</div></div>'
        + '<div class="balance-bars-detail">'
        + '<div>Total ingresos<br><strong>' + escapeHtml(formatMoneyArs(ing)) + '</strong></div>'
        + '<div style="text-align:right">Total gastos<br><strong>' + escapeHtml(formatMoneyArs(gas)) + '</strong></div>'
        + '</div>';
    }

    function renderMonthTotal(month) {
      var wrap = document.getElementById('month-total');
      if (!wrap) return;
      if (!month) {
        wrap.hidden = true;
        wrap.innerHTML = '';
        return;
      }
      var totalArs = Number(month.total || 0);
      if (!Number.isFinite(totalArs) || totalArs < 0) totalArs = 0;
      var totalDisplay = displayAmountFromArs(totalArs);
      var stepBase = window.__currency === 'USD' ? 1000 : 1000000;
      var step = stepBase;
      var tickCount = Math.ceil(totalDisplay / step) || 1;
      while (tickCount > 8) {
        step *= 2;
        tickCount = Math.ceil(totalDisplay / step) || 1;
      }
      var maxDisplay = Math.max(step, Math.ceil(totalDisplay / step) * step);
      var fillPct = maxDisplay > 0 ? Math.max(0, Math.min(100, (totalDisplay / maxDisplay) * 100)) : 0;

      var ticks = [];
      for (var v = 0; v <= maxDisplay + 0.0001; v += step) {
        ticks.push(v);
      }
      var ticksHtml = ticks.map(function(v, idx) {
        var left = maxDisplay > 0 ? (v / maxDisplay) * 100 : 0;
        var lbl = (window.__currency === 'USD')
          ? ('USD ' + Math.round(v).toLocaleString('es-AR'))
          : ('$ ' + Math.round(v).toLocaleString('es-AR'));
        var edgeCls = idx === 0 ? ' is-start' : (idx === ticks.length - 1 ? ' is-end' : '');
        return '<span class=\"month-ruler-tick\" style=\"left:' + left + '%\"></span>'
          + '<span class=\"month-ruler-tick-label' + edgeCls + '\" style=\"left:' + left + '%\">' + escapeHtml(lbl) + '</span>';
      }).join('');

      var marksText = (window.__currency === 'USD')
        ? 'Marcas cada ' + step.toLocaleString('es-AR') + ' USD'
        : 'Marcas cada ' + step.toLocaleString('es-AR') + ' ARS';
      wrap.hidden = false;
      wrap.innerHTML = ''
        + '<div class=\"month-total-head\">'
        + '<span class=\"month-total-label\">Total acumulado del mes</span>'
        + '<strong class=\"month-total-value\">' + escapeHtml(formatMoneyArs(totalArs)) + '</strong>'
        + '</div>'
        + '<div class=\"month-ruler-track\"><span class=\"month-ruler-fill\" style=\"width:' + fillPct.toFixed(2) + '%\"></span></div>'
        + '<div class=\"month-ruler-ticks\">' + ticksHtml + '</div>'
        + '<div class=\"month-total-sub\">Escala hasta ' + escapeHtml(window.__currency === 'USD' ? ('USD ' + Math.round(maxDisplay).toLocaleString('es-AR')) : ('$ ' + Math.round(maxDisplay).toLocaleString('es-AR'))) + ' · ' + escapeHtml(marksText) + '</div>';
    }
    function renderTreemap(month) {
      var rootEl = document.getElementById('root');
      var detailWrap = document.getElementById('cat-detail');
      renderMonthBalance(month);
      renderMonthTotal(month);
      if (!month || !month.categories || month.categories.length === 0) {
        rootEl.innerHTML = '<p class="empty">No hay categorías con datos en este mes.</p>';
        if (detailWrap) { detailWrap.hidden = true; detailWrap.innerHTML = ''; }
        return;
      }
      var cats = month.categories.filter(function(c) { return c.total > 0; });
      if (cats.length === 0) {
        rootEl.innerHTML = '<p class="empty">Montos en cero.</p>';
        if (detailWrap) { detailWrap.hidden = true; detailWrap.innerHTML = ''; }
        return;
      }
      var totalCats = d3.sum(cats, function(d) { return Number(d.total || 0); }) || 0;
      function pctOfTotal(v) {
        if (!totalCats || totalCats <= 0) return 0;
        return Math.round((Number(v || 0) / totalCats) * 100);
      }
      function compactCategoryName(name, cw, ch) {
        var n = String(name || '').trim();
        var area = cw * ch;
        var dict = {
          'Automóvil': 'Auto',
          'Vivienda': 'Viv.',
          'Supermercado': 'Super',
          'Restaurantes y delivery': 'Rest. y deliv.',
          'Servicios e impuestos': 'Servicios',
          'Hogar y mantenimiento': 'Hogar',
          'Ropa y calzado': 'Ropa',
          'Regalos y donaciones': 'Regalos',
          'Suscripciones': 'Suscrip.',
          'Educación': 'Educ.'
        };
        if (dict[n]) return dict[n];
        if (area < 12000 && n.length > 11) return n.slice(0, 9).trim() + '.';
        return n;
      }
      function microCategoryName(name) {
        var n = String(name || '').trim();
        var micro = {
          'Automóvil': 'Auto',
          'Vivienda': 'Viv',
          'Supermercado': 'Sup',
          'Restaurantes y delivery': 'Rest',
          'Servicios e impuestos': 'Serv',
          'Hogar y mantenimiento': 'Hog',
          'Ropa y calzado': 'Ropa',
          'Regalos y donaciones': 'Reg',
          'Suscripciones': 'Sus',
          'Deportes': 'Dep',
          'Educación': 'Edu',
          'Transporte': 'Trans',
          'Salud': 'Salud',
          'Mascotas': 'Masc',
          'Otros': 'Otros'
        };
        if (micro[n]) return micro[n];
        if (n.length <= 5) return n;
        return n.slice(0, 4);
      }
      var maxV = d3.max(cats, function(d) { return d.total; }) || 1;

      var w = Math.max(260, Math.floor(rootEl.clientWidth || document.documentElement.clientWidth - 36));
      var narrow = window.innerWidth <= 640;
      var h = narrow
        ? Math.min(400, Math.max(220, Math.floor(window.innerHeight * 0.34)))
        : Math.min(520, Math.max(300, Math.floor(window.innerHeight * 0.46)));

      var hierarchy = d3.hierarchy({ children: cats })
        .sum(function(d) { return d.total; })
        .sort(function(a, b) { return (b.value || 0) - (a.value || 0); });

      d3.treemap()
        .size([w, h])
        .paddingOuter(8)
        .paddingInner(4)
        .round(true)
      (hierarchy);

      var leaves = hierarchy.leaves();

      var svg = d3.create('svg')
        .attr('id', 'treemap-root')
        .attr('viewBox', '0 0 ' + w + ' ' + h)
        .attr('width', w)
        .attr('height', h)
        .attr('role', 'img')
        .attr('aria-label', 'Treemap de gastos por categoría');

      var g = svg.selectAll('g.cell')
        .data(leaves)
        .join('g')
        .attr('class', 'cell')
        .attr('transform', function(d) { return 'translate(' + d.x0 + ',' + d.y0 + ')'; })
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', function(d) { return 'Ver detalle de ' + (d.data.name || 'categoría'); });

      g.append('title')
        .text(function(d) {
          var n = d.data.name || '';
          var t = formatMoneyArs(d.data.total);
          var p = pctOfTotal(d.data.total);
          var m = d.data.rowCount ? ' · ' + d.data.rowCount + ' movimientos' : '';
          return n + ' — ' + t + ' · ' + p + '%' + m;
        });

      var rects = g.append('rect')
        .attr('class', 'cell-rect')
        .attr('width', function(d) { return Math.max(0, d.x1 - d.x0); })
        .attr('height', function(d) { return Math.max(0, d.y1 - d.y0); })
        .attr('rx', 10)
        .attr('ry', 10)
        .attr('fill', function(d) { return heatFill(d.data.total, maxV); })
        .attr('stroke', 'rgba(255,255,255,0.1)')
        .attr('stroke-width', 1);

      g.each(function(d) {
        var cw = d.x1 - d.x0;
        var ch = d.y1 - d.y0;
        var gEl = this;
        if (cw < 26 || ch < 22) return;
        var area = cw * ch;
        var pad = Math.min(12, Math.max(4, Math.min(cw, ch) * 0.07));
        var iw = Math.max(0, cw - pad * 2);
        var ih = Math.max(0, ch - pad * 2);
        var fs = Math.min(72, Math.max(6.8, Math.sqrt(area) / 4.1));
        var fsAmount = Math.max(6.6, Math.min(24, fs * 0.36));
        var fsMeta = Math.max(6.2, Math.min(14, fs * 0.25));
        var microMode = area < 3600 || iw < 54 || ih < 36;
        var compactMode = !microMode && (area < 8400 || iw < 86 || ih < 56);
        var showAmount = ih > 24 && iw > 42;
        var showMeta = ih > 72 && iw > 105;
        var fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        fo.setAttribute('x', pad);
        fo.setAttribute('y', pad);
        fo.setAttribute('width', iw);
        fo.setAttribute('height', ih);
        var box = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        box.style.width = '100%';
        box.style.height = '100%';
        box.style.overflow = 'hidden';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.justifyContent = 'flex-start';
        box.style.alignItems = 'stretch';
        box.style.boxSizing = 'border-box';
        box.style.gap = '2px';
        box.style.fontFamily = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
        if (microMode) {
          box.style.justifyContent = 'center';
          box.style.alignItems = 'center';
          box.style.gap = '1px';
          box.style.textAlign = 'center';
        }
        var nameEl = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
        nameEl.textContent = microMode ? microCategoryName(d.data.name || '') : compactCategoryName(d.data.name || '', cw, ch);
        nameEl.style.fontWeight = '700';
        nameEl.style.fontSize = (microMode ? Math.max(6.1, fs * 0.68) : (compactMode ? Math.max(7.6, fs * 0.84) : fs)) + 'px';
        nameEl.style.color = 'rgba(255,255,255,0.96)';
        nameEl.style.lineHeight = '1';
        nameEl.style.whiteSpace = 'nowrap';
        nameEl.style.overflow = 'hidden';
        nameEl.style.textOverflow = 'ellipsis';
        if (microMode) nameEl.style.maxWidth = '100%';
        box.appendChild(nameEl);
        if (showAmount) {
          var amtEl = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
          if (microMode) {
            amtEl.textContent = pctOfTotal(d.data.total) + '%';
          } else if (compactMode) {
            amtEl.textContent = pctOfTotal(d.data.total) + '%';
          } else {
            amtEl.textContent = formatMoneyArs(d.data.total) + ' · ' + pctOfTotal(d.data.total) + '%';
          }
          amtEl.style.fontSize = (microMode
            ? Math.max(6.2, fsAmount * 0.95)
            : (compactMode ? Math.max(7.2, fsAmount * 1.02) : fsAmount)) + 'px';
          amtEl.style.color = 'rgba(255,255,255,0.8)';
          amtEl.style.fontVariantNumeric = 'tabular-nums';
          amtEl.style.whiteSpace = 'nowrap';
          amtEl.style.overflow = 'hidden';
          amtEl.style.textOverflow = 'ellipsis';
          if (microMode) amtEl.style.maxWidth = '100%';
          box.appendChild(amtEl);
        }
        if (!microMode && !compactMode && showMeta && d.data.rowCount) {
          var movEl = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
          movEl.textContent = d.data.rowCount + ' mov.';
          movEl.style.fontSize = fsMeta + 'px';
          movEl.style.color = 'rgba(255,255,255,0.72)';
          movEl.style.whiteSpace = 'nowrap';
          movEl.style.overflow = 'hidden';
          movEl.style.textOverflow = 'ellipsis';
          box.appendChild(movEl);
        }
        fo.appendChild(box);
        gEl.appendChild(fo);
      });

      function selectCategory(name) {
        window.__selectedCategory = name || '';
        rects.classed('is-selected', function(d) { return (d.data.name || '') === (window.__selectedCategory || ''); });
        renderCategoryDetail(month, window.__selectedCategory || '');
      }
      g.on('click', function(event, d) { selectCategory(d.data.name || ''); });
      g.on('keydown', function(event, d) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectCategory(d.data.name || '');
        }
      });

      rootEl.innerHTML = '';
      rootEl.appendChild(svg.node());

      if (!month.hasCategoryColumn) {
        var hint = document.createElement('p');
        hint.className = 'hint';
        hint.innerHTML = 'No hay columna <strong>Categoría</strong> en la planilla: todo se agrupa como una sola categoría. Agregá la columna para ver varios recuadros.';
        rootEl.appendChild(hint);
      }
      if (window.__selectedCategory && cats.some(function(c) { return c.name === window.__selectedCategory; })) {
        selectCategory(window.__selectedCategory);
      } else {
        window.__selectedCategory = '';
        if (detailWrap) { detailWrap.hidden = true; detailWrap.innerHTML = ''; }
      }
    }
    function pickDefaultMonth(months) {
      for (var i = months.length - 1; i >= 0; i--) {
        var m = months[i];
        if (m.error) continue;
        var hasGasto = m.categories && m.categories.some(function(c) { return c.total > 0; });
        var hasIngreso = (m.totalIngresos != null && m.totalIngresos > 0);
        if (hasGasto || hasIngreso) return m.name;
      }
      if (months.length) return months[months.length - 1].name;
      return '';
    }
    function onMonthChange() {
      var sel = document.getElementById('month-sel');
      var name = sel.value;
      if (!payload || !name) return;
      var month = payload.months.filter(function(m) { return m.name === name; })[0];
      renderIncome(month);
      renderTreemap(month);
    }
    function setView(view) {
      if (view !== 'patrimonio' && view !== 'ingresos' && view !== 'gastos') view = 'gastos';
      var tabs = document.querySelectorAll('.view-tabs button[role="tab"]');
      var panels = {
        patrimonio: document.getElementById('panel-patrimonio'),
        ingresos: document.getElementById('panel-ingresos'),
        gastos: document.getElementById('panel-gastos')
      };
      tabs.forEach(function(btn) {
        var v = btn.getAttribute('data-view');
        btn.setAttribute('aria-selected', v === view ? 'true' : 'false');
      });
      Object.keys(panels).forEach(function(k) {
        var p = panels[k];
        if (!p) return;
        p.hidden = k !== view;
        p.setAttribute('aria-hidden', k !== view ? 'true' : 'false');
      });
      var tb = document.getElementById('toolbar-month');
      var leg = document.getElementById('legend-gastos');
      if (tb) {
        tb.hidden = view === 'patrimonio';
        if (leg) leg.hidden = view !== 'gastos';
      }
      try { localStorage.setItem('dashboardView', view); } catch (e) {}
      window.__dashView = view;
      requestAnimationFrame(function() { refreshChartsForView(); });
    }
    function refreshChartsForView() {
      if (!payload) return;
      var v = window.__dashView || 'gastos';
      var sel = document.getElementById('month-sel');
      if (!sel) return;
      var month = (payload.months || []).filter(function(m) { return m.name === sel.value; })[0];
      if (v === 'patrimonio') renderPatrimonio();
      if (v === 'ingresos' && month) renderIncome(month);
      if (v === 'gastos' && month) renderTreemap(month);
    }
    async function load() {
      var root = document.getElementById('root');
      var foot = document.getElementById('foot');
      var sel = document.getElementById('month-sel');
      try {
        var r = await fetch(apiUrl(), { cache: 'no-store' });
        var j = await r.json();
        if (j.error === 'NO_CREDS') {
          root.innerHTML = '<div class="error">Falta configurar credenciales de Google en el servidor (<code>GOOGLE_APPLICATION_CREDENTIALS</code>) y compartir la planilla con el email de la cuenta de servicio (solo lectura).</div>';
          return;
        }
        if (!r.ok) throw new Error(j.message || j.error || 'Error');
        payload = j;
        var months = j.months || [];
        sel.innerHTML = '';
        if (months.length === 0) {
          root.innerHTML = '<p class="empty">No hay pestañas mensuales de gastos (o solo Config/Patrimonio). Agregá hojas tipo <strong>enero 2026</strong> para el mapa.</p>';
          sel.disabled = true;
        } else {
          months.forEach(function(m) {
            var opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = m.name + (m.error ? ' (error)' : '');
            sel.appendChild(opt);
          });
          sel.disabled = false;
          sel.value = pickDefaultMonth(months);
          sel.onchange = onMonthChange;
        }
        foot.textContent = j.spreadsheetTitle ? ('Planilla: ' + j.spreadsheetTitle + ' · ') : '';
        foot.textContent += 'Actualizado: ' + (j.updatedAt || '') + (j.cached ? ' (caché)' : '');
        var saved = 'gastos';
        try { saved = localStorage.getItem('dashboardView') || 'gastos'; } catch (err) {}
        if (saved !== 'patrimonio' && saved !== 'ingresos' && saved !== 'gastos') saved = 'gastos';
        var curSaved = 'ARS';
        try { curSaved = localStorage.getItem('dashboardCurrency') || 'ARS'; } catch (err2) {}
        try { window.__selectedSnapshotKey = localStorage.getItem('selectedSnapshotKey') || ''; } catch (err25) { window.__selectedSnapshotKey = ''; }
        if (curSaved === 'USD') {
          try {
            await fetchCotizacionCripto();
            window.__currency = 'USD';
          } catch (err3) {
            window.__currency = 'ARS';
            try { localStorage.setItem('dashboardCurrency', 'ARS'); } catch (e4) {}
          }
        } else {
          window.__currency = 'ARS';
        }
        setCurrencyButtons();
        updateCurrencyMeta();
        setView(saved);
      } catch (e) {
        root.innerHTML = '<div class="error">No se pudo cargar el resumen. ' + escapeHtml(e.message) + '</div>';
      }
    }
    document.querySelectorAll('.view-tabs button[role="tab"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var v = btn.getAttribute('data-view');
        if (v) setView(v);
      });
    });
    (function bindCurrencyToggle() {
      var a = document.getElementById('cur-ars');
      var u = document.getElementById('cur-usd');
      if (a) a.addEventListener('click', function() { if (window.__currency !== 'ARS') applyCurrencyChoice('ARS'); });
      if (u) u.addEventListener('click', function() { if (window.__currency !== 'USD') applyCurrencyChoice('USD'); });
    })();
    window.addEventListener('resize', function() {
      if (!payload) return;
      refreshChartsForView();
    });
    load();
  <\/script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  if (url.pathname === "/api/cotizacion-cripto") {
    try {
      const data = await fetchDolarCriptoJson();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=120",
      });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(502, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(
        JSON.stringify({
          error: "COTIZACION_ERROR",
          message: String(e.message || e),
        })
      );
    }
    return;
  }

  if (url.pathname === "/api/resumen") {
    try {
      const data = await fetchMonthlyTotals();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    } catch (e) {
      if (e.code === "NO_CREDS" || e.message === "NO_CREDS") {
        res.writeHead(503, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(
          JSON.stringify({
            error: "NO_CREDS",
            message:
              "Configurá GOOGLE_APPLICATION_CREDENTIALS en el servidor.",
          })
        );
        return;
      }
      res.writeHead(500, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(
        JSON.stringify({
          error: "SHEETS_ERROR",
          message: String(e.message || e),
        })
      );
    }
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(dashboardHtml());
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404");
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor: http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`);
});
