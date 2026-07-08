import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { sansExtraits } from '../lib/factures'

const FONT = "'Source Sans Pro', sans-serif"
const fmt = (v) => v === null || v === undefined ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)
const fmtDate = (d) => {
  if (!d) return '—'
  const p = String(d).substring(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

// Table de factures de vente selon l'entité (null = pas de module de vente)
const TABLE_VENTES = { LODE: 'lode_factures', DTX: 'dtx_factures', DYNASSUR: 'dyn_factures' }

// Récupère toutes les lignes en contournant le plafond 1000 de PostgREST
async function chargerTout(table, select, filtreSociete) {
  let out = []; let from = 0
  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + 999)
    if (filtreSociete && filtreSociete.length) q = q.in('societe', filtreSociete)
    const { data, error } = await q
    if (error || !data) break
    out = out.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

export default function VueFactures({ societeCodes, color }) {
  const [sousOnglet, setSousOnglet] = useState('achats') // 'achats' | 'ventes'

  const tablesVente = societeCodes.map(c => TABLE_VENTES[c]).filter(Boolean)

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Sous-onglets Achats / Ventes */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {[['achats', 'Achats', 'factures reçues à payer'], ['ventes', 'Ventes', 'factures émises à encaisser']].map(([k, lab, sub]) => (
          <button key={k} onClick={() => setSousOnglet(k)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
            padding: '8px 16px', borderRadius: '9px', border: `1px solid ${sousOnglet === k ? color : '#e2e8f0'}`,
            background: sousOnglet === k ? `${color}0f` : '#fff', cursor: 'pointer', fontFamily: FONT
          }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: sousOnglet === k ? color : '#334155' }}>{lab}</span>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>{sub}</span>
          </button>
        ))}
      </div>

      {sousOnglet === 'achats'
        ? <VueAchats societeCodes={societeCodes} color={color} />
        : <VueVentes tables={tablesVente} color={color} />}
    </div>
  )
}

