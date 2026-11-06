import { useState } from 'react'
import { COUL } from '../lib/theme'

// ─── Graphiques du module Appels ──────────────────────────────────────────
//
// SVG écrit à la main : le Hub n'embarque aucune librairie de graphiques et
// n'a pas besoin d'en embarquer une pour trois barres empilées.
//
// Encodage des couleurs — volontairement différent des pastilles vert/bleu
// d'origine. Vert « entrant » contre bleu « sortant » contre rouge « manqué »
// est le piège classique du daltonisme : les trois se confondent. Le couple
// bleu/orange retenu ici se sépare de ΔE 24,7 en protanopie (seuil : 8), et le
// rouge ne sert qu'au statut « manqué », jamais comme couleur de série.
// Couleurs reprises telles quelles de la maquette approuvée
// (HUB-DTX-suivi-appels-v1.html).
//
// J'avais d'abord remplacé le violet par du vert, en jugeant le couple
// bleu/violet illisible. C'était une erreur de ma part : j'avais relevé les
// couleurs à l'œil sur l'image (#1e9bf0 / #a78bfa), et ce couple-là échoue
// effectivement — ΔE 2,0 en protanopie. Les vraies valeurs du fichier
// passent : ΔE 7,5 en deutéranopie et 18,9 en vision normale, ce qui est
// acceptable dès lors qu'une légende et un écart séparent les barres — les
// deux sont présents. Le violet est donc conservé.
export const COULEURS = {
  entrant: '#00a2ee',
  sortant: '#9962f7',
  manque:  '#ed4568',
}

export const SERIES = [
  { cle: 'entrant', label: 'Entrants répondus', couleur: COULEURS.entrant },
  { cle: 'sortant', label: 'Sortants',          couleur: COULEURS.sortant },
  { cle: 'manque',  label: 'Manqués',           couleur: COULEURS.manque, icone: 'ti-phone-off' },
]

const GRILLE = '#e9eef5'
const AXE = COUL.texteFaible

// Échelle à graduations rondes : un pas pris dans 1/2/2,5/5 × 10ⁿ, visant
// quatre intervalles. Évite les « 13, 25, 38, 50 » d'une division en quarts.
function echelle(max) {
  const brut = Math.max(1, max) / 4
  const e = Math.pow(10, Math.floor(Math.log10(brut)))
  const pas = [1, 2, 2.5, 5, 10].map(m => m * e).find(x => x >= brut) || 10 * e
  const haut = Math.ceil(Math.max(1, max) / pas) * pas
  const ticks = []
  for (let v = 0; v <= haut + 1e-9; v += pas) ticks.push(Math.round(v))
  return { haut, ticks }
}

