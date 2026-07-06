import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const NAVY = '#0D2F5E'
const N8N_API = 'https://n8n.srv1082740.hstgr.cloud/api/v1'
const N8N_WH  = 'https://n8n.srv1082740.hstgr.cloud/webhook'
const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxNzZlZWRiMy03ZjJlLTQ0NWYtOGIyOC1lNTc0MDcwMDdjNWIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZTFiYjQwODUtYzIwNy00Yjk0LWJjNzMtMGZmYTBmZGZmNzAwIiwiaWF0IjoxNzgxNDI2NTY2fQ.ipavXrAn3C8mguWlkFrL1BFiIogYy807JoXH19BVrxM'

export const SYNCS = [
  {
    key: 'import',
    label: 'Import Brio',
    labelCourt: 'Import',
    desc: 'Clients, contrats, production, quittances, famille et objets de risque depuis les CSV Brio (SharePoint).',
    icon: 'ti-database-import',
    color: '#0080BD',
    webhook: 'run-import-dynassur',
    workflowId: 'XveWrHrBybFWp2B0',
    tables: ['clients', 'contrats', 'mouvements_production', 'quittances', 'famille', 'risques'],
  },
  {
    key: 'iban',
    label: 'Comptes bancaires',
    labelCourt: 'Banque',
    desc: 'Soldes et transactions Ponto pour toutes les entités.',
    icon: 'ti-building-bank',
    color: '#16a34a',
    webhook: 'iban-sync',
    workflowId: 'hf6G2dE1ZcfXDO4W',
    tables: ['transactions'],
  },
  {
    key: 'bordereaux',
    label: 'Bordereaux BQT / RCP',
    labelCourt: 'Bordereaux',
    desc: 'Bordereaux de primes et commissions depuis SharePoint.',
    icon: 'ti-file-invoice',
    color: '#7c3aed',
    webhook: 'run-bordereaux',
    workflowId: '9mVOQPAN2fI5z9um',
    tables: ['bordereaux'],
  },
]

export function fmtNb(n) { return n == null ? '—' : n.toLocaleString('fr-BE') }