/* ─────────────── ACHATS (factures fournisseurs, dossier SharePoint) ─────────────── */
function VueAchats({ societeCodes, color }) {
  const [factures, setFactures] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState({ statut: 'toutes', recherche: '', annee: '' })
  const [page, setPage] = useState(1)
  const [lierPaiement, setLierPaiement] = useState(null) // facture en cours de liaison à un mouvement
  const PAR_PAGE = 100

  // Lier une facture à un mouvement bancaire (écrit les DEUX côtés du lien)
  async function lierTransaction(facture, tx) {
    await supabase.from('transactions').update({ facture_url: facture.url, rapproche: true, facture_thumb_url: null }).eq('id', tx.id)
    await supabase.from('factures_achat').update({ transaction_id: tx.id }).eq('fichier_id', facture.fichier_id)
    setFactures(prev => prev.map(f => f.fichier_id === facture.fichier_id ? { ...f, transaction_id: tx.id } : f))
    setLierPaiement(null)
    fetch('https://n8n.srv1082740.hstgr.cloud/webhook/backfill-thumbs2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {})
  }
  // Délier un paiement (remet la facture en « à vérifier » et libère le mouvement)
  async function delierPaiement(facture) {
    if (facture.transaction_id) {
      await supabase.from('transactions').update({ facture_url: null, rapproche: false, facture_thumb_url: null }).eq('id', facture.transaction_id)
    }
    await supabase.from('factures_achat').update({ transaction_id: null }).eq('fichier_id', facture.fichier_id)
    setFactures(prev => prev.map(f => f.fichier_id === facture.fichier_id ? { ...f, transaction_id: null } : f))
  }

  useEffect(() => {
    setLoading(true)
    chargerTout('factures_achat', 'fichier_id,nom,societe,montant,date_facture,url,transaction_id', societeCodes)
      .then(rows => {
        const propres = sansExtraits(rows) // exclure les extraits de compte bancaires
        propres.sort((a, b) => (b.date_facture || '').localeCompare(a.date_facture || ''))
        setFactures(propres); setLoading(false)
      })
  }, [societeCodes.join(',')])

  useEffect(() => { setPage(1) }, [filtre.statut, filtre.recherche, filtre.annee])

  const anneesDispo = [...new Set(factures.map(f => (f.date_facture || '').substring(0, 4)).filter(Boolean))].sort((a, b) => b - a)
  const filtrees = factures.filter(f => {
    const payee = !!f.transaction_id
    if (filtre.statut === 'payees' && !payee) return false
    if (filtre.statut === 'nonpayees' && payee) return false
    if (filtre.annee && !(f.date_facture || '').startsWith(filtre.annee)) return false
    if (filtre.recherche && !(f.nom || '').toLowerCase().includes(filtre.recherche.toLowerCase())) return false
    return true
  })
  const nbPayees = factures.filter(f => f.transaction_id).length
  const nbNonPayees = factures.length - nbPayees
  const montantNonPaye = factures.filter(f => !f.transaction_id).reduce((s, f) => s + (parseFloat(f.montant) || 0), 0)
  const totalPages = Math.ceil(filtrees.length / PAR_PAGE)
  const facturesPage = filtrees.slice((page - 1) * PAR_PAGE, page * PAR_PAGE)
  const multiSociete = societeCodes.length > 1
  const ouvrir = (f) => { if (f.url) window.open(f.url, '_blank', 'noopener,noreferrer') }

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>Chargement des achats…</div>

  const kpis = [
    { label: 'Total achats', value: factures.length, c: color, sub: `${nbPayees} payées • ${nbNonPayees} à vérifier` },
    { label: 'Payées', value: nbPayees, c: '#16a34a', sub: 'liées à un paiement', clic: 'payees' },
    { label: 'Paiement à vérifier', value: nbNonPayees, c: '#dc2626', sub: 'aucun paiement lié', clic: 'nonpayees' },
    { label: 'Montant à vérifier', value: fmt(montantNonPaye), c: '#dc2626', sub: 'total non réglé' },
  ]

  return (
    <>
      <KpiRow kpis={kpis} actif={filtre.statut} onClic={(v) => setFiltre(f => ({ ...f, statut: f.statut === v ? 'toutes' : v }))} />
      <FiltreBar filtre={filtre} setFiltre={setFiltre} anneesDispo={anneesDispo} placeholder="Nom de facture…" reset={() => setFiltre({ statut: 'toutes', recherche: '', annee: '' })} />
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Ligne header cols={multiSociete ? ['110px', '110px', '1fr', '120px', '130px'] : ['110px', '110px', '1fr', '130px']}
          items={multiSociete ? ['Statut', 'Date', 'Facture', 'Société', 'Montant'] : ['Statut', 'Date', 'Facture', 'Montant']} />
        {facturesPage.length === 0 && <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>Aucune facture</div>}
        {facturesPage.map((f, i) => {
          const payee = !!f.transaction_id
          const cells = [
            <span onClick={(e) => { e.stopPropagation(); payee ? delierPaiement(f) : setLierPaiement(f) }} style={{ cursor: 'pointer' }}
              title={payee ? 'Payée — cliquer pour délier le paiement' : 'Cliquer pour retrouver et lier le paiement'}>
              <Badge payee={payee} labelPayee="✓ Payée" labelNon="🔍 Rechercher facture" />
            </span>,
            <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>{fmtDate(f.date_facture)}</span>,
            <span style={{ fontSize: '13px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '10px' }}>{(f.nom || '').replace(/\.pdf$/i, '')}</span>,
            ...(multiSociete ? [<span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>{f.societe}</span>] : []),
            <span style={{ textAlign: 'right', display: 'block', fontSize: '13.5px', fontWeight: '700', color: f.montant == null ? '#cbd5e1' : '#0f172a' }}>{f.montant == null ? '—' : fmt(f.montant)}</span>,
          ]
          return <Ligne key={f.fichier_id} cols={multiSociete ? ['110px', '110px', '1fr', '120px', '130px'] : ['110px', '110px', '1fr', '130px']} items={cells} onClick={() => ouvrir(f)} clickable={!!f.url} alt={i % 2 === 1} title={f.nom} />
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} setPage={setPage} total={filtrees.length} />
      {lierPaiement && <PanneauLierPaiement facture={lierPaiement} color={color} onClose={() => setLierPaiement(null)} onLier={(tx) => lierTransaction(lierPaiement, tx)} />}
    </>
  )
}

/* ─────────────── VENTES (factures clients émises) ─────────────── */
function VueVentes({ tables, color }) {
  const [factures, setFactures] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState({ statut: 'toutes', recherche: '', annee: '' })
  const [page, setPage] = useState(1)
  const PAR_PAGE = 100

  useEffect(() => {
    setLoading(true)
    if (tables.length === 0) { setFactures([]); setLoading(false); return }
    Promise.all(tables.map(t =>
      supabase.from(t).select('id,numero,client_nom,objet,total_ttc,montant_paye,statut,date_facture').then(r => r.data || [])
    )).then(res => {
      const rows = res.flat()
      rows.sort((a, b) => (b.date_facture || '').localeCompare(a.date_facture || ''))
      setFactures(rows); setLoading(false)
    })
  }, [tables.join(',')])

  useEffect(() => { setPage(1) }, [filtre.statut, filtre.recherche, filtre.annee])

  const estPayee = (f) => (parseFloat(f.montant_paye) || 0) >= (parseFloat(f.total_ttc) || 0) && (parseFloat(f.total_ttc) || 0) > 0
  const anneesDispo = [...new Set(factures.map(f => (f.date_facture || '').substring(0, 4)).filter(Boolean))].sort((a, b) => b - a)
  const filtrees = factures.filter(f => {
    const payee = estPayee(f)
    if (filtre.statut === 'payees' && !payee) return false
    if (filtre.statut === 'nonpayees' && payee) return false
    if (filtre.annee && !(f.date_facture || '').startsWith(filtre.annee)) return false
    if (filtre.recherche) {
      const q = filtre.recherche.toLowerCase()
      if (!(f.client_nom || '').toLowerCase().includes(q) && !(f.numero || '').toLowerCase().includes(q) && !(f.objet || '').toLowerCase().includes(q)) return false
    }
    return true
  })
  const nbPayees = factures.filter(estPayee).length
  const nbNonPayees = factures.length - nbPayees
  const montantAEncaisser = factures.filter(f => !estPayee(f)).reduce((s, f) => s + ((parseFloat(f.total_ttc) || 0) - (parseFloat(f.montant_paye) || 0)), 0)
  const totalPages = Math.ceil(filtrees.length / PAR_PAGE)
  const facturesPage = filtrees.slice((page - 1) * PAR_PAGE, page * PAR_PAGE)

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>Chargement des ventes…</div>
  if (tables.length === 0) return <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>Pas de module de facturation de vente pour cette entité.</div>

  const kpis = [
    { label: 'Total ventes', value: factures.length, c: color, sub: `${nbPayees} encaissées • ${nbNonPayees} en attente` },
    { label: 'Encaissées', value: nbPayees, c: '#16a34a', sub: 'payées par le client', clic: 'payees' },
    { label: 'En attente', value: nbNonPayees, c: '#dc2626', sub: 'non encore payées', clic: 'nonpayees' },
    { label: 'Montant à encaisser', value: fmt(montantAEncaisser), c: '#dc2626', sub: 'solde dû par les clients' },
  ]

  return (
    <>
      <KpiRow kpis={kpis} actif={filtre.statut} onClic={(v) => setFiltre(f => ({ ...f, statut: f.statut === v ? 'toutes' : v }))} />
      <FiltreBar filtre={filtre} setFiltre={setFiltre} anneesDispo={anneesDispo} placeholder="Client, n° ou objet…" reset={() => setFiltre({ statut: 'toutes', recherche: '', annee: '' })} />
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Ligne header cols={['100px', '110px', '110px', '1fr', '130px']} items={['Statut', 'Date', 'N°', 'Client', 'Montant TTC']} />
        {facturesPage.length === 0 && <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>Aucune facture de vente</div>}
        {facturesPage.map((f, i) => {
          const payee = estPayee(f)
          const cells = [
            <Badge payee={payee} labelPayee="✓ Encaissée" labelNon="✕ En attente" />,
            <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>{fmtDate(f.date_facture)}</span>,
            <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: '600' }}>{f.numero || '—'}</span>,
            <span style={{ fontSize: '13px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '10px' }}>{f.client_nom || f.objet || '—'}</span>,
            <span style={{ textAlign: 'right', display: 'block', fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>{fmt(f.total_ttc)}</span>,
          ]
          return <Ligne key={f.id} cols={['100px', '110px', '110px', '1fr', '130px']} items={cells} alt={i % 2 === 1} />
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} setPage={setPage} total={filtrees.length} />
    </>
  )
}

/* ─────────────── Sous-composants partagés ─────────────── */
function KpiRow({ kpis, actif, onClic }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
      {kpis.map((k, i) => (
        <div key={i} onClick={k.clic ? () => onClic(k.clic) : undefined}
          style={{ background: (k.clic && actif === k.clic) ? '#f8fafc' : '#fff', borderRadius: '10px', border: `1px solid ${(k.clic && actif === k.clic) ? '#cbd5e1' : '#e2e8f0'}`, borderTop: `3px solid ${k.c}`, padding: '16px 20px', cursor: k.clic ? 'pointer' : 'default' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{k.label}</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: k.c, lineHeight: 1 }}>{k.value}</div>
          {k.sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px', fontWeight: '600' }}>{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function FiltreBar({ filtre, setFiltre, anneesDispo, placeholder, reset }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 16px', marginBottom: '14px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <label style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Statut</label>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[['toutes', 'Toutes', '#64748b'], ['payees', '✓ Payées', '#16a34a'], ['nonpayees', '✕ À vérifier', '#dc2626']].map(([v, l, c]) => (
            <button key={v} onClick={() => setFiltre(f => ({ ...f, statut: v }))} style={{
              padding: '7px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: FONT,
              border: `1px solid ${filtre.statut === v ? c : '#e2e8f0'}`, background: filtre.statut === v ? c : '#fff', color: filtre.statut === v ? '#fff' : '#64748b'
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '180px' }}>
        <label style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recherche</label>
        <input value={filtre.recherche} onChange={e => setFiltre(f => ({ ...f, recherche: e.target.value }))} placeholder={placeholder}
          style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontFamily: FONT }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <label style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Année</label>
        <select value={filtre.annee} onChange={e => setFiltre(f => ({ ...f, annee: e.target.value }))} style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontFamily: FONT, cursor: 'pointer' }}>
          <option value="">Toutes</option>
          {anneesDispo.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {(filtre.statut !== 'toutes' || filtre.recherche || filtre.annee) && (
        <button onClick={reset} style={{ padding: '7px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontFamily: FONT }}>Réinitialiser</button>
      )}
    </div>
  )
}

function Badge({ payee, labelPayee, labelNon }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: payee ? '#dcfce7' : '#fee2e2', color: payee ? '#16a34a' : '#dc2626' }}>
      {payee ? labelPayee : labelNon}
    </span>
  )
}

function Ligne({ cols, items, header, onClick, clickable, alt, title }) {
  return (
    <div onClick={onClick} title={title}
      style={{ display: 'grid', gridTemplateColumns: cols.join(' '), padding: header ? '11px 16px' : '10px 16px', alignItems: 'center',
        borderBottom: header ? '2px solid #f1f5f9' : '1px solid #f8fafc', cursor: clickable ? 'pointer' : 'default',
        background: header ? '#fff' : (alt ? '#fafafa' : '#fff'),
        fontSize: header ? '11px' : '13px', fontWeight: header ? '700' : '400', color: header ? '#94a3b8' : '#0f172a',
        textTransform: header ? 'uppercase' : 'none', letterSpacing: header ? '0.04em' : 'normal' }}>
      {items.map((it, i) => <div key={i} style={i === items.length - 1 && header ? { textAlign: 'right' } : {}}>{it}</div>)}
    </div>
  )
}

function Pagination({ page, totalPages, setPage, total }) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
      <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #e2e8f0', background: page <= 1 ? '#f1f5f9' : '#fff', color: page <= 1 ? '#cbd5e1' : '#334155', cursor: page <= 1 ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: FONT }}>← Précédent</button>
      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Page {page} / {totalPages} · {total} factures</span>
      <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #e2e8f0', background: page >= totalPages ? '#f1f5f9' : '#fff', color: page >= totalPages ? '#cbd5e1' : '#334155', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: FONT }}>Suivant →</button>
    </div>
  )
}

// Nombre de jours entre deux dates (ISO), ou null si l'une manque/est invalide
function ecartJours(a, b) {
  if (!a || !b) return null
  const ta = new Date(a).getTime(), tb = new Date(b).getTime()
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null
  return Math.abs(ta - tb) / 86400000
}

// Le nom du fichier facture apparaît-il dans le nom du tiers du mouvement ?
function nomCorrespond(nomFichier, contrepartie) {
  if (!nomFichier || !contrepartie) return false
  const normalise = s => s.toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const mots = normalise(nomFichier).split(/[^a-z0-9]+/).filter(w => w.length >= 4)
  const hay = normalise(contrepartie)
  return mots.some(w => hay.includes(w))
}

// Score de correspondance d'un mouvement avec la facture à rapprocher (plus haut = meilleur)
function scoreCorrespondance(m, montantCible, facture) {
  let score = 0
  const montant = Math.abs(parseFloat(m.montant) || 0)
  if (montantCible > 0) {
    const diff = Math.abs(montant - montantCible)
    score += diff < 0.01 ? 100 : Math.max(0, 40 - diff)
  }
  const jours = ecartJours(m.date_valeur || m.date_execution, facture.date_facture)
  if (jours != null) score += Math.max(0, 30 - jours)
  if (nomCorrespond(facture.nom, m.contrepartie_nom)) score += 40
  return score
}

/* ─────────────── Panneau : lier un paiement à une facture d'achat ─────────────── */
function PanneauLierPaiement({ facture, color, onClose, onLier }) {
  const [tous, setTous] = useState([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
  const montantCible = Math.abs(parseFloat(facture.montant) || 0)

  // Charger une seule fois tous les mouvements sortants non liés de la société
  useEffect(() => {
    let annule = false
    setLoading(true)
    const soc = facture.societe
    const cols = 'id,montant,date_valeur,date_execution,contrepartie_nom,contrepartie_iban,information_paiement,description,type_transaction,statut,devise,ponto_transaction_id,comptes_bancaires!inner(banque,societes!inner(code))'
    ;(async () => {
      let out = []; let from = 0
      for (;;) {
        const { data, error } = await supabase.from('transactions').select(cols)
          .eq('comptes_bancaires.societes.code', soc).is('facture_url', null).lt('montant', 0)
          .order('date_valeur', { ascending: false }).range(from, from + 999)
        if (error || !data) break
        out = out.concat(data)
        if (data.length < 1000) break
        from += 1000
      }
      if (!annule) { setTous(out); setLoading(false) }
    })()
    return () => { annule = true }
  }, [facture.fichier_id])

  // Recherche sur TOUTES les données (multi-mots) ; sinon tri par proximité de montant
  const mots = recherche.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const hayFor = (m) => [
    m.contrepartie_nom, m.contrepartie_iban, m.information_paiement, m.description,
    m.type_transaction, m.statut, m.devise, m.ponto_transaction_id, m.comptes_bancaires?.banque,
    fmt(m.montant), String(m.montant), fmtDate(m.date_valeur || m.date_execution), m.date_valeur, m.date_execution
  ].filter(Boolean).join(' ').toLowerCase()
  let mouvements = mots.length ? tous.filter(m => { const h = hayFor(m); return mots.every(w => h.includes(w)) }) : tous
  mouvements = [...mouvements].sort((a, b) => scoreCorrespondance(b, montantCible, facture) - scoreCorrespondance(a, montantCible, facture)).slice(0, 80)

  // Suggestion automatique : le mouvement en tête si sa correspondance est forte (montant exact et un seul candidat à ce montant)
  const suggestion = (!recherche && mouvements.length > 0) ? mouvements[0] : null
  const montantExactCount = tous.filter(m => Math.abs(Math.abs(m.montant) - montantCible) < 0.01).length
  const suggestionForte = suggestion && montantCible > 0 && Math.abs(Math.abs(suggestion.montant) - montantCible) < 0.01 && montantExactCount === 1

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: 'min(620px, 94vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Rechercher une facture</div>
          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px' }}>{(facture.nom || '').replace(/\.pdf$/i, '')} — <strong>{fmt(facture.montant)}</strong></div>
        </div>
        {suggestionForte && (
          <div style={{ margin: '12px 20px 0', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="ti ti-sparkles" style={{ fontSize: '16px', color: '#16a34a' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Correspondance trouvée</div>
              <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suggestion.contrepartie_nom || suggestion.information_paiement || 'Mouvement'} · {fmtDate(suggestion.date_valeur || suggestion.date_execution)}</div>
            </div>
            <button onClick={() => onLier(suggestion)} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: '12.5px', fontWeight: '700', fontFamily: FONT, whiteSpace: 'nowrap' }}>Lier ce paiement</button>
          </div>
        )}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher sur tout : contrepartie, IBAN, communication, montant, date…" autoFocus
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box' }} />
          {!recherche && montantCible > 0 && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{tous.length} mouvements non liés · triés par montant proche de {fmt(-montantCible)}</div>}
          {recherche && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{mouvements.length} résultat{mouvements.length > 1 ? 's' : ''}</div>}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Recherche…</div>}
          {!loading && mouvements.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Aucun mouvement correspondant.</div>}
          {!loading && mouvements.map(m => {
            const exact = Math.abs(Math.abs(m.montant) - montantCible) < 0.01
            return (
              <div key={m.id} onClick={() => onLier(m)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '11px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.contrepartie_nom || m.information_paiement || 'Mouvement'}</div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{fmtDate(m.date_valeur || m.date_execution)} · {m.comptes_bancaires?.banque || ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {exact && <span style={{ fontSize: '10px', fontWeight: '700', color: '#16a34a', background: '#dcfce7', padding: '2px 7px', borderRadius: '12px' }}>montant exact</span>}
                  <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#dc2626' }}>{fmt(m.montant)}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: FONT }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}
