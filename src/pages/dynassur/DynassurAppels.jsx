import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'
import { BarresEmpilees, Legende, COULEURS, Sparkline, Jauge, CarteChaleur } from '../../components/GraphAppels'

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

  // Deux bornes : le début de la période affichée, et celui de la période
  // précédente de même longueur — c'est elle qui donne les évolutions.
  const { depuis, depuisCompare, jours: joursPeriode } = useMemo(() => {
    const p = PERIODES.find(x => x.cle === periode)
    if (!p?.jours) return { depuis: null, depuisCompare: null, jours: null }
    const d = new Date(); d.setDate(d.getDate() - p.jours); d.setHours(0, 0, 0, 0)
    const d2 = new Date(d); d2.setDate(d2.getDate() - p.jours)
    return { depuis: d.toISOString(), depuisCompare: d2.toISOString(), jours: p.jours }
  }, [periode])

  // Chargement paginé : la page affichait 1 000 appels et s'arrêtait là, sans
  // le dire autrement qu'en petit en bas. On lit désormais toute la période.
  const charger = async () => {
    setRows(null); setErreur(null)
    const tout = []
    try {
      for (let from = 0; ; from += PAGE) {
        let req = supabase.from('v_appels').select('*').order('debut', { ascending: false }).range(from, from + PAGE - 1)
        if (depuisCompare) req = req.gte('debut', depuisCompare)
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
  useEffect(() => { charger() }, [depuisCompare, depuis])   // eslint-disable-line react-hooks/exhaustive-deps

  // Les lignes chargées débordent sur la période précédente (comparaison) :
  // tout ce qui s'affiche repart de `periodeCourante`.
  const periodeCourante = useMemo(
    () => (rows || []).filter(r => !depuis || r.debut >= depuis),
    [rows, depuis])
  const periodePrecedente = useMemo(
    () => (depuis ? (rows || []).filter(r => r.debut < depuis) : []),
    [rows, depuis])

  const lignes = useMemo(() => {
    const s = q.trim().toLowerCase()
    return periodeCourante.filter(r => {
      if (sens === 'entrant' && (r.sens !== 'entrant' || r.manque)) return false
      if (sens === 'sortant' && r.sens !== 'sortant') return false
      if (sens === 'manque' && !r.manque) return false
      if (s) {
        const hay = `${r.numero || ''} ${r.contact || ''} ${r.extension || ''} ${quiPoste(r)}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [periodeCourante, sens, q])

  // ── Statistiques ────────────────────────────────────────────────────────
  const calcul = lot => {
    const manques = lot.filter(x => x.manque)
    const entrants = lot.filter(x => x.sens === 'entrant' && !x.manque)
    const sortants = lot.filter(x => x.sens === 'sortant')
    const entrantsTotal = entrants.length + manques.length
    const repondus = lot.filter(x => !x.manque && x.duree_s > 0)
    const secondes = repondus.reduce((a, x) => a + (x.duree_s || 0), 0)
    return {
      total: lot.length, entrants: entrants.length, sortants: sortants.length,
      manques: manques.length, entrantsTotal,
      decroche: entrantsTotal ? entrants.length / entrantsTotal : null,
      secondes, moyenne: repondus.length ? Math.round(secondes / repondus.length) : null,
      horsHoraires: lot.filter(x => x.poste_categorie === 'hors_horaires').length,
    }
  }

  const stats = useMemo(() => {
    const r = periodeCourante
    const base = calcul(r)
    const avant = periodePrecedente.length ? calcul(periodePrecedente) : null

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
      cle: j.cle, label: fmtJour(j.d), labelAxe: fmtJour(j.d), valeurs: j.valeurs,
      labelLong: j.d.toLocaleDateString('fr-BE', { weekday: 'long', day: '2-digit', month: 'long' }),
    }))
    const pas = Math.ceil(jours.length / 32)
    if (pas > 1) jours.forEach((j, i) => { j.labelAxe = i % pas === 0 ? j.label : '' })
    const courbe = jours.map(j => j.valeurs.entrant + j.valeurs.sortant + j.valeurs.manque)
    const courbeManques = jours.map(j => j.valeurs.manque)
    const courbeDuree = jours.map(j => j.valeurs.entrant + j.valeurs.sortant)

    // Carte de chaleur : jour de semaine (lundi = 0) × heure, appels entrants
    const grille = Array.from({ length: 7 }, () => ({}))
    let pic = 0, hMin = 23, hMax = 0
    for (const x of r) {
      if (!x.debut || x.sens !== 'entrant') continue
      const d = new Date(x.debut)
      const j = (d.getDay() + 6) % 7, h = d.getHours()
      grille[j][h] = (grille[j][h] || 0) + 1
      pic = Math.max(pic, grille[j][h]); hMin = Math.min(hMin, h); hMax = Math.max(hMax, h)
    }
    if (hMin > hMax) { hMin = 7; hMax = 20 }
    const heuresCarte = Array.from({ length: hMax - hMin + 1 }, (_, i) => hMin + i)

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
    const postes = [...parPoste.values()]
      .map(p => ({ ...p, total: p.entrant + p.sortant + p.manque, decroche: (p.entrant + p.manque) ? p.entrant / (p.entrant + p.manque) : null }))
      .sort((a, b) => b.total - a.total)

    // Numéros récurrents
    const parNum = new Map()
    for (const x of r) {
      if (!x.numero) continue
      if (!parNum.has(x.numero)) parNum.set(x.numero, { numero: x.numero, contact: x.contact, dossier: x.client_dossier, n: 0, manque: 0 })
      const e = parNum.get(x.numero); e.n++; if (x.manque) e.manque++
      if (!e.contact && x.contact) e.contact = x.contact
      if (!e.dossier && x.client_dossier) e.dossier = x.client_dossier
    }
    const topNumeros = [...parNum.values()].filter(n => n.n > 1).sort((a, b) => b.n - a.n).slice(0, 8)

    return {
      ...base, avant, jours, courbe, courbeManques, courbeDuree,
      grille, heuresCarte, pic, postes, topNumeros,
      identifies: r.filter(x => x.contact).length,
    }
  }, [periodeCourante, periodePrecedente])

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

      {chargement ? (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Chargement…</div>
      ) : onglet === 'stats' ? (
        <Stats stats={stats} postes={postes} edition={edition} setEdition={setEdition} renommer={renommerPoste} joursPeriode={joursPeriode} />
      ) : (
        <>
          <ChiffresCles stats={stats} compact />
          <Journal
            lignes={lignes} total={periodeCourante.length} sens={sens} setSens={setSens} q={q} setQ={setQ}
            ouvrirFiche={ouvrirFiche} identifies={stats.identifies}
          />
        </>
      )}
    </Layout>
  )
}

/* ── Évolution par rapport à la période précédente ── */
function Delta({ valeur, avant, unite = '', sensBon = 1, pts = false }) {
  if (avant == null || valeur == null || !isFinite(avant)) return null
  const d = valeur - avant
  if (Math.abs(d) < (pts ? 0.005 : 0.5)) {
    return <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>= stable</span>
  }
  // sensBon = 0 : la grandeur n'a pas de sens souhaitable (le volume d'appels
  // n'est ni bon ni mauvais). On montre l'évolution sans la juger.
  const couleur = sensBon === 0 ? '#94a3b8' : (d * sensBon > 0 ? '#16a34a' : '#dc2626')
  const txt = pts ? `${Math.abs(Math.round(d * 100))} pts` : `${Math.abs(Math.round(d))}${unite}`
  return (
    <span title={`${d > 0 ? 'En hausse' : 'En baisse'} par rapport à la période précédente`}
      style={{ fontSize: 11, color: couleur, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 9 }}>{d > 0 ? '\u25B2' : '\u25BC'}</span>{txt}
    </span>
  )
}

/* ── Chiffres clés ──────────────────────────────────────────────────────
   Un chiffre domine — le taux de décroché, celui qui décide si le standard
   tient — les quatre autres l'entourent en plus petit, chacun avec sa
   tendance sur la période. Pas de camembert à deux parts : une jauge dit la
   même chose en moins de place. */
function ChiffresCles({ stats, compact = false }) {
  const a = stats.avant
  const tuiles = [
    { cle: 'total',  label: 'Appels',        valeur: fmtNb(stats.total),
      sous: `${fmtNb(stats.entrantsTotal)} entrants · ${fmtNb(stats.sortants)} sortants`,
      courbe: stats.courbe, couleur: COULEURS.entrant,
      delta: a ? <Delta valeur={stats.total} avant={a.total} sensBon={0} /> : null },
    { cle: 'manque', label: 'Appels manqués', valeur: fmtNb(stats.manques),
      sous: fmtPct(stats.manques, stats.entrantsTotal) + ' des entrants',
      courbe: stats.courbeManques, couleur: COULEURS.manque,
      delta: a ? <Delta valeur={stats.manques} avant={a.manques} sensBon={-1} /> : null },
    { cle: 'duree',  label: 'Durée moyenne', valeur: fmtDuree(stats.moyenne),
      sous: 'Temps en ligne ' + fmtDuree(stats.secondes),
      courbe: stats.courbeDuree, couleur: COULEURS.sortant,
      delta: a?.moyenne != null && stats.moyenne != null ? <Delta valeur={stats.moyenne} avant={a.moyenne} unite=" s" sensBon={0} /> : null },
    { cle: 'hors',   label: 'Hors horaires', valeur: fmtNb(stats.horsHoraires),
      sous: 'Arrivés bureau fermé', courbe: null, couleur: '#7c3aed',
      delta: a ? <Delta valeur={stats.horsHoraires} avant={a.horsHoraires} sensBon={-1} /> : null },
  ]

  if (compact) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 12, marginBottom: 18 }}>
        <Tuile label="Taux de décroché" valeur={stats.decroche == null ? '—' : fmtPct(stats.entrants, stats.entrantsTotal)}
          sous={`${fmtNb(stats.entrants)} répondus sur ${fmtNb(stats.entrantsTotal)}`} couleur={COULEURS.entrant} />
        {tuiles.map(t => <Tuile key={t.cle} label={t.label} valeur={t.valeur} sous={t.sous} couleur={t.couleur} />)}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.15fr) minmax(300px, 2fr)', gap: 14, marginBottom: 18 }}>
      {/* Chiffre dominant */}
      <div style={{ background: 'linear-gradient(150deg,#0D2F5E 0%,#17487f 100%)', borderRadius: 16, padding: '22px 24px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 168 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.62)' }}>Taux de décroché</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6 }}>
            <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {stats.decroche == null ? '—' : fmtPct(stats.entrants, stats.entrantsTotal)}
            </div>
            {a?.decroche != null && stats.decroche != null && (
              <span style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 20, padding: '3px 9px' }}>
                <Delta valeur={stats.decroche} avant={a.decroche} sensBon={1} pts />
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 8, lineHeight: 1.5, maxWidth: 230 }}>
            Part des appels entrants auxquels quelqu'un a répondu.
          </div>
        </div>
        <div>
          <div style={{ marginBottom: 8 }}>
            <Jauge part={stats.entrants} total={stats.entrantsTotal} couleur="#6da7ec" reste={COULEURS.manque} hauteur={9} />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: 'rgba(255,255,255,0.78)' }}>
            <span><b style={{ color: '#fff' }}>{fmtNb(stats.entrants)}</b> répondus</span>
            <span><b style={{ color: '#fff' }}>{fmtNb(stats.manques)}</b> manqués</span>
          </div>
        </div>
      </div>

      {/* Les quatre satellites */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gridTemplateRows: 'repeat(2,minmax(0,1fr))', gap: 14 }}>
        {tuiles.map(t => (
          <div key={t.cle} style={{ background: '#fff', border: '1px solid #e8edf4', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 77 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#94a3b8' }}>{t.label}</div>
              {t.delta}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
              <div>
                <div style={{ fontSize: 23, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{t.valeur}</div>
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>{t.sous}</div>
              </div>
              {t.courbe && t.courbe.length > 2 && <Sparkline valeurs={t.courbe} couleur={t.couleur} largeur={72} hauteur={28} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Tuile({ label, valeur, sous, couleur }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8edf4', borderTop: `3px solid ${couleur}`, padding: '13px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{valeur}</div>
      {sous && <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>{sous}</div>}
    </div>
  )
}

/* ── Carte de section ── */
const Carte = ({ titre, aide, extra, children }) => (
  <section style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8edf4', padding: '18px 20px 20px', marginBottom: 16 }}>
    <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
      <span style={{ width: 3, alignSelf: 'stretch', minHeight: 26, borderRadius: 2, background: COULEURS.entrant, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 800, color: NAVY, margin: 0, letterSpacing: '-0.01em' }}>{titre}</h2>
        {aide && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3, lineHeight: 1.45 }}>{aide}</div>}
      </div>
      {extra}
    </header>
    {children}
  </section>
)

/* ── Onglet Statistiques ── */
function Stats({ stats, postes, edition, setEdition, renommer, joursPeriode }) {
  const aNommer = postes.filter(p => p.categorie === 'inconnu')
  const maxPoste = Math.max(1, ...stats.postes.map(p => p.total))
  const libelleCompare = joursPeriode ? `vs ${joursPeriode} jours précédents` : null

  return (
    <>
      <ChiffresCles stats={stats} />
      {libelleCompare && (
        <div style={{ fontSize: 11, color: '#94a3b8', margin: '-8px 0 16px 2px' }}>
          Les évolutions comparent la période affichée aux {joursPeriode} jours qui la précèdent.
        </div>
      )}

      {aNommer.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 12.5, color: '#92400e', display: 'flex', gap: 10 }}>
          <i className="ti ti-help-circle" style={{ fontSize: 17, marginTop: 1, flexShrink: 0 }} />
          <div>
            <b>{aNommer.length} poste{aNommer.length > 1 ? 's' : ''} sans nom</b> — {aNommer.map(p => p.extension).join(', ')}.
            Nommez-les plus bas ; un poste qui appartient à quelqu'un se renseigne plutôt dans
            Paramètres → fiche du collaborateur → « Poste 3CX ».
          </div>
        </div>
      )}

      <Carte titre="Activité jour par jour" aide="Les trois séries s'excluent : leur somme est le total d'appels de la journée."
        extra={<Legende />}>
        <BarresEmpilees donnees={stats.jours} hauteur={190} />
      </Carte>

      <Carte titre="Quand le téléphone sonne"
        aide="Appels entrants par jour de semaine et par heure. C'est la carte qui sert à décider des présences.">
        <CarteChaleur grille={stats.grille} heures={stats.heuresCarte} max={stats.pic} />
      </Carte>

      <Carte titre="Par poste" aide="Un poste de service se renomme en cliquant sur son libellé.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(282px,1fr))', gap: 12 }}>
          {stats.postes.map((p, i) => (
            <CartePoste key={p.extension || i} p={p} maxPoste={maxPoste} postes={postes}
              edition={edition} setEdition={setEdition} renommer={renommer} />
          ))}
        </div>
      </Carte>

      {stats.topNumeros.length > 0 && (
        <Carte titre="Numéros qui reviennent" aide="Les numéros vus plusieurs fois sur la période — rappels en attente, ou dossiers qui s'éternisent.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {stats.topNumeros.map((n, i) => (
              <div key={n.numero} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 9, background: i % 2 ? '#fbfcfe' : '#fff' }}>
                <span style={{ width: 21, height: 21, borderRadius: 6, background: i < 3 ? COULEURS.entrant : '#eef2f7', color: i < 3 ? '#fff' : '#94a3b8', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, color: '#1e293b', fontVariantNumeric: 'tabular-nums', minWidth: 118 }}>{n.numero}</span>
                <span style={{ flex: 1, fontSize: 12.5, color: n.contact ? '#1e293b' : '#cbd5e1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.contact || 'Inconnu'}{n.dossier && <span style={{ color: '#94a3b8', fontSize: 11 }}> · {n.dossier}</span>}
                </span>
                {n.manque > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: COULEURS.manque, background: '#fef2f2', borderRadius: 6, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                    <i className="ti ti-phone-off" style={{ marginRight: 3 }} />{n.manque} manqué{n.manque > 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', minWidth: 26, textAlign: 'right' }}>{fmtNb(n.n)}</span>
              </div>
            ))}
          </div>
        </Carte>
      )}
    </>
  )
}

/* ── Une carte par poste ── */
function CartePoste({ p, maxPoste, postes, edition, setEdition, renommer }) {
  const estService = !p.collaborateur && p.extension
  const enEdition = edition?.extension === p.extension
  const initiales = (p.collaborateur || p.qui || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map(m => m[0]).join('').toUpperCase()
  const entrantsTotal = p.entrant + p.manque
  const segments = [
    { v: p.entrant, c: COULEURS.entrant },
    { v: p.sortant, c: COULEURS.sortant },
    { v: p.manque,  c: COULEURS.manque },
  ].filter(x => x.v > 0)

  return (
    <div style={{ border: '1px solid #e8edf4', borderRadius: 13, padding: '13px 15px', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
        <span style={{
          width: 33, height: 33, borderRadius: 9, flexShrink: 0,
          background: estService ? '#f1f5f9' : '#e8f1fd', color: estService ? '#64748b' : '#1c5cab',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800,
        }}>
          {estService ? (p.extension || '?') : initiales}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {enEdition ? (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <input autoFocus value={edition.libelle} onChange={e => setEdition({ ...edition, libelle: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') renommer(); if (e.key === 'Escape') setEdition(null) }}
                style={{ flex: 1, minWidth: 0, padding: '4px 7px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5, fontFamily: 'inherit' }} />
              <select value={edition.categorie} onChange={e => setEdition({ ...edition, categorie: e.target.value })}
                style={{ padding: '4px 4px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 10.5, fontFamily: 'inherit', maxWidth: 82 }}>
                <option value="service">Service</option>
                <option value="file">File</option>
                <option value="svi">Vocal</option>
                <option value="hors_horaires">Hors horaires</option>
                <option value="inconnu">À nommer</option>
              </select>
              <button onClick={renommer} style={{ padding: '4px 8px', border: 'none', borderRadius: 6, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>OK</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {estService ? (
                  <button onClick={() => { const po = postes.find(x => x.extension === p.extension); setEdition({ extension: p.extension, libelle: po?.libelle || '', categorie: po?.categorie || 'service' }) }}
                    style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: p.categorie === 'inconnu' ? '#b45309' : '#0f172a', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                    {p.qui}
                  </button>
                ) : p.qui}
              </div>
              <div style={{ fontSize: 10.5, color: '#94a3b8' }}>Poste {p.extension || '—'}</div>
            </>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{fmtNb(p.total)}</div>
          <div style={{ fontSize: 9.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>appels</div>
        </div>
      </div>

      {/* Part de chaque sens, à l'échelle du poste le plus actif */}
      <div style={{ display: 'flex', gap: 2, height: 7, marginBottom: 9, width: `${Math.max(14, (p.total / maxPoste) * 100)}%` }}>
        {segments.map((sg, k) => (
          <div key={k} style={{ flex: sg.v, background: sg.c, borderRadius: 4 }} />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <Mini label="Décroché" valeur={entrantsTotal ? fmtPct(p.entrant, entrantsTotal) : '—'}
          alerte={p.decroche != null && p.decroche < 0.8} />
        <Mini label="En ligne" valeur={fmtDuree(p.secondes)} />
        <Mini label="Moyenne" valeur={p.repondus ? fmtDuree(Math.round(p.secondes / p.repondus)) : '—'} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 9, paddingTop: 8, borderTop: '1px solid #f1f5f9', fontSize: 10.5, color: '#64748b' }}>
        <span><b style={{ color: COULEURS.entrant }}>{fmtNb(p.entrant)}</b> entrants</span>
        <span><b style={{ color: COULEURS.sortant }}>{fmtNb(p.sortant)}</b> sortants</span>
        {p.manque > 0 && <span><b style={{ color: COULEURS.manque }}>{fmtNb(p.manque)}</b> manqués</span>}
        <span style={{ marginLeft: 'auto' }}>max {p.plusLong ? fmtDuree(p.plusLong) : '—'}</span>
      </div>
    </div>
  )
}

const Mini = ({ label, valeur, alerte }) => (
  <div style={{ background: alerte ? '#fef2f2' : '#f8fafc', borderRadius: 8, padding: '6px 8px' }}>
    <div style={{ fontSize: 9, fontWeight: 700, color: alerte ? '#b91c1c' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
    <div style={{ fontSize: 12, fontWeight: 700, color: alerte ? '#dc2626' : '#334155', marginTop: 2, whiteSpace: 'nowrap' }}>{valeur}</div>
  </div>
)

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