export async function triggerWorkflow(webhook, workflowId) {
  try {
    const res = await fetch(`${N8N_WH}/${webhook}`, { method: 'POST' })
    if (res.ok) return { ok: true, method: 'webhook' }
  } catch {}
  try {
    const h = { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' }
    await fetch(`${N8N_API}/workflows/${workflowId}/deactivate`, { method: 'POST', headers: h })
    await new Promise(r => setTimeout(r, 1500))
    const r2 = await fetch(`${N8N_API}/workflows/${workflowId}/activate`, { method: 'POST', headers: h })
    if (r2.ok) return { ok: true, method: 'api-toggle' }
  } catch {}
  return { ok: false }
}


// Liste étendue pour les boutons compacts (inclut rapprochement factures)
export const SYNC_BUTTONS = [
  ...SYNCS,
  {
    key: 'rapprochement',
    label: 'Rapprochement & prévisualisation',
    labelCourt: 'Rapprochement',
    desc: 'Associe automatiquement les factures SharePoint aux transactions bancaires.',
    icon: 'ti-link',
    color: '#0080BD',
    webhook: 'rapprochement-factures',
    workflowId: 'hmL5WFBknLUfDwGw',
    tables: [],
  },
]

// Formate une date en "il y a X min" ou date courte
export function fmtDerniereExec(at) {
  if (!at) return 'jamais'
  const d = new Date(at)
  const diff = Math.floor((Date.now() - d.getTime()) / 60000) // minutes
  if (diff < 1) return "à l'instant"
  if (diff < 60) return `il y a ${diff} min`
  if (diff < 1440) return `il y a ${Math.floor(diff/60)} h`
  return d.toLocaleDateString('fr-BE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
}

// Bouton compact unique avec dernière exécution
function SyncMiniButton({ sync, onDark, compact }) {
  const [state, setState] = useState('idle')
  const [lastExec, setLastExec] = useState(null)

  const loadLastExec = async () => {
    try {
      const res = await fetch(`${N8N_API}/executions?workflowId=${sync.workflowId}&limit=1`, { headers: { 'X-N8N-API-KEY': N8N_KEY } })
      if (res.ok) {
        const data = await res.json()
        const e = data.data?.[0]
        if (e) setLastExec({ status: e.status, at: e.startedAt })
      }
    } catch {}
  }
  useEffect(() => { loadLastExec() }, [])

  const run = async () => {
    setState('running')
    const result = await triggerWorkflow(sync.webhook, sync.workflowId)
    setState(result.ok ? 'ok' : 'error')
    setTimeout(() => { loadLastExec(); setState('idle') }, 8000)
  }
  const running = state === 'running'
  const statusCol = lastExec?.status === 'error' ? '#f87171' : lastExec?.status === 'success' ? (onDark ? '#86efac' : '#16a34a') : (onDark ? 'rgba(255,255,255,0.6)' : '#94a3b8')
  const bg = onDark
    ? (running ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.92)')
    : (running ? '#f1f5f9' : (state==='ok' ? '#f0fdf4' : state==='error' ? '#fef2f2' : '#fff'))
  const txtCol = onDark ? '#1e293b' : '#334155'
  const iconCol = running ? '#94a3b8' : (state==='ok' ? '#16a34a' : state==='error' ? '#dc2626' : sync.color)
  const border = onDark ? '1px solid rgba(255,255,255,0.3)' : '1px solid #e2e8f0'

  const label = compact ? (sync.labelCourt || sync.label) : sync.label
  return (
    <button onClick={run} disabled={running} title={`${sync.label} — dernière exécution : ${fmtDerniereExec(lastExec?.at)}${lastExec?.status ? ' ('+lastExec.status+')' : ''}`}
      style={{
        display:'flex', alignItems:'center', gap: compact ? '5px' : '7px', padding: compact ? '4px 9px' : '7px 12px', borderRadius: compact ? '7px' : '8px',
        border, background: bg,
        cursor: running ? 'wait' : 'pointer', fontSize: compact ? '11.5px' : '12px', fontWeight:'600', fontFamily:"'Source Sans Pro', sans-serif",
        color: txtCol, whiteSpace:'nowrap', flexShrink:0
      }}>
      <i className={`ti ${running ? 'ti-loader-2' : (state==='ok' ? 'ti-check' : state==='error' ? 'ti-x' : sync.icon)}`}
        style={{ color: iconCol, fontSize: compact ? '14px' : '15px', animation: running ? 'spin 1s linear infinite' : 'none' }} />
      <span>{label}</span>
      <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', paddingLeft:'6px', borderLeft:'1px solid #e2e8f0', color:statusCol, fontSize: compact ? '10px' : '11px', fontWeight:'500' }}>
        <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:statusCol, display:'inline-block' }} />
        {fmtDerniereExec(lastExec?.at)}
      </span>
    </button>
  )
}

