export const css = `
:root{
  color-scheme:dark;
  --bg:#0b0f14;
  --surface:#121821;
  --surface-raised:#182029;
  --border:#232b36;
  --border-soft:#1a212b;
  --text:#e4e9ee;
  --text-muted:#7c8a98;
  --text-faint:#4d5a67;
  --accent:#4fa8c9;
  --accent-soft:#152730;
  --accent-strong:#7cc4e0;
  --warn:#d8a657;
  --warn-soft:#241d10;
  --critical:#d9636b;
  --critical-soft:#241417;
  --ok:#5fae82;
  --ok-soft:#12241a;
  --radius-sm:6px;
  --radius-md:10px;
  --radius-lg:14px;
  --font-ui:-apple-system,BlinkMacSystemFont,"Segoe UI","Inter","Helvetica Neue",Arial,sans-serif;
  --font-mono:ui-monospace,"SFMono-Regular","IBM Plex Mono",Menlo,Consolas,"Liberation Mono",monospace;
}

*{box-sizing:border-box}

body{
  margin:0;
  font-family:var(--font-ui);
  background:var(--bg);
  color:var(--text);
  -webkit-font-smoothing:antialiased
}

button,input,select{font:inherit}

:focus-visible{
  outline:2px solid var(--accent);
  outline-offset:2px
}

.admin-shell{
  min-height:100vh;
  display:flex;
  background:var(--bg)
}

.sidebar{
  width:220px;
  flex-shrink:0;
  border-right:1px solid var(--border);
  background:var(--surface);
  display:flex;
  flex-direction:column;
  position:sticky;
  top:0;
  height:100vh
}

.brand-row{
  display:flex;
  align-items:center;
  gap:10px;
  padding:18px 18px 14px;
  border-bottom:1px solid var(--border)
}

.brand-mark{
  width:26px;
  height:26px;
  border-radius:7px;
  background:var(--accent-soft);
  border:1px solid var(--accent);
  color:var(--accent-strong);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:700;
  font-size:13px;
  flex-shrink:0
}

.brand-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.brand-name{font-weight:600;font-size:14px;letter-spacing:.01em}
.brand-sub{font-size:11px;color:var(--text-muted)}

.status-row{
  display:flex;
  align-items:center;
  gap:7px;
  padding:12px 18px;
  border-bottom:1px solid var(--border);
  font-size:12px;
  color:var(--text-muted)
}

.status-dot{width:7px;height:7px;border-radius:99px;background:var(--ok);flex-shrink:0}

.side-nav{padding:10px;display:flex;flex-direction:column;gap:2px;overflow-y:auto}
.side-nav-group{margin-top:14px;padding:0 10px 4px;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint)}
.side-nav-group:first-child{margin-top:0}

.side-link{
  display:flex;
  align-items:center;
  gap:9px;
  border:1px solid transparent;
  background:transparent;
  color:var(--text-muted);
  padding:9px 10px;
  border-radius:8px;
  cursor:pointer;
  font-size:13px;
  text-align:left;
  text-decoration:none
}

.side-link:hover{background:var(--surface-raised);color:var(--text)}

.side-link.active{
  background:var(--accent-soft);
  color:var(--accent-strong);
  border-color:rgba(79,168,201,.35)
}

.side-link-dot{width:5px;height:5px;border-radius:99px;background:currentColor;opacity:.55;flex-shrink:0}
.side-link.active .side-link-dot{opacity:1}
.side-link-badge{margin-left:auto;font-size:10.5px;color:var(--text-faint);font-variant-numeric:tabular-nums}
.side-link.active .side-link-badge{color:var(--accent-strong)}

.sidebar-footer{margin-top:auto;padding:12px;border-top:1px solid var(--border)}

.logout{
  width:100%;
  border:1px solid var(--border);
  background:var(--surface-raised);
  color:var(--text-muted);
  padding:9px 10px;
  border-radius:8px;
  cursor:pointer;
  font-size:12px
}

.logout:hover{color:var(--text)}

.main-col{flex:1;min-width:0;display:flex;flex-direction:column}

.topbar{
  position:sticky;
  top:0;
  z-index:10;
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
  padding:12px 24px;
  border-bottom:1px solid var(--border);
  background:rgba(11,15,20,.9);
  backdrop-filter:blur(10px)
}

.topbar-time{color:var(--text-faint);font-size:12px;margin-right:auto}

.content{padding:26px 28px 40px;min-width:0}

.page-header{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:16px;
  flex-wrap:wrap;
  margin-bottom:22px
}

.page-heading h1{font-size:22px;font-weight:650;margin:0 0 5px;letter-spacing:-.01em}
.page-heading p{margin:0;color:var(--text-muted);font-size:13px;max-width:52ch}

.page-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

.btn{
  border:1px solid var(--border);
  background:var(--surface);
  color:var(--text);
  padding:9px 13px;
  border-radius:8px;
  cursor:pointer;
  font-size:13px
}

.btn:hover{background:var(--surface-raised)}
.btn.primary{border-color:var(--accent);color:var(--accent-strong);background:var(--accent-soft)}
.btn.danger{border-color:rgba(217,99,107,.5);color:var(--critical);background:var(--critical-soft)}
.btn.small{padding:6px 10px;font-size:12px}
.btn:disabled{opacity:.5;cursor:not-allowed}

.segmented{display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}

.segmented button{
  border:0;
  background:var(--surface);
  color:var(--text-muted);
  padding:8px 12px;
  font-size:12px;
  cursor:pointer;
  border-right:1px solid var(--border)
}

.segmented button:last-child{border-right:0}
.segmented button.active{background:var(--accent-soft);color:var(--accent-strong)}

.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:22px}
.kpi-grid.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.kpi-grid.cols-6{grid-template-columns:repeat(6,minmax(0,1fr))}

.kpi-card{border:1px solid var(--border);background:var(--surface);border-radius:var(--radius-md);padding:16px}
.kpi-label{color:var(--text-muted);font-size:12px}
.kpi-value{font-size:26px;font-weight:650;margin-top:8px;font-variant-numeric:tabular-nums}
.kpi-foot{margin-top:6px;font-size:11px;color:var(--text-faint)}

.panel{border:1px solid var(--border);background:var(--surface);border-radius:var(--radius-lg);padding:16px}
.panel-title{font-size:13px;font-weight:600;color:var(--text)}
.panel-sub{color:var(--text-muted);font-size:12px;margin-top:3px}
.panel-link{margin-left:auto;font-size:12px;color:var(--accent-strong);text-decoration:none;cursor:pointer;background:none;border:0}
.panel-link:hover{text-decoration:underline}

.section{margin-top:20px}
.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px}

.split{display:grid;grid-template-columns:1.35fr 1fr;gap:14px}
.grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}

.globe-panel{min-height:440px;position:relative;overflow:hidden;padding:0}
.globe-overlay{position:absolute;left:18px;top:18px;z-index:2;pointer-events:none}
.globe-overlay .panel-title{color:var(--text)}

.globe-legend{
  position:absolute;
  right:18px;
  top:18px;
  z-index:2;
  display:flex;
  gap:12px;
  align-items:center;
  font-size:11px;
  color:var(--text-muted);
  pointer-events:none
}

.legend-item{display:flex;align-items:center;gap:5px}
.legend-dot{width:7px;height:7px;border-radius:50%}
.legend-ok{background:var(--ok)}
.legend-critical{background:var(--critical)}

.globe-canvas{width:100%;height:400px;display:block}

.table-wrap{overflow:auto;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface)}
.table{width:100%;border-collapse:collapse;font-size:12.5px}

.table th,.table td{
  padding:11px 14px;
  border-bottom:1px solid var(--border-soft);
  text-align:left;
  vertical-align:top
}

.table th{color:var(--text-muted);font-weight:500;font-size:11.5px;position:sticky;top:0;background:var(--surface)}
.table tr:last-child td{border-bottom:0}
.table tr:hover td{background:var(--surface-raised)}

.mono{font-family:var(--font-mono);font-size:12px}
.muted{color:var(--text-muted)}
.mono-wrap{white-space:pre-wrap;word-break:break-word}

.pill{
  display:inline-flex;
  align-items:center;
  gap:5px;
  padding:3px 8px;
  border-radius:999px;
  border:1px solid var(--border);
  font-size:11px
}

.pill::before{content:"";width:5px;height:5px;border-radius:99px;background:currentColor}
.pill.bad{border-color:rgba(217,99,107,.4);color:var(--critical);background:var(--critical-soft)}
.pill.good{border-color:rgba(95,174,130,.4);color:var(--ok);background:var(--ok-soft)}
.pill.warn{border-color:rgba(216,166,87,.4);color:var(--warn);background:var(--warn-soft)}

.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.field{display:grid;gap:6px}
.field label{color:var(--text-muted);font-size:12px}

.field input,.field select{
  width:100%;
  padding:10px 11px;
  border:1px solid var(--border);
  border-radius:8px;
  background:var(--bg);
  color:var(--text)
}

.field input:focus,.field select:focus{border-color:var(--accent)}

.actions{display:flex;gap:7px;flex-wrap:wrap}
.empty{padding:34px 20px;text-align:center;color:var(--text-muted);font-size:13px}

.search-input{
  width:100%;
  max-width:320px;
  padding:9px 12px;
  border:1px solid var(--border);
  border-radius:8px;
  background:var(--bg);
  color:var(--text);
  font-size:13px
}

.search-input:focus{border-color:var(--accent)}

.notice{
  border:1px solid var(--border);
  background:var(--surface-raised);
  padding:13px 14px;
  border-radius:10px;
  color:var(--text-muted);
  font-size:12.5px;
  line-height:1.5
}

.notice b{color:var(--text);font-weight:600}
.notice.error{border-color:rgba(217,99,107,.4);color:var(--critical);background:var(--critical-soft)}

.footer-note{margin-top:14px;color:var(--text-faint);font-size:11.5px;line-height:1.5}

.bar-list{display:flex;flex-direction:column;gap:9px}
.bar-row{display:grid;grid-template-columns:1fr 90px;gap:10px;align-items:center}
.bar-row-label{font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{grid-column:1/-1;height:6px;border-radius:99px;background:var(--surface-raised);overflow:hidden;margin-top:2px}
.bar-fill{height:100%;background:var(--accent);border-radius:99px}
.bar-value{font-size:11.5px;color:var(--text-muted);text-align:right;font-variant-numeric:tabular-nums}

.chart-wrap{width:100%;height:220px}

.stat-list{display:flex;flex-direction:column}
.stat-list-row{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border-soft);font-size:12.5px}
.stat-list-row:last-child{border-bottom:0}
.stat-list-row b{font-variant-numeric:tabular-nums}

@media(max-width:1000px){
  .kpi-grid,.kpi-grid.cols-3,.kpi-grid.cols-6{grid-template-columns:repeat(2,1fr)}
  .admin-shell{flex-direction:column}
  .sidebar{width:100%;height:auto;position:sticky;flex-direction:row;align-items:center;overflow-x:auto}
  .brand-row,.status-row,.sidebar-footer{display:none}
  .side-nav{flex-direction:row;padding:10px}
  .side-nav-group{display:none}
  .split,.grid-2,.grid-3{grid-template-columns:1fr}
}

@media(max-width:640px){
  .content{padding:16px}
  .kpi-grid,.kpi-grid.cols-3,.kpi-grid.cols-6,.form-grid{grid-template-columns:1fr}
  .topbar-time{display:none}
  .globe-canvas{height:300px}
  .globe-panel{min-height:340px}
  .page-header{align-items:flex-start}
}
`;
