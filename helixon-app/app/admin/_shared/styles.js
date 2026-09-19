// Admin console design system.
//
// One stylesheet, injected by app/admin/layout.js. Colours are tokens on :root so
// a whole-console retheme is a few lines. Every class the existing pages already
// use (kpi-card, panel, table, pill, btn, segmented, notice, split, grid-*, ...)
// is kept, so pages that haven't been touched still pick up the new look.
export const css = `
:root{
  color-scheme:dark;

  /* Surfaces: three steps of elevation on a near-black canvas. */
  --bg:#080b10;
  --surface:#0f141b;
  --surface-raised:#151b24;
  --surface-hover:#1a212c;
  --border:rgba(255,255,255,.08);
  --border-soft:rgba(255,255,255,.05);
  --border-strong:rgba(255,255,255,.14);

  --text:#e8edf2;
  --text-muted:#8794a3;
  --text-faint:#566373;

  /* Helixon green, matching the customer-facing site. */
  --accent:#3ddc97;
  --accent-strong:#6ee7b7;
  --accent-soft:rgba(61,220,151,.11);
  --accent-line:rgba(61,220,151,.32);
  --on-accent:#04140c;

  --ok:#3ddc97;
  --ok-soft:rgba(61,220,151,.11);
  --warn:#f0b35a;
  --warn-soft:rgba(240,179,90,.11);
  --critical:#f0707b;
  --critical-soft:rgba(240,112,123,.11);
  --info:#6cb6ff;
  --info-soft:rgba(108,182,255,.11);

  --radius-sm:7px;
  --radius-md:11px;
  --radius-lg:15px;
  --shadow-card:0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px -12px rgba(0,0,0,.55);
  --shadow-pop:0 24px 60px -18px rgba(0,0,0,.75), 0 0 0 1px var(--border-strong);

  --font-ui:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif;
  --font-mono:ui-monospace,"SFMono-Regular","JetBrains Mono","IBM Plex Mono",Menlo,Consolas,monospace;

  --sidebar-w:248px;
}

*{box-sizing:border-box}

body{
  margin:0;
  font-family:var(--font-ui);
  font-size:13.5px;
  line-height:1.5;
  background:
    radial-gradient(900px 420px at 12% -8%, rgba(61,220,151,.07), transparent 60%),
    radial-gradient(700px 380px at 100% 0%, rgba(108,182,255,.05), transparent 55%),
    var(--bg);
  background-attachment:fixed;
  color:var(--text);
  -webkit-font-smoothing:antialiased;
  font-feature-settings:"cv11","ss01","tnum" 0
}

button,input,select,textarea{font:inherit;color:inherit}
/* Icons without an explicit size follow the text size. :where() keeps this at zero
   specificity so any component rule (.side-link svg, .btn svg ...) still wins. */
:where(svg[aria-hidden="true"]:not([width])){width:1.1em;height:1.1em;flex-shrink:0}
h1,h2,h3{font-family:var(--font-ui)}

::selection{background:var(--accent-line);color:#fff}

:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}

::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:99px;border:2px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:var(--text-faint);background-clip:content-box;border:2px solid transparent}

/* ── Shell ─────────────────────────────────────────────────────────────── */

.admin-shell{min-height:100vh;display:flex}

.sidebar{
  width:var(--sidebar-w);
  flex-shrink:0;
  border-right:1px solid var(--border);
  background:linear-gradient(180deg, rgba(15,20,27,.96), rgba(10,14,20,.96));
  backdrop-filter:blur(14px);
  display:flex;
  flex-direction:column;
  position:sticky;
  top:0;
  height:100vh;
  z-index:40
}

.brand-row{display:flex;align-items:center;gap:11px;padding:20px 18px 16px}

.brand-mark{
  width:32px;height:32px;border-radius:10px;
  background:linear-gradient(135deg,#3ddc97,#1b9d6a);
  color:var(--on-accent);
  display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:15px;flex-shrink:0;
  box-shadow:0 6px 18px -6px rgba(61,220,151,.55), 0 0 0 1px rgba(255,255,255,.18) inset
}

.brand-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.brand-name{font-weight:650;font-size:14.5px;letter-spacing:-.005em}
.brand-sub{font-size:11px;color:var(--text-faint);letter-spacing:.02em}

.status-row{
  display:flex;align-items:center;gap:8px;
  margin:0 14px 6px;padding:8px 11px;
  border:1px solid var(--border-soft);border-radius:9px;
  background:var(--surface);
  font-size:11.5px;color:var(--text-muted)
}

.status-dot{width:7px;height:7px;border-radius:99px;background:var(--ok);flex-shrink:0;box-shadow:0 0 0 3px rgba(61,220,151,.16)}
.status-dot.pulse{animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{50%{box-shadow:0 0 0 6px rgba(61,220,151,0)}}

.side-nav{padding:8px 10px 10px;display:flex;flex-direction:column;gap:1px;overflow-y:auto;flex:1}

.side-nav-group{
  margin-top:16px;padding:0 10px 6px;
  font-size:10.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--text-faint)
}
.side-nav-group:first-child{margin-top:4px}

.side-link{
  position:relative;
  display:flex;align-items:center;gap:11px;
  border:0;background:transparent;color:var(--text-muted);
  padding:8px 10px;border-radius:9px;cursor:pointer;
  font-size:13px;font-weight:500;text-align:left;text-decoration:none;
  transition:background .15s,color .15s
}

.side-link svg{width:17px;height:17px;flex-shrink:0;opacity:.85}
.side-link:hover{background:var(--surface-raised);color:var(--text)}

.side-link.active{background:var(--accent-soft);color:var(--accent-strong)}
.side-link.active::before{
  content:"";position:absolute;left:-10px;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:var(--accent)
}
.side-link.active svg{opacity:1}

.side-link-dot{display:none}
.side-link-badge{margin-left:auto;font-size:10.5px;font-weight:600;color:var(--text-faint);font-variant-numeric:tabular-nums;
  background:var(--surface-raised);padding:1px 7px;border-radius:99px}
.side-link.active .side-link-badge{color:var(--accent-strong);background:rgba(61,220,151,.14)}

.sidebar-footer{padding:12px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:10px}

.user-card{display:flex;align-items:center;gap:10px;padding:8px 9px;border-radius:10px;background:var(--surface);border:1px solid var(--border-soft)}
.avatar{
  width:30px;height:30px;border-radius:9px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:700;text-transform:uppercase;
  background:var(--accent-soft);color:var(--accent-strong);border:1px solid var(--accent-line)
}
.user-meta{min-width:0;display:flex;flex-direction:column}
.user-name{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.user-sub{font-size:11px;color:var(--text-faint)}
.user-sub.warn{color:var(--warn)}

.logout{
  width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
  border:1px solid var(--border);background:transparent;color:var(--text-muted);
  padding:8px 10px;border-radius:9px;cursor:pointer;font-size:12.5px;font-weight:500;
  transition:all .15s
}
.logout svg{width:15px;height:15px}
.logout:hover{color:var(--critical);border-color:rgba(240,112,123,.4);background:var(--critical-soft)}

.main-col{flex:1;min-width:0;display:flex;flex-direction:column}

.topbar{
  position:sticky;top:0;z-index:30;
  display:flex;align-items:center;gap:12px;
  padding:11px 28px;
  border-bottom:1px solid var(--border);
  background:rgba(8,11,16,.78);
  backdrop-filter:blur(14px) saturate(1.3)
}

.topbar-title{font-size:13px;font-weight:600;color:var(--text)}
.topbar-crumb{font-size:12px;color:var(--text-faint)}
.topbar-time{color:var(--text-faint);font-size:12px;font-variant-numeric:tabular-nums;margin-left:auto}

.icon-btn{
  width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;
  border:1px solid var(--border);background:var(--surface);color:var(--text-muted);
  border-radius:9px;cursor:pointer;transition:all .15s
}
.icon-btn svg{width:17px;height:17px}
.icon-btn:hover{color:var(--text);background:var(--surface-raised);border-color:var(--border-strong)}
.menu-btn{display:none}

.search-trigger{
  margin-left:auto;display:flex;align-items:center;gap:9px;min-width:230px;
  padding:7px 11px;border:1px solid var(--border);background:var(--surface);
  color:var(--text-faint);border-radius:9px;cursor:pointer;font-size:12.5px;transition:all .15s
}
.search-trigger svg{width:15px;height:15px}
.search-trigger:hover{border-color:var(--border-strong);color:var(--text-muted)}
.kbd{
  margin-left:auto;font-family:var(--font-mono);font-size:10.5px;
  padding:1px 6px;border-radius:5px;border:1px solid var(--border);background:var(--bg);color:var(--text-faint)
}

.content{padding:28px 30px 56px;min-width:0;max-width:1500px;width:100%;margin:0 auto;animation:rise .35s ease both}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.scrim{display:none}

/* ── Page header ───────────────────────────────────────────────────────── */

.page-header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.page-heading h1{font-size:24px;font-weight:700;margin:0 0 6px;letter-spacing:-.02em}
.page-heading p{margin:0;color:var(--text-muted);font-size:13.5px;max-width:64ch}
.page-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

/* ── Buttons & controls ────────────────────────────────────────────────── */

.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  border:1px solid var(--border);background:var(--surface);color:var(--text);
  padding:8px 14px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;
  transition:background .15s,border-color .15s,transform .05s
}
.btn svg{width:15px;height:15px}
.btn:hover{background:var(--surface-raised);border-color:var(--border-strong)}
.btn:active{transform:translateY(1px)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:600}
.btn.primary:hover{background:var(--accent-strong);border-color:var(--accent-strong)}
.btn.danger{border-color:rgba(240,112,123,.4);color:var(--critical);background:var(--critical-soft)}
.btn.danger:hover{background:rgba(240,112,123,.18)}
.btn.ghost{background:transparent;border-color:transparent;color:var(--text-muted)}
.btn.ghost:hover{color:var(--text);background:var(--surface-raised)}
.btn.small{padding:5px 10px;font-size:12px;border-radius:8px}
.btn:disabled{opacity:.45;cursor:not-allowed}

.segmented{display:inline-flex;padding:3px;gap:2px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
.segmented button{border:0;background:transparent;color:var(--text-muted);padding:5px 12px;font-size:12px;font-weight:500;cursor:pointer;border-radius:7px;transition:all .15s}
.segmented button:hover{color:var(--text)}
.segmented button.active{background:var(--surface-hover);color:var(--accent-strong);box-shadow:0 0 0 1px var(--border-strong)}

.field{display:grid;gap:6px}
.field label{color:var(--text-muted);font-size:12px;font-weight:500}
.field input,.field select,.field textarea{
  width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:9px;
  background:var(--bg);color:var(--text);transition:border-color .15s,box-shadow .15s
}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);outline:none}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}

.search-input{
  width:100%;max-width:340px;padding:9px 12px 9px 34px;
  border:1px solid var(--border);border-radius:9px;background:var(--surface) no-repeat 11px center;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='%238794a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m21 21-4.3-4.3'/%3E%3C/svg%3E");
  color:var(--text);font-size:13px;transition:border-color .15s,box-shadow .15s
}
.search-input::placeholder{color:var(--text-faint)}
.search-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);outline:none}
select.search-input{padding-left:12px;background-image:none;max-width:200px}

/* ── Cards ─────────────────────────────────────────────────────────────── */

.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}
.kpi-grid.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.kpi-grid.cols-5{grid-template-columns:repeat(5,minmax(0,1fr))}
.kpi-grid.cols-6{grid-template-columns:repeat(6,minmax(0,1fr))}

.kpi-card{
  position:relative;overflow:hidden;
  border:1px solid var(--border);background:var(--surface);
  border-radius:var(--radius-lg);padding:16px 17px 15px;box-shadow:var(--shadow-card);
  transition:border-color .2s,transform .2s
}
.kpi-card::after{
  content:"";position:absolute;inset:0 0 auto 0;height:2px;
  background:linear-gradient(90deg,var(--kpi-tone,var(--accent)),transparent 70%);opacity:.75
}
.kpi-card:hover{border-color:var(--border-strong)}
.kpi-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.kpi-label{color:var(--text-muted);font-size:12px;font-weight:500}
.kpi-icon{
  width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--kpi-tone,var(--accent)) 14%,transparent);color:var(--kpi-tone,var(--accent))
}
.kpi-icon svg{width:15px;height:15px}
.kpi-value{font-size:28px;font-weight:700;margin-top:10px;font-variant-numeric:tabular-nums;letter-spacing:-.02em;line-height:1.1}
.kpi-foot{margin-top:8px;font-size:11.5px;color:var(--text-faint);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.kpi-spark{margin-top:10px;height:34px}

.delta{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;padding:1px 7px;border-radius:99px}
.delta.up{color:var(--ok);background:var(--ok-soft)}
.delta.down{color:var(--critical);background:var(--critical-soft)}
.delta.flat{color:var(--text-muted);background:var(--surface-raised)}

.panel{border:1px solid var(--border);background:var(--surface);border-radius:var(--radius-lg);padding:18px;box-shadow:var(--shadow-card)}
.panel-title{font-size:13.5px;font-weight:600;color:var(--text)}
.panel-sub{color:var(--text-muted);font-size:12px;margin-top:3px}
.panel-link{margin-left:auto;font-size:12px;color:var(--accent-strong);text-decoration:none;cursor:pointer;background:none;border:0}
.panel-link:hover{text-decoration:underline}

.section{margin-top:22px}
.panel + .kpi-grid,.panel + .grid-3{margin-top:22px}
.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:10px;flex-wrap:wrap}

.split{display:grid;grid-template-columns:1.35fr 1fr;gap:16px}
.grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}

.globe-panel{min-height:440px;position:relative;overflow:hidden;padding:0}
.globe-overlay{position:absolute;left:18px;top:18px;z-index:2;pointer-events:none}
.globe-overlay .panel-title{color:var(--text)}
.globe-legend{position:absolute;right:18px;top:18px;z-index:2;display:flex;gap:12px;align-items:center;font-size:11px;color:var(--text-muted);pointer-events:none}
.legend-item{display:flex;align-items:center;gap:5px}
.legend-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.legend-ok{background:var(--ok)}
.legend-critical{background:var(--critical)}
.globe-canvas{width:100%;height:400px;display:block}

/* ── Tables ────────────────────────────────────────────────────────────── */

.table-wrap{overflow:auto;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--surface);box-shadow:var(--shadow-card)}
.table{width:100%;border-collapse:collapse;font-size:13px}
.table th,.table td{padding:12px 16px;border-bottom:1px solid var(--border-soft);text-align:left;vertical-align:middle}
.table th{
  color:var(--text-faint);font-weight:600;font-size:11px;letter-spacing:.06em;text-transform:uppercase;
  position:sticky;top:0;background:rgba(15,20,27,.94);backdrop-filter:blur(6px);z-index:1;white-space:nowrap
}
.table th.sortable{cursor:pointer;user-select:none}
.table th.sortable:hover{color:var(--text)}
.table th .sort-arrow{margin-left:5px;opacity:.9;color:var(--accent)}
.table tr:last-child td{border-bottom:0}
.table tbody tr{transition:background .12s}
.table tbody tr:hover td{background:var(--surface-raised)}
.table tbody tr.clickable{cursor:pointer}
.table td.num,.table th.num{text-align:right;font-variant-numeric:tabular-nums}
.table-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 16px;border-top:1px solid var(--border-soft);color:var(--text-muted);font-size:12px;background:var(--surface)}

.mono{font-family:var(--font-mono);font-size:12px}
.muted{color:var(--text-muted)}
.faint{color:var(--text-faint)}
.mono-wrap{white-space:pre-wrap;word-break:break-word}
.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.pill{
  display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;
  border:1px solid var(--border);font-size:11.5px;font-weight:500;color:var(--text-muted);white-space:nowrap
}
.pill::before{content:"";width:5px;height:5px;border-radius:99px;background:currentColor}
.pill.bare::before{display:none}
.pill.bad{border-color:rgba(240,112,123,.35);color:var(--critical);background:var(--critical-soft)}
.pill.good{border-color:rgba(61,220,151,.35);color:var(--ok);background:var(--ok-soft)}
.pill.warn{border-color:rgba(240,179,90,.35);color:var(--warn);background:var(--warn-soft)}
.pill.info{border-color:rgba(108,182,255,.35);color:var(--info);background:var(--info-soft)}

.actions{display:flex;gap:7px;flex-wrap:wrap}
.empty{padding:44px 20px;text-align:center;color:var(--text-muted);font-size:13px}
.empty-state{display:flex;flex-direction:column;align-items:center;gap:8px;padding:48px 20px;text-align:center}
.empty-state .icon{width:44px;height:44px;border-radius:12px;background:var(--surface-raised);color:var(--text-faint);display:flex;align-items:center;justify-content:center}
.empty-state .icon svg{width:20px;height:20px}
.empty-state b{font-size:14px}
.empty-state span{color:var(--text-muted);font-size:12.5px;max-width:42ch}

.notice{
  border:1px solid var(--border);background:var(--surface-raised);
  padding:13px 15px;border-radius:11px;color:var(--text-muted);font-size:12.5px;line-height:1.55
}
.notice b{color:var(--text);font-weight:600}
.notice.error{border-color:rgba(240,112,123,.4);color:var(--critical);background:var(--critical-soft)}
.notice.warn{border-color:rgba(240,179,90,.4);color:var(--warn);background:var(--warn-soft)}
.footer-note{margin-top:14px;color:var(--text-faint);font-size:11.5px;line-height:1.5}

.bar-list{display:flex;flex-direction:column;gap:11px}
.bar-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}
.bar-row-label{font-size:12.5px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{grid-column:1/-1;height:6px;border-radius:99px;background:var(--surface-raised);overflow:hidden;margin-top:1px}
.bar-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-strong));border-radius:99px;transition:width .5s cubic-bezier(.2,.8,.2,1)}
.bar-value{font-size:12px;color:var(--text-muted);text-align:right;font-variant-numeric:tabular-nums}

.progress{height:6px;border-radius:99px;background:var(--surface-raised);overflow:hidden;min-width:70px}
.progress>span{display:block;height:100%;border-radius:99px;background:var(--accent)}
.progress.warn>span{background:var(--warn)}
.progress.bad>span{background:var(--critical)}

.chart-wrap{width:100%;height:220px}
.stat-list{display:flex;flex-direction:column}
.stat-list-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-soft);font-size:13px}
.stat-list-row:last-child{border-bottom:0}
.stat-list-row b{font-variant-numeric:tabular-nums}

/* ── Overlays: modal, drawer, palette, toasts ──────────────────────────── */

.modal-overlay{position:fixed;inset:0;background:rgba(3,5,8,.66);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;animation:fade .15s ease}
.modal-card{background:var(--surface);border:1px solid var(--border-strong);border-radius:16px;padding:22px;width:400px;max-width:92vw;box-shadow:var(--shadow-pop);animation:pop .18s ease}
.modal-title{font-weight:650;font-size:15px;margin-bottom:8px}
.modal-message{margin:0 0 14px;color:var(--text-muted);font-size:13.5px}
.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}

.drawer-overlay{position:fixed;inset:0;background:rgba(3,5,8,.55);backdrop-filter:blur(3px);z-index:900;animation:fade .15s ease}
.drawer{
  position:fixed;top:0;right:0;bottom:0;width:520px;max-width:100vw;z-index:910;
  background:var(--surface);border-left:1px solid var(--border-strong);box-shadow:var(--shadow-pop);
  display:flex;flex-direction:column;animation:slide .22s cubic-bezier(.2,.8,.2,1)
}
@keyframes slide{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}
.drawer-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 22px 16px;border-bottom:1px solid var(--border)}
.drawer-head h2{margin:0;font-size:17px;letter-spacing:-.01em}
.drawer-head p{margin:3px 0 0;color:var(--text-muted);font-size:12.5px}
.drawer-body{padding:20px 22px 30px;overflow-y:auto;display:flex;flex-direction:column;gap:22px}
.drawer-section h3{margin:0 0 10px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint);font-weight:600}
.kv{display:grid;grid-template-columns:130px 1fr;gap:9px 14px;font-size:13px}
.kv dt{color:var(--text-muted)}
.kv dd{margin:0;min-width:0;word-break:break-word}
.mini-list{display:flex;flex-direction:column}
.mini-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--border-soft);font-size:13px}
.mini-row:last-child{border-bottom:0}

.palette-overlay{position:fixed;inset:0;background:rgba(3,5,8,.6);backdrop-filter:blur(5px);z-index:1100;display:flex;justify-content:center;align-items:flex-start;padding-top:14vh;animation:fade .12s ease}
.palette{width:560px;max-width:92vw;background:var(--surface);border:1px solid var(--border-strong);border-radius:16px;box-shadow:var(--shadow-pop);overflow:hidden;animation:pop .16s ease}
.palette-input{width:100%;border:0;border-bottom:1px solid var(--border);background:transparent;padding:16px 18px;font-size:15px;outline:none;color:var(--text)}
.palette-input::placeholder{color:var(--text-faint)}
.palette-list{max-height:340px;overflow-y:auto;padding:8px}
.palette-group{padding:8px 10px 4px;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint);font-weight:600}
.palette-item{display:flex;align-items:center;gap:12px;width:100%;border:0;background:transparent;color:var(--text);text-align:left;padding:10px 11px;border-radius:10px;cursor:pointer;font-size:13.5px}
.palette-item svg{width:17px;height:17px;color:var(--text-muted)}
.palette-item.active{background:var(--accent-soft)}
.palette-item.active svg{color:var(--accent)}
.palette-item small{margin-left:auto;color:var(--text-faint);font-size:11.5px}
.palette-foot{display:flex;gap:16px;padding:9px 16px;border-top:1px solid var(--border);color:var(--text-faint);font-size:11.5px}

.toast-host{position:fixed;right:20px;bottom:20px;z-index:1200;display:flex;flex-direction:column;gap:9px;align-items:flex-end;pointer-events:none}
.toast{
  pointer-events:auto;display:flex;align-items:flex-start;gap:10px;max-width:380px;
  padding:11px 14px;border-radius:11px;background:var(--surface-hover);border:1px solid var(--border-strong);
  box-shadow:var(--shadow-pop);font-size:13px;animation:pop .2s ease
}
.toast svg{width:16px;height:16px;flex-shrink:0;margin-top:2px}
.toast.ok svg{color:var(--ok)}
.toast.error svg{color:var(--critical)}
.toast.warn svg{color:var(--warn)}
.toast.info svg{color:var(--info)}

/* ── Skeletons ─────────────────────────────────────────────────────────── */

.skeleton{
  display:block;border-radius:8px;min-height:12px;
  background:linear-gradient(90deg,var(--surface-raised) 25%,var(--surface-hover) 37%,var(--surface-raised) 63%);
  background-size:400% 100%;animation:shimmer 1.4s ease infinite
}
@keyframes shimmer{0%{background-position:100% 50%}100%{background-position:0 50%}}

/* ── Findings (security pages) ─────────────────────────────────────────── */

.findings-list{display:flex;flex-direction:column;gap:14px}
.finding-row{padding:14px 16px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface-raised)}
.finding-row-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}

/* ── Audit timeline ────────────────────────────────────────────────────── */

.timeline{display:flex;flex-direction:column}
.tl-row{display:grid;grid-template-columns:34px 1fr;gap:14px;padding:14px 4px;border-bottom:1px solid var(--border-soft)}
.tl-row:last-child{border-bottom:0}
.tl-dot{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--surface-raised);color:var(--text-muted)}
.tl-dot svg{width:16px;height:16px}
.tl-dot.good{background:var(--ok-soft);color:var(--ok)}
.tl-dot.bad{background:var(--critical-soft);color:var(--critical)}
.tl-dot.warn{background:var(--warn-soft);color:var(--warn)}
.tl-dot.info{background:var(--info-soft);color:var(--info)}
.tl-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.tl-title{font-weight:600}
.tl-meta{color:var(--text-muted);font-size:12px;margin-top:2px}
.tl-details{margin-top:8px;padding:10px 12px;border-radius:9px;background:var(--bg);border:1px solid var(--border-soft);font-size:12px;color:var(--text-muted)}


/* ── Login ─────────────────────────────────────────────────────────────── */

.login-wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
.login-card{
  width:100%;max-width:400px;padding:30px;
  background:var(--surface);border:1px solid var(--border-strong);border-radius:20px;
  box-shadow:var(--shadow-pop);animation:pop .25s ease
}
.login-brand{display:flex;align-items:center;gap:14px;margin-bottom:24px}
.login-brand h1{margin:0;font-size:19px;letter-spacing:-.01em}
.login-brand p{margin:2px 0 0;color:var(--text-muted);font-size:13px}
.login-foot{margin:18px 0 0;text-align:center;color:var(--text-faint);font-size:11.5px}

/* ── Responsive ────────────────────────────────────────────────────────── */

@media(max-width:1100px){
  .kpi-grid,.kpi-grid.cols-3,.kpi-grid.cols-5,.kpi-grid.cols-6{grid-template-columns:repeat(2,1fr)}
  .split,.grid-2,.grid-3{grid-template-columns:1fr}
  .search-trigger{min-width:0}
  .search-trigger span{display:none}
  .search-trigger .kbd{display:none}
}

@media(max-width:900px){
  .sidebar{position:fixed;left:0;top:0;bottom:0;transform:translateX(-102%);transition:transform .25s cubic-bezier(.2,.8,.2,1);box-shadow:var(--shadow-pop)}
  .sidebar.open{transform:none}
  .scrim.open{display:block;position:fixed;inset:0;background:rgba(3,5,8,.6);backdrop-filter:blur(3px);z-index:35}
  .menu-btn{display:inline-flex}
  .topbar{padding:10px 16px}
  .content{padding:20px 16px 48px}
}

@media(max-width:640px){
  .form-grid{grid-template-columns:1fr}
  .kpi-grid,.kpi-grid.cols-3,.kpi-grid.cols-5,.kpi-grid.cols-6{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .kpi-value{font-size:24px}
  .topbar-time{display:none}
  .globe-canvas{height:300px}
  .globe-panel{min-height:340px}
  .page-header{align-items:flex-start}
  .kv{grid-template-columns:1fr}
}

@media(prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important}
}
`;
