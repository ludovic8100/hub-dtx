import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { LODE } from '../../lib/lodeConfig'
import { StatBanner } from '../../components/ui/AccountableUI'

const FONT = "'Source Sans Pro', sans-serif"
const OR = '#ea580c', ORD = '#7c2d12'
const eur = v => (Math.round(Number(v) || 0)).toLocaleString('fr-BE') + ' €'
const pctTxt = v => v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v)} %`
const margeCol = v => v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#64748b'

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16 }
const th = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#334155' }
const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: FONT, background: '#fff' }

function Kpi({ label, value, col, sub }) {
  return (
    <div style={{ flex: '1 1 160px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: col }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function LodeRentabilite() {
  const [devis, setDevis] = useState([])
  const [factures, setFactures] = useState([])
  const [achats, setAchats] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState('non') // non | tous
  const [saving, setSaving] = useState(null)

  const charger = async () => {
    setLoading(true)
    const [d, f, a] = await Promise.all([
      supabase.from('lode_devis').select('id,numero,objet,client_nom,statut,total_ht,total_ttc,date_devis,responsable').order('date_devis', { ascending: false }),
      supabase.from('lode_factures').select('id,numero,devis_id,type,total_ht,total_ttc,date_facture,statut,responsable'),
      supabase.from('factures_achat').select('id,nom,montant,date_facture,lode_devis_id').eq('societe', 'LODE').eq('sens', 'achat').order('date_facture', { ascending: false }),
    ])
    setDevis(d.data || []); setFactures(f.data || []); setAchats(a.data || []); setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const caParDevis = useMemo(() => { const m = {}; for (const f of factures) { if (!f.devis_id) continue; (m[f.devis_id] ||= { ht: 0, n: 0 }); m[f.devis_id].ht += Number(f.total_ht) || 0; m[f.devis_id].n++ } return m }, [factures])
  const achatsParDevis = useMemo(() => { const m = {}; for (const a of achats) { if (!a.lode_devis_id) continue; (m[a.lode_devis_id] ||= { montant: 0, n: 0 }); m[a.lode_devis_id].montant += Number(a.montant) || 0; m[a.lode_devis_id].n++ } return m }, [achats])

  const chantiers = useMemo(() => devis.map(d => {
    const ca = caParDevis[d.id] || { ht: 0, n: 0 }
    const ac = achatsParDevis[d.id] || { montant: 0, n: 0 }
    const marge = ca.ht - ac.montant
    return { ...d, caHT: ca.ht, caN: ca.n, achat: ac.montant, achatN: ac.n, marge, margePct: ca.ht > 0 ? marge / ca.ht * 100 : null, actif: ca.ht > 0 || ac.montant > 0 }
  }).sort((a, b) => (b.caHT + b.achat) - (a.caHT + a.achat)), [devis, caParDevis, achatsParDevis])

  const caTotalHT = useMemo(() => factures.reduce((s, f) => s + (Number(f.total_ht) || 0), 0), [factures])
  const achatTotal = useMemo(() => achats.reduce((s, a) => s + (Number(a.montant) || 0), 0), [achats])
  const caHorsCh = useMemo(() => factures.filter(f => !f.devis_id).reduce((s, f) => s + (Number(f.total_ht) || 0), 0), [factures])
  const caHorsChN = useMemo(() => factures.filter(f => !f.devis_id).length, [factures])
  const fraisGen = useMemo(() => achats.filter(a => !a.lode_devis_id).reduce((s, a) => s + (Number(a.montant) || 0), 0), [achats])
  const fraisGenN = useMemo(() => achats.filter(a => !a.lode_devis_id).length, [achats])
  const margeBrute = caTotalHT - achatTotal

  const optionsDevis = useMemo(() => devis.map(d => ({ id: d.id, label: `${d.numero} · ${(d.objet || '').slice(0, 38)}${(d.client_nom ? ' · ' + d.client_nom : '')}` })), [devis])

  const rattacher = async (achatId, devisId) => {
    setSaving(achatId)
    const { error } = await supabase.from('factures_achat').update({ lode_devis_id: devisId || null }).eq('id', achatId)
    if (!error) setAchats(prev => prev.map(a => a.id === achatId ? { ...a, lode_devis_id: devisId || null } : a))
    setSaving(null)
  }

  const achatsListe = useMemo(() => {
    let l = achats
    if (filtre === 'non') l = l.filter(a => !a.lode_devis_id)
    if (q.trim()) { const s = q.toLowerCase(); l = l.filter(a => (a.nom || '').toLowerCase().includes(s)) }
    return l
  }, [achats, filtre, q])
  const achatsAff = achatsListe.slice(0, 80)

  return (
    <Layout currentPage="Rentabilité">
      <div style={{ fontFamily: FONT, width: '100%' }}>
        <StatBanner color={LODE.couleur || OR} colorDark={ORD} logoUrl={LODE.logo_url}
          title="Rentabilité par chantier" subtitle="LODE SRL — CA facturé vs achats, marge par devis" />

        {loading ? <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Calcul…</div> : <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <Kpi label="CA facturé (HT)" value={eur(caTotalHT)} col={OR} sub={`${factures.length} factures`} />
            <Kpi label="Achats" value={eur(achatTotal)} col="#9333ea" sub={`${achats.length} factures d'achat`} />
            <Kpi label="Marge brute" value={eur(margeBrute)} col={margeCol(margeBrute)} sub={caTotalHT > 0 ? pctTxt(margeBrute / caTotalHT * 100) : '—'} />
            <Kpi label="À rattacher" value={`${fraisGenN}`} col="#f59e0b" sub={`${eur(fraisGen)} d'achats non affectés`} />
          </div>

          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 800, color: ORD }}>Marge par chantier</div>
            <div style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 10px' }}>Marge = CA HT − achats rattachés. Les achats sont pris au montant enregistré ; s'ils sont en TTC, la marge réelle est un peu supérieure (TVA récupérable).</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Chantier</th><th style={th}>Resp.</th><th style={thR}>CA HT</th><th style={thR}>Achats</th><th style={thR}>Marge</th><th style={thR}>%</th>
                </tr></thead>
                <tbody>
                  {chantiers.filter(c => c.actif).map(c => (
                    <tr key={c.id}>
                      <td style={td}><span style={{ fontWeight: 600, color: ORD }}>{c.numero}</span> <span style={{ color: '#64748b' }}>{(c.objet || '').slice(0, 44)}</span><div style={{ fontSize: 11, color: '#94a3b8' }}>{c.client_nom}</div></td>
                      <td style={td}>{c.responsable || '—'}</td>
                      <td style={tdR}>{eur(c.caHT)}<div style={{ fontSize: 10, color: '#cbd5e1' }}>{c.caN} fact.</div></td>
                      <td style={tdR}>{eur(c.achat)}<div style={{ fontSize: 10, color: '#cbd5e1' }}>{c.achatN} ach.</div></td>
                      <td style={{ ...tdR, fontWeight: 800, color: margeCol(c.marge) }}>{eur(c.marge)}</td>
                      <td style={{ ...tdR, fontWeight: 700, color: margeCol(c.marge) }}>{pctTxt(c.margePct)}</td>
                    </tr>
                  ))}
                  {caHorsCh > 0 && (
                    <tr style={{ background: '#fffbeb' }}>
                      <td style={td}><span style={{ fontWeight: 700, color: '#b45309' }}>Hors chantier</span><div style={{ fontSize: 11, color: '#94a3b8' }}>factures sans devis lié</div></td>
                      <td style={td}>—</td>
                      <td style={tdR}>{eur(caHorsCh)}<div style={{ fontSize: 10, color: '#cbd5e1' }}>{caHorsChN} fact.</div></td>
                      <td style={tdR}>—</td><td style={tdR}>—</td><td style={tdR}>—</td>
                    </tr>
                  )}
                  {!chantiers.some(c => c.actif) && caHorsCh === 0 && (
                    <tr><td style={td} colSpan={6}><span style={{ color: '#94a3b8' }}>Aucune facture rattachée à un chantier pour l'instant.</span></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {fraisGen > 0 && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#475569' }}><b>Frais généraux</b> — achats non rattachés à un chantier ({fraisGenN})</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>− {eur(fraisGen)}</span>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: ORD }}>Rattacher les achats à un chantier</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input placeholder="Rechercher un fournisseur…" value={q} onChange={e => setQ(e.target.value)} style={{ ...inp, minWidth: 200 }} />
                <select value={filtre} onChange={e => setFiltre(e.target.value)} style={inp}>
                  <option value="non">Non rattachés</option>
                  <option value="tous">Tous</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 10px' }}>{achatsListe.length} achat(s){filtre === 'non' ? ' non rattaché(s)' : ''}{achatsListe.length > 80 ? ` — 80 affichés, affine la recherche` : ''}.</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Date</th><th style={th}>Fournisseur</th><th style={thR}>Montant</th><th style={th}>Chantier</th>
                </tr></thead>
                <tbody>
                  {achatsAff.map(a => (
                    <tr key={a.id} style={a.lode_devis_id ? { background: '#f0fdf4' } : null}>
                      <td style={td}>{(a.date_facture || '').slice(0, 10)}</td>
                      <td style={td}>{a.nom || '—'}</td>
                      <td style={tdR}>{eur(a.montant)}</td>
                      <td style={td}>
                        <select value={a.lode_devis_id || ''} disabled={saving === a.id} onChange={e => rattacher(a.id, e.target.value)} style={{ ...inp, minWidth: 240, opacity: saving === a.id ? 0.5 : 1 }}>
                          <option value="">— Hors chantier (frais généraux)</option>
                          {optionsDevis.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {!achatsAff.length && <tr><td style={td} colSpan={4}><span style={{ color: '#94a3b8' }}>Aucun achat.</span></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>}
      </div>
    </Layout>
  )
}