// Ligne de boutons de synchronisation manuelle (avec dernière exécution)
export function SyncButtonsRow({ only, style, onDark, compact }) {
  const list = only ? SYNC_BUTTONS.filter(s => only.includes(s.key)) : SYNC_BUTTONS
  return (
    <div style={{ display:'flex', gap: compact ? '6px' : '8px', flexWrap:'wrap', alignItems:'center', ...style }}>
      <span title="Mettre à jour" style={{ fontSize:'11px', fontWeight:'700', color: onDark ? 'rgba(255,255,255,0.85)' : '#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginRight:'2px', display:'inline-flex', alignItems:'center' }}>
        <i className="ti ti-refresh" style={{ fontSize:'14px' }} />{!compact && <span style={{ marginLeft:'4px' }}>Mettre à jour</span>}
      </span>
      {list.map(s => <SyncMiniButton key={s.key} sync={s} onDark={onDark} compact={compact} />)}
    </div>
  )
}

export function WebhookStatus() {
  const [status, setStatus] = useState('checking')
  useEffect(() => {
    fetch(`${N8N_API}/workflows?limit=1`, { headers: { 'X-N8N-API-KEY': N8N_KEY } })
      .then(r => setStatus(r.ok ? 'api-ok' : 'down'))
      .catch(() => setStatus('down'))
    fetch(`${N8N_WH}/iban-sync`, { method: 'POST' })
      .then(r => setStatus(r.ok || r.status < 500 ? 'ok' : 'webhook-down'))
      .catch(() => {})
  }, [])
  const cfg = {
    checking:      { col:'#64748b', bg:'#f1f5f9', icon:'ti-loader-2',      txt:'Vérification…' },
    ok:            { col:'#16a34a', bg:'#f0fdf4', icon:'ti-circle-check',  txt:'n8n opérationnel' },
    'api-ok':      { col:'#f59e0b', bg:'#fef3c7', icon:'ti-alert-triangle',txt:'API n8n OK — serveur webhook inactif (redémarrage requis)' },
    'webhook-down':{ col:'#dc2626', bg:'#fee2e2', icon:'ti-alert-circle',  txt:'Serveur webhook n8n inactif — redémarrer n8n sur le serveur' },
    down:          { col:'#dc2626', bg:'#fee2e2', icon:'ti-plug-off',       txt:'n8n inaccessible' },
  }[status]
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, padding:'8px 12px', borderRadius:8, background:cfg.bg, border:`1px solid ${cfg.col}30`, marginBottom:16 }}>
      <i className={`ti ${cfg.icon}`} style={{ color:cfg.col, fontSize:15 }} />
      <span style={{ color:cfg.col, fontWeight:600 }}>{cfg.txt}</span>
      {(status === 'api-ok' || status === 'webhook-down') && (
        <code style={{ marginLeft:'auto', background:'rgba(0,0,0,0.06)', padding:'2px 8px', borderRadius:4, fontSize:11, color:'#374151' }}>
          docker restart n8n  |  pm2 restart n8n
        </code>
      )}
    </div>
  )
}

