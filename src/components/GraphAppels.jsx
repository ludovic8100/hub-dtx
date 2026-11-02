import { useState } from 'react'

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
export const COULEURS = {
  entrant: '#2a78d6',
  sortant: '#eb6834',
  manque:  '#d03b3b',
}

export const SERIES = [
  { cle: 'entrant', label: 'Entrants répondus', couleur: COULEURS.entrant },
  { cle: 'sortant', label: 'Sortants',          couleur: COULEURS.sortant },
  { cle: 'manque',  label: 'Manqués',           couleur: COULEURS.manque, icone: 'ti-phone-off' },
]

const GRILLE = '#e9eef5'
const AXE = '#94a3b8'

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
        <span key={s.cle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#475569' }}>
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
    return <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>{vide}</div>
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
          <div style={{ background: '#0f172a', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, boxShadow: '0 6px 20px rgba(15,23,42,0.28)', minWidth: 150 }}>
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
