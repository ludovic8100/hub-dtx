// Comptabilité consolidée — recherche transversale aux six entités.
//
// Répond à une question que les pages par société ne savent pas traiter :
// « combien a-t-on dépensé chez ce fournisseur, toutes sociétés confondues ? ».
// Chercher « bigmat » remonte ici les paiements LODE et DTX côte à côte.
//
// La société n'est pas portée par la transaction : elle vient du compte
// bancaire (transactions.compte_id → comptes_bancaires.societe_id). On charge
// donc les 13 comptes une fois, et on filtre par liste d'identifiants — ce qui
// évite une jointure filtrée à chaque frappe.

import { useState, useEffect, useMemo, useCallback } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const NAVY = '#0D2F5E'
const PAR_PAGE = 300

const COULEUR_SOC = {
  DYNASSUR: '#0080BD', DTX: '#64748b', LODE: '#ea580c',
  HEXAGROUP: '#dc2626', PRIVE: '#0d9488', HOL: '#7c3aed',
}

const fmt = v => v == null ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

// Premier jour du mois, N mois en arrière — pour les raccourcis de période
const moisEnArriere = n => {
  const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(1)
  return d.toISOString().slice(0, 10)
}

export default function GroupeComptabilite() {
  const [comptes, setComptes]       = useState([])
  const [categories, setCategories] = useState([])
  const [lignes, setLignes]         = useState([])
  const [chargement, setChargement] = useState(false)
  const [tronque, setTronque]       = useState(false)

  // Filtres
  const [recherche, setRecherche]   = useState('')
  const [societes, setSocietes]     = useState([])          // [] = toutes
  const [du, setDu]                 = useState(moisEnArriere(12))
  const [au, setAu]                 = useState('')
  const [sens, setSens]             = useState('tous')      // tous | entrees | sorties
  const [categorie, setCategorie]   = useState('')
  const [etatFacture, setEtatFacture] = useState('tous')    // tous | avec | sans
  const [tri, setTri]               = useState({ col: 'date_execution', desc: true })

  // Référentiels : chargés une fois
  useEffect(() => {
    supabase.from('comptes_bancaires')
      .select('id,banque,iban,societe_id,societes(code,nom)')
      .eq('actif', true)
      .then(({ data }) => setComptes(data || []))
    supabase.from('categories').select('id,nom').order('nom')
      .then(({ data }) => setCategories(data || []))
  }, [])

  const codesSocietes = useMemo(() => {
    const vus = new Set()
    comptes.forEach(c => { const code = c.societes?.code; if (code) vus.add(code) })
    return [...vus].sort()
  }, [comptes])

  const societeDuCompte = useCallback(
    id => comptes.find(c => c.id === id)?.societes?.code || '—', [comptes])
  const libelleCompte = useCallback(
    id => { const c = comptes.find(x => x.id === id); return c ? `${c.banque} ••${String(c.iban || '').slice(-4)}` : '—' },
    [comptes])

  const charger = useCallback(async () => {
    if (!comptes.length) return
    setChargement(true)

    let requete = supabase.from('transactions')
      .select('id,date_execution,date_valeur,montant,contrepartie_nom,information_paiement,description,facture_url,rapproche,sans_facture,categorie_id,compte_id,bordereau_id')

    // Société → liste de comptes
    if (societes.length) {
      const ids = comptes.filter(c => societes.includes(c.societes?.code)).map(c => c.id)
      if (!ids.length) { setLignes([]); setChargement(false); return }
      requete = requete.in('compte_id', ids)
    }

    const terme = recherche.trim()
    if (terme.length >= 2) {
      const motif = `%${terme.replace(/[%,()]/g, '')}%`
      requete = requete.or(
        `contrepartie_nom.ilike.${motif},information_paiement.ilike.${motif},description.ilike.${motif}`)
    }
    if (du) requete = requete.gte('date_execution', du)
    if (au) requete = requete.lte('date_execution', au)
    if (sens === 'entrees') requete = requete.gt('montant', 0)
    if (sens === 'sorties') requete = requete.lt('montant', 0)
    if (categorie) requete = requete.eq('categorie_id', categorie)
    if (etatFacture === 'avec') requete = requete.not('facture_url', 'is', null)
    if (etatFacture === 'sans') requete = requete.is('facture_url', null)

    const { data, error } = await requete
      .order(tri.col, { ascending: !tri.desc })
      .limit(PAR_PAGE + 1)

    if (error) { console.error('Compta groupe :', error); setLignes([]); setChargement(false); return }
    setTronque((data || []).length > PAR_PAGE)
    setLignes((data || []).slice(0, PAR_PAGE))
    setChargement(false)
  }, [comptes, societes, recherche, du, au, sens, categorie, etatFacture, tri])

  // Débounce sur la frappe, immédiat sur les autres filtres
  useEffect(() => {
    const t = setTimeout(charger, recherche ? 350 : 0)
    return () => clearTimeout(t)
  }, [charger, recherche])

  const totaux = useMemo(() => {
    const entrees = lignes.filter(l => l.montant > 0).reduce((s, l) => s + Number(l.montant), 0)
    const sorties = lignes.filter(l => l.montant < 0).reduce((s, l) => s + Number(l.montant), 0)
    return { entrees, sorties, solde: entrees + sorties }
  }, [lignes])

  // Récapitulatif par société — la réponse à « combien chez ce fournisseur, et où »
  const parSociete = useMemo(() => {
    const acc = {}
    lignes.forEach(l => {
      const code = societeDuCompte(l.compte_id)
      if (!acc[code]) acc[code] = { code, n: 0, total: 0 }
      acc[code].n++; acc[code].total += Number(l.montant)
    })
    return Object.values(acc).sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  }, [lignes, societeDuCompte])

  const basculerSociete = code =>
    setSocietes(s => s.includes(code) ? s.filter(x => x !== code) : [...s, code])

  const trierPar = col =>
    setTri(t => t.col === col ? { col, desc: !t.desc } : { col, desc: true })

  const reinitialiser = () => {
    setRecherche(''); setSocietes([]); setDu(moisEnArriere(12)); setAu('')
    setSens('tous'); setCategorie(''); setEtatFacture('tous')
  }

  const styleChamp = {
    padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0',
    fontSize: 13, fontFamily: 'inherit', color: NAVY, background: '#fff',
  }
  const enTete = (col, label, aligne = 'left') => (
    <th onClick={() => trierPar(col)}
      style={{ padding: '8px 10px', fontWeight: 700, textAlign: aligne, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
      {label}
      {tri.col === col && <span style={{ marginLeft: 4, color: '#0080BD' }}>{tri.desc ? '▾' : '▴'}</span>}
    </th>
  )

  return (
    <Layout currentPage="Comptabilité">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: '0 0 4px' }}>Comptabilité — toutes sociétés</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 18px' }}>
          Rechercher un paiement, un virement ou un fournisseur dans les comptes des six entités à la fois.
        </p>

        {/* ── Filtres ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <input
              value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Fournisseur, communication, description…  (ex. bigmat)"
              style={{ ...styleChamp, flex: '1 1 320px', fontSize: 14 }} />
            <select value={sens} onChange={e => setSens(e.target.value)} style={styleChamp}>
              <option value="tous">Entrées et sorties</option>
              <option value="sorties">Dépenses</option>
              <option value="entrees">Rentrées</option>
            </select>
            <select value={categorie} onChange={e => setCategorie(e.target.value)} style={styleChamp}>
              <option value="">Toutes catégories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
            <select value={etatFacture} onChange={e => setEtatFacture(e.target.value)} style={styleChamp}>
              <option value="tous">Avec ou sans document</option>
              <option value="avec">Avec document</option>
              <option value="sans">Sans document</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {codesSocietes.map(code => {
                const actif = societes.includes(code)
                const col = COULEUR_SOC[code] || '#64748b'
                return (
                  <button key={code} onClick={() => basculerSociete(code)}
                    style={{ fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 7,
                      border: `1px solid ${actif ? col : '#e2e8f0'}`,
                      background: actif ? col : '#fff', color: actif ? '#fff' : '#64748b',
                      cursor: 'pointer', fontFamily: 'inherit' }}>
                    {code}
                  </button>
                )
              })}
              {societes.length > 0 && (
                <button onClick={() => setSocietes([])}
                  style={{ fontSize: 12, padding: '5px 9px', borderRadius: 7, border: '1px solid #e2e8f0',
                    background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Toutes
                </button>
              )}
            </div>

            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 4 }}>du</span>
            <input type="date" value={du} onChange={e => setDu(e.target.value)} style={styleChamp} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>au</span>
            <input type="date" value={au} onChange={e => setAu(e.target.value)} style={styleChamp} />
            {[['12 mois', 12], ['24 mois', 24], ['Tout', 0]].map(([label, n]) => (
              <button key={label} onClick={() => { setDu(n ? moisEnArriere(n) : ''); setAu('') }}
                style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {label}
              </button>
            ))}
            <button onClick={reinitialiser}
              style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 7, border: 'none',
                background: '#f1f5f9', color: '#64748b', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, marginLeft: 'auto' }}>
              Réinitialiser
            </button>
          </div>
        </div>

        {/* ── Totaux ── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { l: 'Opérations', v: `${lignes.length}${tronque ? '+' : ''}`, c: NAVY },
            { l: 'Rentrées',   v: fmt(totaux.entrees), c: '#16a34a' },
            { l: 'Dépenses',   v: fmt(totaux.sorties), c: '#dc2626' },
            { l: 'Solde',      v: fmt(totaux.solde),   c: totaux.solde < 0 ? '#dc2626' : '#16a34a' },
          ].map(k => (
            <div key={k.l} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 18px', minWidth: 150 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.l}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: k.c, marginTop: 2 }}>{k.v}</div>
            </div>
          ))}
          {parSociete.length > 1 && parSociete.map(s => (
            <div key={s.code} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', minWidth: 130 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: COULEUR_SOC[s.code] || '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.code}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.total < 0 ? '#dc2626' : '#16a34a', marginTop: 2 }}>{fmt(s.total)}</div>
              <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{s.n} opération{s.n > 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>

        {/* ── Résultats ── */}
        {chargement ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Recherche…</p>
        ) : !lignes.length ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 36, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Aucune opération ne correspond. Élargis la période ou retire un filtre.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {enTete('date_execution', 'Date')}
                    <th style={{ padding: '8px 10px', fontWeight: 700 }}>Société</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700 }}>Compte</th>
                    {enTete('contrepartie_nom', 'Contrepartie')}
                    <th style={{ padding: '8px 10px', fontWeight: 700 }}>Communication</th>
                    {enTete('montant', 'Montant', 'right')}
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center' }}>Doc.</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map(l => {
                    const code = societeDuCompte(l.compte_id)
                    const col = COULEUR_SOC[code] || '#64748b'
                    const negatif = Number(l.montant) < 0
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: '#475569' }}>{fmtDate(l.date_execution)}</td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5,
                            background: `${col}15`, color: col, border: `1px solid ${col}35` }}>{code}</span>
                        </td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: '#94a3b8', fontSize: 11.5 }}>{libelleCompte(l.compte_id)}</td>
                        <td style={{ padding: '7px 10px', fontWeight: 600, color: NAVY, maxWidth: 220 }}>{l.contrepartie_nom || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#64748b', maxWidth: 380, fontSize: 11.5 }}>
                          {(l.information_paiement || l.description || '').slice(0, 160) || '—'}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700,
                          color: negatif ? '#dc2626' : '#16a34a' }}>{fmt(l.montant)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {l.facture_url ? (
                            <a href={l.facture_url} target="_blank" rel="noreferrer" title="Ouvrir le document"
                              style={{ color: '#0080BD', textDecoration: 'none' }}>
                              <i className="ti ti-file-text" style={{ fontSize: 15 }} />
                            </a>
                          ) : l.sans_facture ? (
                            <span title="Marqué sans document" style={{ color: '#cbd5e1' }}>—</span>
                          ) : (
                            <span title="Document manquant" style={{ color: '#f59e0b' }}>
                              <i className="ti ti-alert-circle" style={{ fontSize: 14 }} />
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {tronque && (
              <div style={{ padding: '10px 14px', background: '#fffbeb', borderTop: '1px solid #fde68a', fontSize: 12, color: '#b45309' }}>
                Seules les {PAR_PAGE} premières opérations sont affichées. Affine la recherche ou réduis la période.
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
