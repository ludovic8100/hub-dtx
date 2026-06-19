import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const BLUE = '#0080BD'
const NAVY = '#0D2F5E'
const N8N  = 'https://n8n.srv1082740.hstgr.cloud/webhook'

// Liste des synchronisations disponibles.
// `webhook` = chemin du webhook n8n (doit exister comme Webhook trigger dans le workflow).
// `tables`  = tables Supabase à compter pour afficher l'état après synchro.
const SYNCS = [
  {
    key: 'import',
    label: 'Import Brio',
    desc: 'Clients, contrats, production, quittances, famille et objets de risque depuis les CSV Brio (SharePoint).',
    icon: 'ti-database-import',
    color: '#0080BD',
    webhook: 'run-import-dynassur',
    tables: ['clients', 'contrats', 'mouvements_production', 'quittances', 'famille', 'risques'],
  },
  {
    key: 'iban',
    label: 'Comptes bancaires',
    desc: 'Soldes et transactions Ponto pour toutes les entités.',
    icon: 'ti-building-bank',
    color: '#16a34a',
    webhook: 'iban-sync',
    tables: ['transactions'],
  },
  {
    key: 'bordereaux',
    label: 'Bordereaux BQT / RCP',
    desc: 'Bordereaux de primes et commissions depuis SharePoint.',
    icon: 'ti-file-invoice',
    color: '#7c3aed',
    webhook: 'run-bordereaux',
    tables: ['bordereaux'],
  },
]

function fmtNb(n) {
  return n == null ? '—' : n.toLocaleString('fr-BE')
}

function SyncCard({ sync }) {
  const [state, setState] = useState('idle') // idle | running | ok | error
  const [msg, setMsg] = useState(null)
  const [counts, setCounts] = useState({})
  const [lastRun, setLastRun] = useState(null)

  const loadCounts = async () => {
    const out = {}
    for (const t of sync.tables) {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
      out[t] = count
    }
    setCounts(out)
  }

  useEffect(() => { loadCounts() }, [])

  const run = async () => {
    setState('running'); setMsg(null)
    try {
      const res = await fetch(`${N8N}/${sync.webhook}`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setState('ok')
      setMsg('Synchronisation lancée. Les données se mettent à jour en arrière-plan.')
      setLastRun(new Date())
      // Recharger les compteurs après un délai (le workflow tourne en async)
      setTimeout(loadCounts, 8000)
    } catch (e) {
      setState('error')
      setMsg(`Échec : ${e.message}. Vérifie que le workflow possède un déclencheur Webhook actif sur « ${sync.webhook} ».`)
    }
  }

  const running = state === 'running'

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
      borderTop: `3px solid ${sync.color}`, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 11, flexShrink: 0,
          background: `${sync.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={`ti ${sync.icon}`} style={{ fontSize: 21, color: sync.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{sync.label}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{sync.desc}</div>
        </div>
      </div>

      {/* Compteurs des tables */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {sync.tables.map(t => (
          <div key={t} style={{ background: '#f8fafc', borderRadius: 8, padding: '6px 11px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>{fmtNb(counts[t])}</div>
          </div>
        ))}
      </div>

      {/* Message d'état */}
      {msg && (
        <div style={{
          fontSize: 12, padding: '8px 12px', borderRadius: 8,
          background: state === 'error' ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${state === 'error' ? '#fecaca' : '#bbf7d0'}`,
          color: state === 'error' ? '#dc2626' : '#16a34a',
          display: 'flex', alignItems: 'flex-start', gap: 6,
        }}>
          <i className={`ti ${state === 'error' ? 'ti-alert-circle' : 'ti-circle-check'}`} style={{ fontSize: 15, marginTop: 1, flexShrink: 0 }} />
          <span>{msg}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto' }}>
        <button onClick={run} disabled={running} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: running ? '#f1f5f9' : sync.color, color: running ? '#94a3b8' : '#fff',
          border: 'none', borderRadius: 9, padding: '9px 18px',
          cursor: running ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700,
          fontFamily: "'Source Sans Pro', sans-serif", transition: 'background 0.15s',
        }}>
          <i className={`ti ${running ? 'ti-loader-2' : 'ti-refresh'}`} style={running ? { animation: 'spin 1s linear infinite' } : {}} />
          {running ? 'Synchronisation…' : 'Synchroniser'}
        </button>
        <button onClick={loadCounts} title="Rafraîchir les compteurs" style={{
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9,
          padding: '9px 12px', cursor: 'pointer', color: '#64748b', fontSize: 13,
        }}>
          <i className="ti ti-reload" />
        </button>
        {lastRun && <span style={{ fontSize: 11, color: '#94a3b8' }}>Lancé à {lastRun.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}</span>}
      </div>
    </div>
  )
}

export default function SyncCenter() {
  return (
    <Layout currentPage="Synchronisation">
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", maxWidth: 1100 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <i className="ti ti-refresh" style={{ fontSize: 20, color: BLUE }} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: 0 }}>Centre de synchronisation</h1>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Lance manuellement les imports de données. Chaque synchronisation tourne en arrière-plan via n8n.
          </p>
        </div>

        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#92400e',
          display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <i className="ti ti-info-circle" style={{ fontSize: 15, marginTop: 1, flexShrink: 0 }} />
          <span>Les compteurs se rafraîchissent automatiquement quelques secondes après le lancement. Une synchro complète peut prendre 1 à 2 minutes selon le volume.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 16 }}>
          {SYNCS.map(s => <SyncCard key={s.key} sync={s} />)}
        </div>
      </div>
    </Layout>
  )
}
