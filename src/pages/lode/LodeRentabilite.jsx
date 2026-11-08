import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { LODE } from '../../lib/lodeConfig'
import { StatBanner } from '../../components/ui/AccountableUI'
import { COUL } from '../../lib/theme'
import PanneauAttribuer from '../../components/PanneauAttribuer'

const FONT = "'Source Sans Pro', sans-serif"
const OR = COUL.orange, ORD = '#7c2d12'
const eur = v => (Math.round(Number(v) || 0)).toLocaleString('fr-BE') + ' €'
const pctTxt = v => v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v)} %`
const col = v => v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : COUL.texteDoux
const RESP = ['LDE', 'JCL', 'LLO']
const achHT = (a) => (Number(a.montant) || 0) / (1 + (a.tva_taux == null ? 21 : Number(a.tva_taux)) / 100)
const MOIS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const card = { background: COUL.surface, border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16 }
const th = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: COUL.texteSombre }
const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: FONT, background: COUL.surface }

function Kpi({ label, value, c, sub }) {
  return (
    <div style={{ flex: '1 1 160px', background: COUL.surface, border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COUL.texteFaible, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const CAN_HOVER = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover)').matches

function ApercuFacture({ fid, nom, pin, onClose }) {
  const [etat, setEtat] = useState('load')
  useEffect(() => { setEtat('load') }, [fid])
  const src = `/api/apercu-facture?fid=${encodeURIComponent(fid)}`
  return (
    <div style={{ position: 'fixed', top: '50%', right: 24, transform: 'translateY(-50%)', zIndex: 2100, width: 520, maxWidth: '48vw', maxHeight: '88vh', background: COUL.surface, borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', pointerEvents: pin ? 'auto' : 'none' }}>
      <div style={{ padding: '10px 14px', background: COUL.texteFort, color: COUL.blanc, fontSize: 12, fontWeight: 600, fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📄 {nom}</span>{pin && <button onClick={onClose} style={{ border: 'none', background: 'rgba(255,255,255,0.15)', color: COUL.blanc, borderRadius: 6, padding: '2px 9px', cursor: 'pointer', fontSize: 14, lineHeight: 1.3 }}>✕</button>}</div>
      <div style={{ overflowY: 'auto', background: COUL.fond }}>
        <img src={src} alt="Apercu facture" onLoad={() => setEtat('ok')} onError={() => setEtat('err')} style={{ width: '100%', height: 'auto', display: etat === 'ok' ? 'block' : 'none' }} />
        {etat === 'load' && <div style={{ padding: '34px 20px', textAlign: 'center', color: COUL.texteFaible, fontSize: 13, fontFamily: FONT }}>Chargement de l'aperçu…</div>}
        {etat === 'err' && <div style={{ padding: '34px 20px', textAlign: 'center', color: COUL.texteFaible, fontSize: 13, fontFamily: FONT }}>Aperçu indisponible.</div>}
      </div>
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
  const [apercu, setApercu] = useState(null)
  const [dossiers, setDossiers] = useState([])
  const [qR, setQR] = useState('')
  const [filtreR, setFiltreR] = useState('non')

  const charger = async () => {
    setLoading(true)
    const [d, f, a, t, c, dos] = await Promise.all([
      supabase.from('lode_devis').select('id,numero,objet,client_nom,statut,total_ht,date_devis,responsable,dossier_id').order('date_devis', { ascending: false }),
      supabase.from('lode_factures').select('id,numero,devis_id,dossier_id,type,total_ht,date_facture,responsable'),
      supabase.from('factures_achat').select('id,nom,montant,date_facture,lode_devis_id,destination_type,destination_id,destination_nom,tva_taux,fichier_id').eq('societe', 'LODE').eq('sens', 'achat').order('date_facture', { ascending: false }),
      supabase.from('transactions').select('id,montant,date_valeur,categorie_id,activite,responsable,contrepartie_nom').eq('activite', 'rental'),
      supabase.from('categories').select('id,nom'),
      supabase.from('dossiers').select('id,numero,titre,client_nom,statut,responsable').eq('societe', 'LODE').order('created_at', { ascending: false }),
    ])
    setDevis(d.data || []); setFactures(f.data || []); setAchats(a.data || []); setTx(t.data || [])
    setDossiers(dos.data || [])
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
  // ⚠️ LE CHANTIER EST LE DOSSIER, PLUS LE DEVIS.
  //
  // Ludovic : « tu as toujours la liste rattacher les achats à un chantier
  // dans rentabilité ». Il avait raison, et le problème était plus profond
  // qu'un écran en double : cette page rattachait les achats à un DEVIS
  // (factures_achat.lode_devis_id) pendant que la comptabilité et l'écran
  // Dossiers les rattachent à un DOSSIER (destination_type/destination_id).
  //
  // Deux notions rivales de « chantier » qui ne se parlaient pas : la marge
  // calculée ici ignorait tout ce qui était attribué ailleurs. Mesuré avant
  // d'y toucher : 5 achats sur 483 passaient par l'ancien lien, soit 1 %.
  //
  // Un devis n'est d'ailleurs pas un chantier : un chantier peut en porter
  // plusieurs (porte ET châssis chez le même client), et un dépannage n'en a
  // aucun. Le dossier est la bonne maille.
  //
  // lode_devis_id est conservé en REPLI, pas en concurrent : un achat
  // rattaché à un devis compte sur le dossier de ce devis. Rien n'est perdu,
  // et rien de nouveau ne s'y écrit.
  const dossierDuDevis = useMemo(
    () => Object.fromEntries(devis.filter(d => d.dossier_id).map(d => [d.id, d.dossier_id])),
    [devis])

  const caParDossier = useMemo(() => {
    const m = {}
    for (const f of facturesF) {
      const dos = f.dossier_id || (f.devis_id ? dossierDuDevis[f.devis_id] : null)
      if (!dos) continue
      ;(m[dos] ||= { ht: 0, n: 0 }); m[dos].ht += Number(f.total_ht) || 0; m[dos].n++
    }
    return m
  }, [facturesF, dossierDuDevis])

  const achParDossier = useMemo(() => {
    const m = {}
    for (const a of achatsF) {
      const dos = a.destination_type === 'dossier'
        ? a.destination_id
        : (a.lode_devis_id ? dossierDuDevis[a.lode_devis_id] : null)
      if (!dos) continue
      ;(m[dos] ||= { v: 0, n: 0 }); m[dos].v += achHT(a); m[dos].n++
    }
    return m
  }, [achatsF, dossierDuDevis])

  // Le commercial vit désormais SUR LE DOSSIER (migration du 08/11).
  //
  // Avant, il était déduit du premier devis rattaché : colonne vide sur les
  // dépannages, qui n'ont pas de devis, et résultat arbitraire quand un
  // chantier en portait deux. Le devis reste un REPLI pour les dossiers
  // antérieurs à la colonne, pas une source concurrente.
  const respDuDossier = useMemo(() => {
    const m = {}
    for (const d of devis) if (d.dossier_id && d.responsable && !m[d.dossier_id]) m[d.dossier_id] = d.responsable
    return m
  }, [devis])

  const chantiersAll = useMemo(() => dossiers.map(d => {
    const ca = caParDossier[d.id] || { ht: 0, n: 0 }, ac = achParDossier[d.id] || { v: 0, n: 0 }
    const marge = ca.ht - ac.v
    return {
      ...d,
      objet: d.titre,
      responsable: d.responsable || respDuDossier[d.id] || '',
      caHT: ca.ht, caN: ca.n, achat: ac.v, achatN: ac.n,
      marge, margePct: ca.ht > 0 ? marge / ca.ht * 100 : null,
      actif: ca.ht > 0 || ac.v > 0,
    }
  }), [dossiers, caParDossier, achParDossier, respDuDossier])
  const chantiers = useMemo(() => chantiersAll.filter(c => resp === 'all' || (c.responsable || '') === resp).sort((a, b) => (b.caHT + b.achat) - (a.caHT + a.achat)), [chantiersAll, resp])

  const parCommercial = useMemo(() => {
    const m = {}
    for (const c of chantiersAll) { if (!c.actif) continue; const r = c.responsable || '—'; (m[r] ||= { ca: 0, achat: 0 }); m[r].ca += c.caHT; m[r].achat += c.achat }
    return Object.entries(m).map(([r, v]) => ({ resp: r, ca: v.ca, achat: v.achat, marge: v.ca - v.achat, pct: v.ca > 0 ? (v.ca - v.achat) / v.ca * 100 : null })).sort((a, b) => b.marge - a.marge)
  }, [chantiersAll])

  const caTot = useMemo(() => facturesF.reduce((s, f) => s + (Number(f.total_ht) || 0), 0), [facturesF])
  const achTot = useMemo(() => achatsF.reduce((s, a) => s + achHT(a), 0), [achatsF])
  const achTotTTC = useMemo(() => achatsF.reduce((s, a) => s + (Number(a.montant) || 0), 0), [achatsF])
  const caHorsCh = useMemo(() => facturesF.filter(f => !f.devis_id).reduce((s, f) => s + (Number(f.total_ht) || 0), 0), [facturesF])
  const nonAffecte = (a) => !a.destination_type && !a.lode_devis_id
  const fraisGen = useMemo(() => achatsF.filter(nonAffecte).reduce((s, a) => s + achHT(a), 0), [achatsF])
  const fraisGenN = useMemo(() => achatsF.filter(nonAffecte).length, [achatsF])

  // L'attribution passe par le MÊME panneau que la comptabilité et l'écran
  // Dossiers. Il y avait ici un sélecteur de devis concurrent : trois écrans,
  // trois mécanismes, et des chiffres qui ne pouvaient que diverger.
  const [aAttribuer, setAAttribuer] = useState(null)
  const attribuerAchat = async (facture, patch) => {
    const { error } = await supabase.from('factures_achat').update(patch).eq('id', facture.id)
    if (error) { alert(`Attribution refusée — ${error.message}`); return }
    setAchats(p => p.map(a => a.id === facture.id ? { ...a, ...patch } : a))
    setAAttribuer(null)
  }
  const setTaux = async (id, v) => {
    setSaving(id)
    const t = Number(v)
    const { error } = await supabase.from('factures_achat').update({ tva_taux: t }).eq('id', id)
    if (!error) setAchats(p => p.map(a => a.id === id ? { ...a, tva_taux: t } : a))
    setSaving(null)
  }
  const setRespCh = async (id, r) => {
    setSaving(id)
    const { error } = await supabase.from('lode_devis').update({ responsable: r || null }).eq('id', id)
    if (!error) setDevis(p => p.map(d => d.id === id ? { ...d, responsable: r || null } : d))
    setSaving(null)
  }
  const achatsListe = useMemo(() => {
    let l = achats
    if (filtre === 'non') l = l.filter(nonAffecte)
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

  const rentalParResp = useMemo(() => {
    const m = {}
    for (const t of txF) { const r = t.responsable || '— non attribué'; (m[r] ||= { rec: 0, dep: 0 }); const v = Number(t.montant) || 0; if (v >= 0) m[r].rec += v; else m[r].dep += -v }
    return Object.entries(m).map(([r, v]) => ({ resp: r, rec: v.rec, dep: v.dep, net: v.rec - v.dep })).sort((a, b) => b.net - a.net)
  }, [txF])
  const nbNonAttr = useMemo(() => txF.filter(t => !t.responsable).length, [txF])
  const txAttr = useMemo(() => {
    let l = txF.filter(t => filtreR === 'tous' || !t.responsable)
    if (qR.trim()) { const sx = qR.toLowerCase(); l = l.filter(t => ((t.contrepartie_nom || '') + ' ' + (cats[t.categorie_id] || '')).toLowerCase().includes(sx)) }
    return [...l].sort((a, b) => (b.date_valeur || '').localeCompare(a.date_valeur || ''))
  }, [txF, filtreR, qR, cats])
  const attribuer = async (id, r) => {
    setSaving(id)
    const { error } = await supabase.from('transactions').update({ responsable: r || null }).eq('id', id)
    if (!error) setTx(pp => pp.map(t => t.id === id ? { ...t, responsable: r || null } : t))
    setSaving(null)
  }

  const tabBtn = (k, label) => (
    <button onClick={() => setOnglet(k)} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid ' + (onglet === k ? OR : COUL.bord), background: onglet === k ? OR : COUL.blanc, color: onglet === k ? '#fff' : COUL.texteMoyen, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{label}</button>
  )
  const yrBtn = (y, label) => (
    <button key={y} onClick={() => setAnnee(y)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid ' + (annee === y ? ORD : COUL.bord), background: annee === y ? ORD : COUL.blanc, color: annee === y ? '#fff' : COUL.texteMoyen, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>{label}</button>
  )

  return (
    <Layout currentPage="Rentabilité">
      <div style={{ fontFamily: FONT, width: '100%' }}>
        <StatBanner color={LODE.couleur || OR} colorDark={ORD} logoUrl={LODE.logo_url}
          title="Rentabilité LODE" subtitle="Lode Protect (vente) · Lode Rental (locatif)" />

        {loading ? <div style={{ padding: 60, textAlign: 'center', color: COUL.texteFaible }}>Calcul…</div> : <>
          <div style={{ display: 'flex', gap: 10, margin: '12px 0 4px', flexWrap: 'wrap' }}>
            {tabBtn('protect', 'Lode Protect — vente')}
            {tabBtn('rental', 'Lode Rental — locatif')}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '10px 0' }}>
            <span style={{ fontSize: 11, color: COUL.texteFaible, fontWeight: 700, textTransform: 'uppercase' }}>Année</span>
            {yrBtn('all', 'Toutes')}{annees.map(y => yrBtn(y, y))}
            {onglet === 'protect' && <>
              <span style={{ fontSize: 11, color: COUL.texteFaible, fontWeight: 700, textTransform: 'uppercase', marginLeft: 10 }}>Commercial</span>
              <select value={resp} onChange={e => setResp(e.target.value)} style={inp}>
                <option value="all">Tous</option>
                {RESP.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </>}
          </div>

          {annee === 'all' && <div style={{ fontSize: 12, color: COUL.alerte, background: COUL.alerteFondDoux, border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginBottom: 4 }}>
            ⚠️ « Toutes années » : côté Protect, le CA (13 factures 2026) est partiel alors que les achats couvrent 2024→2026. Choisis une année pour une marge cohérente.
          </div>}

          {onglet === 'protect' ? <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              <Kpi label="CA facturé (HT)" value={eur(caTot)} c={OR} sub={`${facturesF.length} factures`} />
              <Kpi label="Achats (HT)" value={eur(achTot)} c="#9333ea" sub={`${eur(achTotTTC)} TTC · ${achatsF.length} fact.`} />
              <Kpi label="Marge brute" value={eur(caTot - achTot)} c={col(caTot - achTot)} sub={caTot > 0 ? pctTxt((caTot - achTot) / caTot * 100) : '—'} />
              <Kpi label="À rattacher" value={`${fraisGenN}`} c={COUL.alerteVif} sub={`${eur(fraisGen)} non affectés`} />
            </div>

            {parCommercial.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORD, marginBottom: 8 }}>Marge par commercial</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Commercial</th><th style={thR}>CA HT</th><th style={thR}>Achats HT</th><th style={thR}>Marge</th><th style={thR}>%</th></tr></thead>
                    <tbody>{parCommercial.map(r => (
                      <tr key={r.resp}><td style={{ ...td, fontWeight: 700, color: ORD }}>{r.resp}</td><td style={tdR}>{eur(r.ca)}</td><td style={tdR}>{eur(r.achat)}</td><td style={{ ...tdR, fontWeight: 800, color: col(r.marge) }}>{eur(r.marge)}</td><td style={{ ...tdR, color: col(r.marge) }}>{pctTxt(r.pct)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 800, color: ORD }}>Marge par chantier</div>
              <div style={{ fontSize: 12, color: COUL.texteFaible, margin: '4px 0 10px' }}>Marge = CA HT − achats HT rattachés. Les achats (TTC) sont convertis en HT via leur taux de TVA — 21 % par défaut, ajustable dans la liste ci-dessous.</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Chantier</th><th style={th}>Resp.</th><th style={thR}>CA HT</th><th style={thR}>Achats HT</th><th style={thR}>Marge</th><th style={thR}>%</th></tr></thead>
                  <tbody>
                    {chantiers.filter(c => c.actif).map(c => (
                      <tr key={c.id}>
                        <td style={td}><span style={{ fontWeight: 600, color: ORD }}>{c.numero}</span> <span style={{ color: COUL.texteDoux }}>{(c.objet || '').slice(0, 40)}</span><div style={{ fontSize: 11, color: COUL.texteFaible }}>{c.client_nom}</div></td>
                        <td style={td}>
                          <select value={c.responsable || ''} disabled={saving === c.id} onChange={e => setRespCh(c.id, e.target.value)} style={{ ...inp, padding: '5px 8px', minWidth: 80, opacity: saving === c.id ? 0.5 : 1 }}>
                            <option value="">—</option>
                            {RESP.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td style={tdR}>{eur(c.caHT)}<div style={{ fontSize: 10, color: COUL.bordFort }}>{c.caN} f.</div></td>
                        <td style={tdR}>{eur(c.achat)}<div style={{ fontSize: 10, color: COUL.bordFort }}>{c.achatN} a.</div></td>
                        <td style={{ ...tdR, fontWeight: 800, color: col(c.marge) }}>{eur(c.marge)}</td>
                        <td style={{ ...tdR, fontWeight: 700, color: col(c.marge) }}>{pctTxt(c.margePct)}</td>
                      </tr>
                    ))}
                    {resp === 'all' && caHorsCh > 0 && (
                      <tr style={{ background: COUL.alerteFondDoux }}><td style={td}><span style={{ fontWeight: 700, color: COUL.alerte }}>Hors chantier</span><div style={{ fontSize: 11, color: COUL.texteFaible }}>factures sans devis</div></td><td style={td}>—</td><td style={tdR}>{eur(caHorsCh)}</td><td style={tdR}>—</td><td style={tdR}>—</td><td style={tdR}>—</td></tr>
                    )}
                    {!chantiers.some(c => c.actif) && !(resp === 'all' && caHorsCh > 0) && <tr><td style={td} colSpan={6}><span style={{ color: COUL.texteFaible }}>Rien à afficher pour ce filtre.</span></td></tr>}
                  </tbody>
                </table>
              </div>
              {resp === 'all' && fraisGen > 0 && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: COUL.fond, border: '1px solid #e2e8f0', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 13, color: COUL.texteMoyen }}><b>Frais généraux</b> — achats non rattachés ({fraisGenN})</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: COUL.danger }}>− {eur(fraisGen)}</span>
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORD }}>Achats — taux de TVA et attribution</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input placeholder="Fournisseur…" value={q} onChange={e => setQ(e.target.value)} style={{ ...inp, minWidth: 180 }} />
                  <select value={filtre} onChange={e => setFiltre(e.target.value)} style={inp}><option value="non">Non attribués</option><option value="tous">Tous</option></select>
                </div>
              </div>
              <div style={{ fontSize: 12, color: COUL.texteFaible, margin: '6px 0 10px' }}>{achatsListe.length} achat(s){achatsListe.length > 80 ? ' — 80 affichés' : ''}.</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}></th><th style={th}>Date</th><th style={th}>Fournisseur</th><th style={thR}>Montant TTC</th><th style={th}>TVA</th><th style={thR}>HT</th><th style={th}>Chantier</th></tr></thead>
                  <tbody>
                    {achatsListe.slice(0, 80).map(a => (
                      <tr key={a.id} style={(a.destination_type || a.lode_devis_id) ? { background: COUL.succesFondDoux } : null}>
                        <td style={{ ...td, textAlign: 'center', width: 44 }}>
                          {a.fichier_id ? <button title="Aperçu facture" onClick={() => setApercu(c => c && c.pin && c.fid === a.fichier_id ? null : { fid: a.fichier_id, nom: (a.nom || '').replace(/\.pdf$/i, ''), pin: true })} onMouseEnter={() => { if (CAN_HOVER) setApercu(c => c && c.pin ? c : { fid: a.fichier_id, nom: (a.nom || '').replace(/\.pdf$/i, ''), pin: false }) }} onMouseLeave={() => setApercu(c => c && c.pin ? c : null)} style={{ border: '1px solid #e2e8f0', background: COUL.surface, borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>📄</button> : <span style={{ color: COUL.bordFort }}>—</span>}
                        </td>
                        <td style={td}>{(a.date_facture || '').slice(0, 10)}</td>
                        <td style={td}>{a.nom || '—'}</td>
                        <td style={tdR}>{eur(a.montant)}</td>
                        <td style={td}>
                          <select value={a.tva_taux == null ? 21 : a.tva_taux} disabled={saving === a.id} onChange={e => setTaux(a.id, e.target.value)} style={{ ...inp, padding: '5px 8px', minWidth: 72, opacity: saving === a.id ? 0.5 : 1 }}>
                            {[21, 12, 6, 0].map(t => <option key={t} value={t}>{t} %</option>)}
                          </select>
                        </td>
                        <td style={tdR}>{eur(achHT(a))}</td>
                        <td style={td}>
                          <span onClick={() => setAAttribuer(a)}
                            title={a.destination_nom ? `${a.destination_nom} — cliquer pour changer` : 'Attribuer'}
                            style={{
                              display: 'inline-block', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                              maxWidth: 230, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              color: a.destination_nom ? COUL.texteDoux : OR,
                            }}>
                            {a.destination_nom || (a.lode_devis_id ? 'devis (ancien lien)' : '+ attribuer')}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!achatsListe.length && <tr><td style={td} colSpan={7}><span style={{ color: COUL.texteFaible }}>Aucun achat.</span></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            {aAttribuer && (
        <PanneauAttribuer facture={aAttribuer} dossiers={dossiers}
          onClose={() => setAAttribuer(null)}
          onChoisir={patch => attribuerAchat(aAttribuer, patch)} />
      )}
      {apercu && <ApercuFacture fid={apercu.fid} nom={apercu.nom} pin={apercu.pin} onClose={() => setApercu(null)} />}
          </> : <>
            {/* RENTAL */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
              <Kpi label="Recettes" value={eur(rRec)} c={COUL.succes} sub="Airbnb · Booking · location" />
              <Kpi label="Charges" value={eur(rDep)} c={COUL.danger} sub="loyers · énergie · entretien" />
              <Kpi label="Résultat net" value={eur(rNet)} c={col(rNet)} sub={rRec > 0 ? pctTxt(rNet / rRec * 100) : '—'} />
              <Kpi label="Opérations" value={`${txF.length}`} c="#0891b2" sub="activité « rental »" />
              <Kpi label="À attribuer" value={`${nbNonAttr}`} c={COUL.alerteVif} sub="sans commercial" />
            </div>

            {rentalParResp.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORD, marginBottom: 8 }}>Résultat par commercial</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr><th style={th}>Commercial</th><th style={thR}>Recettes</th><th style={thR}>Charges</th><th style={thR}>Net</th></tr></thead>
                    <tbody>{rentalParResp.map(r => (
                      <tr key={r.resp}><td style={{ ...td, fontWeight: 700, color: r.resp.startsWith('—') ? '#b45309' : ORD }}>{r.resp}</td><td style={{ ...tdR, color: COUL.succes }}>{eur(r.rec)}</td><td style={{ ...tdR, color: COUL.danger }}>− {eur(r.dep)}</td><td style={{ ...tdR, fontWeight: 800, color: col(r.net) }}>{eur(r.net)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORD }}>Attribuer les opérations à un commercial</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input placeholder="Libellé / catégorie…" value={qR} onChange={e => setQR(e.target.value)} style={{ ...inp, minWidth: 180 }} />
                  <select value={filtreR} onChange={e => setFiltreR(e.target.value)} style={inp}><option value="non">Non attribuées</option><option value="tous">Toutes</option></select>
                </div>
              </div>
              <div style={{ fontSize: 12, color: COUL.texteFaible, margin: '6px 0 10px' }}>{nbNonAttr} opération(s) sans commercial{txAttr.length > 80 ? ' — 80 affichées' : ''}. Attribue au fur et à mesure.</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Date</th><th style={th}>Libellé</th><th style={thR}>Montant</th><th style={th}>Commercial</th></tr></thead>
                  <tbody>
                    {txAttr.slice(0, 80).map(t => (
                      <tr key={t.id} style={t.responsable ? { background: COUL.succesFondDoux } : null}>
                        <td style={td}>{(t.date_valeur || '').slice(0, 10)}</td>
                        <td style={td}>{t.contrepartie_nom || cats[t.categorie_id] || '—'}<div style={{ fontSize: 10, color: COUL.bordFort }}>{cats[t.categorie_id] || ''}</div></td>
                        <td style={{ ...tdR, color: (Number(t.montant) || 0) >= 0 ? '#16a34a' : COUL.danger }}>{eur(t.montant)}</td>
                        <td style={td}>
                          <select value={t.responsable || ''} disabled={saving === t.id} onChange={e => attribuer(t.id, e.target.value)} style={{ ...inp, minWidth: 140, opacity: saving === t.id ? 0.5 : 1 }}>
                            <option value="">— non attribué</option>
                            {RESP.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {!txAttr.length && <tr><td style={td} colSpan={4}><span style={{ color: COUL.texteFaible }}>Aucune opération.</span></td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 800, color: ORD, marginBottom: 8 }}>Résultat par mois</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Mois</th><th style={thR}>Recettes</th><th style={thR}>Charges</th><th style={thR}>Net</th></tr></thead>
                  <tbody>
                    {rentalMois.map(m => { const [y, mo] = m.mois.split('-'); return (
                      <tr key={m.mois}><td style={td}>{MOIS[+mo]} {y}</td><td style={{ ...tdR, color: COUL.succes }}>{eur(m.rec)}</td><td style={{ ...tdR, color: COUL.danger }}>− {eur(m.dep)}</td><td style={{ ...tdR, fontWeight: 800, color: col(m.net) }}>{eur(m.net)}</td></tr>
                    )})}
                    {!rentalMois.length && <tr><td style={td} colSpan={4}><span style={{ color: COUL.texteFaible }}>Aucune opération locative sur la période.</span></td></tr>}
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
                    {!rCats.length && <tr><td style={td} colSpan={2}><span style={{ color: COUL.texteFaible }}>—</span></td></tr>}
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
