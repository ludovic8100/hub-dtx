import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

const E = ENTITES.dynassur
const NAVY = '#0D2F5E'
const eur = n => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n || 0))
const fmtD = d => { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

function etatStyle(etat) {
  const e = (etat || '').toLowerCase()
  if (e.startsWith('en cours')) return { bg: '#fef3c7', fg: '#b45309', label: etat }
  if (e.startsWith('clôtur') || e.startsWith('clotur')) return { bg: '#dcfce7', fg: '#15803d', label: etat }
  if (e.startsWith('sans suite')) return { bg: '#f1f5f9', fg: '#64748b', label: etat }
  return { bg: '#f1f5f9', fg: '#64748b', label: etat || '—' }
}

function Kpi({ label, value, col, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${col}`, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function DynassurSinistres() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [etat, setEtat] = useState('')
  const [gest, setGest] = useState('')
  const [annee, setAnnee] = useState('')
  const [q, setQ] = useState('')

  async function charger() {
    setLoading(true)
    let all = [], from = 0
    while (true) {
      const { data: page, error } = await supabase
        .from('sinistres')
        .select('pointeur_sinistre,reference_sinistre,sinistre_nom,etat,gestionnaire,domaine,garantie,responsabilite,description,date_survenance,date_ouverture,montant_a_payer,montant_paye,annee')
        .order('date_ouverture', { ascending: false, nullsFirst: false })
        .range(from, from + 999)
      if (error || !page || page.length === 0) break
      all = all.concat(page)
      if (page.length < 1000) break
      from += 1000
    }
    setData(all)
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const etats = useMemo(() => [...new Set(data.map(s => s.etat).filter(Boolean))].sort(), [data])
  const gests = useMemo(() => [...new Set(data.map(s => s.gestionnaire).filter(Boolean))].sort(), [data])
  const annees = useMemo(() => [...new Set(data.map(s => s.annee).filter(Boolean))].sort((a, b) => b - a), [data])

  const liste = useMemo(() => {
    let l = data
    if (etat) l = l.filter(s => s.etat === etat)
    if (gest) l = l.filter(s => s.gestionnaire === gest)
    if (annee) l = l.filter(s => String(s.annee) === String(annee))
    if (q.trim()) {
      const t = q.toLowerCase()
      l = l.filter(s => `${s.reference_sinistre || ''} ${s.sinistre_nom || ''} ${s.description || ''} ${s.domaine || ''}`.toLowerCase().includes(t))
    }
    return l
  }, [data, etat, gest, annee, q])

  const enCours = useMemo(() => data.filter(s => (s.etat || '').toLowerCase().startsWith('en cours')).length, [data])
  const clotures = useMemo(() => data.filter(s => (s.etat || '').toLowerCase().startsWith('cl')).length, [data])
  const sumPaye = useMemo(() => liste.reduce((a, s) => a + Number(s.montant_paye || 0), 0), [liste])
  const sumAPayer = useMemo(() => liste.reduce((a, s) => a + Number(s.montant_a_payer || 0), 0), [liste])

  const sel = { padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: NAVY, background: '#fff', fontFamily: "'Source Sans Pro', sans-serif" }

  return (
    <Layout currentPage="Sinistres">
      <StatBanner
        color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
        title="Sinistres" subtitle="Suivi des dossiers sinistres — source BRIO, synchronisé quotidiennement"
        action={
          <button onClick={charger} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <i className="ti ti-refresh" style={{ marginRight: 6 }} />Actualiser
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Total sinistres" value={data.length} col={E.color} />
        <Kpi label="En cours" value={enCours} col="#ea580c" sub="dossiers ouverts" />
        <Kpi label="Clôturés" value={clotures} col="#16a34a" />
        <Kpi label="Payé (sélection)" value={eur(sumPaye)} col="#7c3aed" />
        <Kpi label="À payer (sélection)" value={eur(sumAPayer)} col="#0d9488" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <select value={etat} onChange={e => setEtat(e.target.value)} style={sel}>
          <option value="">Tous les états</option>
          {etats.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={gest} onChange={e => setGest(e.target.value)} style={sel}>
          <option value="">Tous gestionnaires</option>
          {gests.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={annee} onChange={e => setAnnee(e.target.value)} style={sel}>
          <option value="">Toutes années</option>
          {annees.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Réf., assuré, description…" style={{ ...sel, flex: 1, minWidth: 200 }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{liste.length} résultat{liste.length > 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
          <i className="ti ti-loader-2" style={{ fontSize: 32, display: 'block', marginBottom: 12, animation: 'spin 1s linear infinite' }} />
          Chargement des sinistres…
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>Réf.</th>
                  <th style={{ padding: '10px 14px' }}>Assuré</th>
                  <th style={{ padding: '10px 14px' }}>Survenance</th>
                  <th style={{ padding: '10px 14px' }}>Ouverture</th>
                  <th style={{ padding: '10px 14px' }}>État</th>
                  <th style={{ padding: '10px 14px' }}>Gestionnaire</th>
                  <th style={{ padding: '10px 14px' }}>Domaine</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Payé</th>
                </tr>
              </thead>
              <tbody>
                {liste.slice(0, 600).map(s => {
                  const es = etatStyle(s.etat)
                  return (
                    <tr key={s.pointeur_sinistre} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>{s.reference_sinistre || '—'}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ color: '#1e293b', fontWeight: 600 }}>{s.sinistre_nom || '—'}</div>
                        {s.description && <div style={{ fontSize: 11, color: '#94a3b8', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>}
                      </td>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', color: '#64748b' }}>{fmtD(s.date_survenance)}</td>
                      <td style={{ padding: '9px 14px', whiteSpace: 'nowrap', color: '#64748b' }}>{fmtD(s.date_ouverture)}</td>
                      <td style={{ padding: '9px 14px' }}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 5, background: es.bg, color: es.fg, whiteSpace: 'nowrap' }}>{es.label}</span></td>
                      <td style={{ padding: '9px 14px', color: '#475569', whiteSpace: 'nowrap' }}>{s.gestionnaire || '—'}</td>
                      <td style={{ padding: '9px 14px', color: '#64748b', fontSize: 12 }}>{s.domaine || '—'}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: NAVY, whiteSpace: 'nowrap' }}>{s.montant_paye ? eur(s.montant_paye) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {liste.length > 600 && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
              Affichage des 600 premiers sur {liste.length}. Affine avec les filtres ou la recherche.
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
