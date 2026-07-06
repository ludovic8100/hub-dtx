import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const FONT = "'Source Sans Pro', sans-serif"
const fmt = (v) => v === null || v === undefined ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)
const fmtDate = (d) => {
  if (!d) return '—'
  const p = String(d).substring(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

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

export default function VueFacturesFournisseurs({ societeCodes, color }) {
  const [factures, setFactures] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState({ statut: 'toutes', recherche: '', annee: '' })
  const [page, setPage] = useState(1)
  const PAR_PAGE = 100

  useEffect(() => {
    setLoading(true)
    chargerTout('factures_fournisseurs', 'fichier_id,nom,societe,montant,date_facture,url,transaction_id', societeCodes)
      .then(rows => {
        rows.sort((a, b) => (b.date_facture || '').localeCompare(a.date_facture || ''))
        setFactures(rows); setLoading(false)
      })
  }, [societeCodes.join(',')])

  useEffect(() => { setPage(1) }, [filtre.statut, filtre.recherche, filtre.annee])

  const anneesDispo = [...new Set(factures.map(f => (f.date_facture || '').substring(0, 4)).filter(Boolean))].sort((a, b) => b - a)

  const filtrees = factures.filter(f => {
    const payee = !!f.transaction_id
    if (filtre.statut === 'payees' && !payee) return false
    if (filtre.statut === 'nonpayees' && payee) return false
    if (filtre.annee && !(f.date_facture || '').startsWith(filtre.annee)) return false
    if (filtre.recherche) {
      const q = filtre.recherche.toLowerCase()
      if (!(f.nom || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const nbPayees = factures.filter(f => f.transaction_id).length
  const nbNonPayees = factures.length - nbPayees
  const montantTotal = factures.reduce((s, f) => s + (parseFloat(f.montant) || 0), 0)
  const montantNonPaye = factures.filter(f => !f.transaction_id).reduce((s, f) => s + (parseFloat(f.montant) || 0), 0)

  const totalPages = Math.ceil(filtrees.length / PAR_PAGE)
  const facturesPage = filtrees.slice((page - 1) * PAR_PAGE, page * PAR_PAGE)
  const multiSociete = societeCodes.length > 1

  const ouvrir = (f) => { if (f.url) window.open(f.url, '_blank', 'noopener,noreferrer') }

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8', fontFamily: FONT }}>Chargement des factures…</div>

  const kpis = [
    (filtre.statut === 'payees'
      ? { label: 'Factures payées', value: nbPayees, c: '#16a34a', sub: fmt(montantTotal - montantNonPaye) }
      : filtre.statut === 'nonpayees'
        ? { label: 'Paiement à vérifier', value: nbNonPayees, c: '#dc2626', sub: fmt(montantNonPaye) }
        : { label: 'Total factures', value: factures.length, c: color, sub: `${nbPayees} payées • ${nbNonPayees} à vérifier` }),
    { label: 'Payées', value: nbPayees, c: '#16a34a', sub: 'liées à un paiement', clic: 'payees' },
    { label: 'Paiement à vérifier', value: nbNonPayees, c: '#dc2626', sub: 'aucun paiement lié', clic: 'nonpayees' },
    { label: 'Montant à vérifier', value: fmt(montantNonPaye), c: '#dc2626', sub: 'total non payé' },
  ]

  return (
    <div style={{ fontFamily: FONT }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
        {kpis.map((k, i) => (
          <div key={i} onClick={k.clic ? () => setFiltre(f => ({ ...f, statut: f.statut === k.clic ? 'toutes' : k.clic })) : undefined}
            style={{ background: (k.clic && filtre.statut === k.clic) ? '#f8fafc' : '#fff', borderRadius: '10px', border: `1px solid ${(k.clic && filtre.statut === k.clic) ? '#cbd5e1' : '#e2e8f0'}`, borderTop: `3px solid ${k.c}`, padding: '16px 20px', cursor: k.clic ? 'pointer' : 'default' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{k.label}</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: k.c, lineHeight: 1 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px', fontWeight: '600' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Filtres */}
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
          <label style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nom de facture</label>
          <input value={filtre.recherche} onChange={e => setFiltre(f => ({ ...f, recherche: e.target.value }))} placeholder="Rechercher…"
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
          <button onClick={() => setFiltre({ statut: 'toutes', recherche: '', annee: '' })} style={{ padding: '7px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontFamily: FONT }}>Réinitialiser</button>
        )}
      </div>

      {/* Liste */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: multiSociete ? '90px 110px 1fr 120px 130px' : '90px 110px 1fr 130px', padding: '11px 16px', borderBottom: '2px solid #f1f5f9', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <div>Statut</div><div>Date</div><div>Facture</div>{multiSociete && <div>Société</div>}<div style={{ textAlign: 'right' }}>Montant</div>
        </div>
        {facturesPage.length === 0 && (
          <div style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>Aucune facture</div>
        )}
        {facturesPage.map((f, i) => {
          const payee = !!f.transaction_id
          return (
            <div key={f.fichier_id} onClick={() => ouvrir(f)} title={f.nom}
              style={{ display: 'grid', gridTemplateColumns: multiSociete ? '90px 110px 1fr 120px 130px' : '90px 110px 1fr 130px', padding: '10px 16px', alignItems: 'center', cursor: f.url ? 'pointer' : 'default', borderBottom: i < facturesPage.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: payee ? '#dcfce7' : '#fee2e2', color: payee ? '#16a34a' : '#dc2626' }}>
                  {payee ? '✓ Payée' : '✕ À vérifier'}
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '600' }}>{fmtDate(f.date_facture)}</div>
              <div style={{ fontSize: '13px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '10px' }}>{(f.nom || '').replace(/\.pdf$/i, '')}</div>
              {multiSociete && <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>{f.societe}</div>}
              <div style={{ textAlign: 'right', fontSize: '13.5px', fontWeight: '700', color: f.montant == null ? '#cbd5e1' : '#0f172a' }}>{f.montant == null ? '—' : fmt(f.montant)}</div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #e2e8f0', background: page <= 1 ? '#f1f5f9' : '#fff', color: page <= 1 ? '#cbd5e1' : '#334155', cursor: page <= 1 ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: FONT }}>← Précédent</button>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Page {page} / {totalPages} · {filtrees.length} factures</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #e2e8f0', background: page >= totalPages ? '#f1f5f9' : '#fff', color: page >= totalPages ? '#cbd5e1' : '#334155', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: FONT }}>Suivant →</button>
        </div>
      )}
    </div>
  )
}
