import { useState, useMemo, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const FONT = "'Source Sans Pro', sans-serif"
const eur = (v) => Math.round(v).toLocaleString('fr-BE') + ' €'
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

export default function RentabiliteView({ transactions = [], categories = [], activitesSoc = [], color = '#0080BD', ventilations = {}, facturesParTx = {} }) {
  const [anneesSel, setAnneesSel] = useState(null)
  const [scopeAct, setScopeAct] = useState('all')
  const [deplie, setDeplie] = useState(null)
  const [ibanGroupe, setIbanGroupe] = useState(() => new Set())

  useEffect(() => {
    let annule = false
    supabase.from('comptes_bancaires').select('iban').then(({ data }) => {
      if (annule) return
      setIbanGroupe(new Set((data || []).map(c => (c.iban || '').replace(/\s/g, '').toUpperCase()).filter(Boolean)))
    })
    return () => { annule = true }
  }, [])

  const annees = useMemo(() => {
    const set = new Set()
    for (const t of transactions) { const d = t._date || t.date_valeur; if (d) set.add(String(d).slice(0, 4)) }
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [transactions])
  const anSel = useMemo(() => (anneesSel && anneesSel.size) ? anneesSel : new Set(annees.length ? annees : [String(new Date().getFullYear())]), [anneesSel, annees])
  const anLabel = Array.from(anSel).sort().join(' + ')
  function toggleAnnee(a) {
    setAnneesSel(prev => {
      const base = new Set((prev && prev.size) ? prev : annees)
      if (base.has(a)) base.delete(a); else base.add(a)
      return base
    })
  }

  const catById = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])
  const parentIdDe = (id) => { const c = catById[id]; return c ? (c.parent_id || c.id) : null }

  const transfertIds = useMemo(() => {
    const ids = new Set()
    for (const c of categories) {
      if ((c.nom || '').toUpperCase() === 'TRANSFERT') { ids.add(c.id); for (const s of categories) if (s.parent_id === c.id) ids.add(s.id) }
    }
    return ids
  }, [categories])

  const num = (t) => parseFloat(t.montant) || 0

  const txAn = useMemo(() => transactions.filter(t => {
    const d = t._date || t.date_valeur
    if (!d || !anSel.has(String(d).slice(0, 4))) return false
    if (t.categorie_id && transfertIds.has(t.categorie_id)) return false
    const cib = (t.contrepartie_iban || '').replace(/\s/g, '').toUpperCase()
    const interne = cib && ibanGroupe.has(cib)
    if (interne && !((facturesParTx[t.id] || 0) > 0)) return false
    return true
  }), [transactions, anSel, transfertIds, ibanGroupe, facturesParTx])

  // Éclatement : une transaction ventilée est remplacée par ses lignes (montant signé/catégorie/activité)
  const lignesAn = useMemo(() => {
    const out = []
    for (const t of txAn) {
      const dt = t._date || t.date_valeur
      const v = ventilations[t.id]
      if (v && v.length) {
        for (const l of v) out.push({ montant: l.montant, activite: l.activite, categorie_id: l.categorie_id, _date: dt })
      } else {
        out.push({ montant: t.montant, activite: t.activite, categorie_id: t.categorie_id, _date: dt })
      }
    }
    return scopeAct === 'all' ? out : out.filter(l => l.activite === scopeAct)
  }, [txAn, ventilations, scopeAct])

  const glob = useMemo(() => {
    let e = 0, s = 0
    for (const t of lignesAn) { const m = num(t); if (m > 0) e += m; else s += -m }
    return { e, s, net: e - s }
  }, [lignesAn])

  const parActivite = useMemo(() => {
    if (!activitesSoc.length) return []
    const codes = activitesSoc.map(a => a.code)
    const acc = {}
    for (const a of activitesSoc) acc[a.code] = { ...a, e: 0, s: 0 }
    acc._none = { code: '_none', label: 'Non qualifié', couleur: '#94a3b8', e: 0, s: 0 }
    for (const t of lignesAn) {
      const k = (t.activite && codes.includes(t.activite)) ? t.activite : '_none'
      const m = num(t); if (m > 0) acc[k].e += m; else acc[k].s += -m
    }
    return Object.values(acc).map(x => ({ ...x, net: x.e - x.s }))
  }, [lignesAn, activitesSoc])

  const parCategorie = useMemo(() => {
    const acc = {}
    for (const t of lignesAn) {
      const m = num(t); if (m >= 0) continue
      const dep = -m
      const cid = t.categorie_id
      const pid = cid ? (parentIdDe(cid) || '_none') : '_none'
      const pnom = pid === '_none' ? 'Non catégorisé' : (catById[pid]?.nom || '—')
      if (!acc[pid]) acc[pid] = { id: pid, nom: pnom, total: 0, enfants: {} }
      acc[pid].total += dep
      if (cid && catById[cid]?.parent_id) {
        const snom = catById[cid]?.nom || '—'
        acc[pid].enfants[cid] = acc[pid].enfants[cid] || { id: cid, nom: snom, total: 0 }
        acc[pid].enfants[cid].total += dep
      }
    }
    return Object.values(acc).sort((a, b) => b.total - a.total)
  }, [lignesAn])

  const parMois = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ mois: i + 1, e: 0, s: 0 }))
    for (const t of lignesAn) {
      const d = t._date || t.date_valeur
      const mi = parseInt(String(d).slice(5, 7), 10) - 1
      if (mi < 0 || mi > 11) continue
      const m = num(t); if (m > 0) arr[mi].e += m; else arr[mi].s += -m
    }
    return arr
  }, [lignesAn])

  const maxCat = Math.max(1, ...parCategorie.map(c => c.total))
  const maxMois = Math.max(1, ...parMois.map(m => Math.max(m.e, m.s)))

  const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 18px' }
  const kpi = { background: '#f8fafc', borderRadius: '10px', padding: '14px 16px' }

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Exercice(s) :</span>
        {(annees.length ? annees : [anLabel]).map(a => {
          const on = anSel.has(a)
          return <button key={a} onClick={() => toggleAnnee(a)} style={{ padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: FONT, border: on ? `2px solid ${color}` : '1px solid #e2e8f0', background: on ? `${color}14` : '#fff', color: on ? '#0f172a' : '#94a3b8' }}>{a}</button>
        })}
        {annees.length > 1 && <button onClick={() => setAnneesSel(new Set(annees))} style={{ padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: FONT, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b' }}>Tous</button>}
      </div>

      {activitesSoc.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Activité :</span>
          <button onClick={() => setScopeAct('all')} style={{ padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: FONT, border: scopeAct === 'all' ? '2px solid #1e293b' : '1px solid #e2e8f0', background: scopeAct === 'all' ? '#1e293b14' : '#fff', color: scopeAct === 'all' ? '#0f172a' : '#94a3b8' }}>Tout LODE</button>
          {activitesSoc.map(a => {
            const on = scopeAct === a.code
            return <button key={a.code} onClick={() => setScopeAct(a.code)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: FONT, border: on ? `2px solid ${a.couleur || '#1e293b'}` : '1px solid #e2e8f0', background: on ? (a.couleur || '#1e293b') + '18' : '#fff', color: on ? '#0f172a' : '#94a3b8' }}><span style={{ width: '9px', height: '9px', borderRadius: '3px', background: a.couleur || '#94a3b8' }} />{a.label}</button>
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: '12px', marginBottom: '16px' }}>
        <div style={kpi}><div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Entrées</div><div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{eur(glob.e)}</div></div>
        <div style={kpi}><div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Sorties</div><div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{eur(glob.s)}</div></div>
        <div style={kpi}><div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>Résultat net</div><div style={{ fontSize: '24px', fontWeight: 700, color: glob.net >= 0 ? '#16a34a' : '#dc2626' }}>{glob.net >= 0 ? '+' : ''}{eur(glob.net)}</div></div>
      </div>

      {scopeAct === 'all' && parActivite.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: '12px', marginBottom: '20px' }}>
          {parActivite.filter(a => a.code !== '_none' || a.e || a.s).map(a => (
            <div key={a.code} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: a.couleur || '#94a3b8' }} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{a.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: '15px', fontWeight: 700, color: a.net >= 0 ? '#16a34a' : '#dc2626' }}>{a.net >= 0 ? '+' : ''}{eur(a.net)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', padding: '3px 0' }}><span>Entrées</span><span style={{ color: '#0f172a' }}>{eur(a.e)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', padding: '3px 0' }}><span>Sorties</span><span style={{ color: '#0f172a' }}>{eur(a.s)}</span></div>
            </div>
          ))}
        </div>
      )}

      <div style={{ ...card, marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginBottom: '12px' }}>Dépenses par catégorie</div>
        {parCategorie.length === 0 && <div style={{ color: '#94a3b8', fontSize: '13px' }}>Aucune dépense sur {anLabel}.</div>}
        {parCategorie.map(c => {
          const enfants = Object.values(c.enfants).sort((a, b) => b.total - a.total)
          const ouvrable = enfants.length > 0
          const open = deplie === c.id
          return (
            <div key={c.id} style={{ marginBottom: '10px' }}>
              <div onClick={() => ouvrable && setDeplie(open ? null : c.id)} style={{ cursor: ouvrable ? 'pointer' : 'default' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span style={{ color: '#334155', fontWeight: 600 }}>{ouvrable && <span style={{ color: '#94a3b8', marginRight: '4px' }}>{open ? '▾' : '▸'}</span>}{c.nom}</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{eur(c.total)} <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {Math.round(c.total / glob.s * 100) || 0}%</span></span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${c.total / maxCat * 100}%`, background: color, borderRadius: '4px' }} /></div>
              </div>
              {open && enfants.map(s => (
                <div key={s.id} style={{ marginLeft: '18px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                    <span style={{ color: '#64748b' }}>↳ {s.nom}</span>
                    <span style={{ color: '#475569' }}>{eur(s.total)}</span>
                  </div>
                  <div style={{ height: '6px', background: '#f8fafc', borderRadius: '3px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${s.total / maxCat * 100}%`, background: `${color}99`, borderRadius: '3px' }} /></div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', fontSize: '12px', color: '#64748b', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Évolution mensuelle</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#1baf7a' }} />Entrées</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#eb6834' }} />Sorties</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '160px' }}>
          {parMois.map(m => (
            <div key={m.mois} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '2px', width: '100%', justifyContent: 'center' }}>
                <div title={eur(m.e)} style={{ width: '42%', height: `${m.e / maxMois * 100}%`, background: '#1baf7a', borderRadius: '3px 3px 0 0', minHeight: m.e ? '2px' : '0' }} />
                <div title={eur(m.s)} style={{ width: '42%', height: `${m.s / maxMois * 100}%`, background: '#eb6834', borderRadius: '3px 3px 0 0', minHeight: m.s ? '2px' : '0' }} />
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>{MOIS[m.mois - 1]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