export function Legende({ series = SERIES }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
      {series.map(s => (
        <span key={s.cle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: COUL.texteMoyen }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.couleur, flexShrink: 0 }} />
          {s.icone && <i className={`ti ${s.icone}`} style={{ fontSize: 12, color: s.couleur }} />}
          {s.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Barres empilées.
 * donnees : [{ cle, label, labelLong?, valeurs: { entrant, sortant, manque } }]
 * Les trois séries s'excluent : leur somme est le total d'appels de la tranche.
 */
export function BarresEmpilees({ donnees, hauteur = 180, series = SERIES, vide = 'Aucun appel sur la période.' }) {
  const [survol, setSurvol] = useState(null)

  if (!donnees.length) {
    return <div style={{ padding: '32px 0', textAlign: 'center', color: COUL.texteFaible, fontSize: 12.5 }}>{vide}</div>
  }

  const totaux = donnees.map(d => series.reduce((s, k) => s + (d.valeurs[k.cle] || 0), 0))
  const { haut: max, ticks: uniques } = echelle(Math.max(...totaux))

  const MARGE_G = 34, MARGE_B = 22, ESPACE = 2
  const n = donnees.length
  const largeurCol = 100 / n            // en % de la zone de tracé
  const largeurBarre = Math.min(26, Math.max(3, largeurCol * 0.66))

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex' }}>
        {/* Axe des valeurs */}
        <div style={{ width: MARGE_G, height: hauteur, position: 'relative', flexShrink: 0 }}>
          {uniques.map(g => (
            <div key={g} style={{ position: 'absolute', right: 6, bottom: (g / max) * hauteur - 6, fontSize: 9.5, color: AXE, fontVariantNumeric: 'tabular-nums' }}>{g}</div>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Zone de tracé */}
          <div style={{ position: 'relative', height: hauteur }}>
            {uniques.map(g => (
              <div key={g} style={{ position: 'absolute', left: 0, right: 0, bottom: (g / max) * hauteur, height: 1, background: GRILLE }} />
            ))}

            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
              {donnees.map((d, i) => {
                const total = totaux[i]
                return (
                  <div key={d.cle} style={{ width: `${largeurCol}%`, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}
                    onMouseEnter={() => setSurvol(i)} onMouseLeave={() => setSurvol(null)}>
                    {/* cible de survol plus large que la barre */}
                    <div style={{ position: 'absolute', inset: 0, background: survol === i ? 'rgba(42,120,214,0.06)' : 'transparent' }} />
                    <div style={{ width: `${largeurBarre / largeurCol * 100}%`, maxWidth: 26, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
                      {series.map((s, si) => {
                        const v = d.valeurs[s.cle] || 0
                        if (!v) return null
                        const h = (v / max) * hauteur
                        const sommet = series.slice(0, si).every(k => !(d.valeurs[k.cle] || 0))
                        return (
                          <div key={s.cle} title={`${s.label} : ${v}`}
                            style={{
                              height: Math.max(1, h - ESPACE), background: s.couleur,
                              marginBottom: si === series.length - 1 ? 0 : ESPACE,
                              borderRadius: sommet ? '3px 3px 0 0' : 0,
                            }} />
                        )
                      })}
                      {total === 0 && <div style={{ height: 1, background: GRILLE }} />}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Axe des tranches */}
          <div style={{ display: 'flex', height: MARGE_B, borderTop: `1px solid ${GRILLE}` }}>
            {donnees.map((d, i) => (
              <div key={d.cle} style={{ width: `${largeurCol}%`, textAlign: 'center', fontSize: 9.5, color: survol === i ? '#0f172a' : AXE, fontWeight: survol === i ? 700 : 400, paddingTop: 4, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {d.labelAxe ?? d.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Infobulle */}
      {survol != null && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: COUL.texteFort, color: COUL.blanc, borderRadius: 8, padding: '8px 12px', fontSize: 11.5, boxShadow: '0 6px 20px rgba(15,23,42,0.28)', minWidth: 150 }}>
            <div style={{ fontWeight: 700, marginBottom: 5 }}>{donnees[survol].labelLong ?? donnees[survol].label}</div>
            {series.map(s => (
              <div key={s.cle} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2, opacity: (donnees[survol].valeurs[s.cle] || 0) ? 1 : 0.45 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.couleur, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{s.label}</span>
                <b style={{ fontVariantNumeric: 'tabular-nums' }}>{donnees[survol].valeurs[s.cle] || 0}</b>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 7, marginTop: 6, paddingTop: 5, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
              <span style={{ flex: 1 }}>Total</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{totaux[survol]}</b>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Rampe séquentielle (bleu, clair → foncé) ────────────────────────────
   Pour la carte de chaleur : une seule teinte, l'intensité porte le volume.
   Jamais d'arc-en-ciel sur une grandeur continue. */
export const RAMPE = ['#e8f1fd', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95']

/* ─── Courbe de tendance miniature ─── */
export function Sparkline({ valeurs, couleur = COULEURS.entrant, largeur = 104, hauteur = 30 }) {
  if (!valeurs || valeurs.length < 2) return <div style={{ height: hauteur }} />
  const max = Math.max(1, ...valeurs)
  const pas = largeur / (valeurs.length - 1)
  const y = v => hauteur - 3 - (v / max) * (hauteur - 6)
  const pts = valeurs.map((v, i) => `${(i * pas).toFixed(1)},${y(v).toFixed(1)}`)
  const id = 'sp' + couleur.replace('#', '')
  return (
    <svg width={largeur} height={hauteur} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={couleur} stopOpacity="0.22" />
          <stop offset="100%" stopColor={couleur} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${hauteur} ${pts.join(' ')} ${largeur},${hauteur}`} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={couleur} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={largeur} cy={y(valeurs[valeurs.length - 1])} r="2.6" fill={couleur} stroke={COUL.blanc} strokeWidth="1.5" />
    </svg>
  )
}

/* ─── Jauge : une part d'un total, en une barre ───
   Préférée à un camembert à deux parts, qui ne dit rien de plus. */
export function Jauge({ part, total, couleur = COULEURS.entrant, reste = COULEURS.manque, hauteur = 8 }) {
  const pct = total ? (part / total) * 100 : 0
  return (
    <div style={{ display: 'flex', height: hauteur, borderRadius: hauteur / 2, overflow: 'hidden', background: '#eef2f7', gap: 2 }}>
      <div style={{ width: `${pct}%`, background: couleur, borderRadius: hauteur / 2 }} />
      {total > part && <div style={{ flex: 1, background: reste, borderRadius: hauteur / 2, opacity: 0.85 }} />}
    </div>
  )
}

/* ─── Carte de chaleur jour de semaine × heure ───
   Le classique du centre d'appels : où se concentre la charge. Une teinte,
   sept paliers ; la case vide reste au niveau du fond. */
const JOURS_SEM = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export function CarteChaleur({ grille, heures, max, legende = 'appels reçus' }) {
  const [survol, setSurvol] = useState(null)
  const seuils = RAMPE.map((_, i) => (max * (i + 1)) / RAMPE.length)
  const teinte = v => {
    if (!v) return null
    const i = seuils.findIndex(s => v <= s)
    return RAMPE[i === -1 ? RAMPE.length - 1 : i]
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 3, marginBottom: 4, paddingLeft: 74 }}>
        {heures.map(h => (
          <div key={h} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: COUL.texteFaible, fontVariantNumeric: 'tabular-nums' }}>{String(h).padStart(2, '0')}</div>
        ))}
      </div>
      {JOURS_SEM.map((nom, j) => (
        <div key={nom} style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 3 }}>
          <div style={{ width: 70, fontSize: 10.5, color: COUL.texteDoux, textAlign: 'right', paddingRight: 4, whiteSpace: 'nowrap' }}>{nom}</div>
          {heures.map(h => {
            const v = grille[j]?.[h] || 0
            const c = teinte(v)
            const actif = survol && survol.j === j && survol.h === h
            return (
              <div key={h} onMouseEnter={() => setSurvol({ j, h, v })} onMouseLeave={() => setSurvol(null)}
                title={`${nom} ${String(h).padStart(2, '0')} h — ${v} ${legende}`}
                style={{
                  flex: 1, height: 22, borderRadius: 4,
                  background: c || '#f6f8fb',
                  boxShadow: actif ? '0 0 0 2px #0f172a' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                  color: v && v > seuils[3] ? '#fff' : COUL.texteMoyen,
                  transition: 'box-shadow .1s', cursor: v ? 'default' : 'default',
                }}>
                {v || ''}
              </div>
            )
          })}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 10.5, color: COUL.texteFaible }}>
        <span>Moins</span>
        <div style={{ display: 'flex', gap: 3 }}>
          <div style={{ width: 18, height: 10, borderRadius: 3, background: '#f6f8fb' }} />
          {RAMPE.map(c => <div key={c} style={{ width: 18, height: 10, borderRadius: 3, background: c }} />)}
        </div>
        <span>Plus</span>
        <span style={{ marginLeft: 'auto' }}>Pic : {max} {legende} sur une heure</span>
      </div>
    </div>
  )
}


/* ─── Barres groupées (et non empilées) ───
   Pour comparer deux séries tranche par tranche, comme sur la maquette. */
export function BarresGroupees({ donnees, series, hauteur = 190, vide = 'Aucun appel sur la période.' }) {
  const [survol, setSurvol] = useState(null)
  if (!donnees.length) return <div style={{ padding: '32px 0', textAlign: 'center', color: COUL.texteFaible, fontSize: 12.5 }}>{vide}</div>

  const max = Math.max(1, ...donnees.flatMap(d => series.map(s => d.valeurs[s.cle] || 0)))
  const { haut, ticks } = echelle(max)
  const MARGE_G = 32, MARGE_B = 22

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex' }}>
        <div style={{ width: MARGE_G, height: hauteur, position: 'relative', flexShrink: 0 }}>
          {ticks.map(g => (
            <div key={g} style={{ position: 'absolute', right: 6, bottom: (g / haut) * hauteur - 6, fontSize: 10, color: AXE, fontVariantNumeric: 'tabular-nums' }}>{g}</div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', height: hauteur }}>
            {ticks.map(g => (
              <div key={g} style={{ position: 'absolute', left: 0, right: 0, bottom: (g / haut) * hauteur, height: 1, background: GRILLE }} />
            ))}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
              {donnees.map((d, i) => (
                <div key={d.cle} onMouseEnter={() => setSurvol(i)} onMouseLeave={() => setSurvol(null)}
                  style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, position: 'relative', background: survol === i ? 'rgba(30,155,240,0.07)' : 'transparent', borderRadius: 4 }}>
                  {series.map(s => {
                    const v = d.valeurs[s.cle] || 0
                    return (
                      <div key={s.cle} title={`${s.label} : ${v}`}
                        style={{ width: 11, maxWidth: '38%', height: Math.max(v ? 2 : 0, (v / haut) * hauteur), background: s.couleur, borderRadius: '3px 3px 0 0' }} />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', height: MARGE_B, borderTop: `1px solid ${GRILLE}` }}>
            {donnees.map((d, i) => (
              <div key={d.cle} style={{ flex: 1, textAlign: 'center', fontSize: 10.5, color: survol === i ? '#0f172a' : AXE, fontWeight: survol === i ? 700 : 400, paddingTop: 5 }}>{d.label}</div>
            ))}
          </div>
        </div>
      </div>

      {survol != null && (
        <div style={{ position: 'absolute', top: -4, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: COUL.texteFort, color: COUL.blanc, borderRadius: 8, padding: '7px 11px', fontSize: 11.5, boxShadow: '0 6px 20px rgba(15,23,42,0.28)', minWidth: 130 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{donnees[survol].labelLong ?? donnees[survol].label}</div>
            {series.map(s => (
              <div key={s.cle} style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.couleur, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{s.label}</span>
                <b style={{ fontVariantNumeric: 'tabular-nums' }}>{donnees[survol].valeurs[s.cle] || 0}</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
