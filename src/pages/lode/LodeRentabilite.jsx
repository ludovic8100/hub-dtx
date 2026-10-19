import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { LODE } from '../../lib/lodeConfig'
import { StatBanner } from '../../components/ui/AccountableUI'

const FONT = "'Source Sans Pro', sans-serif"
const OR = '#ea580c', ORD = '#7c2d12'
const eur = v => (Math.round(Number(v) || 0)).toLocaleString('fr-BE') + ' €'
const pctTxt = v => v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v)} %`
const col = v => v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#64748b'
const RESP = ['LDE', 'JCL', 'LLO']
const MOIS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16 }
const th = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#334155' }
const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: FONT, background: '#fff' }

function Kpi({ label, value, c, sub }) {
  return (
    <div style={{ flex: '1 1 160px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function LodeRentabilite() {
  const [onglet, setOnglet] = useState('protect')
  const [devis, setDevis] = useState([])
  const [factures, setFactures] = useState([])
  const [achats, setAchats] = useState([])
  const [tx, setTx] = useState([])
  const [cats, setCats] = useState({})
  const [loading, setLoading] = useState(true)
  const [annee, setAnnee] = useState('all')
  const [resp, setResp] = useState('all')
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState('non')
  const [saving, setSaving] = useState(null)

  const charger = async () => {
    setLoading(true)
    const [d, f, a, t, c] = await Promise.all([
      supabase.from('lode_devis').select('id,numero,objet,client_nom,statut,total_ht,date_devis,responsable').order('date_devis', { ascending: false }),
      supabase.from('lode_factures').select('id,numero,devis_id,type,total_ht,date_facture,responsable'),
      supabase.from('factures_achat').select('id,nom,montant,date_facture,lode_devis_id').eq('societe', 'LODE').eq('sens', 'achat').order('date_facture', { ascending: false }),
      supabase.from('transactions').select('id,montant,date_valeur,categorie_id,activite').eq('activite', 'rental'),
      supabase.from('categories').select('id,nom'),
    ])
    setDevis(d.data || []); setFactures(f.data || []); setAchats(a.data || []); setTx(t.data || [])
    setCats(Object.fromEntries((c.data || []).map(x => [x.id, x.nom]))); setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const annees = useMemo(() => {
    const s = new Set()
    for (const f of factures) if (f.date_facture) s.add(f.date_facture.slice(0, 4))
    for (const a of achats) if (a.date_facture) s.add(a.date_facture.slice(0, 4))
    for (const t of tx) if (t.date_valeur) s.add(t.date_valeur.slice(0, 4))
    return Array.from(s).sort((a, b) => b.localeCompare(a))
  }, [factures, achats, tx])
  const inY = (ds) => annee === 'all' || (ds || '').slice(0, 4) === annee

  // ---- PROTECT (vente / chantiers) ----
  const facturesF = useMemo(() => factures.filter(f => inY(f.date_facture)), [factures, annee])
  const achatsF = useMemo(() => achats.filter(a => inY(a.date_facture)), [achats, annee])
  const caParDevis = useMemo(() => { const m = {}; for (const f of facturesF) { if (!f.devis_id) continue; (m[f.devis_id] ||= { ht: 0, n: 0 }); m[f.devis_id].ht += Number(f.total_ht) || 0; m[f.devis_id].n++ } return m }, [facturesF])
  const achParDevis = useMemo(() => { const m = {}; for (const a of achatsF) { if (!a.lode_devis_id) continue; (m[a.lode_devis_id] ||= { v: 0, n: 0 }); m[a.lode_devis_id].v += Number(a.montant) || 0; m[a.lode_devis_id].n++ } return m }, [achatsF])

  const chantiersAll = useMemo(() => devis.map(d => {
    const ca = caParDevis[d.id] || { ht: 0, n: 0 }, ac = achParDevis[d.id] || { v: 0, n: 0 }
    const marge = ca.ht - ac.v
    return { ...d, caHT: ca.ht, caN: ca.n, achat: ac.v, achatN: ac.n, marge, margePct: ca.ht > 0 ? marge / ca.ht * 100 : null, actif: ca.ht > 0 || ac.v > 0 }
  }), [devis, caParDevis, achParDevis])
  const chantiers = useMemo(() => chantiersAll.filter(c => resp === 'all' || (c.responsable || '') === resp).sort((a, b) => (b.caHT + b.achat) - (a.caHT + a.achat)), [chantiersAll, resp])

  const parCommercial = useMemo(() => {
    const m = {}
    for (const c of chantiersAll) { if (!c.actif) continue; const r = c.responsable || '—'; (m[r] ||= { ca: 0, achat: 0 }); m[r].ca += c.caHT; m[r].achat += c.achat }
    return Object.entries(m).map(([r, v]) => ({ resp: r, ca: v.ca, achat: v.achat, marge: v.ca - v.achat, pct: v.ca > 0 ? (v.ca - v.achat) / v.ca * 100 : null })).sort((a, b) => b.marge - a.marge)
  }, [chantiersAll])

  const caTot = useMemo(() => facturesF.reduce((s, f) => s + (Number(f.total_ht) || 0), 0), [facturesF])
  const achTot = useMemo(() => achatsF.reduce((s, a) => s + (Number(a.montant) || 0), 0), [achatsF])
  const caHorsCh = useMemo(() => facturesF.filter(f => !f.devis_id).reduce((s, f) => s + (Number(f.total_ht) || 0), 0), [facturesF])
  const fraisGen = useMemo(() => achatsF.filter(a => !a.lode_devis_id).reduce((s, a) => s + (Number(a.montant) || 0), 0), [achatsF])
  const fraisGenN = useMemo(() => achatsF.filter(a => !a.lode_devis_id).length, [achatsF])

  const optionsDevis = useMemo(() => devis.map(d => ({ id: d.id, label: `${d.numero} · ${(d.objet || '').slice(0, 34)}${d.client_nom ? ' · ' + d.client_nom : ''}` })), [devis])
  const rattacher = async (id, dv) => {
    setSaving(id)
    const { error } = await supabase.from('factures_achat').update({ lode_devis_id: dv || null }).eq('id', id)
    if (!error) setAchats(p => p.map(a => a.id === id ? { ...a, lode_devis_id: dv || null } : a))
    setSaving(null)
  }
  const achatsListe = useMemo(() => {
    let l = achats
    if (filtre === 'non') l = l.filter(a => !a.lode_devis_id)
    if (q.trim()) { const s = q.toLowerCase(); l = l.filter(a => (a.nom || '').toLowerCase().includes(s)) }
    return l
  }, [achats, filtre, q])

  // ---- RENTAL (locatif) ----
  const txF = useMemo(() => tx.filter(t => inY(t.date_valeur)), [tx, annee])
  const rentalMois = useMemo(() => {
    const m = {}
    for (const t of txF) { const mk = (t.date_valeur || '').slice(0, 7); if (!mk) continue; (m[mk] ||= { rec: 0, dep: 0 }); const v = Number(t.montant) || 0; if (v >= 0) m[mk].rec += v; else m[mk].dep += -v }
    return Object.entries(m).map(([mk, v]) => ({ mois: mk, rec: v.rec, dep: v.dep, net: v.rec - v.dep })).sort((a, b) => b.mois.localeCompare(a.mois))
  }, [txF])
  const rRec = rentalMois.reduce((s, m) => s + m.rec, 0)
  const rDep = rentalMois.reduce((s, m) => s + m.dep, 0)
  const rNet = rRec - rDep
  const rCats = useMemo(() => {
    const m = {}
    for (const t of txF) { const n = cats[t.categorie_id] || 'Non catégorisé'; (m[n] ||= 0); m[n] += Number(t.montant) || 0 }
    return Object.entries(m).map(([n, v]) => ({ nom: n, v })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
  }, [txF, cats])

  const tabBtn = (k, label) => (
    <button onClick={() => setOnglet(k)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid ' + (onglet === k ? OR : '#e2e8f0'), background: onglet === k ? OR : '#fff', color: onglet === k ? '#fff' : '#475569', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{label}</button>
  )
  const yrBtn = (y, label) => (
    <button key={y} onClick={() => setAnnee(y)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid ' + (annee === y ? ORD : '#e2e8f0'), background: annee === y ? ORD : '#fff', color: annee === y ? '#fff' : '#475569', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>{label}</button>
  )

  return (
    <Layout currentPage="Rentabilité">
      <div style={{ fontFamily: FONT, width: '100%' }}>
        <StatBanner color={LODE.couleur || OR} colorDark={ORD} logoUrl={LODE.logo_url}
          title="Rentabilité LODE" subtitle="Lode Protect (vente) · Lode Rental (locatif)" />

        {loading ? <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Calcul…</div> : <>
          <div style={{ display: 'flex', gap: 10, margin: '12px 0 4px', flexWrap: 'wrap' }}>
            {tabBtn('protect', 'Lode Protect — vente')}
            {tabBtn('rental', 'Lode Rental — locatif')}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '10px 0' }}>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Année</span>
            {yrBtn('all', 'Toutes')}{annees.map(y => yrBtn(y, y))}
            {onglet === 'protect' && <>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginLeft: 10 }}>Commercial</span>
              <select value={resp} onChange={e => setResp(e.target.value)} style={inp}>
                <option value="all">Tous</option>
                {RESP.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </>}
          </div>

          {annee === 'all' && <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginBottom: 4 }}>
            ⚠️ « Toutes années » : côté Protect, le CA (13 factures 2026) est partiel alors que les achats couvrent 2024→2026. Choisis une année pour une marge cohérente.
          </div>}

          {onglet === 'protect' ? <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              <Kpi label="CA facturé (HT)" value={eur(caTot)} c={OR} sub={`${facturesF.length} factures`} />
              <Kpi label="Achats" value={eur(achTot)} c="#9333ea" sub={`${achatsF.length} factures d'achat`} />
              <Kpi label="Marge brute" value={eur(caTot - achTot)} c={col(caTot - achTot)} sub={caTot > 0 ? pctTxt((caTot - achTot) / caTot * 100) : '—'} />
              <Kpi label="À rattacher" value={`${fraisGenN}`} c="#f59e0b" sub={`${eur(fraisGen)} non affectés`} />
            </div>

            {parCommercial.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORD, marginBottom: 8 }}>Marge par commercial</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Commercial</th><th style={thR}>CA HT</th><th style={thR}>Achats</th><th style={thR}>Marge</th><th style={thR}>%</th></tr></thead>
                    <tbody>{parCommercial.map(r => (
                      <tr key={r.resp}><td style={{ ...td, fontWeight: 700, color: ORD }}>{r.resp}</td><td style={tdR}>{eur(r.ca)}</td><td style={tdR}>{eur(r.achat)}</td><td style={{ ...tdR, fontWeight: 800, color: col(r.marge) }}>{eur(r.marge)}</td><td style={{ ...tdR, color: col(r.marge) }}>{pctTxt(r.pct)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 800, color: ORD }}>Marge par chantier</div>
              <div style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 10px' }}>Marge = CA HT − achats rattachés. ⚠️ Le HT des achats n'est pas encore défini : les achats sont pris au montant enregistré (voir décision en cours).</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Chantier</th><th style={th}>Resp.</th><th style={thR}>CA HT</th><th style={thR}>Achats</th><th style={thR}>Marge</th><th style={thR}>%</th></tr></thead>
                  <tbody>
                    {chantiers.filter(c => c.actif).map(c => (
                      <tr key={c.id}>
                        <td style={td}><span style={{ fontWeight: 600, color: ORD }}>{c.numero}</span> <span style={{ color: '#64748b' }}>{(c.objet || '').slice(0, 40)}</span><div style={{ fontSize: 11, color: '#94a3b8' }}>{c.client_nom}</div></td>
                        <td style={td}>{c.responsable || '—'}</td>
                        <td style={tdR}>{eur(c.caHT)}<div style={{ fontSize: 10, color: '#cbd5e1' }}>{c.caN} f.</div></td>
                        <td style={tdR}>{eur(c.achat)}<div style={{ fontSize: 10, color: '#cbd5e1' }}>{c.achatN} a.</div></td>
                        <td style={{ ...tdR, fontWeight: 800, color: col(c.marge) }}>{eur(c.marge)}</td>
                        <td style={{ ...tdR, fontWeight: 700, color: col(c.marge) }}>{pctTxt(c.margePct)}</td>
                      </tr>
                    ))}
                    {resp === 'all' && caHorsCh > 0 && (
                      <tr style={{ background: '#fffbeb' }}><td style={td}><span style={{ fontWeight: 700, color: '#b45309' }}>Hors chantier</span><div style={{ fontSize: 11, color: '#94a3b8' }}>factures sans devis</div></td><td style={td}>—</td><td style={tdR}>{eur(caHorsCh)}</td><td style={tdR}>—</td><td style={tdR}>—</td><td style={tdR}>—</td></tr>
                    )}
                    {!chantiers.some(c => c.actif) && !(resp === 'all' && caHorsCh > 0) && <tr><td style={td} colSpan={6}><span style={{ color: '#94a3b8' }}>Rien à afficher pour ce filtre.</span></td></tr>}
                  </tbody>
                </table>
              </div>
              {resp === 'all' && fraisGen > 0 && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#475569' }}><b>Frais généraux</b> — achats non rattachés ({fraisGenN})</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>− {eur(fraisGen)}</span>
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORD }}>Rattacher les achats à un chantier</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input placeholder="Fournisseur…" value={q} onChange={e => setQ(e.target.value)} style={{ ...inp, minWidth: 180 }} />
                  <select value={filtre} onChange={e => setFiltre(e.target.value)} style={inp}><option value="non">Non rattachés</option><option value="tous">Tous</option></select>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 10px' }}>{achatsListe.length} achat(s){achatsListe.length > 80 ? ' — 80 affichés' : ''}.</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Date</th><th style={th}>Fournisseur</th><th style={thR}>Montant</th><th style={th}>Chantier</th></tr></thead>
                  <tbody>
                    {achatsListe.slice(0, 80).map(a => (
                      <tr key={a.id} style={a.lode_devis_id ? { background: '#f0fdf4' } : null}>
                        <td style={td}>{(a.date_facture || '').slice(0, 10)}</td>
                        <td style={td}>{a.nom || '—'}</td>
                        <td style={tdR}>{eur(a.montant)}</td>
                        <td style={td}>
                          <select value={a.lode_devis_id || ''} disabled={saving === a.id} onChange={e => rattacher(a.id, e.target.value)} style={{ ...inp, minWidth: 230, opacity: saving === a.id ? 0.5 : 1 }}>
                            <option value="">— Hors chantier (frais généraux)</option>
                            {optionsDevis.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {!achatsListe.length && <tr><td style={td} colSpan={4}><span style={{ color: '#94a3b8' }}>Aucun achat.</span></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </> : <>
            {/* RENTAL */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              <Kpi label="Recettes" value={eur(rRec)} c="#16a34a" sub="Airbnb · Booking · location" />
              <Kpi label="Charges" value={eur(rDep)} c="#dc2626" sub="loyers · énergie · entretien" />
              <Kpi label="Résultat net" value={eur(rNet)} c={col(rNet)} sub={rRec > 0 ? pctTxt(rNet / rRec * 100) : '—'} />
              <Kpi label="Opérations" value={`${txF.length}`} c="#0891b2" sub="activité « rental »" />
            </div>

            <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginTop: 12 }}>
              Attribution par commercial (Ludivine ≈ 99 %) : <b>pas encore active</b> — les transactions locatives n'ont pas de commercial en base. Mécanisme à décider (voir message).
            </div>

            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 800, color: ORD, marginBottom: 8 }}>Résultat par mois</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Mois</th><th style={thR}>Recettes</th><th style={thR}>Charges</th><th style={thR}>Net</th></tr></thead>
                  <tbody>
                    {rentalMois.map(m => { const [y, mo] = m.mois.split('-'); return (
                      <tr key={m.mois}><td style={td}>{MOIS[+mo]} {y}</td><td style={{ ...tdR, color: '#16a34a' }}>{eur(m.rec)}</td><td style={{ ...tdR, color: '#dc2626' }}>− {eur(m.dep)}</td><td style={{ ...tdR, fontWeight: 800, color: col(m.net) }}>{eur(m.net)}</td></tr>
                    )})}
                    {!rentalMois.length && <tr><td style={td} colSpan={4}><span style={{ color: '#94a3b8' }}>Aucune opération locative sur la période.</span></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 800, color: ORD, marginBottom: 8 }}>Détail par catégorie</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Catégorie</th><th style={thR}>Montant net</th></tr></thead>
                  <tbody>
                    {rCats.map(r => <tr key={r.nom}><td style={td}>{r.nom}</td><td style={{ ...tdR, fontWeight: 700, color: col(r.v) }}>{eur(r.v)}</td></tr>)}
                    {!rCats.length && <tr><td style={td} colSpan={2}><span style={{ color: '#94a3b8' }}>—</span></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>}
        </>}
      </div>
    </Layout>
  )
}
