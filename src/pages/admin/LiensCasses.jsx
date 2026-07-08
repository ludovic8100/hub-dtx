import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { StatBanner } from '../../components/ui/AccountableUI'

const C = '#7c3aed'
const CDARK = '#6d28d9'
const WEBHOOK = 'https://n8n.srv1082740.hstgr.cloud/webhook/nettoyer-liens-casses'

const fmtEur = (n) => (n == null || isNaN(n)) ? '—' : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(n)
const fmtDT = (s) => { try { return new Date(s).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return s || '—' } }
const fmtD = (s) => { if (!s) return '—'; const [y, m, d] = String(s).split('-'); return d ? `${d}/${m}/${y}` : s }

export default function LiensCasses() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [ouvert, setOuvert] = useState(null)
  const [flash, setFlash] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('liens_casses_log').select('*').order('executed_at', { ascending: false }).limit(200)
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function lancer() {
    setRunning(true)
    try {
      await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ declencheur: 'manuel' }) })
      setFlash({ ok: true, msg: 'Nettoyage lancé — le résultat apparaîtra dans quelques secondes.' })
      setTimeout(() => { load(); setRunning(false) }, 3000)
    } catch (e) {
      setFlash({ ok: false, msg: "Échec du déclenchement. Le webhook n'est peut-être pas encore enregistré côté n8n." })
      setRunning(false)
    }
    setTimeout(() => setFlash(null), 6000)
  }

  const derniere = rows[0]
  const stats = [
    { label: 'Dernière exécution', value: derniere ? fmtDT(derniere.executed_at) : '—' },
    { label: 'Liens supprimés (dernière)', value: derniere ? String(derniere.nb_supprimes) : '—' },
    { label: 'Exécutions enregistrées', value: String(rows.length) },
  ]

  const action = (
    <button onClick={lancer} disabled={running}
      style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: running ? 'rgba(255,255,255,0.3)' : '#fff', color: running ? '#fff' : CDARK, fontSize: 13, fontWeight: 700, cursor: running ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
      <i className={running ? 'ti ti-loader' : 'ti ti-refresh'} style={{ fontSize: 15 }} />
      {running ? 'En cours…' : 'Lancer maintenant'}
    </button>
  )

  return (
    <Layout>
      <StatBanner color={C} colorDark={CDARK}
        title="Liens cassés" subtitle="Nettoyage automatique des paiements liés à un document supprimé ou renommé (toutes sociétés). Vérification quotidienne à 02:00 + à la demande."
        stats={stats} action={action} />

      {flash && (
        <div style={{ margin: '14px 0', padding: '11px 15px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: flash.ok ? '#f0fdf4' : '#fef2f2', color: flash.ok ? '#16a34a' : '#dc2626', border: `1px solid ${flash.ok ? '#bbf7d0' : '#fecaca'}` }}>{flash.msg}</div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginTop: 14 }}>
        {loading && <div style={{ padding: 50, textAlign: 'center', color: '#94a3b8' }}>Chargement de l'historique…</div>}
        {!loading && rows.length === 0 && <div style={{ padding: 50, textAlign: 'center', color: '#94a3b8' }}>Aucune exécution enregistrée pour l'instant.</div>}
        {!loading && rows.map((r) => {
          const det = Array.isArray(r.details) ? r.details : []
          const skip = det.length === 1 && det[0] && det[0].skip
          const open = ouvert === r.id
          return (
            <div key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div onClick={() => (r.nb_supprimes > 0 || skip) && setOuvert(open ? null : r.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', cursor: (r.nb_supprimes > 0 || skip) ? 'pointer' : 'default' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{fmtDT(r.executed_at)}</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                    Déclencheur : {r.declencheur === 'manuel' ? 'manuel' : 'automatique'}
                  </div>
                </div>
                {skip
                  ? <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '4px 10px', borderRadius: 12 }}>ignoré (chargement incomplet)</span>
                  : <span style={{ fontSize: 12.5, fontWeight: 800, color: r.nb_supprimes > 0 ? '#dc2626' : '#16a34a', background: r.nb_supprimes > 0 ? '#fef2f2' : '#f0fdf4', padding: '4px 12px', borderRadius: 12 }}>
                      {r.nb_supprimes} lien{r.nb_supprimes > 1 ? 's' : ''} supprimé{r.nb_supprimes > 1 ? 's' : ''}
                    </span>}
                {(r.nb_supprimes > 0 || skip) && <i className={`ti ti-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 16, color: '#94a3b8' }} />}
              </div>
              {open && !skip && (
                <div style={{ padding: '0 18px 14px' }}>
                  <div style={{ background: '#f8fafc', borderRadius: 9, overflow: 'hidden', border: '1px solid #eef2f7' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 100px', gap: 8, padding: '8px 12px', background: '#f1f5f9', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      <span>Société</span><span>Tiers</span><span style={{ textAlign: 'right' }}>Montant</span><span style={{ textAlign: 'right' }}>Date</span>
                    </div>
                    {det.map((d, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 100px', gap: 8, padding: '8px 12px', fontSize: 12.5, borderTop: '1px solid #eef2f7', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#475569' }}>{d.societe || '—'}</span>
                        <span style={{ color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.tiers || '—'}</span>
                        <span style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{fmtEur(parseFloat(d.montant))}</span>
                        <span style={{ textAlign: 'right', color: '#64748b' }}>{fmtD(d.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
