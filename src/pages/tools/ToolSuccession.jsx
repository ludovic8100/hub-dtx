import { SUPABASE_PROJECT_REF } from '../../config/env'
import { useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useAuth } from '../../lib/auth'

export default function ToolsSuccession() {
  const { user } = useAuth()
  const iframeRef = useRef(null)

  const blobUrl = useMemo(() => {
    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body>
<style>
:root {
  --bg: #f5f6fa;
  --sidebar: #1a2744;
  --sidebar-light: #243352;
  --card: #ffffff;
  --text: #1a2744;
  --text-light: #6b7a99;
  --accent: #2563eb;
  --green: #16a34a;
  --red: #dc2626;
  --orange: #ea580c;
  --border: #e2e8f0;
  --radius: 10px;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); display: flex; min-height: 100vh; }

/* SIDEBAR */
.sidebar { width: 360px; min-width: 360px; background: var(--sidebar); color: #fff; padding: 24px 20px; overflow-y: auto; }
.sidebar h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.sidebar .subtitle { font-size: 12px; color: #8b9dc3; margin-bottom: 24px; }
.section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #8b9dc3; margin: 20px 0 10px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; }
.field { margin-bottom: 12px; }
.field label { display: block; font-size: 12px; color: #c8d6e5; margin-bottom: 3px; }
.field select, .field input[type="number"], .field input[type="text"], .field input[type="date"] {
  width: 100%; padding: 7px 10px; border: 1px solid #3a4f6f; border-radius: 6px;
  background: var(--sidebar-light); color: #fff; font-size: 13px; outline: none;
}
.field select option { background: var(--sidebar-light); }
.field input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
.field .hint { font-size: 11px; color: #6b7a99; margin-top: 2px; }
.field-row { display: flex; gap: 8px; }
.field-row .field { flex: 1; }
.toggle-row { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
.toggle { position: relative; width: 44px; height: 24px; cursor: pointer; flex-shrink: 0; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle .slider { position: absolute; inset: 0; background: #3a4f6f; border-radius: 12px; transition: .2s; }
.toggle .slider:before { content:''; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .2s; }
.toggle input:checked + .slider { background: var(--accent); }
.toggle input:checked + .slider:before { transform: translateX(20px); }
.toggle-label { font-size: 13px; color: #c8d6e5; }
.av-section { display: none; padding: 12px; background: rgba(37,99,235,.1); border-radius: 8px; margin-top: 10px; }
.av-section.show { display: block; }

/* CLIENT MANAGEMENT */
.client-bar { background: rgba(37,99,235,.15); border-radius: 8px; padding: 14px; margin-bottom: 20px; }
.client-bar h2 { font-size: 13px; font-weight: 600; color: #c8d6e5; margin-bottom: 10px; letter-spacing: .5px; }
.client-bar .btn-row { display: flex; gap: 6px; margin-top: 10px; }
.client-bar .btn-row button {
  flex: 1; padding: 8px 4px; border: none; border-radius: 6px; font-size: 11px; font-weight: 600;
  cursor: pointer; transition: opacity .15s;
}
.client-bar .btn-row button:hover { opacity: .85; }
.btn-save { background: var(--accent); color: #fff; }
.btn-new { background: #16a34a; color: #fff; }
.btn-delete { background: #dc2626; color: #fff; }
.client-bar .saved-list { margin-top: 10px; }
.client-bar .saved-item {
  display: flex; align-items: center; gap: 6px; padding: 6px 8px; margin-bottom: 4px;
  background: rgba(255,255,255,.06); border-radius: 6px; cursor: pointer; transition: background .15s;
}
.client-bar .saved-item:hover { background: rgba(255,255,255,.12); }
.client-bar .saved-item .si-name { flex: 1; font-size: 12px; color: #fff; font-weight: 500; }
.client-bar .saved-item .si-date { font-size: 10px; color: #6b7a99; }
.client-bar .saved-item .si-del { color: #dc2626; cursor: pointer; font-size: 14px; padding: 0 4px; }
.client-bar .status-msg { font-size: 11px; color: #16a34a; margin-top: 6px; min-height: 16px; }
.client-bar .status-msg.error { color: #dc2626; }
.db-unavailable { font-size: 11px; color: #fca5a5; padding: 8px; background: rgba(220,38,38,.1); border-radius: 6px; }
.search-input { width:100%; padding:6px 8px 6px 28px; border:1px solid #3a4f6f; border-radius:6px; background:var(--sidebar-light) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%238b9dc3' viewBox='0 0 24 24'%3E%3Cpath d='M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'/%3E%3C/svg%3E") no-repeat 8px center; color:#fff; font-size:12px; margin-bottom:6px; }
.search-input::placeholder { color:#6b7a99; }

/* DB LOOKUP */
.db-lookup { background: rgba(22,163,74,.12); border-radius: 8px; padding: 14px; margin-bottom: 16px; border: 1px solid rgba(22,163,74,.25); }
.db-lookup h2 { font-size: 13px; font-weight: 600; color: #86efac; margin-bottom: 10px; letter-spacing: .5px; display: flex; align-items: center; gap: 6px; }
.db-lookup h2 .db-icon { font-size: 15px; }
.db-lookup-input { width:100%; padding:7px 10px 7px 30px; border:1px solid #3a4f6f; border-radius:6px; background:var(--sidebar-light) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%2386efac' viewBox='0 0 24 24'%3E%3Cpath d='M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'/%3E%3C/svg%3E") no-repeat 8px center; color:#fff; font-size:13px; }
.db-lookup-input::placeholder { color:#6b7a99; }
.db-results { max-height: 220px; overflow-y: auto; margin-top: 8px; }
.db-result-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 3px; background: rgba(255,255,255,.06); border-radius: 6px; cursor: pointer; transition: background .15s; }
.db-result-item:hover { background: rgba(22,163,74,.2); }
.db-result-item .ri-name { font-size: 12px; color: #fff; font-weight: 500; flex: 1; }
.db-result-item .ri-detail { font-size: 10px; color: #8b9dc3; }
.db-result-item .ri-cp { font-size: 10px; color: #86efac; background: rgba(22,163,74,.2); padding: 1px 6px; border-radius: 3px; }
.db-lookup .db-status { font-size: 11px; color: #8b9dc3; margin-top: 6px; min-height: 14px; }
.db-lookup .db-status.loading { color: #fbbf24; }
.db-lookup .db-status.error { color: #fca5a5; }
.db-lookup .prefill-info { font-size: 10px; color: #86efac; margin-top: 6px; padding: 6px 8px; background: rgba(22,163,74,.1); border-radius: 4px; line-height: 1.5; }
.db-modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:9999; align-items:center; justify-content:center; }
.db-modal-overlay.show { display:flex; }
.db-modal { background:#1a2744; border-radius:10px; width:380px; max-height:80vh; padding:18px; box-shadow:0 8px 32px rgba(0,0,0,.5); }
.db-modal h3 { font-size:14px; color:#86efac; margin-bottom:10px; }
.db-modal input { width:100%; padding:8px 10px; border:1px solid #3a4f6f; border-radius:6px; background:#243352; color:#fff; font-size:13px; outline:none; margin-bottom:8px; }
.db-modal .modal-results { max-height:300px; overflow-y:auto; }
.db-modal .modal-result-item { padding:8px 10px; cursor:pointer; border-radius:5px; font-size:12px; color:#c8d6e5; display:flex; justify-content:space-between; align-items:center; }
.db-modal .modal-result-item:hover { background:rgba(22,163,74,.15); }
.db-modal .modal-result-item .mri-name { font-weight:600; color:#fff; }
.db-modal .modal-result-item .mri-info { font-size:11px; color:#6b7a99; }
.db-modal .modal-close { float:right; background:none; border:none; color:#6b7a99; font-size:18px; cursor:pointer; }
.db-modal .modal-close:hover { color:#fff; }

/* DYNAMIC ITEMS (children, biens, companies, legs) */
.item-row { background: rgba(255,255,255,.06); border-radius: 6px; padding: 10px; margin-bottom: 6px; position: relative; }
.item-row .item-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.item-row .item-full { grid-column: 1 / -1; }
.item-row label { font-size: 10px; color: #8b9dc3; display: block; }
.item-row select, .item-row input { width: 100%; padding: 5px 6px; margin-top: 2px; border: 1px solid #3a4f6f; border-radius: 4px; background: var(--sidebar-light); color: #fff; font-size: 11px; }
.item-row input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); }
.item-remove { position: absolute; top: 4px; right: 6px; background: none; border: none; color: #f87171; cursor: pointer; font-size: 14px; line-height: 1; }
.item-tag { display: inline-block; font-size: 9px; padding: 1px 6px; border-radius: 3px; background: rgba(37,99,235,.3); color: #93c5fd; margin-left: 6px; }
.btn-add { width: 100%; padding: 7px; border: 1px dashed #3a4f6f; border-radius: 6px; background: transparent; color: #8b9dc3; cursor: pointer; font-size: 12px; transition: background .2s; }
.btn-add:hover { background: rgba(255,255,255,.06); color: #fff; }
.separator { border: none; border-top: 1px solid #2a3d5c; margin: 16px 0; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.badge-red { background: rgba(220,38,38,.2); color: #fca5a5; }
.badge-green { background: rgba(22,163,74,.2); color: #86efac; }
.badge-orange { background: rgba(234,88,12,.2); color: #fdba74; }

/* Nested company biens */
.sub-items { margin: 8px 0 4px 10px; padding-left: 10px; border-left: 2px solid rgba(37,99,235,.3); }
.sub-item-row { background: rgba(255,255,255,.04); border-radius: 5px; padding: 8px; margin-bottom: 4px; position: relative; }
.sub-item-row label { font-size: 10px; color: #6b7a99; display: block; }
.sub-item-row select, .sub-item-row input { width: 100%; padding: 4px 6px; margin-top: 2px; border: 1px solid #3a4f6f; border-radius: 4px; background: var(--sidebar-light); color: #fff; font-size: 11px; }
.sub-item-row .sub-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.btn-add-sub { width: 100%; padding: 5px; border: 1px dashed #2a3d5c; border-radius: 5px; background: transparent; color: #6b7a99; cursor: pointer; font-size: 10px; margin-top: 4px; }
.btn-add-sub:hover { color: #8b9dc3; background: rgba(255,255,255,.03); }

/* PARTNER SECTION */
.partner-box { background: rgba(37,99,235,.08); border-radius: 8px; padding: 12px; margin-bottom: 10px; position: relative; }
.partner-box .partner-name { font-size: 13px; font-weight: 600; color: #93c5fd; margin-bottom: 8px; }

/* Age display badge */
.age-badge { font-size: 10px; color: #fdba74; background: rgba(234,88,12,.15); padding: 1px 6px; border-radius: 3px; margin-left: 4px; }
.minor-badge { font-size: 10px; color: #fca5a5; background: rgba(220,38,38,.2); padding: 1px 6px; border-radius: 3px; margin-left: 4px; font-weight: 600; }

/* MAIN */
.main { flex: 1; padding: 24px 28px; overflow-y: auto; }
.main h2 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
.main .scenario-label { font-size: 13px; color: var(--text-light); margin-bottom: 20px; }

/* KPI CARDS */
.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.kpi { background: var(--card); border-radius: var(--radius); padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.kpi .kpi-label { font-size: 12px; color: var(--text-light); margin-bottom: 6px; }
.kpi .kpi-value { font-size: 22px; font-weight: 700; }
.kpi .kpi-sub { font-size: 11px; color: var(--text-light); margin-top: 4px; }
.kpi-green .kpi-value { color: var(--green); }
.kpi-red .kpi-value { color: var(--red); }
.kpi-orange .kpi-value { color: var(--orange); }

/* CARDS */
.card { background: var(--card); border-radius: var(--radius); padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.06); margin-bottom: 20px; }
.card h3 { font-size: 15px; font-weight: 600; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
.card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }

/* TABLE */
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; padding: 8px 10px; border-bottom: 2px solid var(--border); color: var(--text-light); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
td { padding: 8px 10px; border-bottom: 1px solid var(--border); }
tr:last-child td { border-bottom: none; }
.text-right { text-align: right; }
.text-bold { font-weight: 600; }
.text-red { color: var(--red); }
.text-green { color: var(--green); }
.text-orange { color: var(--orange); }
tr.total-row { background: #f8fafc; font-weight: 600; }
tr.total-row td { border-top: 2px solid var(--border); }

/* BARS */
.bar-chart { display: flex; flex-direction: column; gap: 8px; }
.bar-item { display: flex; align-items: center; gap: 10px; }
.bar-label { width: 100px; font-size: 12px; color: var(--text-light); text-align: right; flex-shrink: 0; }
.bar-track { flex: 1; height: 28px; background: #f1f5f9; border-radius: 6px; overflow: hidden; position: relative; }
.bar-fill { height: 100%; border-radius: 6px; display: flex; align-items: center; padding: 0 10px; font-size: 11px; color: #fff; font-weight: 600; transition: width .4s ease; min-width: fit-content; }
.bar-amount { width: 90px; font-size: 12px; text-align: right; flex-shrink: 0; font-weight: 600; }

/* ALERT */
.alert { padding: 14px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; display: flex; align-items: flex-start; gap: 10px; }
.alert-red { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.alert-green { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.alert-orange { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; }
.alert-icon { font-size: 18px; flex-shrink: 0; }

/* COMPARISON */
.comparison { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0; align-items: start; }
.comp-col { padding: 16px; }
.comp-col h4 { font-size: 13px; font-weight: 600; margin-bottom: 10px; text-align: center; }
.comp-arrow { display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--accent); padding-top: 40px; }
.comp-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid var(--border); }
.comp-item:last-child { border: none; }

/* CONSEILS */
.conseil { padding: 12px 14px; border-left: 3px solid var(--accent); background: #f8fafc; margin-bottom: 10px; border-radius: 0 6px 6px 0; font-size: 13px; }
.conseil strong { color: var(--accent); }
.conseil.urgent { border-left-color: var(--red); }
.conseil.urgent strong { color: var(--red); }

/* TESTAMENT LEGS */
.leg-row { background: rgba(255,255,255,.06); border-radius: 6px; padding: 8px; margin-bottom: 8px; position: relative; }
.leg-row select, .leg-row input { width: 100%; padding: 5px 6px; margin-top: 3px; border: 1px solid #3a4f6f; border-radius: 4px; background: var(--sidebar-light); color: #fff; font-size: 11px; }
.leg-row label { font-size: 10px; color: #8b9dc3; display: block; }
.leg-row .leg-grid { display: grid; grid-template-columns: 1fr 80px; gap: 6px; }
.leg-remove { position: absolute; top: 4px; right: 6px; background: none; border: none; color: #f87171; cursor: pointer; font-size: 14px; line-height: 1; }

/* PREFILL PANEL */
.prefill-panel { background: #1a2744; border: 1px solid #2a3f5f; border-radius: 8px; margin: 8px 0; padding: 10px; }
.prefill-panel h3 { color: #86efac; font-size: 12px; margin: 0 0 8px; display: flex; align-items: center; gap: 6px; }
.prefill-panel h3 .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(134,239,172,.3); border-top-color: #86efac; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.prefill-section { margin-bottom: 8px; }
.prefill-section-title { font-size: 11px; color: #8b9dc3; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.prefill-section-title .count { background: #2563eb; color: #fff; font-size: 9px; padding: 1px 6px; border-radius: 10px; }
.prefill-item { display: flex; align-items: center; gap: 6px; padding: 5px 6px; background: #0f1a2e; border-radius: 6px; margin-bottom: 3px; font-size: 11px; color: #d1ddf0; }
.prefill-item .pi-icon { flex-shrink: 0; width: 18px; text-align: center; font-size: 13px; }
.prefill-item .pi-text { flex: 1; line-height: 1.3; }
.prefill-item .pi-sub { color: #6b7a99; font-size: 10px; }
.prefill-item .pi-actions { display: flex; gap: 3px; flex-shrink: 0; }
.prefill-item .pi-btn { border: none; border-radius: 4px; padding: 3px 8px; font-size: 10px; cursor: pointer; font-weight: 600; }
.prefill-item .pi-accept { background: rgba(22,163,74,.3); color: #86efac; }
.prefill-item .pi-accept:hover { background: rgba(22,163,74,.5); }
.prefill-item .pi-skip { background: rgba(107,122,153,.2); color: #6b7a99; }
.prefill-item .pi-skip:hover { background: rgba(107,122,153,.4); }
.prefill-item.pi-accepted { opacity: .5; }
.prefill-item.pi-accepted .pi-text { text-decoration: line-through; }
.prefill-accept-all { border: 1px solid rgba(22,163,74,.4); background: rgba(22,163,74,.15); color: #86efac; border-radius: 6px; padding: 5px 12px; font-size: 11px; cursor: pointer; font-weight: 600; width: 100%; margin-top: 4px; }
.prefill-accept-all:hover { background: rgba(22,163,74,.3); }
.prefill-empty { font-size: 10px; color: #4a5a7a; font-style: italic; padding: 3px 0; }

/* ASSURANCES VIE */
.av-contract { background: #0f1a2e; border-radius: 6px; padding: 8px; margin-bottom: 4px; border: 1px solid #1e2d4a; }
.av-contract .av-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.av-contract .av-type { font-size: 11px; font-weight: 600; color: #93c5fd; }
.av-contract .av-comp { font-size: 10px; color: #6b7a99; }
.av-contract .av-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.av-contract .av-grid label { font-size: 10px; color: #6b7a99; }
.av-contract .av-grid input, .av-contract .av-grid select { font-size: 11px; padding: 4px 6px; }

/* SCHEMA SUCCESSION */
.schema-svg { width: 100%; overflow-x: auto; }
.schema-svg svg { display: block; margin: 0 auto; }
.schema-svg text { font-family: 'Segoe UI', system-ui, sans-serif; }

/* RESPONSIVE */
@media (max-width: 1200px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } .card-grid { grid-template-columns: 1fr; } }
@media (max-width: 900px) { body { flex-direction: column; } .sidebar { width: 100%; min-width: unset; } }
</style>


<div class="sidebar">
  <h1>Simulateur Successoral</h1>
  <div class="subtitle">Dynassur — Outil de planning</div>

  <!-- DB LOOKUP -->
  <div class="db-lookup" id="dbLookup">
    <h2><span class="db-icon">&#128269;</span> RECHERCHE BASE CLIENTS</h2>
    <input type="text" class="db-lookup-input" id="dbSearchInput" placeholder="Tapez un nom de client..." oninput="onDbSearch(this.value)">
    <div class="db-status" id="dbSearchStatus"></div>
    <div class="db-results" id="dbResults"></div>
    <div id="prefillPanel" style="display:none"></div>
  </div>

  <!-- CLIENT MANAGEMENT -->
  <div class="client-bar" id="clientBar">
    <h2>GESTION CLIENTS</h2>
    <div class="field">
      <label>Nom du client / dossier</label>
      <input type="text" id="clientName" placeholder="Ex: Famille Dupont">
    </div>
    <div class="btn-row">
      <button class="btn-save" onclick="saveSimulation()">Sauver</button>
      <button class="btn-new" onclick="newSimulation()">Nouveau</button>
    </div>
    <div class="status-msg" id="statusMsg"></div>
    <input type="text" class="search-input" id="searchClient" placeholder="Rechercher un client..." oninput="filterSavedList()">
    <div class="saved-list" id="savedList">
      <div style="font-size:11px;color:#6b7a99;text-align:center;padding:10px">Chargement...</div>
    </div>
  </div>

  <!-- PERSONNE -->
  <div class="section-title">Personne</div>
  <div class="field">
    <label>Nom</label>
    <input type="text" id="personName" placeholder="Nom du défunt simulé" onchange="update()">
  </div>
  <div class="field-row">
    <div class="field">
      <label>Date de naissance</label>
      <input type="date" id="personDob" value="1978-06-15" onchange="update()">
    </div>
    <div class="field">
      <label>Région fiscale</label>
      <select id="region" onchange="update()">
        <option value="wallonie" selected>Wallonie</option>
        <option value="bruxelles">Bruxelles</option>
        <option value="flandre">Flandre</option>
      </select>
    </div>
  </div>

  <!-- CONJOINT / PARTENAIRE -->
  <hr class="separator">
  <div class="section-title">Conjoint / Partenaire <span style="display:flex;gap:4px"><button class="btn-add" style="width:auto;padding:3px 12px;font-size:11px;border:1px solid #3a4f6f" id="btnAddPartner" onclick="addPartner()">+ Ajouter</button><button class="btn-add db-search-btn" style="width:auto;padding:3px 8px;font-size:11px;border:1px solid rgba(22,163,74,.4);background:rgba(22,163,74,.15);color:#86efac;display:none" id="btnSearchPartner" onclick="openDbSearchModal('partner')">&#128269; DB</button></span></div>
  <div id="partnerContainer"></div>

  <!-- ENFANTS -->
  <hr class="separator">
  <div class="section-title">Enfants <span style="display:flex;gap:4px"><button class="btn-add" style="width:auto;padding:3px 12px;font-size:11px;border:1px solid #3a4f6f" onclick="addChild()">+ Ajouter</button><button class="btn-add db-search-btn" style="width:auto;padding:3px 8px;font-size:11px;border:1px solid rgba(22,163,74,.4);background:rgba(22,163,74,.15);color:#86efac;display:none" id="btnSearchChild" onclick="openDbSearchModal('child')">&#128269; DB</button></span></div>
  <div id="childrenContainer"></div>

  <!-- PATRIMOINE PERSONNEL -->
  <hr class="separator">
  <div class="section-title">Patrimoine personnel</div>
  <div id="biensContainer"></div>
  <button class="btn-add" onclick="addBien()">+ Ajouter un bien immobilier</button>

  <!-- SOCIÉTÉS -->
  <hr class="separator">
  <div class="section-title">Sociétés <button class="btn-add" style="width:auto;padding:3px 12px;font-size:11px;border:1px solid #3a4f6f" onclick="addCompany()">+ Ajouter</button></div>
  <div id="companiesContainer"></div>

  <!-- MOBILIER / ÉPARGNE -->
  <hr class="separator">
  <div class="section-title">Épargne / Mobilier</div>
  <div class="field-row">
    <div class="field">
      <label>Mobilier / épargne (vous)</label>
      <input type="number" id="mobilier" value="0" step="5000" onchange="update()">
    </div>
    <div class="field">
      <label>Mobilier partenaire</label>
      <input type="number" id="mobilierPartner" value="0" step="5000" onchange="update()">
    </div>
  </div>

  <!-- ASSURANCES VIE -->
  <hr class="separator">
  <div class="section-title">Assurances Vie <button class="btn-add" style="width:auto;padding:3px 12px;font-size:11px;border:1px solid #3a4f6f" onclick="addAssuranceVie()">+ Ajouter</button></div>
  <div id="assurancesVieContainer"></div>
  <div style="margin-top:6px">
    <div class="field">
      <label>Assurance décès (SRDU / temporaire décès) — capital total</label>
      <input type="number" id="capitalDeces" value="0" step="10000" onchange="update()">
    </div>
    <div class="field">
      <label>Bénéficiaire décès</label>
      <select id="beneficiaire" onchange="update()">
        <option value="legal">Héritiers légaux</option>
        <option value="enfants">Les enfants</option>
        <option value="partenaire">Le/la partenaire</option>
        <option value="mixte">Mixte (50/50)</option>
      </select>
    </div>
  </div>

  <!-- EXONÉRATIONS -->
  <hr class="separator">
  <div class="section-title">Exonérations</div>
  <div class="toggle-row">
    <label class="toggle"><input type="checkbox" id="toggleLogement" onchange="update()"><span class="slider"></span></label>
    <span class="toggle-label">Exonération logement familial</span>
  </div>
  <div class="av-section" id="logementInfo" style="font-size:11px;color:#8b9dc3;line-height:1.5">
    Wallonie/BXL : abattement sur la part nette du logement familial pour le conjoint/cohabitant légal.<br>
    Wallonie : exo totale sur 1ère tranche (160.000 €).<br>
    BXL : abattement de 500.000 € max sur le logement.<br>
    <span style="color:#fca5a5">Non applicable aux cohabitants de fait</span>
  </div>

  <!-- DONATION -->
  <hr class="separator">
  <div class="section-title">Simulation donation</div>
  <div class="toggle-row">
    <label class="toggle"><input type="checkbox" id="toggleDonation" onchange="update()"><span class="slider"></span></label>
    <span class="toggle-label">Simuler une donation</span>
  </div>
  <div class="av-section" id="donationSection">
    <div class="field">
      <label>Type de donation</label>
      <select id="donationType" onchange="update()">
        <option value="mobiliere">Mobilière (parts, épargne)</option>
        <option value="immobiliere">Immobilière</option>
      </select>
    </div>
    <div class="field">
      <label>Montant donné</label>
      <input type="number" id="donationMontant" value="0" step="10000" onchange="update()">
    </div>
    <div class="field">
      <label>Bénéficiaire</label>
      <select id="donationBenef" onchange="update()">
        <option value="enfant">Un enfant (ligne directe)</option>
        <option value="partenaire">Le/la partenaire</option>
        <option value="autre">Autre personne</option>
      </select>
    </div>
    <div class="field">
      <label>Nature</label>
      <select id="donationNature" onchange="update()">
        <option value="avance">Avance d'hoirie (imputable sur la part)</option>
        <option value="horspart">Hors part / par préciput (en plus de la part)</option>
      </select>
    </div>
    <div class="hint" style="color:#8b9dc3;font-size:11px;margin-top:6px">
      Avance d'hoirie = rapportable au décès (déduite de la part).<br>
      Hors part = prélevée sur la quotité disponible (50%).
    </div>
  </div>

  <!-- TESTAMENT -->
  <hr class="separator">
  <div class="section-title">Simulation testament</div>
  <div class="toggle-row">
    <label class="toggle"><input type="checkbox" id="toggleTestament" onchange="update()"><span class="slider"></span></label>
    <span class="toggle-label">Simuler un testament</span>
  </div>
  <div class="av-section" id="testamentSection">
    <div style="font-size:11px;color:#8b9dc3;margin-bottom:10px">
      Attribuez des biens spécifiques à des personnes. Les biens non attribués suivent la dévolution légale.
    </div>
    <div id="legsContainer"></div>
    <button onclick="addLeg()" style="width:100%;padding:8px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;margin-top:8px">+ Ajouter un legs</button>
  </div>

  <!-- COMPARAISON 2028 -->
  <hr class="separator">
  <div class="section-title">Comparaison temporelle</div>
  <div class="toggle-row">
    <label class="toggle"><input type="checkbox" id="toggle2028" onchange="update()"><span class="slider"></span></label>
    <span class="toggle-label">Comparer MNT vs Réforme 2028</span>
  </div>
  <div id="reform2028Info" class="av-section" style="font-size:11px;color:#8b9dc3;line-height:1.5">
    Décret wallon voté 12/2024.<br>Entrée en vigueur : 01/01/2028.<br>
    Ligne directe : max 15% (vs 30%)<br>
    Autres : max 40% (vs 80%)<br>
    Abattement : 25.000 € exonérés<br>
    <span style="color:#fdba74">Tranches intermédiaires = projection</span>
  </div>

  <!-- ASSURANCE-VIE -->
  <hr class="separator">
  <div class="toggle-row">
    <label class="toggle"><input type="checkbox" id="toggleAV" onchange="update()"><span class="slider"></span></label>
    <span class="toggle-label">Simuler assurance-vie supplémentaire</span>
  </div>
  <div class="av-section" id="avSection">
    <div class="field">
      <label>Type de contrat</label>
      <select id="avType" onchange="update()">
        <option value="AAB">AAB (vous = preneur/assuré, partenaire = bénéf.)</option>
        <option value="ABA">ABA (vous = preneur/bénéf., partenaire = assuré)</option>
        <option value="ABC">ABC (vous = preneur, partenaire = assuré, enfant = bénéf.)</option>
      </select>
    </div>
    <div class="field">
      <label>Capital décès simulé</label>
      <input type="number" id="avCapital" value="0" step="10000" onchange="update()">
    </div>
  </div>
</div>

<!-- DB Search Modal -->
<div class="db-modal-overlay" id="dbModalOverlay" onclick="if(event.target===this)closeDbModal()">
  <div class="db-modal">
    <button class="modal-close" onclick="closeDbModal()">&times;</button>
    <h3 id="dbModalTitle">Rechercher un client</h3>
    <input type="text" id="dbModalSearch" placeholder="Tapez un nom..." oninput="onDbModalSearch(this.value)">
    <div class="modal-results" id="dbModalResults"></div>
  </div>
</div>

<div class="main" id="results">
  <!-- Filled by JS -->
</div>


<script>
// ============================================================
// BARÈMES DROITS DE SUCCESSION
// ============================================================
const BRACKETS = {
  wallonie: {
    direct: [[12500,.03],[25000,.04],[50000,.05],[100000,.07],[150000,.10],[200000,.14],[250000,.18],[500000,.24],[Infinity,.30]],
    fratrie: [[12500,.20],[25000,.25],[75000,.35],[175000,.50],[Infinity,.65]],
    oncle: [[12500,.25],[25000,.30],[75000,.40],[175000,.55],[Infinity,.70]],
    autres: [[12500,.30],[25000,.35],[75000,.60],[175000,.80],[Infinity,.80]]
  },
  bruxelles: {
    direct: [[12500,.03],[25000,.04],[50000,.05],[100000,.07],[150000,.10],[200000,.14],[250000,.18],[500000,.24],[Infinity,.30]],
    fratrie: [[12500,.20],[25000,.25],[75000,.35],[175000,.50],[Infinity,.65]],
    oncle: [[12500,.25],[25000,.30],[75000,.40],[175000,.55],[Infinity,.70]],
    autres: [[12500,.30],[25000,.35],[75000,.60],[175000,.80],[Infinity,.80]]
  },
  flandre: {
    direct: [[50000,.03],[250000,.09],[Infinity,.27]],
    fratrie: [[35000,.25],[75000,.30],[Infinity,.55]],
    autres: [[35000,.25],[75000,.45],[Infinity,.55]]
  }
};

const BRACKETS_2028 = {
  wallonie: {
    direct: [[25000,0],[50000,.03],[100000,.05],[150000,.05],[200000,.09],[250000,.10],[350000,.12],[500000,.15],[Infinity,.15]],
    fratrie: [[12500,.10],[25000,.13],[75000,.16],[175000,.25],[Infinity,.33]],
    oncle: [[12500,.13],[25000,.15],[75000,.20],[175000,.28],[Infinity,.35]],
    autres: [[5000,0],[12500,.15],[25000,.18],[75000,.30],[Infinity,.40]]
  },
  bruxelles: null,
  flandre: null
};

const DONATION_IMMO = {
  wallonie: {
    direct: [[25000,.03],[50000,.04],[175000,.09],[250000,.12],[500000,.18],[Infinity,.27]],
    autres: [[25000,.10],[50000,.20],[175000,.30],[250000,.35],[500000,.40],[Infinity,.40]]
  }
};
const DONATION_IMMO_2028 = {
  wallonie: {
    direct: [[25000,.03],[50000,.06],[175000,.10],[Infinity,.14]],
    autres: [[25000,.09],[50000,.12],[175000,.16],[Infinity,.20]]
  }
};
const DONATION_MOB = { direct: 0.033, autres: 0.055 };

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function ageFromDob(dobStr) {
  if (!dobStr) return 0;
  const dob = new Date(dobStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return Math.max(0, age);
}

function usufruitCoeff(age) {
  if (age < 20) return 0.72;
  if (age < 30) return 0.64;
  if (age < 40) return 0.56;
  if (age < 50) return 0.48;
  if (age < 55) return 0.44;
  if (age < 60) return 0.36;
  if (age < 65) return 0.28;
  if (age < 70) return 0.20;
  if (age < 75) return 0.16;
  if (age < 80) return 0.08;
  return 0.04;
}

function calcTax(amount, brackets) {
  let tax = 0, prev = 0, detail = [];
  for (const [limit, rate] of brackets) {
    if (amount <= prev) break;
    const taxable = Math.min(amount, limit) - prev;
    const t = taxable * rate;
    tax += t;
    detail.push({ from: prev, to: Math.min(amount, limit), rate, taxable, tax: t });
    prev = limit;
  }
  return { tax: Math.round(tax), detail, effectiveRate: amount > 0 ? tax / amount : 0 };
}

function getBracketType(statut) {
  if (statut === 'marie' || statut === 'legal') return 'direct';
  return 'autres';
}

function fmt(n) { return new Intl.NumberFormat('fr-BE', { style:'currency', currency:'EUR', minimumFractionDigits:0, maximumFractionDigits:0 }).format(n); }
function pct(n) { return (n * 100).toFixed(1) + '%'; }

// ============================================================
// DATA MODEL — Dynamic arrays
// ============================================================
let partner = null; // { name, dob, statut, regime }
let children = [];  // [{ id, name, dob }]
let childIdCounter = 0;
let biens = [];     // [{ id, type, desc, valeur, logementFamilial }]
let bienId = 0;
let companies = []; // [{ id, name, valeurParts, biens: [{ id, type, desc, valeur }] }]
let companyId = 0;
let companyBienId = 0;
let assurancesVie = []; // [{ id, type, compagnie, police, capital, beneficiaire, description }]
let avId = 0;
let legs = [];
let legId = 0;

// ============================================================
// PARTNER
// ============================================================
function addPartner() {
  if (partner) return;
  partner = { name: '', dob: '1985-01-01', statut: 'fait', regime: 'acquets' };
  renderPartner();
  document.getElementById('btnAddPartner').style.display = 'none';
  update();
}

function removePartner() {
  partner = null;
  renderPartner();
  document.getElementById('btnAddPartner').style.display = '';
  update();
}

function renderPartner() {
  const c = document.getElementById('partnerContainer');
  if (!partner) { c.innerHTML = '<div style="font-size:11px;color:#6b7a99;padding:4px 0">Aucun partenaire ajouté</div>'; return; }
  const age = ageFromDob(partner.dob);
  const showRegime = partner.statut === 'marie';
  c.innerHTML = \`<div class="partner-box">
    <button class="item-remove" onclick="removePartner()">✕</button>
    <div class="item-grid">
      <div>
        <label>Nom</label>
        <input type="text" value="\${partner.name}" onchange="partner.name=this.value;update()" placeholder="Nom du partenaire">
      </div>
      <div>
        <label>Date de naissance <span class="age-badge">\${age} ans</span></label>
        <input type="date" value="\${partner.dob}" onchange="partner.dob=this.value;renderPartner();update()">
      </div>
      <div>
        <label>Statut</label>
        <select onchange="partner.statut=this.value;renderPartner();update()">
          <option value="fait" \${partner.statut==='fait'?'selected':''}>Cohabitant de fait</option>
          <option value="legal" \${partner.statut==='legal'?'selected':''}>Cohabitant légal</option>
          <option value="marie" \${partner.statut==='marie'?'selected':''}>Marié(e)</option>
        </select>
      </div>
      <div style="\${showRegime?'':'opacity:.3;pointer-events:none'}">
        <label>Régime matrimonial</label>
        <select onchange="partner.regime=this.value;update()" \${showRegime?'':'disabled'}>
          <option value="acquets" \${partner.regime==='acquets'?'selected':''}>Communauté réduite aux acquêts</option>
          <option value="separation" \${partner.regime==='separation'?'selected':''}>Séparation de biens</option>
          <option value="universelle" \${partner.regime==='universelle'?'selected':''}>Communauté universelle</option>
        </select>
      </div>
    </div>
  </div>\`;
}

// ============================================================
// CHILDREN
// ============================================================
function addChild() {
  const id = ++childIdCounter;
  children.push({ id, name: '', dob: '' });
  renderChildren();
  update();
}

function removeChild(id) {
  children = children.filter(c => c.id !== id);
  renderChildren();
  update();
}

function renderChildren() {
  const container = document.getElementById('childrenContainer');
  if (children.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:#6b7a99;padding:4px 0">Aucun enfant ajouté</div>';
    return;
  }
  let h = '';
  children.forEach((child, idx) => {
    const age = child.dob ? ageFromDob(child.dob) : null;
    const isMinor = age !== null && age < 18;
    const ageBadge = age !== null
      ? (isMinor ? \`<span class="minor-badge">MINEUR \${age} ans</span>\` : \`<span class="age-badge">\${age} ans</span>\`)
      : '';
    h += \`<div class="item-row">
      <button class="item-remove" onclick="removeChild(\${child.id})">✕</button>
      <div class="item-grid">
        <div>
          <label>Enfant \${idx+1}</label>
          <input type="text" value="\${child.name}" placeholder="Prénom" onchange="children.find(c=>c.id===\${child.id}).name=this.value;update()">
        </div>
        <div>
          <label>Naissance \${ageBadge}</label>
          <input type="date" value="\${child.dob}" onchange="children.find(c=>c.id===\${child.id}).dob=this.value;renderChildren();update()">
        </div>
      </div>
    </div>\`;
  });
  container.innerHTML = h;
}

// ============================================================
// BIENS (patrimoine personnel)
// ============================================================
function addBien() {
  const id = ++bienId;
  biens.push({ id, type: 'immo_perso', desc: '', valeur: 0, logementFamilial: false });
  renderBiens();
  update();
}

function removeBien(id) {
  biens = biens.filter(b => b.id !== id);
  renderBiens();
  update();
}

function renderBiens() {
  const container = document.getElementById('biensContainer');
  if (biens.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:#6b7a99;padding:4px 0">Aucun bien ajouté</div>';
    return;
  }
  let h = '';
  for (const b of biens) {
    h += \`<div class="item-row">
      <button class="item-remove" onclick="removeBien(\${b.id})">✕</button>
      <div class="item-grid">
        <div>
          <label>Type</label>
          <select onchange="biens.find(x=>x.id===\${b.id}).type=this.value;update()">
            <option value="immo_perso" \${b.type==='immo_perso'?'selected':''}>Habitation</option>
            <option value="immo_invest" \${b.type==='immo_invest'?'selected':''}>Investissement</option>
            <option value="immo_mixte" \${b.type==='immo_mixte'?'selected':''}>Mixte</option>
            <option value="terrain" \${b.type==='terrain'?'selected':''}>Terrain</option>
          </select>
        </div>
        <div>
          <label>Valeur estimée (€)</label>
          <input type="number" value="\${b.valeur}" step="10000" onchange="biens.find(x=>x.id===\${b.id}).valeur=parseFloat(this.value)||0;update()">
        </div>
        <div class="item-full">
          <label>Description</label>
          <input type="text" value="\${b.desc}" placeholder="Ex: Maison Juprelle" onchange="biens.find(x=>x.id===\${b.id}).desc=this.value;update()">
        </div>
        <div class="item-full">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" \${b.logementFamilial?'checked':''} onchange="biens.find(x=>x.id===\${b.id}).logementFamilial=this.checked;update()" style="width:auto;margin:0">
            Logement familial
          </label>
        </div>
      </div>
    </div>\`;
  }
  container.innerHTML = h;
}

function aggregateBiens() {
  let immoPerso = 0, partsSociete = 0, immoBiensSociete = 0, logementFamilialValue = 0;
  const biensList = [];
  // Personal real estate
  for (const b of biens) {
    immoPerso += b.valeur;
    biensList.push({ type: b.type, desc: b.desc, valeur: b.valeur, proprio: 'perso', logementFamilial: b.logementFamilial });
    if (b.logementFamilial) logementFamilialValue += b.valeur;
  }
  // Company-held assets: parts value is mobilier, underlying biens are informational
  for (const co of companies) {
    partsSociete += co.valeurParts;
    for (const cb of co.biens) {
      immoBiensSociete += cb.valeur;
      biensList.push({ type: cb.type, desc: \`\${co.name} — \${cb.desc}\`, valeur: cb.valeur, proprio: 'societe' });
    }
  }
  return { immoPerso, partsSociete, immoBiensSociete, logementFamilialValue, biensList };
}

// ============================================================
// COMPANIES
// ============================================================
function addCompany() {
  const id = ++companyId;
  companies.push({ id, name: '', valeurParts: 0, biens: [] });
  renderCompanies();
  update();
}

function removeCompany(id) {
  companies = companies.filter(c => c.id !== id);
  renderCompanies();
  update();
}

function addCompanyBien(compId) {
  const co = companies.find(c => c.id === compId);
  if (!co) return;
  const id = ++companyBienId;
  co.biens.push({ id, type: 'immo_invest', desc: '', valeur: 0 });
  renderCompanies();
  update();
}

function removeCompanyBien(compId, bienId) {
  const co = companies.find(c => c.id === compId);
  if (!co) return;
  co.biens = co.biens.filter(b => b.id !== bienId);
  renderCompanies();
  update();
}

function renderCompanies() {
  const container = document.getElementById('companiesContainer');
  if (companies.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:#6b7a99;padding:4px 0">Aucune société ajoutée</div>';
    return;
  }
  let h = '';
  for (const co of companies) {
    h += \`<div class="item-row" style="padding-bottom:4px">
      <button class="item-remove" onclick="removeCompany(\${co.id})">✕</button>
      <div class="item-grid">
        <div>
          <label>Nom de la société</label>
          <input type="text" value="\${co.name}" placeholder="Ex: DTX SRL" onchange="companies.find(x=>x.id===\${co.id}).name=this.value;update()">
        </div>
        <div>
          <label>Valeur de vos parts (€)</label>
          <input type="number" value="\${co.valeurParts}" step="10000" onchange="companies.find(x=>x.id===\${co.id}).valeurParts=parseFloat(this.value)||0;update()">
        </div>
      </div>
      <div class="sub-items">
        <div style="font-size:10px;color:#6b7a99;margin-bottom:4px">Biens détenus par la société (informatif) :</div>\`;
    for (const cb of co.biens) {
      h += \`<div class="sub-item-row">
          <button class="item-remove" onclick="removeCompanyBien(\${co.id},\${cb.id})">✕</button>
          <div class="sub-grid">
            <div>
              <label>Type</label>
              <select onchange="companies.find(x=>x.id===\${co.id}).biens.find(b=>b.id===\${cb.id}).type=this.value;update()">
                <option value="immo_invest" \${cb.type==='immo_invest'?'selected':''}>Investissement</option>
                <option value="immo_mixte" \${cb.type==='immo_mixte'?'selected':''}>Mixte</option>
                <option value="bureaux" \${cb.type==='bureaux'?'selected':''}>Bureaux</option>
                <option value="commercial" \${cb.type==='commercial'?'selected':''}>Commercial</option>
              </select>
            </div>
            <div>
              <label>Valeur (€)</label>
              <input type="number" value="\${cb.valeur}" step="10000" onchange="companies.find(x=>x.id===\${co.id}).biens.find(b=>b.id===\${cb.id}).valeur=parseFloat(this.value)||0;update()">
            </div>
            <div style="grid-column:1/-1">
              <label>Description</label>
              <input type="text" value="\${cb.desc}" placeholder="Ex: Bureaux Tongres" onchange="companies.find(x=>x.id===\${co.id}).biens.find(b=>b.id===\${cb.id}).desc=this.value;update()">
            </div>
          </div>
        </div>\`;
    }
    h += \`<button class="btn-add-sub" onclick="addCompanyBien(\${co.id})">+ Bien de la société</button>
      </div>
    </div>\`;
  }
  container.innerHTML = h;
}

// ============================================================
// ASSURANCES VIE
// ============================================================
function addAssuranceVie(preset) {
  const id = ++avId;
  const av = { id, type: 'EP', compagnie: '', police: '', capital: 0, beneficiaire: 'legal', description: '' };
  if (preset) Object.assign(av, preset);
  assurancesVie.push(av);
  renderAssurancesVie();
  update();
}

function removeAssuranceVie(id) {
  assurancesVie = assurancesVie.filter(a => a.id !== id);
  renderAssurancesVie();
  update();
}

function getBenefOptionsAV(selected) {
  const opts = [
    { v: 'legal', l: 'Héritiers légaux' },
    { v: 'enfants', l: 'Les enfants' },
    { v: 'partenaire', l: 'Le/la partenaire' },
    { v: 'mixte', l: 'Mixte (50/50)' },
    { v: 'tiers', l: 'Tiers' }
  ];
  // Add children by name
  children.forEach((c, i) => {
    const lbl = c.name || \`Enfant \${i+1}\`;
    opts.push({ v: \`enfant_\${c.id}\`, l: lbl });
  });
  if (partner && partner.name) {
    opts.push({ v: 'partenaire_nom', l: partner.name });
  }
  return opts.map(o => \`<option value="\${o.v}" \${selected===o.v?'selected':''}>\${o.l}</option>\`).join('');
}

function renderAssurancesVie() {
  const container = document.getElementById('assurancesVieContainer');
  if (!assurancesVie.length) {
    container.innerHTML = '<div style="font-size:11px;color:#6b7a99;padding:4px 0">Aucune assurance vie ajoutée</div>';
    return;
  }
  let h = '';
  for (const av of assurancesVie) {
    h += \`<div class="av-contract">
      <div class="av-head">
        <span class="av-type">\${av.type}\${av.compagnie ? ' — '+av.compagnie : ''}</span>
        <button class="item-remove" style="position:static" onclick="removeAssuranceVie(\${av.id})">✕</button>
      </div>
      <div class="av-grid">
        <div>
          <label>Type</label>
          <select onchange="assurancesVie.find(x=>x.id===\${av.id}).type=this.value;update()">
            <option value="EP" \${av.type==='EP'?'selected':''}>Épargne-pension (EP)</option>
            <option value="EL" \${av.type==='EL'?'selected':''}>Épargne long terme (EL)</option>
            <option value="PCLI" \${av.type==='PCLI'?'selected':''}>PCLI</option>
            <option value="EIP" \${av.type==='EIP'?'selected':''}>EIP</option>
            <option value="Branche21" \${av.type==='Branche21'?'selected':''}>Branche 21</option>
            <option value="Branche23" \${av.type==='Branche23'?'selected':''}>Branche 23</option>
            <option value="Autre" \${av.type==='Autre'?'selected':''}>Autre</option>
          </select>
        </div>
        <div>
          <label>Capital estimé (€)</label>
          <input type="number" value="\${av.capital}" step="5000" onchange="assurancesVie.find(x=>x.id===\${av.id}).capital=parseFloat(this.value)||0;update()">
        </div>
        <div style="grid-column:1/-1">
          <label>Bénéficiaire</label>
          <select onchange="assurancesVie.find(x=>x.id===\${av.id}).beneficiaire=this.value;update()">
            \${getBenefOptionsAV(av.beneficiaire)}
          </select>
        </div>
        <div style="grid-column:1/-1">
          <label>Description</label>
          <input type="text" value="\${av.description}" placeholder="\${av.police ? 'Police '+av.police : 'Ex: Épargne-pension Baloise'}" onchange="assurancesVie.find(x=>x.id===\${av.id}).description=this.value;update()">
        </div>
      </div>
    </div>\`;
  }
  container.innerHTML = h;
}

function totalAssurancesVie() {
  return assurancesVie.reduce((sum, a) => sum + (a.capital || 0), 0);
}

// ============================================================
// TESTAMENT — LEGS
// ============================================================
function getBenefOptions() {
  let opts = '';
  children.forEach((c, i) => {
    const label = c.name || \`Enfant \${i+1}\`;
    opts += \`<option value="enfant_\${c.id}">\${label}</option>\`;
  });
  if (partner) opts += \`<option value="partenaire">\${partner.name || 'Partenaire'}</option>\`;
  opts += \`<option value="tiers">Tiers (autre personne)</option>\`;
  return opts;
}

function getAssetOptions() {
  return \`<option value="immo">Immobilier (habitation)</option>
    <option value="parts">Parts de sociétés</option>
    <option value="mobilier">Mobilier / épargne</option>
    <option value="assurance">Capital assurance</option>
    <option value="custom">Montant libre</option>\`;
}

function addLeg() {
  const id = ++legId;
  legs.push(id);
  renderLegs();
  update();
}

function removeLeg(id) {
  legs = legs.filter(l => l !== id);
  renderLegs();
  update();
}

function renderLegs() {
  const container = document.getElementById('legsContainer');
  let h = '';
  for (const id of legs) {
    const prevAsset = document.getElementById(\`legAsset_\${id}\`)?.value || 'immo';
    const prevBenef = document.getElementById(\`legBenef_\${id}\`)?.value || '';
    h += \`<div class="leg-row" data-leg="\${id}">
      <button class="leg-remove" onclick="removeLeg(\${id})">✕</button>
      <label>Bien</label>
      <select id="legAsset_\${id}" onchange="onLegAssetChange(\${id});update()">
        \${getAssetOptions()}
      </select>
      <div class="leg-grid" style="margin-top:6px">
        <div><label>Bénéficiaire</label><select id="legBenef_\${id}" onchange="update()">\${getBenefOptions()}</select></div>
        <div><label>Montant</label><input type="number" id="legAmount_\${id}" step="10000" onchange="update()"></div>
      </div>
    </div>\`;
  }
  container.innerHTML = h;
  for (const id of legs) { onLegAssetChange(id); }
}

function onLegAssetChange(id) {
  const asset = document.getElementById(\`legAsset_\${id}\`).value;
  const amountInput = document.getElementById(\`legAmount_\${id}\`);
  if (asset === 'custom') {
    amountInput.readOnly = false;
    amountInput.style.opacity = '1';
    if (!amountInput.value) amountInput.value = '50000';
  } else {
    amountInput.readOnly = true;
    amountInput.style.opacity = '.6';
    const agg = aggregateBiens();
    const vals = {
      immo: agg.immoPerso,
      parts: agg.partsSociete,
      mobilier: parseFloat(document.getElementById('mobilier').value) || 0,
      assurance: (totalAssurancesVie() + parseFloat(document.getElementById('capitalDeces').value || 0))
    };
    amountInput.value = vals[asset] || 0;
  }
}

function collectLegs() {
  const result = [];
  for (const id of legs) {
    const assetEl = document.getElementById(\`legAsset_\${id}\`);
    const benefEl = document.getElementById(\`legBenef_\${id}\`);
    const amountEl = document.getElementById(\`legAmount_\${id}\`);
    if (!assetEl) continue;
    result.push({
      asset: assetEl.value,
      benef: benefEl.value,
      amount: parseFloat(amountEl.value) || 0,
      label: assetEl.options[assetEl.selectedIndex].text,
      benefLabel: benefEl.options[benefEl.selectedIndex].text
    });
  }
  return result;
}

function computeTestament(r, legsData) {
  const region = r.region;
  const statut = r.statut;
  const brackets = BRACKETS[region];
  const nbEnfants = r.nbEnfants;
  const masseTotale = r.masseTotaleAvecAssur;
  const reserve = nbEnfants > 0 ? masseTotale * 0.5 : 0;
  const qd = masseTotale - reserve;

  const perBenef = {};
  let totalLegue = 0;
  for (const leg of legsData) {
    if (!perBenef[leg.benef]) perBenef[leg.benef] = { label: leg.benefLabel, amount: 0, legs: [], relation: 'direct' };
    perBenef[leg.benef].amount += leg.amount;
    perBenef[leg.benef].legs.push(leg);
    totalLegue += leg.amount;
  }

  for (const [key, pb] of Object.entries(perBenef)) {
    if (key === 'partenaire') pb.relation = getBracketType(statut);
    else if (key === 'tiers') pb.relation = 'autres';
    else pb.relation = 'direct';
  }

  const reste = Math.max(0, masseTotale - totalLegue);

  if (nbEnfants > 0 && reste > 0) {
    children.forEach((child, i) => {
      const key = \`enfant_\${child.id}\`;
      if (!perBenef[key]) perBenef[key] = { label: child.name || \`Enfant \${i+1}\`, amount: 0, legs: [], relation: 'direct' };
      perBenef[key].amount += reste / nbEnfants;
      perBenef[key].fromRemainder = reste / nbEnfants;
    });
  }

  let totalEnfants = 0;
  children.forEach(child => {
    totalEnfants += (perBenef[\`enfant_\${child.id}\`]?.amount || 0);
  });
  const reserveOk = nbEnfants === 0 || totalEnfants >= reserve;
  const reserveManquant = reserve - totalEnfants;

  const details = [];
  let totalDroits = 0;
  for (const [key, pb] of Object.entries(perBenef)) {
    const bk = brackets[pb.relation] || brackets.autres;
    const result = calcTax(pb.amount, bk);
    details.push({
      key, nom: pb.label, amount: pb.amount, relation: pb.relation,
      droits: result.tax, tauxEffectif: result.effectiveRate, net: pb.amount - result.tax,
      legs: pb.legs, fromRemainder: pb.fromRemainder || 0
    });
    totalDroits += result.tax;
  }

  return { details, totalDroits, totalLegue, reste, reserve, qd, reserveOk, reserveManquant, masseTotale };
}

// ============================================================
// CALCUL PRINCIPAL
// ============================================================
function compute(overrideBrackets) {
  const statut = partner ? partner.statut : 'isole';
  const regime = partner ? partner.regime : 'acquets';
  const region = document.getElementById('region').value;
  const nbEnfants = children.length;
  const age = ageFromDob(document.getElementById('personDob').value);
  const ageP = partner ? ageFromDob(partner.dob) : 0;
  const agg = aggregateBiens();
  const immo = agg.immoPerso;
  const parts = agg.partsSociete;
  const mob = parseFloat(document.getElementById('mobilier').value) || 0;
  const mobP = parseFloat(document.getElementById('mobilierPartner').value) || 0;
  const capAssur = totalAssurancesVie();
  const capDeces = parseFloat(document.getElementById('capitalDeces').value) || 0;
  const benef = document.getElementById('beneficiaire').value;
  const avEnabled = document.getElementById('toggleAV').checked;
  const avType = document.getElementById('avType').value;
  const avCapital = parseFloat(document.getElementById('avCapital').value) || 0;

  const brackets = overrideBrackets || BRACKETS[region];
  const isMarried = statut === 'marie';
  const hasPartner = partner !== null;
  const partnerIsHeir = statut === 'marie' || statut === 'legal';

  let masseImmo = immo;
  let masseParts = parts;
  let masseMob = mob;

  const masseAssurances = capAssur + capDeces;
  const masseTotale = masseImmo + masseParts + masseMob;
  const masseTotaleAvecAssur = masseTotale + masseAssurances;

  const heritiers = [];
  const usufCoeff = usufruitCoeff(ageP);

  if (nbEnfants > 0) {
    if (partnerIsHeir && hasPartner) {
      const npCoeff = 1 - usufCoeff;
      const usufValue = masseTotale * usufCoeff;
      const npValuePerChild = masseTotale * npCoeff / nbEnfants;

      heritiers.push({
        nom: partner.name || (statut === 'marie' ? 'Conjoint(e)' : 'Cohabitant(e) légal(e)'),
        type: 'Usufruit',
        part: '100% usufruit',
        valeurFiscale: Math.round(usufValue),
        relation: 'direct',
        isPartner: true
      });
      children.forEach((child, i) => {
        heritiers.push({
          nom: child.name || \`Enfant \${i+1}\`,
          type: 'Nue-propriété',
          part: \`\${pct(1/nbEnfants)} NP\`,
          valeurFiscale: Math.round(npValuePerChild),
          relation: 'direct',
          isPartner: false
        });
      });
    } else {
      children.forEach((child, i) => {
        heritiers.push({
          nom: child.name || \`Enfant \${i+1}\`,
          type: 'Pleine propriété',
          part: pct(1/nbEnfants),
          valeurFiscale: Math.round(masseTotale / nbEnfants),
          relation: 'direct',
          isPartner: false
        });
      });
    }
  } else if (hasPartner && partnerIsHeir) {
    heritiers.push({
      nom: partner.name || (statut === 'marie' ? 'Conjoint(e)' : 'Cohabitant(e) légal(e)'),
      type: 'Pleine propriété',
      part: '100%',
      valeurFiscale: masseTotale,
      relation: 'direct',
      isPartner: true
    });
  }

  const partnerExcluded = hasPartner && !partnerIsHeir;

  let assurToEnfants = 0, assurToPartner = 0;
  if (benef === 'legal') {
    if (partnerIsHeir && hasPartner) {
      assurToPartner = masseAssurances * usufCoeff;
      assurToEnfants = masseAssurances - assurToPartner;
    } else {
      assurToEnfants = masseAssurances;
    }
  } else if (benef === 'enfants') {
    assurToEnfants = masseAssurances;
  } else if (benef === 'partenaire') {
    assurToPartner = masseAssurances;
  } else {
    assurToEnfants = masseAssurances * 0.5;
    assurToPartner = masseAssurances * 0.5;
  }

  let totalDroits = 0;
  const droitsDetail = [];
  const bracketTypePartner = getBracketType(statut);
  const bracketKey = region === 'flandre' ? (bracketTypePartner === 'direct' ? 'direct' : 'autres') : bracketTypePartner;

  for (const h of heritiers) {
    let base = h.valeurFiscale;
    if (h.isPartner) base += assurToPartner;
    else if (nbEnfants > 0) base += assurToEnfants / nbEnfants;
    const bk = brackets[h.relation] || brackets.direct;
    const result = calcTax(base, bk);
    droitsDetail.push({ ...h, baseTaxable: base, droits: result.tax, tauxEffectif: result.effectiveRate, detail: result.detail });
    totalDroits += result.tax;
  }

  let droitsPartnerSurAssur = 0;
  if (partnerExcluded && assurToPartner > 0) {
    const bk = brackets.autres || brackets[Object.keys(brackets).pop()];
    const r = calcTax(assurToPartner, bk);
    droitsPartnerSurAssur = r.tax;
    totalDroits += r.tax;
    droitsDetail.push({
      nom: partner.name || 'Partenaire (de fait)',
      type: 'Bénéficiaire assurance',
      part: '-',
      valeurFiscale: 0,
      baseTaxable: assurToPartner,
      droits: r.tax,
      tauxEffectif: r.effectiveRate,
      relation: 'autres',
      isPartner: true,
      detail: r.detail
    });
  }

  let avResult = null;
  if (avEnabled && avCapital > 0) {
    if (avType === 'AAB') {
      const bk = brackets[bracketKey] || brackets.autres;
      const r = calcTax(avCapital, bk);
      avResult = { type: avType, description: 'Capital versé au partenaire au décès. Art. 8 CDS → droits de succession.', capital: avCapital, droits: r.tax, tauxEffectif: r.effectiveRate, net: avCapital - r.tax, bracketUsed: bracketKey };
    } else if (avType === 'ABA') {
      avResult = { type: avType, description: 'Capital versé à vous au décès du partenaire. Pas de droits de succession.', capital: avCapital, droits: 0, tauxEffectif: 0, net: avCapital, bracketUsed: '-' };
    } else if (avType === 'ABC') {
      const bk = brackets.direct;
      const r = calcTax(avCapital, bk);
      avResult = { type: avType, description: 'Capital versé à l\\'enfant au décès du partenaire. Donation indirecte.', capital: avCapital, droits: r.tax, tauxEffectif: r.effectiveRate, net: avCapital - r.tax, bracketUsed: 'direct' };
    }
  }

  const compRegions = {};
  for (const reg of ['wallonie', 'bruxelles', 'flandre']) {
    let tot = 0;
    for (const h of heritiers) {
      let base = h.valeurFiscale;
      if (h.isPartner) base += assurToPartner;
      else if (nbEnfants > 0) base += assurToEnfants / nbEnfants;
      const bk = BRACKETS[reg][h.relation] || BRACKETS[reg].direct;
      tot += calcTax(base, bk).tax;
    }
    if (partnerExcluded && assurToPartner > 0) {
      const bk = BRACKETS[reg].autres || BRACKETS[reg][Object.keys(BRACKETS[reg]).pop()];
      tot += calcTax(assurToPartner, bk).tax;
    }
    compRegions[reg] = tot;
  }

  return { statut, region, masseTotale, masseAssurances, masseTotaleAvecAssur, heritiers, droitsDetail, totalDroits, partnerExcluded, hasPartner, partnerIsHeir, avResult, compRegions, assurToEnfants, assurToPartner, nbEnfants, usufCoeff, ageP, droitsPartnerSurAssur, avEnabled, children };
}

// ============================================================
// RECHERCHE CLIENTS
// ============================================================
let allSavedItems = [];
function filterSavedList() {
  const q = (document.getElementById('searchClient')?.value || '').toLowerCase().trim();
  if (!q) { renderSavedList(allSavedItems, false); return; }
  const filtered = allSavedItems.filter(i => (i.data.clientName || '').toLowerCase().includes(q));
  renderSavedList(filtered, true);
}

// ============================================================
// SCHÉMA VISUEL
// ============================================================
function buildSchemaSuccession(r) {
  const heirs = r.droitsDetail;
  const n = heirs.length;
  if (n === 0) return '';

  const colW = 160, colGap = 20, padX = 40;
  const totalW = Math.max(n * (colW + colGap) - colGap + padX * 2, 500);
  const defuntY = 40, heirY = 170, boxH = 90;
  const svgH = heirY + boxH + 60;
  const startX = (totalW - (n * (colW + colGap) - colGap)) / 2;
  const defuntX = totalW / 2;
  const masseW = 220;

  let svg = \`<div class="card"><h3>Schéma de succession</h3><div class="schema-svg">\`;
  svg += \`<svg viewBox="0 0 \${totalW} \${svgH}" width="\${Math.min(totalW, 900)}" xmlns="http://www.w3.org/2000/svg">\`;

  svg += \`<defs><marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#2563eb"/></marker>
    <marker id="ah-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#dc2626"/></marker>
    <marker id="ah-grey" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#94a3b8"/></marker></defs>\`;

  const personName = document.getElementById('personName').value || 'DÉFUNT';
  svg += \`<rect x="\${defuntX - masseW/2}" y="\${defuntY - 22}" width="\${masseW}" height="44" rx="10" fill="#1a2744"/>\`;
  svg += \`<text x="\${defuntX}" y="\${defuntY - 2}" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">\${personName.toUpperCase()}</text>\`;
  svg += \`<text x="\${defuntX}" y="\${defuntY + 14}" text-anchor="middle" fill="#8b9dc3" font-size="11">Masse : \${fmt(r.masseTotaleAvecAssur)}</text>\`;

  if (r.partnerExcluded && r.hasPartner) {
    const exX = totalW - 150;
    svg += \`<rect x="\${exX - 70}" y="\${defuntY - 18}" width="140" height="36" rx="6" fill="#fef2f2" stroke="#fecaca"/>\`;
    svg += \`<text x="\${exX}" y="\${defuntY - 2}" text-anchor="middle" fill="#dc2626" font-size="10" font-weight="600">\${partner?.name || 'Partenaire de fait'}</text>\`;
    svg += \`<text x="\${exX}" y="\${defuntY + 12}" text-anchor="middle" fill="#991b1b" font-size="10">Aucun droit successoral</text>\`;
    svg += \`<line x1="\${defuntX + masseW/2}" y1="\${defuntY}" x2="\${exX - 70}" y2="\${defuntY}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,4" marker-end="url(#ah-grey)"/>\`;
  }

  for (let i = 0; i < n; i++) {
    const h = heirs[i];
    const cx = startX + i * (colW + colGap) + colW / 2;
    const bx = startX + i * (colW + colGap);
    const isExcludedPartner = h.relation === 'autres' && h.isPartner;
    const arrowColor = isExcludedPartner ? '#dc2626' : '#2563eb';
    const marker = isExcludedPartner ? 'url(#ah-red)' : 'url(#ah)';
    svg += \`<line x1="\${defuntX}" y1="\${defuntY + 22}" x2="\${cx}" y2="\${heirY}" stroke="\${arrowColor}" stroke-width="2" marker-end="\${marker}"/>\`;
    svg += \`<text x="\${(defuntX + cx) / 2}" y="\${(defuntY + 22 + heirY) / 2 - 6}" text-anchor="middle" fill="\${arrowColor}" font-size="10" font-weight="600">\${fmt(h.baseTaxable)}</text>\`;
    const fillColor = isExcludedPartner ? '#fef2f2' : '#f0f9ff';
    const strokeColor = isExcludedPartner ? '#fecaca' : '#bfdbfe';
    svg += \`<rect x="\${bx}" y="\${heirY}" width="\${colW}" height="\${boxH}" rx="8" fill="\${fillColor}" stroke="\${strokeColor}" stroke-width="1.5"/>\`;
    const nameStr = h.nom.length > 18 ? h.nom.slice(0, 18) + '…' : h.nom;
    svg += \`<text x="\${cx}" y="\${heirY + 18}" text-anchor="middle" fill="#1a2744" font-size="12" font-weight="700">\${nameStr}</text>\`;
    svg += \`<text x="\${cx}" y="\${heirY + 34}" text-anchor="middle" fill="#6b7a99" font-size="10">\${h.type} · \${h.part}</text>\`;
    svg += \`<text x="\${cx}" y="\${heirY + 52}" text-anchor="middle" fill="#dc2626" font-size="11" font-weight="600">Droits : \${fmt(h.droits)}</text>\`;
    svg += \`<text x="\${cx}" y="\${heirY + 67}" text-anchor="middle" fill="#6b7a99" font-size="10">Taux eff. : \${pct(h.tauxEffectif)}</text>\`;
    svg += \`<text x="\${cx}" y="\${heirY + 82}" text-anchor="middle" fill="#16a34a" font-size="10" font-weight="600">Net : \${fmt(h.baseTaxable - h.droits)}</text>\`;
  }

  svg += \`<text x="\${padX}" y="\${svgH - 20}" fill="#6b7a99" font-size="10">Héritier légal (bleu) · Assurance au partenaire de fait (rouge)</text>\`;
  svg += \`</svg></div></div>\`;
  return svg;
}

// ============================================================
// RENDU
// ============================================================
function update() {
  // Toggle visibility
  document.getElementById('avSection').className = 'av-section' + (document.getElementById('toggleAV').checked ? ' show' : '');
  document.getElementById('donationSection').className = 'av-section' + (document.getElementById('toggleDonation').checked ? ' show' : '');
  document.getElementById('logementInfo').className = 'av-section' + (document.getElementById('toggleLogement').checked ? ' show' : '');
  document.getElementById('testamentSection').className = 'av-section' + (document.getElementById('toggleTestament').checked ? ' show' : '');
  const show2028 = document.getElementById('toggle2028').checked;
  document.getElementById('reform2028Info').className = 'av-section' + (show2028 ? ' show' : '');

  const r = compute();
  const region = document.getElementById('region').value;
  const r2028 = (show2028 && BRACKETS_2028[region]) ? compute(BRACKETS_2028[region]) : null;
  const main = document.getElementById('results');

  const statutLabels = { fait: 'Cohabitant de fait', legal: 'Cohabitant légal', marie: 'Marié(e)', isole: 'Isolé(e)' };
  const regionLabels = { wallonie: 'Wallonie', bruxelles: 'Bruxelles', flandre: 'Flandre' };

  const personName = document.getElementById('personName').value || 'Client';
  let html = \`<h2>Résultat — \${personName}</h2>
  <div class="scenario-label">\${statutLabels[r.statut]} · \${regionLabels[r.region]} · \${r.nbEnfants} enfant(s)</div>\`;

  // ALERTES
  if (r.partnerExcluded) {
    html += \`<div class="alert alert-red"><span class="alert-icon">⚠</span><div><strong>Attention :</strong> En tant que cohabitant de fait, \${partner?.name || 'votre partenaire'} <strong>n'hérite de rien</strong>. Aucune protection légale. Si des assurances lui sont versées, elles seront taxées au tarif "autres" (30 à 80% en Wallonie/BXL).</div></div>\`;
  }
  if (r.partnerIsHeir && r.statut === 'legal') {
    html += \`<div class="alert alert-orange"><span class="alert-icon">ℹ</span><div>En cohabitation légale, le partenaire reçoit l'usufruit du logement familial. Ce droit peut être réduit ou supprimé par testament. Protection limitée par rapport au mariage.</div></div>\`;
  }

  // Children minors alert
  const minors = children.filter(c => c.dob && ageFromDob(c.dob) < 18);
  if (minors.length > 0) {
    const names = minors.map(c => c.name || 'enfant').join(', ');
    html += \`<div class="alert alert-orange"><span class="alert-icon">⚠</span><div><strong>\${minors.length} enfant(s) mineur(s) :</strong> \${names}. Un tuteur sera désigné par le juge de paix. Pensez à un tuteur testamentaire et un mandat de gestion.</div></div>\`;
  }

  // KPI
  const tauxGlobal = r.masseTotaleAvecAssur > 0 ? r.totalDroits / r.masseTotaleAvecAssur : 0;
  html += \`<div class="kpi-row">
    <div class="kpi"><div class="kpi-label">Masse successorale</div><div class="kpi-value">\${fmt(r.masseTotale)}</div><div class="kpi-sub">Hors assurances</div></div>
    <div class="kpi"><div class="kpi-label">Assurances (capital)</div><div class="kpi-value">\${fmt(r.masseAssurances)}</div><div class="kpi-sub">EP + PLCI + EIP + Décès</div></div>
    <div class="kpi kpi-red"><div class="kpi-label">Total droits de succession</div><div class="kpi-value">\${fmt(r.totalDroits)}</div><div class="kpi-sub">Taux effectif global : \${pct(tauxGlobal)}</div></div>
    <div class="kpi kpi-orange"><div class="kpi-label">Net transmis</div><div class="kpi-value">\${fmt(r.masseTotaleAvecAssur - r.totalDroits)}</div><div class="kpi-sub">Après droits</div></div>
  </div>\`;

  // COMPARAISON MNT vs 2028
  if (r2028) {
    const economie = r.totalDroits - r2028.totalDroits;
    const econPct = r.totalDroits > 0 ? economie / r.totalDroits : 0;
    html += \`<div class="card" style="border-left:4px solid var(--green)">
      <h3>Comparaison : Maintenant vs Réforme 2028 (Wallonie)</h3>
      <div class="kpi-row" style="margin-bottom:14px">
        <div class="kpi kpi-red"><div class="kpi-label">Droits MNT (\${new Date().getFullYear()})</div><div class="kpi-value">\${fmt(r.totalDroits)}</div><div class="kpi-sub">Taux eff. \${pct(r.masseTotaleAvecAssur > 0 ? r.totalDroits/r.masseTotaleAvecAssur : 0)}</div></div>
        <div class="kpi kpi-orange"><div class="kpi-label">Droits 2028 (projection)</div><div class="kpi-value">\${fmt(r2028.totalDroits)}</div><div class="kpi-sub">Taux eff. \${pct(r2028.masseTotaleAvecAssur > 0 ? r2028.totalDroits/r2028.masseTotaleAvecAssur : 0)}</div></div>
        <div class="kpi kpi-green"><div class="kpi-label">Économie 2028</div><div class="kpi-value">\${fmt(economie)}</div><div class="kpi-sub">Réduction de \${pct(econPct)}</div></div>
      </div>
      <table><tr><th>Héritier</th><th class="text-right">Droits MNT</th><th class="text-right">Droits 2028</th><th class="text-right">Économie</th></tr>\`;
    for (let i = 0; i < r.droitsDetail.length; i++) {
      const d = r.droitsDetail[i];
      const d28 = r2028.droitsDetail[i] || { droits: 0 };
      const eco = d.droits - d28.droits;
      html += \`<tr><td class="text-bold">\${d.nom}</td>
        <td class="text-right text-red">\${fmt(d.droits)}</td>
        <td class="text-right text-orange">\${fmt(d28.droits)}</td>
        <td class="text-right text-green">\${eco > 0 ? '-' : ''}\${fmt(Math.abs(eco))}</td></tr>\`;
    }
    html += \`<tr class="total-row"><td>Total</td><td class="text-right text-red">\${fmt(r.totalDroits)}</td><td class="text-right text-orange">\${fmt(r2028.totalDroits)}</td><td class="text-right text-green">-\${fmt(economie)}</td></tr>\`;
    html += \`</table>
      <div style="margin-top:12px;font-size:11px;color:var(--text-light)">Projection basée sur le décret wallon voté en 12/2024. Tranches intermédiaires non encore publiées officiellement.</div>
    </div>\`;
  } else if (show2028 && !BRACKETS_2028[region]) {
    html += \`<div class="alert alert-orange"><span class="alert-icon">ℹ</span><div>La réforme 2028 n'est confirmée que pour la <strong>Wallonie</strong>. Bruxelles et la Flandre n'ont pas annoncé de modification.</div></div>\`;
  }

  // SCHÉMA
  html += buildSchemaSuccession(r);

  // DÉVOLUTION
  html += \`<div class="card-grid"><div class="card"><h3>Dévolution légale</h3><table>
    <tr><th>Héritier</th><th>Type</th><th>Part</th><th class="text-right">Base taxable</th><th class="text-right">Droits</th><th class="text-right">Taux eff.</th></tr>\`;
  for (const d of r.droitsDetail) {
    html += \`<tr><td class="text-bold">\${d.nom}</td><td>\${d.type}</td><td>\${d.part}</td>
      <td class="text-right">\${fmt(d.baseTaxable)}</td>
      <td class="text-right text-red">\${fmt(d.droits)}</td>
      <td class="text-right">\${pct(d.tauxEffectif)}</td></tr>\`;
  }
  html += \`<tr class="total-row"><td colspan="4">Total droits</td><td class="text-right text-red">\${fmt(r.totalDroits)}</td><td></td></tr>\`;
  html += \`</table></div>\`;

  // COMPARAISON RÉGIONS
  const maxReg = Math.max(...Object.values(r.compRegions), 1);
  const regColors = { wallonie: '#2563eb', bruxelles: '#7c3aed', flandre: '#ea580c' };
  html += \`<div class="card"><h3>Comparaison régionale</h3><div class="bar-chart">\`;
  for (const [reg, val] of Object.entries(r.compRegions)) {
    const w = (val / maxReg * 100).toFixed(1);
    const label = reg.charAt(0).toUpperCase() + reg.slice(1);
    const active = reg === r.region ? ' ◀' : '';
    html += \`<div class="bar-item">
      <div class="bar-label">\${label}\${active}</div>
      <div class="bar-track"><div class="bar-fill" style="width:\${w}%;background:\${regColors[reg]}">\${pct(val/(r.masseTotaleAvecAssur||1))}</div></div>
      <div class="bar-amount">\${fmt(val)}</div>
    </div>\`;
  }
  html += \`</div></div></div>\`;

  // DÉTAIL TRANCHES
  if (r.droitsDetail.length > 0) {
    const biggest = r.droitsDetail.reduce((a, b) => a.baseTaxable > b.baseTaxable ? a : b);
    html += \`<div class="card"><h3>Détail des tranches — \${biggest.nom}</h3>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:12px">Base taxable : \${fmt(biggest.baseTaxable)} · Barème : \${biggest.relation}</p>
      <table><tr><th>Tranche</th><th class="text-right">Montant</th><th class="text-right">Taux</th><th class="text-right">Droits</th></tr>\`;
    for (const t of biggest.detail) {
      html += \`<tr><td>\${fmt(t.from)} → \${t.to === Infinity ? '∞' : fmt(t.to)}</td>
        <td class="text-right">\${fmt(t.taxable)}</td>
        <td class="text-right">\${pct(t.rate)}</td>
        <td class="text-right text-red">\${fmt(t.tax)}</td></tr>\`;
    }
    html += \`<tr class="total-row"><td colspan="3">Total</td><td class="text-right text-red">\${fmt(biggest.droits)}</td></tr>\`;
    html += \`</table></div>\`;
  }

  // ASSURANCE-VIE
  if (r.avEnabled && r.avResult) {
    const av = r.avResult;
    html += \`<div class="card"><h3>Simulation assurance-vie — Contrat \${av.type}</h3>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:14px">\${av.description}</p>
      <div class="kpi-row" style="margin-bottom:0">
        <div class="kpi"><div class="kpi-label">Capital</div><div class="kpi-value">\${fmt(av.capital)}</div></div>
        <div class="kpi kpi-red"><div class="kpi-label">Droits</div><div class="kpi-value">\${fmt(av.droits)}</div><div class="kpi-sub">Barème : \${av.bracketUsed}</div></div>
        <div class="kpi kpi-green"><div class="kpi-label">Net perçu</div><div class="kpi-value">\${fmt(av.net)}</div><div class="kpi-sub">Taux eff. : \${pct(av.tauxEffectif)}</div></div>
      </div>
    </div>\`;
  }

  // TESTAMENT
  const testEnabled = document.getElementById('toggleTestament').checked;
  if (testEnabled && legs.length > 0) {
    const legsData = collectLegs();
    const t = computeTestament(r, legsData);

    html += \`<div class="card" style="border-left:4px solid #7c3aed">
      <h3>Simulation testament</h3>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:14px">
        Répartition personnalisée de \${fmt(t.totalLegue)} sur une masse de \${fmt(t.masseTotale)}. Reste en dévolution légale : \${fmt(t.reste)}.
      </p>\`;

    if (!t.reserveOk) {
      html += \`<div class="alert alert-red"><span class="alert-icon">⚠</span><div>
        <strong>Réserve héréditaire non respectée !</strong> Vos enfants doivent recevoir au minimum \${fmt(t.reserve)} (50% de la masse).
        Il manque <strong>\${fmt(t.reserveManquant)}</strong>. Les héritiers réservataires pourront demander la <strong>réduction</strong>.
      </div></div>\`;
    } else if (r.nbEnfants > 0) {
      html += \`<div class="alert alert-green"><span class="alert-icon">✓</span><div>
        Réserve héréditaire respectée. Quotité disponible utilisée : \${fmt(Math.max(0, t.totalLegue - t.reserve))} / \${fmt(t.qd)}.
      </div></div>\`;
    }

    html += \`<div class="kpi-row" style="margin-bottom:14px">
      <div class="kpi"><div class="kpi-label">Total légué</div><div class="kpi-value">\${fmt(t.totalLegue)}</div></div>
      <div class="kpi kpi-red"><div class="kpi-label">Droits (testament)</div><div class="kpi-value">\${fmt(t.totalDroits)}</div></div>
      <div class="kpi kpi-orange"><div class="kpi-label">Droits (dévolution légale)</div><div class="kpi-value">\${fmt(r.totalDroits)}</div></div>
      <div class="kpi \${t.totalDroits <= r.totalDroits ? 'kpi-green' : 'kpi-red'}"><div class="kpi-label">Différence</div><div class="kpi-value">\${t.totalDroits <= r.totalDroits ? '-' : '+'}\${fmt(Math.abs(r.totalDroits - t.totalDroits))}</div><div class="kpi-sub">\${t.totalDroits <= r.totalDroits ? 'Économie' : 'Surcoût'}</div></div>
    </div>\`;

    html += \`<table><tr><th>Bénéficiaire</th><th>Biens légués</th><th class="text-right">Montant</th><th class="text-right">Barème</th><th class="text-right">Droits</th><th class="text-right">Net reçu</th></tr>\`;
    for (const d of t.details) {
      const biensStr = d.legs.map(l => l.label).join(', ') || 'Reste légal';
      const fromR = d.fromRemainder > 0 ? \` + \${fmt(d.fromRemainder)} (reste)\` : '';
      html += \`<tr><td class="text-bold">\${d.nom}</td><td style="font-size:11px">\${biensStr}\${fromR}</td>
        <td class="text-right">\${fmt(d.amount)}</td>
        <td class="text-right" style="font-size:11px">\${d.relation}</td>
        <td class="text-right text-red">\${fmt(d.droits)}</td>
        <td class="text-right text-green">\${fmt(d.net)}</td></tr>\`;
    }
    html += \`<tr class="total-row"><td colspan="4">Total</td><td class="text-right text-red">\${fmt(t.totalDroits)}</td><td class="text-right text-green">\${fmt(t.masseTotale - t.totalDroits)}</td></tr>\`;
    html += \`</table></div>\`;
  }

  // DONATION
  const donEnabled = document.getElementById('toggleDonation').checked;
  if (donEnabled) {
    const donType = document.getElementById('donationType').value;
    const donMontant = parseFloat(document.getElementById('donationMontant').value) || 0;
    const donBenef = document.getElementById('donationBenef').value;
    const donNature = document.getElementById('donationNature').value;
    const donBracketKey = donBenef === 'enfant' ? 'direct' : (donBenef === 'partenaire' ? getBracketType(r.statut) : 'autres');

    let donDroits = 0, donDroits2028 = 0;
    if (donType === 'mobiliere') {
      const taux = donBracketKey === 'direct' ? DONATION_MOB.direct : DONATION_MOB.autres;
      donDroits = Math.round(donMontant * taux);
      donDroits2028 = donDroits;
    } else {
      const bk = (DONATION_IMMO[r.region] || DONATION_IMMO.wallonie)[donBracketKey === 'direct' ? 'direct' : 'autres'];
      donDroits = calcTax(donMontant, bk).tax;
      if (DONATION_IMMO_2028[r.region]) {
        const bk28 = DONATION_IMMO_2028[r.region][donBracketKey === 'direct' ? 'direct' : 'autres'];
        donDroits2028 = calcTax(donMontant, bk28).tax;
      } else {
        donDroits2028 = donDroits;
      }
    }
    const donNet = donMontant - donDroits;
    const masseApres = r.masseTotale - donMontant;
    const natureLabel = donNature === 'avance' ? 'Avance d\\'hoirie' : 'Hors part (préciput)';
    const benefLabel = donBenef === 'enfant' ? 'un enfant' : (donBenef === 'partenaire' ? 'le/la partenaire' : 'un tiers');

    html += \`<div class="card" style="border-left:4px solid var(--accent)">
      <h3>Simulation donation — \${donType === 'mobiliere' ? 'Mobilière' : 'Immobilière'}</h3>
      <p style="font-size:13px;color:var(--text-light);margin-bottom:14px">
        Donation de \${fmt(donMontant)} à \${benefLabel} · \${natureLabel}
      </p>
      <div class="kpi-row" style="margin-bottom:14px">
        <div class="kpi"><div class="kpi-label">Montant donné</div><div class="kpi-value">\${fmt(donMontant)}</div></div>
        <div class="kpi kpi-red"><div class="kpi-label">Droits de donation</div><div class="kpi-value">\${fmt(donDroits)}</div><div class="kpi-sub">\${donType === 'mobiliere' ? (donBracketKey === 'direct' ? '3,3%' : '5,5%') : 'Barème progressif'}</div></div>
        <div class="kpi kpi-green"><div class="kpi-label">Net reçu</div><div class="kpi-value">\${fmt(donNet)}</div></div>
        <div class="kpi kpi-orange"><div class="kpi-label">Masse après donation</div><div class="kpi-value">\${fmt(Math.max(0, masseApres))}</div><div class="kpi-sub">Impact sur la succession</div></div>
      </div>\`;

    if (donType === 'immobiliere' && show2028 && DONATION_IMMO_2028[r.region]) {
      const eco = donDroits - donDroits2028;
      html += \`<div class="alert alert-green"><span class="alert-icon">📅</span><div>
        <strong>Réforme 2028 :</strong> Droits actuels : \${fmt(donDroits)} → 2028 : \${fmt(donDroits2028)} = <strong>économie \${fmt(eco)}</strong>.
        \${eco > 5000 ? 'Attendre 2028 pourrait être avantageux.' : ''}
      </div></div>\`;
    }

    if (donNature === 'avance') {
      html += \`<div style="font-size:12px;color:var(--text-light);margin-top:8px;padding:10px;background:#f8fafc;border-radius:6px">
        <strong>Avance d'hoirie :</strong> Au décès, le montant donné (\${fmt(donMontant)}) sera rapporté fictivement à la masse.
        Le donataire recevra sa part d'héritage <em>moins</em> la valeur déjà reçue.
      </div>\`;
    } else {
      html += \`<div style="font-size:12px;color:var(--text-light);margin-top:8px;padding:10px;background:#f8fafc;border-radius:6px">
        <strong>Hors part (préciput) :</strong> Prélevée sur la quotité disponible (\${r.nbEnfants > 0 ? '50%' : '100%'} = \${fmt((r.nbEnfants > 0 ? 0.5 : 1) * r.masseTotale)}).
        \${donMontant > (r.nbEnfants > 0 ? 0.5 : 1) * r.masseTotale ? '<span style="color:var(--red)">La donation excède la quotité disponible ! Réductible par les héritiers réservataires.</span>' : 'Dans les limites de la quotité disponible.'}
      </div>\`;
    }
    html += \`</div>\`;
  }

  // EXONÉRATION LOGEMENT FAMILIAL (FIX: uses aggregateBiens() instead of missing element)
  const logementEnabled = document.getElementById('toggleLogement').checked;
  if (logementEnabled) {
    const agg = aggregateBiens();
    const immoLogement = agg.logementFamilialValue;
    const statut = r.statut;
    const regionVal = r.region;
    const eligible = statut === 'marie' || statut === 'legal';

    html += \`<div class="card" style="border-left:4px solid \${eligible ? 'var(--green)' : 'var(--red)'}">
      <h3>Exonération logement familial</h3>\`;

    if (!eligible) {
      html += \`<div class="alert alert-red"><span class="alert-icon">⚠</span><div>
        <strong>Non applicable :</strong> L'exonération est réservée au conjoint survivant ou au cohabitant légal.
        \${r.hasPartner ? '<br><strong>Solution :</strong> Passer en cohabitation légale (déclaration gratuite à la commune).' : ''}
      </div></div>\`;
    } else if (immoLogement === 0) {
      html += \`<div class="alert alert-orange"><span class="alert-icon">ℹ</span><div>
        Aucun bien n'est marqué comme "Logement familial". Cochez la case dans le patrimoine pour un bien.
      </div></div>\`;
    } else {
      let exoMontant = 0, exoDescription = '';
      if (regionVal === 'wallonie') {
        exoMontant = Math.min(immoLogement, 160000);
        exoDescription = 'Wallonie : exonération totale de la première tranche de 160.000 € du logement familial.';
      } else if (regionVal === 'bruxelles') {
        exoMontant = Math.min(immoLogement, 500000);
        exoDescription = 'Bruxelles : abattement jusqu\\'à 500.000 € sur le logement familial.';
      } else {
        exoMontant = immoLogement;
        exoDescription = 'Flandre : exonération totale du logement familial pour le conjoint/cohabitant légal.';
      }
      const usufVal = exoMontant * usufruitCoeff(r.ageP);
      const economieDroits = calcTax(usufVal, BRACKETS[regionVal].direct).tax;

      html += \`<p style="font-size:13px;color:var(--text-light);margin-bottom:14px">\${exoDescription}</p>
      <div class="kpi-row" style="margin-bottom:0">
        <div class="kpi"><div class="kpi-label">Valeur logement</div><div class="kpi-value">\${fmt(immoLogement)}</div></div>
        <div class="kpi"><div class="kpi-label">Montant exonéré</div><div class="kpi-value">\${fmt(exoMontant)}</div></div>
        <div class="kpi kpi-green"><div class="kpi-label">Économie droits (usufruit)</div><div class="kpi-value">\${fmt(economieDroits)}</div><div class="kpi-sub">Sur la part usufruit du partenaire</div></div>
      </div>\`;
    }
    html += \`</div>\`;
  }

  // CONSEILS
  html += \`<div class="card"><h3>Conseils personnalisés</h3>\`;

  if (r.partnerExcluded) {
    html += \`<div class="conseil urgent"><strong>URGENT — Cohabitation légale :</strong> Déclaration gratuite à la commune. \${partner?.name || 'Votre partenaire'} passe de "aucun droit" à "usufruit du logement familial" et du tarif "autres" (30-80%) au tarif "ligne directe" (3-30%). Économie potentielle sur les assurances : <strong>\${fmt(Math.max(0, calcTax(r.masseAssurances, BRACKETS[r.region].autres).tax - calcTax(r.masseAssurances, BRACKETS[r.region].direct).tax))}</strong>.</div>\`;
  }

  if (r.partnerExcluded || r.statut === 'legal') {
    html += \`<div class="conseil"><strong>Testament :</strong> Sans testament, \${partner?.name || 'votre partenaire'} n'a que l'usufruit du logement (cohabitation légale) ou rien (de fait). Un testament permet de léguer jusqu'à la quotité disponible (\${r.nbEnfants > 0 ? '50%' : '100%'}).</div>\`;
  }

  html += \`<div class="conseil"><strong>Clauses bénéficiaires :</strong> Vos assurances (\${fmt(r.masseAssurances)}) vont actuellement aux "héritiers légaux"\${r.partnerExcluded ? ' = vos enfants uniquement (le partenaire de fait n\\'est pas héritier légal)' : ''}. Vérifiez pour chaque contrat.</div>\`;

  const agg = aggregateBiens();
  if (r.nbEnfants > 0 && agg.partsSociete > 0) {
    html += \`<div class="conseil"><strong>Continuité de l'entreprise :</strong> Vos enfants hériteraient des parts de société (\${fmt(agg.partsSociete)}). Prévoyez un mandat de gestion ou pacte d'actionnaires.</div>\`;
  }

  if (agg.immoBiensSociete > 0) {
    html += \`<div class="conseil"><strong>Biens détenus par la société :</strong> \${fmt(agg.immoBiensSociete)} d'immobilier détenu via société, hors masse successorale personnelle. Seule la valeur de vos parts (\${fmt(agg.partsSociete)}) est taxée comme mobilier.</div>\`;
  }

  html += \`<div class="conseil"><strong>Assurance droits de succession :</strong> Une temporaire décès de \${fmt(r.totalDroits)} couvrirait les droits dus par vos héritiers.</div>\`;

  if (show2028 && r2028) {
    const eco = r.totalDroits - r2028.totalDroits;
    if (eco > 10000) {
      html += \`<div class="conseil"><strong>Timing réforme 2028 :</strong> Réduction de \${fmt(eco)}. Pour les donations immobilières, envisagez d'attendre 2028 (max 14% vs 27%). Donations mobilières inchangées (3,3% / 5,5%).</div>\`;
    }
  }

  if (r.partnerExcluded) {
    html += \`<div class="conseil"><strong>Donation au partenaire :</strong> Donner de son vivant des biens mobiliers coûte 5,5% vs 30-80% en succession. Activez la simulation donation pour chiffrer.</div>\`;
  }

  html += \`</div>\`;

  // DISCLAIMER
  html += \`<div style="margin-top:20px;padding:14px;background:#f8fafc;border-radius:8px;font-size:11px;color:var(--text-light)">
    <strong>Avertissement :</strong> Estimations basées sur les barèmes en vigueur. Exonérations entreprises familiales / bâtiments classés non intégrées.
    Consultez un notaire pour toute décision de planning successoral.
    <br>Source : Formation "Assurance-vie — Outil de planning successoral" (cepom/Dynassur, 10/2026).
  </div>\`;

  main.innerHTML = html;
}

// ============================================================
// DB — SAUVEGARDE / CHARGEMENT
// ============================================================

// ============================================================
// POSTMESSAGE BRIDGE — replaces claude.use APIs
// ============================================================
let currentSimId = null;
let unsubSaved = null;
let dbSearchTimer = null;
let _bridgeCallId = 0;
const _bridgePending = {};

window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'bridge-response') {
    const cb = _bridgePending[e.data.callId];
    if (cb) {
      delete _bridgePending[e.data.callId];
      if (e.data.error) cb.reject(new Error(e.data.error));
      else cb.resolve(e.data.result);
    }
  }
  if (e.data && e.data.type === 'user-info') {
    window._hubUser = e.data.user;
  }
});

function bridgeCall(action, params) {
  return new Promise(function(resolve, reject) {
    var id = ++_bridgeCallId;
    _bridgePending[id] = { resolve: resolve, reject: reject };
    window.parent.postMessage({ type: 'bridge-request', callId: id, action: action, params: params }, '*');
  });
}

// mcpNs — returns result in MCP payload format so existing parsing code works
var mcpNs = {
  callTool: function(server, tool, input) {
    return bridgeCall('execute_sql', { query: input.query || input.sql }).then(function(rows) {
      // Wrap in MCP-style payload so existing parsing code (text.match(/\\[...\\]/)) works
      return { payload: { result: JSON.stringify(rows) } };
    });
  }
};

// dbNs — Firestore-like API for succession_simulations table
var dbNs = {
  collection: function(name) {
    return {
      doc: function(id) {
        return {
          get: function() { return bridgeCall('db_get', { id: id }); },
          set: function(data) { return bridgeCall('db_set', { id: id, data: data }); },
          delete: function() { return bridgeCall('db_delete', { id: id }); }
        };
      },
      add: function(data) { return bridgeCall('db_add', { data: data }); },
      orderBy: function(field, dir) {
        return {
          limit: function(n) {
            return {
              get: function() { return bridgeCall('db_list', { orderBy: field, dir: dir, limit: n }); },
              onSnapshot: function(cb) {
                bridgeCall('db_list', { orderBy: field, dir: dir, limit: n }).then(function(snap) { cb(snap); });
                return function() {};
              }
            };
          }
        };
      }
    };
  }
};

var userNs = { id: function() { return (window._hubUser && window._hubUser.id) || 'anonymous'; } };

async function initDB() {
  window.parent.postMessage({ type: 'request-user-info' }, '*');
  var bp = document.getElementById('btnSearchPartner');
  var bc = document.getElementById('btnSearchChild');
  if (bp) bp.style.display = '';
  if (bc) bc.style.display = '';
  try {
    unsubSaved = dbNs.collection('simulations').orderBy('updatedAt', 'desc').limit(50).onSnapshot(function(snap) {
      var items = (snap.docs || []).map(function(d) { return { id: d.id, data: d.data }; });
      renderSavedList(items);
    });
  } catch (e) {
    document.getElementById('savedList').innerHTML = '<div class="db-unavailable">Erreur de chargement.</div>';
  }
}


// ============================================================
// SUPABASE CLIENT LOOKUP VIA MCP
// ============================================================
const ETAT_CIVIL_MAP = {
  '0': { label: 'Inconnu', partner: null },
  '1': { label: 'Célibataire', partner: null },
  '2': { label: 'Marié(e)', partner: 'marie' },
  '3': { label: 'Veuf/Veuve', partner: null },
  '4': { label: 'Divorcé(e)', partner: null },
  '5': { label: 'Séparé(e) de fait', partner: 'marie' },
  '6': { label: 'Cohabitant légal', partner: 'legal' },
  '7': { label: 'Séparé(e) de corps', partner: null },
  '8': { label: 'Autre', partner: null },
  '9': { label: 'Non renseigné', partner: null }
};

function cpToRegion(cp) {
  const n = parseInt(cp, 10);
  if (isNaN(n)) return 'wallonie';
  if (n >= 1000 && n <= 1299) return 'bruxelles';
  if (n >= 1300 && n <= 1499) return 'wallonie';
  if (n >= 1500 && n <= 1999) return 'flandre';
  if (n >= 2000 && n <= 2999) return 'flandre';
  if (n >= 3000 && n <= 3499) return 'flandre';
  if (n >= 3500 && n <= 3999) return 'flandre';
  if (n >= 4000 && n <= 4999) return 'wallonie';
  if (n >= 5000 && n <= 5999) return 'wallonie';
  if (n >= 6000 && n <= 6999) return 'wallonie';
  if (n >= 7000 && n <= 7999) return 'wallonie';
  if (n >= 8000 && n <= 8999) return 'flandre';
  if (n >= 9000 && n <= 9999) return 'flandre';
  return 'wallonie';
}

function onDbSearch(val) {
  clearTimeout(dbSearchTimer);
  const q = val.trim();
  if (q.length < 2) {
    document.getElementById('dbResults').innerHTML = '';
    document.getElementById('dbSearchStatus').textContent = '';
    return;
  }
  document.getElementById('dbSearchStatus').textContent = 'Recherche...';
  document.getElementById('dbSearchStatus').className = 'db-status loading';
  dbSearchTimer = setTimeout(() => searchClientsDB(q), 400);
}

async function searchClientsDB(query) {
  if (!mcpNs) {
    document.getElementById('dbSearchStatus').textContent = 'Connecteur Supabase non disponible';
    document.getElementById('dbSearchStatus').className = 'db-status error';
    return;
  }
  try {
    const safeQ = query.replace(/'/g, "''");
    const sql = \`SELECT id, dossier, nom, prenom, date_naissance, cp, localite, etat_civil FROM clients WHERE LOWER(nom) LIKE LOWER('%\${safeQ}%') OR LOWER(prenom) LIKE LOWER('%\${safeQ}%') OR dossier LIKE '%\${safeQ}%' ORDER BY nom, prenom LIMIT 15\`;
    const result = await mcpNs.callTool('Supabase', 'execute_sql', { query: sql });
    const text = result?.payload?.result || result?.payload?.text || (typeof result?.payload === 'string' ? result.payload : JSON.stringify(result?.payload || ''));
    // Parse JSON from response - extract the array
    let rows = [];
    try {
      const match = text.match(/\\[[\\s\\S]*\\]/);
      if (match) rows = JSON.parse(match[0]);
    } catch(e) { /* parse error */ }

    const container = document.getElementById('dbResults');
    const statusEl = document.getElementById('dbSearchStatus');
    if (rows.length === 0) {
      container.innerHTML = '';
      statusEl.textContent = 'Aucun client trouvé';
      statusEl.className = 'db-status';
      return;
    }
    statusEl.textContent = rows.length + ' résultat' + (rows.length > 1 ? 's' : '');
    statusEl.className = 'db-status';
    container.innerHTML = rows.map((r, i) => {
      const ecInfo = ETAT_CIVIL_MAP[r.etat_civil] || { label: '' };
      const age = r.date_naissance ? ageFromDob(r.date_naissance) + ' ans' : '';
      const detail = [ecInfo.label, age].filter(Boolean).join(' · ');
      return \`<div class="db-result-item" onclick='prefillFromClient(\${JSON.stringify(r).replace(/'/g,"&#39;")})'>
        <span class="ri-name">\${(r.nom||'')} \${(r.prenom||'')}</span>
        \${r.cp ? \`<span class="ri-cp">\${r.cp}</span>\` : ''}
        <span class="ri-detail">\${detail}</span>
      </div>\`;
    }).join('');
  } catch(e) {
    document.getElementById('dbSearchStatus').textContent = 'Erreur: ' + (e.message || e.code || 'inconnue');
    document.getElementById('dbSearchStatus').className = 'db-status error';
    document.getElementById('dbResults').innerHTML = '';
  }
}

async function prefillFromClient(client) {
  // Name
  const fullName = ((client.nom || '') + ' ' + (client.prenom || '')).trim();
  document.getElementById('personName').value = fullName;
  document.getElementById('clientName').value = fullName;

  // Date of birth
  if (client.date_naissance) {
    document.getElementById('personDob').value = client.date_naissance;
  }

  // Region from CP
  if (client.cp) {
    document.getElementById('region').value = cpToRegion(client.cp);
  }

  // Partner status from etat_civil
  const ecInfo = ETAT_CIVIL_MAP[client.etat_civil] || {};
  if (ecInfo.partner) {
    if (!partner) {
      partner = { name: '', dob: '1985-01-01', statut: ecInfo.partner, regime: 'acquets' };
      document.getElementById('btnAddPartner').style.display = 'none';
    } else {
      partner.statut = ecInfo.partner;
    }
    renderPartner();
  }

  // Clear search
  document.getElementById('dbResults').innerHTML = '';
  document.getElementById('dbSearchInput').value = '';

  // Show prefill info
  const region = cpToRegion(client.cp || '');
  const regionLabel = { wallonie: 'Wallonie', bruxelles: 'Bruxelles', flandre: 'Flandre' }[region];
  const age = client.date_naissance ? ageFromDob(client.date_naissance) : '?';
  let info = \`Pré-rempli : \${fullName}, \${age} ans, \${regionLabel}\`;
  if (ecInfo.label) info += \`, \${ecInfo.label}\`;
  document.getElementById('dbSearchStatus').innerHTML = \`<div class="prefill-info">\${info.replace(/\\n/g,'<br>')}</div>\`;
  document.getElementById('dbSearchStatus').className = 'db-status';

  update();

  // Fire parallel DB enrichment queries if MCP available
  if (!mcpNs || !client.dossier) return;

  const panel = document.getElementById('prefillPanel');
  panel.style.display = '';
  panel.innerHTML = \`<div class="prefill-panel"><h3><span class="spinner"></span> Recherche en base...</h3></div>\`;

  const safeDossier = (client.dossier+'').replace(/'/g,"''");
  const safeNom = (client.nom||'').replace(/'/g,"''");
  const safePrenom = (client.prenom||'').replace(/'/g,"''");
  const PID = '${SUPABASE_PROJECT_REF}';
  const sql = (q) => mcpNs.callTool('Supabase', 'execute_sql', { project_id: PID, query: q }).then(r => {
    // Extract text from various possible response shapes
    let raw = r?.payload;
    // Also try content blocks if payload is empty
    if (!raw && r?.content) {
      const tb = r.content.find(b => b.type === 'text');
      if (tb) raw = tb.text;
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      raw = raw.result || raw.text || JSON.stringify(raw);
    }
    if (typeof raw === 'string') {
      const m = raw.match(/\\[[\\s\\S]*\\]/);
      if (m) return JSON.parse(m[0]);
    }
    if (Array.isArray(raw)) return raw;
    return [];
  }).catch(e => { console.error('SQL enrichment error:', e); return []; });

  // === PHASE 1: Direct queries on person's own dossier ===
  const [ownIncendieRows, familleRows, entrepriseRows, vieRows] = await Promise.all([
    sql(\`SELECT DISTINCT o.description, o.type_risque FROM objets_risque o JOIN contrats c ON o.dossier=c.dossier AND o.police=c.police WHERE o.dossier='\${safeDossier}' AND o.domaine='Incendie risques simples' AND o.situation IN ('En cours','Suspendu') AND o.type_risque='Bâtiment'\`),
    sql(\`SELECT DISTINCT p.membre_nom, c.dossier AS membre_dossier, c.date_naissance, c.cp FROM parentes p LEFT JOIN clients c ON UPPER(TRIM(p.membre_nom)) LIKE '%' || UPPER(TRIM(c.nom)) || '%' AND UPPER(TRIM(p.membre_nom)) LIKE '%' || UPPER(TRIM(c.prenom)) || '%' WHERE p.dossier_principal='\${safeDossier}' AND p.groupe_type='01-Famille' AND UPPER(TRIM(p.membre_nom)) NOT LIKE '%\${safeNom.toUpperCase()}%\${safePrenom.toUpperCase()}%' AND UPPER(TRIM(p.membre_nom)) NOT LIKE '%\${safePrenom.toUpperCase()}%\${safeNom.toUpperCase()}%'\`),
    sql(\`SELECT DISTINCT p.membre_nom FROM parentes p WHERE p.dossier_principal='\${safeDossier}' AND p.groupe_type='02-Entreprise' AND UPPER(TRIM(p.membre_nom)) NOT LIKE '%\${safeNom.toUpperCase()}%'\`),
    sql(\`SELECT DISTINCT o.police, o.compagnie, o.garantie, o.description, c.type_production FROM objets_risque o JOIN contrats c ON o.dossier=c.dossier AND o.police=c.police WHERE o.dossier='\${safeDossier}' AND o.domaine='Vie et placements' AND o.situation IN ('En cours','Suspendu')\`)
  ]);

  // === PHASE 2: RECURSIVE company chain discovery ===
  // Start with direct entreprise members, then follow the chain
  const allCompanyNames = new Set(); // all unique company names discovered
  const allCompanyDossiers = new Map(); // dossier -> company name
  const visitedDossiers = new Set([safeDossier]); // avoid loops
  const deepEntreprises = []; // extended list with source info

  // Seed with direct entreprise members (these are company names found in person's parentes)
  const directCompanies = entrepriseRows.map(r => (r.membre_nom||'').trim()).filter(n => n);
  directCompanies.forEach(n => { allCompanyNames.add(n.toUpperCase()); deepEntreprises.push({ membre_nom: n, via: 'Direct' }); });

  // Recursive: for each company, find where it appears in OTHER dossiers' parentes, get those dossiers' members
  let frontier = [...directCompanies]; // companies to explore
  let depth = 0;
  const MAX_DEPTH = 3;
  while (frontier.length > 0 && depth < MAX_DEPTH) {
    depth++;
    const nextFrontier = [];
    // Find dossiers where these companies appear as membre_nom in entreprise parentes
    const conditions = frontier.map(n => \`UPPER(TRIM(p.membre_nom)) = '\${n.toUpperCase().replace(/'/g,"''")}'\`).join(' OR ');
    const linkedDossiers = await sql(\`SELECT DISTINCT p.dossier_principal, p.groupe_nom FROM parentes p WHERE (\${conditions}) AND p.groupe_type='02-Entreprise' AND p.dossier_principal NOT IN (\${[...visitedDossiers].map(d=>\`'\${d}'\`).join(',')})\`);

    for (const ld of linkedDossiers) {
      const dos = (ld.dossier_principal||'').replace(/'/g,"''");
      if (visitedDossiers.has(dos)) continue;
      visitedDossiers.add(dos);
      // Get all entreprise members of this new dossier
      const members = await sql(\`SELECT DISTINCT p.membre_nom FROM parentes p WHERE p.dossier_principal='\${dos}' AND p.groupe_type='02-Entreprise'\`);
      for (const m of members) {
        const mName = (m.membre_nom||'').trim();
        if (!mName || mName.toUpperCase().includes(safeNom.toUpperCase())) continue; // skip the person themselves
        if (!allCompanyNames.has(mName.toUpperCase())) {
          allCompanyNames.add(mName.toUpperCase());
          const viaLabel = frontier.length === 1 ? \`Via \${frontier[0]}\` : \`Via \${ld.groupe_nom || dos}\`;
          deepEntreprises.push({ membre_nom: mName, via: viaLabel });
          // Check if this looks like a company (not a person name) — add to next frontier
          // Heuristic: company names are typically ALL CAPS or single words
          const looksLikeCompany = mName === mName.toUpperCase() || !mName.includes(' ') || mName.match(/^[A-Z][A-Z0-9\\s_-]+$/);
          if (looksLikeCompany) nextFrontier.push(mName);
        }
      }
      // Also find incendie/vie in this dossier
      allCompanyDossiers.set(dos, ld.groupe_nom || dos);
    }
    // Also resolve direct company names to their own dossiers (clients table)
    if (depth === 1) {
      const cNames = frontier.map(n => \`UPPER(c.nom) = '\${n.toUpperCase().replace(/'/g,"''")}'\`).join(' OR ');
      const cDossiers = await sql(\`SELECT DISTINCT c.dossier, c.nom FROM clients c WHERE \${cNames}\`);
      for (const cd of cDossiers) {
        if (!visitedDossiers.has(cd.dossier)) {
          visitedDossiers.add(cd.dossier);
          allCompanyDossiers.set(cd.dossier, cd.nom);
        }
      }
    }
    frontier = nextFrontier;
  }

  // === PHASE 3: Incendie + Vie from ALL discovered company dossiers ===
  let companyIncendieRows = [];
  let companyVieRows = [];
  const compDossierKeys = [...allCompanyDossiers.keys()];
  if (compDossierKeys.length) {
    const dossierList = compDossierKeys.map(d => \`'\${d.replace(/'/g,"''")}'\`).join(',');
    const [cInc, cVie] = await Promise.all([
      sql(\`SELECT DISTINCT o.description, o.type_risque, o.dossier FROM objets_risque o JOIN contrats c ON o.dossier=c.dossier AND o.police=c.police WHERE o.dossier IN (\${dossierList}) AND o.domaine='Incendie risques simples' AND o.situation IN ('En cours','Suspendu') AND o.type_risque='Bâtiment'\`),
      sql(\`SELECT DISTINCT o.police, o.compagnie, o.garantie, o.description, c.type_production, o.dossier FROM objets_risque o JOIN contrats c ON o.dossier=c.dossier AND o.police=c.police WHERE o.dossier IN (\${dossierList}) AND o.domaine='Vie et placements' AND o.situation IN ('En cours','Suspendu')\`)
    ]);
    companyIncendieRows = cInc;
    companyVieRows = cVie;
  }

  // === PHASE 4: Sibling/family discovery via surname matching ===
  // Extract unique surnames from famille members and search for other clients with same surname
  const siblingRows = [];
  const knownNames = new Set(familleRows.map(r => (r.membre_nom||'').trim().toUpperCase()));
  knownNames.add(\`\${safeNom.toUpperCase()} \${safePrenom.toUpperCase()}\`);
  knownNames.add(\`\${safePrenom.toUpperCase()} \${safeNom.toUpperCase()}\`);
  const surnames = new Set();
  // Add own surname
  surnames.add(safeNom.toUpperCase());
  // Extract surnames from famille members (format "SURNAME Firstname" or "Firstname SURNAME")
  familleRows.forEach(r => {
    const parts = (r.membre_nom||'').trim().split(/\\s+/);
    parts.forEach(p => { if (p === p.toUpperCase() && p.length > 2) surnames.add(p); });
  });
  if (surnames.size) {
    const surnameConditions = [...surnames].map(s => \`UPPER(TRIM(c.nom)) = '\${s.replace(/'/g,"''")}'\`).join(' OR ');
    const sameNameClients = await sql(\`SELECT DISTINCT c.dossier, c.nom, c.prenom, c.date_naissance FROM clients c WHERE (\${surnameConditions}) AND c.dossier != '\${safeDossier}' AND c.prenom IS NOT NULL AND c.prenom != ''\`);
    for (const sc of sameNameClients) {
      const fullName = \`\${(sc.nom||'')} \${(sc.prenom||'')}\`.trim().toUpperCase();
      if (knownNames.has(fullName)) continue; // already in famille
      // Check it's not already a known famille member by checking partial match
      const alreadyKnown = [...knownNames].some(k => k.includes((sc.nom||'').toUpperCase()) && k.includes((sc.prenom||'').toUpperCase()));
      if (alreadyKnown) continue;
      knownNames.add(fullName);
      siblingRows.push({ membre_nom: \`\${sc.nom} \${sc.prenom}\`.trim(), date_naissance: sc.date_naissance, membre_dossier: sc.dossier, via: \`Même nom: \${sc.nom}\` });
    }
  }

  // Merge results
  const incendieRows = [...ownIncendieRows, ...companyIncendieRows.map(r => ({...r, viaCompany: true, viaLabel: allCompanyDossiers.get(r.dossier) || 'Société'}))];
  const allVieRows = [...vieRows, ...companyVieRows.map(r => ({...r, viaCompany: true, viaLabel: allCompanyDossiers.get(r.dossier) || 'Société'}))];
  const allFamilleRows = [...familleRows, ...siblingRows];

  renderPrefillPanel(incendieRows, allFamilleRows, deepEntreprises, allVieRows, client);
}

function renderPrefillPanel(incendieRows, familleRows, entrepriseRows, vieRows, client) {
  const panel = document.getElementById('prefillPanel');
  const total = incendieRows.length + familleRows.length + entrepriseRows.length + vieRows.length;
  if (total === 0) {
    panel.innerHTML = \`<div class="prefill-panel"><h3>&#9989; Aucune donnée complémentaire trouvée en base</h3></div>\`;
    setTimeout(() => { panel.style.display = 'none'; }, 3000);
    return;
  }

  // Store prefill data for accept actions
  window._prefillData = { incendie: incendieRows, famille: familleRows, entreprises: entrepriseRows, vie: vieRows, client };

  let html = \`<div class="prefill-panel"><h3>&#128204; Données trouvées en base (\${total})</h3>\`;

  // --- IMMEUBLES ---
  if (incendieRows.length) {
    html += \`<div class="prefill-section"><div class="prefill-section-title">&#127968; Immeubles assurés <span class="count">\${incendieRows.length}</span></div>\`;
    incendieRows.forEach((r, i) => {
      const addr = (r.description || 'Adresse inconnue').trim();
      const src = r.viaCompany ? (r.viaLabel ? 'Via ' + r.viaLabel : 'Via société') : 'Contrat Incendie';
      html += \`<div class="prefill-item" id="pi-immo-\${i}">
        <span class="pi-icon">&#127968;</span>
        <div class="pi-text">\${addr}<div class="pi-sub">\${src} — Bâtiment</div></div>
        <div class="pi-actions">
          <button class="pi-btn pi-accept" onclick="acceptImmo(\${i})">+ Ajouter</button>
          <button class="pi-btn pi-skip" onclick="skipItem('pi-immo-\${i}')">Ignorer</button>
        </div>
      </div>\`;
    });
    html += \`</div>\`;
  }

  // --- FAMILLE ---
  if (familleRows.length) {
    html += \`<div class="prefill-section"><div class="prefill-section-title">&#128106; Famille <span class="count">\${familleRows.length}</span></div>\`;
    familleRows.forEach((r, i) => {
      const name = (r.membre_nom || '').trim();
      const age = r.date_naissance ? ageFromDob(r.date_naissance) + ' ans' : '';
      const viaInfo = r.via ? \` · <em>\${r.via}</em>\` : '';
      const sub = (age || 'Lien familial') + viaInfo;
      html += \`<div class="prefill-item" id="pi-fam-\${i}">
        <span class="pi-icon">&#128100;</span>
        <div class="pi-text">\${name}<div class="pi-sub">\${sub || 'Lien familial'}</div></div>
        <div class="pi-actions">
          <button class="pi-btn pi-accept" onclick="acceptFamille(\${i},'enfant')">Enfant</button>
          <button class="pi-btn pi-accept" onclick="acceptFamille(\${i},'conjoint')" style="background:rgba(37,99,235,.3);color:#93c5fd">Conjoint</button>
          <button class="pi-btn pi-skip" onclick="skipItem('pi-fam-\${i}')">Ignorer</button>
        </div>
      </div>\`;
    });
    html += \`</div>\`;
  }

  // --- ENTREPRISES ---
  if (entrepriseRows.length) {
    html += \`<div class="prefill-section"><div class="prefill-section-title">&#127970; Sociétés <span class="count">\${entrepriseRows.length}</span></div>\`;
    entrepriseRows.forEach((r, i) => {
      const name = (r.membre_nom || r.groupe_nom || '').trim();
      const entVia = r.via ? \`<div class="pi-sub">\${r.via}</div>\` : '';
      html += \`<div class="prefill-item" id="pi-ent-\${i}">
        <span class="pi-icon">&#127970;</span>
        <div class="pi-text">\${name}\${entVia}</div>
        <div class="pi-actions">
          <button class="pi-btn pi-accept" onclick="acceptEntreprise(\${i})">+ Ajouter</button>
          <button class="pi-btn pi-skip" onclick="skipItem('pi-ent-\${i}')">Ignorer</button>
        </div>
      </div>\`;
    });
    html += \`</div>\`;
  }

  // --- VIE ---
  if (vieRows.length) {
    // Group by police
    const grouped = {};
    vieRows.forEach(r => {
      const key = r.police || 'unknown';
      if (!grouped[key]) grouped[key] = { police: r.police, compagnie: r.compagnie, garanties: [], descriptions: [], type_production: r.type_production, viaCompany: r.viaCompany, viaLabel: r.viaLabel };
      if (r.garantie && !grouped[key].garanties.includes(r.garantie)) grouped[key].garanties.push(r.garantie);
      if (r.description && !grouped[key].descriptions.includes(r.description)) grouped[key].descriptions.push(r.description);
    });
    const vieGrouped = Object.values(grouped);

    html += \`<div class="prefill-section"><div class="prefill-section-title">&#128176; Assurances Vie <span class="count">\${vieGrouped.length}</span></div>\`;
    vieGrouped.forEach((g, i) => {
      const type = guessVieType(g);
      const descs = g.descriptions.join(', ');
      const vieVia = g.viaCompany ? \` · <em>Via \${g.viaLabel || 'société'}</em>\` : '';
      html += \`<div class="prefill-item" id="pi-vie-\${i}">
        <span class="pi-icon">&#128176;</span>
        <div class="pi-text">\${type} — \${g.compagnie || '?'}<div class="pi-sub">Police \${g.police}\${descs ? ' · '+descs : ''}\${vieVia}</div></div>
        <div class="pi-actions">
          <button class="pi-btn pi-accept" onclick="acceptVie(\${i})">+ Ajouter</button>
          <button class="pi-btn pi-skip" onclick="skipItem('pi-vie-\${i}')">Ignorer</button>
        </div>
      </div>\`;
    });
    // Store grouped for accept
    window._prefillData.vieGrouped = vieGrouped;
    html += \`</div>\`;
  }

  html += \`<button class="prefill-accept-all" onclick="acceptAllPrefill()">✓ Tout ajouter</button>\`;
  html += \`</div>\`;
  panel.innerHTML = html;
}

function guessVieType(g) {
  const gar = (g.garanties || []).join(' ').toLowerCase();
  const tp = (g.type_production || '').toLowerCase();
  if (gar.includes('solde restant') || gar.includes('srdu')) return 'SRDU';
  if (gar.includes('pension') && gar.includes('complémentaire')) return 'PCLI';
  if (gar.includes('eip') || gar.includes('engagement individuel')) return 'EIP';
  if (tp.includes('épargne-pension') || tp.includes('epargne pension') || tp.includes('ep ')) return 'EP';
  if (tp.includes('long terme') || tp.includes('elt')) return 'EL';
  if (tp.includes('branche 21') || tp.includes('br21')) return 'Branche21';
  if (tp.includes('branche 23') || tp.includes('br23')) return 'Branche23';
  if (gar.includes('vie') || gar.includes('décès')) return 'EP';
  return 'Autre';
}

function skipItem(elId) {
  const el = document.getElementById(elId);
  if (el) { el.classList.add('pi-accepted'); el.querySelector('.pi-actions').innerHTML = '<span style="font-size:10px;color:#4a5a7a">Ignoré</span>'; }
}

function markAccepted(elId) {
  const el = document.getElementById(elId);
  if (el) { el.classList.add('pi-accepted'); el.querySelector('.pi-actions').innerHTML = '<span style="font-size:10px;color:#86efac">✓ Ajouté</span>'; }
}

function acceptImmo(idx) {
  const r = window._prefillData.incendie[idx];
  if (!r) return;
  const id = ++bienId;
  biens.push({ id, type: 'immo_perso', desc: (r.description || '').trim(), valeur: 0, logementFamilial: false });
  renderBiens();
  update();
  markAccepted('pi-immo-'+idx);
}

function acceptFamille(idx, role) {
  const r = window._prefillData.famille[idx];
  if (!r) return;
  const name = (r.membre_nom || '').trim();
  const dob = r.date_naissance || '';
  if (role === 'enfant') {
    const id = ++childIdCounter;
    children.push({ id, name, dob });
    renderChildren();
  } else if (role === 'conjoint') {
    const ecInfo = ETAT_CIVIL_MAP[window._prefillData.client.etat_civil] || {};
    const statut = ecInfo.partner || 'fait';
    partner = { name, dob: dob || '1985-01-01', statut, regime: 'acquets' };
    document.getElementById('btnAddPartner').style.display = 'none';
    renderPartner();
  }
  update();
  markAccepted('pi-fam-'+idx);
}

function acceptEntreprise(idx) {
  const r = window._prefillData.entreprises[idx];
  if (!r) return;
  const id = ++companyId;
  companies.push({ id, name: (r.membre_nom || r.groupe_nom || '').trim(), valeurParts: 0, biens: [] });
  renderCompanies();
  update();
  markAccepted('pi-ent-'+idx);
}

function acceptVie(idx) {
  const g = window._prefillData.vieGrouped[idx];
  if (!g) return;
  const type = guessVieType(g);
  const isSRDU = type === 'SRDU';
  if (isSRDU) {
    // SRDU goes into capitalDeces
    // Don't overwrite — user may have a value already
    markAccepted('pi-vie-'+idx);
    return;
  }
  addAssuranceVie({
    type,
    compagnie: g.compagnie || '',
    police: g.police || '',
    capital: 0,
    beneficiaire: 'legal',
    description: g.descriptions.join(', ')
  });
  markAccepted('pi-vie-'+idx);
}

function acceptAllPrefill() {
  const d = window._prefillData;
  if (!d) return;
  // Accept all non-yet-accepted items
  d.incendie.forEach((_, i) => {
    if (!document.getElementById('pi-immo-'+i)?.classList.contains('pi-accepted')) acceptImmo(i);
  });
  d.famille.forEach((_, i) => {
    if (!document.getElementById('pi-fam-'+i)?.classList.contains('pi-accepted')) acceptFamille(i, 'enfant');
  });
  d.entreprises.forEach((_, i) => {
    if (!document.getElementById('pi-ent-'+i)?.classList.contains('pi-accepted')) acceptEntreprise(i);
  });
  (d.vieGrouped || []).forEach((_, i) => {
    if (!document.getElementById('pi-vie-'+i)?.classList.contains('pi-accepted')) acceptVie(i);
  });
}

// ============== DB MODAL SEARCH FOR PARTNER / CHILDREN ==============
let dbModalMode = null; // 'partner' or 'child'
let dbModalTimer = null;

function openDbSearchModal(mode) {
  dbModalMode = mode;
  document.getElementById('dbModalTitle').textContent = mode === 'partner' ? 'Rechercher le conjoint en base' : 'Rechercher un enfant en base';
  document.getElementById('dbModalSearch').value = '';
  document.getElementById('dbModalResults').innerHTML = '';
  document.getElementById('dbModalOverlay').classList.add('show');
  setTimeout(() => document.getElementById('dbModalSearch').focus(), 100);
}

function closeDbModal() {
  document.getElementById('dbModalOverlay').classList.remove('show');
  dbModalMode = null;
}

function onDbModalSearch(val) {
  clearTimeout(dbModalTimer);
  const q = val.trim();
  if (q.length < 2) { document.getElementById('dbModalResults').innerHTML = ''; return; }
  dbModalTimer = setTimeout(() => searchClientsForModal(q), 400);
}

async function searchClientsForModal(query) {
  if (!mcpNs) return;
  try {
    const safeQ = query.replace(/'/g, "''");
    const sql = \`SELECT id, dossier, nom, prenom, date_naissance, cp, localite, etat_civil FROM clients WHERE LOWER(nom) LIKE LOWER('%\${safeQ}%') OR LOWER(prenom) LIKE LOWER('%\${safeQ}%') ORDER BY nom, prenom LIMIT 15\`;
    const res = await mcpNs.callTool('Supabase', 'execute_sql', { query: sql });
    // Parse response — same logic as main search
    let raw = res?.payload;
    if (!raw && res?.content) { const tb = res.content.find(b => b.type === 'text'); if (tb) raw = tb.text; }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) { raw = raw.result || raw.text || JSON.stringify(raw); }
    let rows = [];
    if (typeof raw === 'string') { const m = raw.match(/\\[[\\s\\S]*\\]/); if (m) try { rows = JSON.parse(m[0]); } catch(e){} }
    else if (Array.isArray(raw)) rows = raw;
    const container = document.getElementById('dbModalResults');
    if (!rows.length) { container.innerHTML = '<div style="font-size:11px;color:#6b7a99;padding:8px">Aucun résultat</div>'; return; }
    container.innerHTML = rows.map(r => {
      const name = ((r.nom || '') + ' ' + (r.prenom || '')).trim();
      const age = r.date_naissance ? ageFromDob(r.date_naissance) : '?';
      const loc = r.localite || r.cp || '';
      return \`<div class="modal-result-item" onclick='selectModalClient(\${JSON.stringify(r).replace(/'/g,"&#39;")})'>
        <div><span class="mri-name">\${name}</span><br><span class="mri-info">\${age} ans · \${loc}</span></div>
      </div>\`;
    }).join('');
  } catch (e) {
    document.getElementById('dbModalResults').innerHTML = '<div style="font-size:11px;color:#dc2626;padding:8px">Erreur de recherche</div>';
  }
}

function selectModalClient(client) {
  const name = ((client.nom || '') + ' ' + (client.prenom || '')).trim();
  const dob = client.date_naissance || '';
  if (dbModalMode === 'partner') {
    const ecInfo = ETAT_CIVIL_MAP[client.etat_civil] || {};
    const statut = ecInfo.partner || 'fait';
    partner = { name, dob: dob || '1985-01-01', statut, regime: 'acquets' };
    document.getElementById('btnAddPartner').style.display = 'none';
    renderPartner();
    update();
  } else if (dbModalMode === 'child') {
    const id = ++childIdCounter;
    children.push({ id, name, dob });
    renderChildren();
    update();
  }
  closeDbModal();
}

function getFieldValues() {
  const data = {};
  // Simple fields
  const simpleFields = ['region','mobilier','mobilierPartner','capitalDeces',
    'beneficiaire','toggleLogement','toggleDonation','donationType','donationMontant','donationBenef',
    'donationNature','toggleAV','avType','avCapital','toggle2028','toggleTestament','personName','personDob'];
  simpleFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') data[id] = el.checked;
    else data[id] = el.value;
  });
  // Partner
  data._partner = partner ? { ...partner } : null;
  // Children
  data._children = children.map(c => ({ name: c.name, dob: c.dob }));
  // Biens
  data._biens = biens.map(b => ({ type: b.type, desc: b.desc, valeur: b.valeur, logementFamilial: b.logementFamilial }));
  // Companies
  data._companies = companies.map(co => ({
    name: co.name, valeurParts: co.valeurParts,
    biens: co.biens.map(cb => ({ type: cb.type, desc: cb.desc, valeur: cb.valeur }))
  }));
  // Assurances Vie
  data._assurancesVie = assurancesVie.map(a => ({
    type: a.type, compagnie: a.compagnie, police: a.police, capital: a.capital, beneficiaire: a.beneficiaire, description: a.description
  }));
  // Legs
  data._legs = legs.map(id => ({
    beneficiaire: document.getElementById(\`legBenef_\${id}\`)?.value,
    asset: document.getElementById(\`legAsset_\${id}\`)?.value,
    montant: document.getElementById(\`legAmount_\${id}\`)?.value
  }));
  return data;
}

function setFieldValues(data) {
  const simpleFields = ['region','mobilier','mobilierPartner','capitalDeces',
    'beneficiaire','toggleLogement','toggleDonation','donationType','donationMontant','donationBenef',
    'donationNature','toggleAV','avType','avCapital','toggle2028','toggleTestament','personName','personDob'];
  simpleFields.forEach(id => {
    const el = document.getElementById(id);
    if (!el || data[id] === undefined) return;
    if (el.type === 'checkbox') el.checked = !!data[id];
    else el.value = data[id];
  });

  // Backward compat: old capitalAssurances → single AV entry
  if (data.capitalAssurances && parseFloat(data.capitalAssurances) > 0 && (!data._assurancesVie || !data._assurancesVie.length)) {
    assurancesVie = [{ id: ++avId, type: 'EP', compagnie: '', police: '', capital: parseFloat(data.capitalAssurances), beneficiaire: 'legal', description: 'Import ancien format' }];
  }

  // Partner
  if (data._partner) {
    partner = { ...data._partner };
    document.getElementById('btnAddPartner').style.display = 'none';
  } else {
    partner = null;
    document.getElementById('btnAddPartner').style.display = '';
  }
  renderPartner();

  // Children
  children = [];
  childIdCounter = 0;
  if (data._children && data._children.length > 0) {
    data._children.forEach(c => {
      children.push({ id: ++childIdCounter, name: c.name || '', dob: c.dob || '' });
    });
  }
  renderChildren();

  // Biens
  biens = [];
  bienId = 0;
  if (data._biens && data._biens.length > 0) {
    data._biens.forEach(b => {
      biens.push({ id: ++bienId, type: b.type || 'immo_perso', desc: b.desc || '', valeur: b.valeur || 0, logementFamilial: !!b.logementFamilial });
    });
  }
  renderBiens();

  // Companies
  companies = [];
  companyId = 0;
  companyBienId = 0;
  if (data._companies && data._companies.length > 0) {
    data._companies.forEach(co => {
      const cid = ++companyId;
      const cBiens = (co.biens || []).map(cb => ({ id: ++companyBienId, type: cb.type || 'immo_invest', desc: cb.desc || '', valeur: cb.valeur || 0 }));
      companies.push({ id: cid, name: co.name || '', valeurParts: co.valeurParts || 0, biens: cBiens });
    });
  }
  renderCompanies();

  // Assurances Vie
  if (data._assurancesVie && data._assurancesVie.length > 0) {
    assurancesVie = [];
    avId = 0;
    data._assurancesVie.forEach(a => {
      assurancesVie.push({ id: ++avId, type: a.type || 'EP', compagnie: a.compagnie || '', police: a.police || '', capital: a.capital || 0, beneficiaire: a.beneficiaire || 'legal', description: a.description || '' });
    });
  }
  renderAssurancesVie();

  // Legs
  legs = [];
  legId = 0;
  if (data._legs && data._legs.length > 0) {
    data._legs.forEach(() => { legs.push(++legId); });
    renderLegs();
    data._legs.forEach((l, i) => {
      const id = legs[i];
      const bEl = document.getElementById(\`legBenef_\${id}\`);
      const aEl = document.getElementById(\`legAsset_\${id}\`);
      const mEl = document.getElementById(\`legAmount_\${id}\`);
      if (bEl && l.beneficiaire) bEl.value = l.beneficiaire;
      if (aEl && l.asset) aEl.value = l.asset;
      if (mEl && l.montant) mEl.value = l.montant;
    });
  } else {
    renderLegs();
  }
  update();
}

function showStatus(msg, isError) {
  const el = document.getElementById('statusMsg');
  if (!el) return;
  el.textContent = msg;
  el.className = 'status-msg' + (isError ? ' error' : '');
  if (!isError) setTimeout(() => { el.textContent = ''; }, 3000);
}

async function saveSimulation() {
  if (!dbNs) { showStatus('Base de données non disponible', true); return; }
  const name = document.getElementById('clientName').value.trim();
  if (!name) { showStatus('Entrez un nom de client', true); return; }
  const data = getFieldValues();
  data.clientName = name;
  data.updatedAt = Date.now();
  try {
    if (currentSimId) {
      await dbNs.collection('simulations').doc(currentSimId).set(data);
      showStatus('Simulation mise à jour');
    } else {
      data.createdAt = Date.now();
      const ref = await dbNs.collection('simulations').add(data);
      currentSimId = ref.id;
      showStatus('Simulation sauvegardée');
    }
  } catch (e) {
    showStatus('Erreur: ' + (e.message || e.code || 'inconnu'), true);
  }
}

async function loadSimulation(id) {
  if (!dbNs) return;
  try {
    const snap = await dbNs.collection('simulations').doc(id).get();
    if (!snap.exists) { showStatus('Simulation introuvable', true); return; }
    const data = snap.data;
    currentSimId = id;
    document.getElementById('clientName').value = data.clientName || '';
    setFieldValues(data);
    showStatus('Chargé: ' + (data.clientName || id));
  } catch (e) {
    showStatus('Erreur chargement', true);
  }
}

async function deleteSimulation(id) {
  if (!dbNs) return;
  if (!confirm('Supprimer cette simulation ?')) return;
  try {
    await dbNs.collection('simulations').doc(id).delete();
    if (currentSimId === id) { currentSimId = null; newSimulation(); }
    showStatus('Simulation supprimée');
  } catch (e) {
    showStatus('Erreur suppression', true);
  }
}

function newSimulation() {
  currentSimId = null;
  document.getElementById('clientName').value = '';
  document.getElementById('personName').value = '';
  document.getElementById('personDob').value = '1978-06-15';
  document.getElementById('region').selectedIndex = 0;
  document.getElementById('mobilier').value = '0';
  document.getElementById('mobilierPartner').value = '0';
  document.getElementById('capitalDeces').value = '0';
  document.getElementById('beneficiaire').selectedIndex = 0;
  document.getElementById('toggleLogement').checked = false;
  document.getElementById('toggleDonation').checked = false;
  document.getElementById('toggleTestament').checked = false;
  document.getElementById('toggle2028').checked = false;
  document.getElementById('toggleAV').checked = false;
  document.getElementById('donationMontant').value = '0';

  partner = null;
  document.getElementById('btnAddPartner').style.display = '';
  renderPartner();
  children = [];
  childIdCounter = 0;
  renderChildren();
  biens = [];
  bienId = 0;
  renderBiens();
  companies = [];
  companyId = 0;
  companyBienId = 0;
  renderCompanies();
  assurancesVie = [];
  avId = 0;
  renderAssurancesVie();
  legs = [];
  legId = 0;
  renderLegs();
  update();
  showStatus('Nouveau dossier');
}

function renderSavedList(items, isFiltered) {
  if (!isFiltered) allSavedItems = items || [];
  const container = document.getElementById('savedList');
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = \`<div style="font-size:11px;color:#6b7a99;text-align:center;padding:10px">\${isFiltered ? 'Aucun résultat' : 'Aucune simulation sauvegardée'}</div>\`;
    return;
  }
  container.innerHTML = items.map(item => {
    const d = item.data;
    const date = d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('fr-BE') : '';
    const active = item.id === currentSimId ? ' style="background:rgba(37,99,235,.2)"' : '';
    return \`<div class="saved-item"\${active} onclick="loadSimulation('\${item.id}')">
      <span class="si-name">\${d.clientName || 'Sans nom'}</span>
      <span class="si-date">\${date}</span>
      <span class="si-del" onclick="event.stopPropagation();deleteSimulation('\${item.id}')" title="Supprimer">✕</span>
    </div>\`;
  }).join('');
}


update();
</script>
</body>
</html>`
    const blob = new Blob([htmlContent], { type: 'text/html' })
    return URL.createObjectURL(blob)
  }, [])

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl)
  }, [blobUrl])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    function handleMessage(e) {
      if (!e.data || !e.data.type) return
      const { type, callId, action, params } = e.data

      if (type === 'request-user-info') {
        iframe.contentWindow.postMessage({
          type: 'user-info',
          user: { id: user?.id || 'anonymous', email: user?.email || '' }
        }, '*')
        return
      }

      if (type !== 'bridge-request') return

      const respond = (result) => {
        iframe.contentWindow.postMessage({ type: 'bridge-response', callId, result }, '*')
      }
      const respondError = (err) => {
        iframe.contentWindow.postMessage({ type: 'bridge-response', callId, error: err }, '*')
      }

      ;(async () => {
        try {
          switch (action) {
            case 'execute_sql': {
              const { data, error } = await supabase.rpc('execute_raw_sql', { sql_query: params.query })
              if (error) respondError('SQL error: ' + error.message)
              else respond(Array.isArray(data) ? data : [])
              break
            }

            case 'db_get': {
              const { data, error } = await supabase
                .from('succession_simulations')
                .select('*')
                .eq('id', params.id)
                .single()
              if (error) respond({ exists: false, data: null })
              else respond({ exists: true, data: data.data || data })
              break
            }

            case 'db_set': {
              const payload = {
                data: params.data,
                client_name: params.data.clientName || '',
                updated_at: new Date().toISOString()
              }
              const { error } = await supabase
                .from('succession_simulations')
                .update(payload)
                .eq('id', params.id)
              if (error) respondError(error.message)
              else respond({ id: params.id })
              break
            }

            case 'db_add': {
              const { data: row, error } = await supabase
                .from('succession_simulations')
                .insert({
                  user_id: user?.id || null,
                  client_name: params.data.clientName || '',
                  data: params.data
                })
                .select('id')
                .single()
              if (error) respondError(error.message)
              else respond({ id: row.id })
              break
            }

            case 'db_delete': {
              const { error } = await supabase
                .from('succession_simulations')
                .delete()
                .eq('id', params.id)
              if (error) respondError(error.message)
              else respond({ ok: true })
              break
            }

            case 'db_list': {
              const { data, error } = await supabase
                .from('succession_simulations')
                .select('*')
                .order(params.orderBy === 'updatedAt' ? 'updated_at' : params.orderBy, {
                  ascending: params.dir !== 'desc'
                })
                .limit(params.limit || 50)
              if (error) respond({ docs: [] })
              else respond({
                docs: (data || []).map(row => ({
                  id: row.id,
                  data: { ...row.data, clientName: row.client_name || row.data?.clientName }
                }))
              })
              break
            }

            default:
              respondError('Unknown action: ' + action)
          }
        } catch (err) {
          respondError(err.message || 'Bridge error')
        }
      })()
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [user])

  return (
    <Layout currentPage="Succession">
      <iframe
        ref={iframeRef}
        src={blobUrl}
        style={{
          width: '100%',
          height: 'calc(100vh - 60px)',
          border: 'none',
          borderRadius: '8px'
        }}
        title="Simulateur Successoral"
      />
    </Layout>
  )
}