export function SyncCard({ sync }) {
  const [state, setState]     = useState('idle')
  const [msg, setMsg]         = useState(null)
  const [method, setMethod]   = useState(null)
  const [counts, setCounts]   = useState({})
  const [lastRun, setLastRun] = useState(null)
  const [lastExec, setLastExec] = useState(null)

  const loadCounts = async () => {
    const out = {}
    for (const t of sync.tables) {
      const { count } = await supabase.from(t).select('*', { count:'exact', head:true })
      out[t] = count
    }
    setCounts(out)
  }

  const loadLastExec = async () => {
    try {
      const res = await fetch(`${N8N_API}/executions?workflowId=${sync.workflowId}&limit=1`, {
        headers: { 'X-N8N-API-KEY': N8N_KEY }
      })
      if (res.ok) {
        const data = await res.json()
        const e = data.data?.[0]
        if (e) setLastExec({ status: e.status, at: e.startedAt })
      }
    } catch {}
  }

  useEffect(() => { loadCounts(); loadLastExec() }, [])

  const run = async () => {
    setState('running'); setMsg(null); setMethod(null)
    const result = await triggerWorkflow(sync.webhook, sync.workflowId)
    if (result.ok) {
      setState('ok'); setMethod(result.method)
      setMsg(result.method === 'webhook'
        ? 'Synchronisation lancée via webhook.'
        : 'Workflow relancé via API n8n. Les données se mettent à jour en arrière-plan.')
      setLastRun(new Date())
      setTimeout(() => { loadCounts(); loadLastExec() }, 8000)
    } else {
      setState('error')
      setMsg('Le serveur webhook n8n est inactif. Redémarre n8n (docker restart n8n), puis réessaie.')
    }
  }

  const running = state === 'running'
  const execBadge = lastExec ? {
    success: { bg:'#f0fdf4', col:'#16a34a', icon:'ti-check', label:'Succès' },
    error:   { bg:'#fef2f2', col:'#dc2626', icon:'ti-x',     label:'Erreur' },
    running: { bg:'#eff6ff', col:'#1d4ed8', icon:'ti-loader', label:'En cours' },
  }[lastExec.status] : null

  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e2e8f0', borderTop:`3px solid ${sync.color}`, padding:'18px 20px', display:'flex', flexDirection:'column', gap:12, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:42, height:42, borderRadius:11, flexShrink:0, background:`${sync.color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i className={`ti ${sync.icon}`} style={{ fontSize:21, color:sync.color }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:800, color:NAVY }}>{sync.label}</div>
          <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>{sync.desc}</div>
        </div>
        {execBadge && (
          <div style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:6, background:execBadge.bg, color:execBadge.col, display:'flex', alignItems:'center', gap:4 }}>
            <i className={`ti ${execBadge.icon}`} style={{ fontSize:11 }} />
            {execBadge.label}
          </div>
        )}
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {sync.tables.map(t => (
          <div key={t} style={{ background:'#f8fafc', borderRadius:8, padding:'6px 11px', border:'1px solid #f1f5f9' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.04em' }}>{t}</div>
            <div style={{ fontSize:15, fontWeight:800, color:'#1e293b' }}>{fmtNb(counts[t])}</div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ fontSize:12, padding:'8px 12px', borderRadius:8,
          background: state==='error' ? '#fef2f2' : state==='ok' && method==='api-toggle' ? '#fffbeb' : '#f0fdf4',
          border: `1px solid ${state==='error' ? '#fecaca' : state==='ok' && method==='api-toggle' ? '#fde68a' : '#bbf7d0'}`,
          color: state==='error' ? '#dc2626' : state==='ok' && method==='api-toggle' ? '#92400e' : '#16a34a',
          display:'flex', alignItems:'flex-start', gap:6 }}>
          <i className={`ti ${state==='error' ? 'ti-alert-circle' : state==='ok' && method==='api-toggle' ? 'ti-alert-triangle' : 'ti-circle-check'}`} style={{ fontSize:15, marginTop:1, flexShrink:0 }} />
          <span>{msg}</span>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:'auto' }}>
        <button onClick={run} disabled={running} style={{ display:'flex', alignItems:'center', gap:7, background:running?'#f1f5f9':sync.color, color:running?'#94a3b8':'#fff', border:'none', borderRadius:9, padding:'9px 18px', cursor:running?'wait':'pointer', fontSize:13, fontWeight:700, fontFamily:"'Source Sans Pro',sans-serif", transition:'background 0.15s' }}>
          <i className={`ti ${running?'ti-loader-2':'ti-refresh'}`} style={running?{animation:'spin 1s linear infinite'}:{}} />
          {running ? 'Lancement…' : 'Synchroniser'}
        </button>
        <button onClick={() => { loadCounts(); loadLastExec() }} title="Rafraîchir" style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:9, padding:'9px 12px', cursor:'pointer', color:'#64748b', fontSize:13 }}>
          <i className="ti ti-reload" />
        </button>
        {lastRun && <span style={{ fontSize:11, color:'#94a3b8' }}>Lancé à {lastRun.toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})}</span>}
        <a href={`https://n8n.srv1082740.hstgr.cloud/workflow/${sync.workflowId}`} target="_blank" rel="noopener noreferrer"
          style={{ marginLeft:'auto', fontSize:11, color:'#94a3b8', textDecoration:'none', display:'flex', alignItems:'center', gap:3 }}>
          <i className="ti ti-external-link" style={{ fontSize:12 }} />n8n
        </a>
      </div>
    </div>
  )
}
