import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'
import { BarresEmpilees, Legende, COULEURS } from '../../components/GraphAppels'

// Journal et statistiques de la téléphonie 3CX.
//
// La page lit la vue `v_appels` et non la table `appels` : la vue normalise le
// sens (Inbound/Missed/Notanswered sont TOUS des entrants), isole les appels
// manqués, convertit la durée en secondes — elle est stockée en texte, dans
// deux formats qui cohabitent — et résout le nom du contact et du poste.
// Voir supabase/migrations/20261102210000_telephonie_postes_et_vue_appels.sql

const E = ENTITES.dynassur
const NAVY = '#0D2F5E'
const PAGE = 1000

const PERIODES = [
  { cle: '7',   label: '7 jours',  jours: 7 },
  { cle: '30',  label: '30 jours', jours: 30 },
  { cle: '90',  label: '90 jours', jours: 90 },
  { cle: 'all', label: 'Tout',     jours: null },
]

const fmtDT = iso => {
  if (!iso) return '—'
  const d = new Date(String(iso).replace(' ', 'T'))
  return isNaN(d) ? '—' : d.toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const fmtJour = d => d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' })
const fmtNb = n => Number(n || 0).toLocaleString('fr-BE')

// « 5 min 48 s », « 1 h 12 », « 23 s »
const fmtDuree = s => {
  if (s == null) return '—'
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60), r = s % 60
  if (m < 60) return r ? `${m} min ${String(r).padStart(2, '0')} s` : `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}
const fmtPct = (n, d) => d ? `${Math.round((n / d) * 100)} %` : '—'

// Qui est au bout du poste : le collaborateur s'il est identifié, sinon le
// libellé du poste de service, sinon le numéro nu.
const quiPoste = r => r.collaborateur || r.poste_libelle || (r.extension ? `Poste ${r.extension}` : '—')

export default function DynassurAppels() {
  const navigate = useNavigate()
  const [rows, setRows] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [onglet, setOnglet] = useState('journal')     // journal | stats
  const [periode, setPeriode] = useState('30')
  const [sens, setSens] = useState('tous')            // tous | entrant | sortant | manque
  const [q, setQ] = useState('')
  const [postes, setPostes] = useState([])
  const [edition, setEdition] = useState(null)        // { extension, libelle }

  const depuis = useMemo(() => {
    const p = PERIODES.find(x => x.cle === periode)
    if (!p?.jours) return null
    const d = new Date(); d.setDate(d.getDate() - p.jours); d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [periode])

  // Chargement paginé : la page affichait 1 000 appels et s'arrêtait là, sans
  // le dire autrement qu'en petit en bas. On lit désormais toute la période.
  const charger = async () => {
    setRows(null); setErreur(null)
    const tout = []
    try {
      for (let from = 0; ; from += PAGE) {
        let req = supabase.from('v_appels').select('*').order('debut', { ascending: false }).range(from, from + PAGE - 1)
        if (depuis) req = req.gte('debut', depuis)
        const { data, error } = await req
        if (error) throw error
        tout.push(...(data || []))
        if (!data || data.length < PAGE || tout.length >= 50000) break
      }
      setRows(tout)
    } catch (e) {
      setErreur(e); setRows([])
    }
    const { data: p } = await supabase.from('postes_telephonie').select('*').order('extension')
    setPostes(p || [])
  }
  useEffect(() => { charger() }, [depuis])   // eslint-disable-line react-hooks/exhaustive-deps

  const lignes = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows || []).filter(r => {
      if (sens === 'entrant' && (r.sens !== 'entrant' || r.manque)) return false
      if (sens === 'sortant' && r.sens !== 'sortant') return false
      if (sens === 'manque' && !r.manque) return false
      if (s) {
        const hay = `${r.numero || ''} ${r.contact || ''} ${r.extension || ''} ${quiPoste(r)}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [rows, sens, q])

  // ── Statistiques ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const r = rows || []
    const manques = r.filter(x => x.manque)
    const entrants = r.filter(x => x.sens === 'entrant' && !x.manque)
    const sortants = r.filter(x => x.sens === 'sortant')
    const entrantsTotal = entrants.length + manques.length
    const repondus = r.filter(x => !x.manque && x.duree_s > 0)
    const secondes = repondus.reduce((s, x) => s + (x.duree_s || 0), 0)
    const horsHoraires = r.filter(x => x.poste_categorie === 'hors_horaires')

    // Par jour
    const parJour = new Map()
    for (const x of r) {
      if (!x.debut) continue
      const d = new Date(x.debut)
      const cle = d.toISOString().slice(0, 10)
      if (!parJour.has(cle)) parJour.set(cle, { cle, d, valeurs: { entrant: 0, sortant: 0, manque: 0 } })
      const b = parJour.get(cle).valeurs
      if (x.manque) b.manque++; else if (x.sens === 'entrant') b.entrant++; else b.sortant++
    }
    const jours = [...parJour.values()].sort((a, b) => a.d - b.d).map(j => ({
      cle: j.cle, label: fmtJour(j.d), valeurs: j.valeurs,
      labelAxe: fmtJour(j.d),
      labelLong: j.d.toLocaleDateString('fr-BE', { weekday: 'long', day: '2-digit', month: 'long' }),
    }))
    // Au-delà de ~45 jours, un libellé sur deux pour que l'axe reste lisible
    const pas = Math.ceil(jours.length / 32)
    if (pas > 1) jours.forEach((j, i) => { j.labelAxe = i % pas === 0 ? j.label : '' })

    // Par heure
    const parHeure = Array.from({ length: 24 }, (_, h) => ({ cle: String(h), label: String(h).padStart(2, '0'), labelLong: `${String(h).padStart(2, '0')} h – ${String((h + 1) % 24).padStart(2, '0')} h`, valeurs: { entrant: 0, sortant: 0, manque: 0 } }))
    for (const x of r) {
      if (!x.debut) continue
      const b = parHeure[new Date(x.debut).getHours()].valeurs
      if (x.manque) b.manque++; else if (x.sens === 'entrant') b.entrant++; else b.sortant++
    }
    const actives = parHeure.filter(h => h.valeurs.entrant + h.valeurs.sortant + h.valeurs.manque > 0)
    const hMin = actives.length ? Number(actives[0].cle) : 7
    const hMax = actives.length ? Number(actives[actives.length - 1].cle) : 20
    const heures = parHeure.slice(hMin, hMax + 1)

    // Par poste
    const parPoste = new Map()
    for (const x of r) {
      const cle = x.extension || '—'
      if (!parPoste.has(cle)) parPoste.set(cle, {
        extension: x.extension, qui: quiPoste(x), categorie: x.poste_categorie,
        collaborateur: x.collaborateur, entrant: 0, sortant: 0, manque: 0, secondes: 0, repondus: 0, plusLong: 0,
      })
      const p = parPoste.get(cle)
      if (x.manque) p.manque++; else if (x.sens === 'entrant') p.entrant++; else p.sortant++
      if (!x.manque && x.duree_s > 0) { p.secondes += x.duree_s; p.repondus++; p.plusLong = Math.max(p.plusLong, x.duree_s) }
    }
    const pPostes = [...parPoste.values()]
      .map(p => ({ ...p, total: p.entrant + p.sortant + p.manque }))
      .sort((a, b) => b.total - a.total)

    // Numéros qui reviennent le plus
    const parNum = new Map()
    for (const x of r) {
      if (!x.numero) continue
      if (!parNum.has(x.numero)) parNum.set(x.numero, { numero: x.numero, contact: x.contact, dossier: x.client_dossier, n: 0, manque: 0 })
      const e = parNum.get(x.numero); e.n++; if (x.manque) e.manque++
      if (!e.contact && x.contact) e.contact = x.contact
      if (!e.dossier && x.client_dossier) e.dossier = x.client_dossier
    }
    const topNumeros = [...parNum.values()].sort((a, b) => b.n - a.n).slice(0, 8)

    return {
      total: r.length, entrants: entrants.length, sortants: sortants.length,
      manques: manques.length, entrantsTotal,
      tauxDecroche: entrantsTotal ? entrants.length / entrantsTotal : null,
      secondes, moyenne: repondus.length ? Math.round(secondes / repondus.length) : null,
      horsHoraires: horsHoraires.length,
      identifies: r.filter(x => x.contact).length,
      jours, heures, postes: pPostes, topNumeros,
    }
  }, [rows])

  const renommerPoste = async () => {
    if (!edition) return
    const { error } = await supabase.from('postes_telephonie')
      .update({ libelle: edition.libelle.trim() || `Poste ${edition.extension}`, categorie: edition.categorie })
      .eq('extension', edition.extension)
    if (error) { setErreur(error); return }
    setEdition(null)
    charger()
  }

  const ouvrirFiche = r => { if (r.client_dossier) navigate('/dynassur/clients?dossier=' + encodeURIComponent(r.client_dossier)) }

  const chargement = rows === null

  return (
    <Layout currentPage="Appels">
      <StatBanner
        color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
        title="Appels" subtitle="Journal et statistiques — téléphonie 3CX"
        action={
          <button onClick={charger} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <i className="ti ti-refresh" style={{ marginRight: 6 }} />Actualiser
          </button>
        }
      />

      {erreur && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: 13, display: 'flex', gap: 9 }}>
          <i className="ti ti-alert-circle" style={{ fontSize: 16, marginTop: 1 }} />
          <div>Lecture impossible : {erreur.message || String(erreur)}</div>
        </div>
      )}

      {/* Onglets + période */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ v: 'journal', l: 'Journal', i: 'ti-list' }, { v: 'stats', l: 'Statistiques', i: 'ti-chart-bar' }].map(o => (
            <button key={o.v} onClick={() => setOnglet(o.v)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid ' + (onglet === o.v ? E.color : '#e2e8f0'), background: onglet === o.v ? E.color : '#fff', color: onglet === o.v ? '#fff' : '#64748b', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
              <i className={`ti ${o.i}`} style={{ marginRight: 6 }} />{o.l}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 5 }}>
          {PERIODES.map(p => (
            <button key={p.cle} onClick={() => setPeriode(p.cle)} style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid ' + (periode === p.cle ? NAVY : '#e2e8f0'), background: periode === p.cle ? NAVY : '#fff', color: periode === p.cle ? '#fff' : '#64748b', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Appels" value={chargement ? '…' : fmtNb(stats.total)} col={E.color} sub={chargement ? null : `${fmtNb(stats.entrantsTotal)} entrants · ${fmtNb(stats.sortants)} sortants`} />
        <Kpi label="Taux de décroché" value={chargement ? '…' : (stats.tauxDecroche == null ? '—' : fmtPct(stats.entrants, stats.entrantsTotal))} col={COULEURS.entrant} sub={chargement ? null : `${fmtNb(stats.entrants)} répondus sur ${fmtNb(stats.entrantsTotal)}`} />
        <Kpi label="Appels manqués" value={chargement ? '…' : fmtNb(stats.manques)} col={COULEURS.manque} sub={chargement ? null : fmtPct(stats.manques, stats.entrantsTotal) + ' des entrants'} />
        <Kpi label="Durée moyenne" value={chargement ? '…' : fmtDuree(stats.moyenne)} col={COULEURS.sortant} sub={chargement ? null : 'Total ' + fmtDuree(stats.secondes)} />
        <Kpi label="Hors horaires" value={chargement ? '…' : fmtNb(stats.horsHoraires)} col="#7c3aed" sub="Arrivés bureau fermé" />
      </div>

      {chargement ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Chargement…</div>
      ) : onglet === 'stats' ? (
        <Stats stats={stats} postes={postes} edition={edition} setEdition={setEdition} renommer={renommerPoste} />
      ) : (
        <Journal
          lignes={lignes} total={(rows || []).length} sens={sens} setSens={setSens} q={q} setQ={setQ}
          ouvrirFiche={ouvrirFiche} identifies={stats.identifies}
        />
      )}
    </Layout>
  )
}

/* ── Vignette de chiffre ── */
function Kpi({ label, value, col, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${col}`, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const Carte = ({ titre, aide, children }) => (
  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 18px', marginBottom: 16 }}>
    <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: aide ? 2 : 12 }}>{titre}</div>
    {aide && <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 12 }}>{aide}</div>}
    {children}
  </div>
)

/* ── Onglet Statistiques ── */
function Stats({ stats, postes, edition, setEdition, renommer }) {
  const aNommer = postes.filter(p => p.categorie === 'inconnu')
  const maxPoste = Math.max(1, ...stats.postes.map(p => p.total))

  return (
    <>
      {aNommer.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12.5, color: '#92400e' }}>
          <b>{aNommer.length} poste{aNommer.length > 1 ? 's' : ''} sans nom</b> — {aNommer.map(p => p.extension).join(', ')}.
          Nommez-les dans le tableau ci-dessous ; un poste qui appartient à quelqu'un se renseigne plutôt
          dans Paramètres → fiche du collaborateur → « Poste 3CX ».
        </div>
      )}

      <Carte titre="Volume par jour" aide="Les trois séries s'excluent : leur somme est le total d'appels de la journée.">
        <Legende />
        <BarresEmpilees donnees={stats.jours} hauteur={190} />
      </Carte>

      <Carte titre="Répartition par heure" aide="Quand le téléphone sonne — la donnée qui sert à décider des présences.">
        <Legende />
        <BarresEmpilees donnees={stats.heures} hauteur={160} vide="Aucun appel sur la période." />
      </Carte>

      <Carte titre="Par poste" aide="Cliquez sur un libellé de poste de service pour le renommer.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {['Poste', 'Qui', 'Volume', 'Entrants', 'Sortants', 'Manqués', 'Décroché', 'Temps en ligne', 'Moyenne', 'Plus long'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.postes.map((p, i) => {
                const entrantsTotal = p.entrant + p.manque
                const estService = !p.collaborateur && p.extension
                const enEdition = edition?.extension === p.extension
                return (
                  <tr key={p.extension || i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: NAVY, whiteSpace: 'nowrap' }}>{p.extension || '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#1e293b', minWidth: 190 }}>
                      {enEdition ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input autoFocus value={edition.libelle} onChange={e => setEdition({ ...edition, libelle: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') renommer(); if (e.key === 'Escape') setEdition(null) }}
                            style={{ flex: 1, padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit' }} />
                          <select value={edition.categorie} onChange={e => setEdition({ ...edition, categorie: e.target.value })}
                            style={{ padding: '5px 6px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 11.5, fontFamily: 'inherit' }}>
                            <option value="service">Service</option>
                            <option value="file">File d'attente</option>
                            <option value="svi">Serveur vocal</option>
                            <option value="hors_horaires">Hors horaires</option>
                            <option value="inconnu">À nommer</option>
                          </select>
                          <button onClick={renommer} style={{ padding: '5px 9px', border: 'none', borderRadius: 6, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>OK</button>
                        </div>
                      ) : estService ? (
                        <button onClick={() => { const po = postes.find(x => x.extension === p.extension); setEdition({ extension: p.extension, libelle: po?.libelle || '', categorie: po?.categorie || 'service' }) }}
                          style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: p.categorie === 'inconnu' ? '#b45309' : '#1e293b', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                          {p.qui}
                        </button>
                      ) : p.qui}
                    </td>
                    <td style={{ padding: '8px 12px', minWidth: 110 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ flex: 1, height: 7, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', minWidth: 46 }}>
                          <div style={{ width: `${(p.total / maxPoste) * 100}%`, height: '100%', background: COULEURS.entrant, borderRadius: 4 }} />
                        </div>
                        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#0f172a' }}>{fmtNb(p.total)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>{fmtNb(p.entrant)}</td>
                    <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>{fmtNb(p.sortant)}</td>
                    <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums', color: p.manque ? COULEURS.manque : '#94a3b8', fontWeight: p.manque ? 700 : 400 }}>{fmtNb(p.manque)}</td>
                    <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums', color: '#475569' }}>{entrantsTotal ? fmtPct(p.entrant, entrantsTotal) : '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDuree(p.secondes)}</td>
                    <td style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{p.repondus ? fmtDuree(Math.round(p.secondes / p.repondus)) : '—'}</td>
                    <td style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{p.plusLong ? fmtDuree(p.plusLong) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Carte>

      <Carte titre="Numéros les plus fréquents" aide="Huit numéros qui reviennent le plus sur la période.">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              {['Numéro', 'Contact', 'Appels', 'dont manqués'].map(h => (
                <th key={h} style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.topNumeros.map(n => (
              <tr key={n.numero} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 12px', color: '#1e293b' }}>{n.numero}</td>
                <td style={{ padding: '8px 12px', color: n.contact ? '#1e293b' : '#94a3b8' }}>{n.contact || 'Inconnu'}{n.dossier ? <span style={{ color: '#94a3b8' }}> · {n.dossier}</span> : null}</td>
                <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtNb(n.n)}</td>
                <td style={{ padding: '8px 12px', fontVariantNumeric: 'tabular-nums', color: n.manque ? COULEURS.manque : '#94a3b8' }}>{fmtNb(n.manque)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Carte>
    </>
  )
}

/* ── Onglet Journal ── */
function Journal({ lignes, total, sens, setSens, q, setQ, ouvrirFiche, identifies }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ v: 'tous', l: 'Tous' }, { v: 'entrant', l: 'Entrants' }, { v: 'sortant', l: 'Sortants' }, { v: 'manque', l: 'Manqués' }].map(o => (
            <button key={o.v} onClick={() => setSens(o.v)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid ' + (sens === o.v ? E.color : '#e2e8f0'), background: sens === o.v ? E.color : '#fff', color: sens === o.v ? '#fff' : '#64748b', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{o.l}</button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher (numéro, contact, poste)…" style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                {['Sens', 'Numéro', 'Contact', 'Poste', 'Durée', 'Date / heure', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!lignes.length ? (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Aucun appel.</td></tr>
              ) : lignes.map((r, i) => {
                const etat = r.manque ? { l: 'Manqué', c: COULEURS.manque, f: '#fef2f2', i: 'ti-phone-off' }
                  : r.sens === 'entrant' ? { l: 'Entrant', c: COULEURS.entrant, f: '#eff6ff', i: 'ti-phone-incoming' }
                  : { l: 'Sortant', c: COULEURS.sortant, f: '#fff4ed', i: 'ti-phone-outgoing' }
                return (
                  <tr key={r.id} onClick={() => ouvrirFiche(r)} style={{ borderTop: '1px solid #f1f5f9', cursor: r.client_dossier ? 'pointer' : 'default', background: i % 2 ? '#fafafe' : '#fff' }}
                    onMouseEnter={e => { if (r.client_dossier) e.currentTarget.style.background = '#eff6ff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = i % 2 ? '#fafafe' : '#fff' }}>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: etat.f, color: etat.c, whiteSpace: 'nowrap' }}>
                        <i className={`ti ${etat.i}`} style={{ marginRight: 4 }} />{etat.l}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', color: '#1e293b', whiteSpace: 'nowrap' }}>{r.numero || '—'}</td>
                    <td style={{ padding: '9px 14px', color: r.contact ? '#1e293b' : '#cbd5e1' }}>
                      {r.contact || '—'}
                      {r.client_dossier && <span style={{ color: '#94a3b8', fontSize: 11 }}> · {r.client_dossier}</span>}
                    </td>
                    <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {r.extension && <span style={{ fontWeight: 700, color: '#475569' }}>{r.extension}</span>}
                      {quiPoste(r) !== `Poste ${r.extension}` && <span> · {quiPoste(r)}</span>}
                    </td>
                    <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtDuree(r.duree_s)}</td>
                    <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDT(r.debut)}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>{r.client_dossier && <i className="ti ti-external-link" style={{ color: E.color }} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
        {fmtNb(lignes.length)} appel(s) affiché(s) sur {fmtNb(total)} chargé(s) — toute la période, sans plafond.
        {' '}{fmtNb(identifies)} contact(s) identifié(s). Clic sur une ligne = fiche client, quand un dossier est rattaché.
      </p>
    </>
  )
}
