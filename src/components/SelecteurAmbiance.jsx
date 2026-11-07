import { useState, useRef, useEffect } from 'react'
import {
  AMBIANCES, CLES_AMBIANCE, appliquer, preferenceLue, preferenceEcrite,
  ambianceDuCalendrier,
} from '../lib/themes'

// Le choix d'ambiance, dans l'en-tête.
//
// DEUX RÈGLES, ET ELLES VIENNENT DU BRIEF
//
// 1. Standard par défaut. Le Hub est un outil de travail : il doit s'ouvrir
//    sur du calme, pas sur des citrouilles.
// 2. L'activation par calendrier est PROPOSÉE, jamais imposée. Tant que
//    « Suivre le calendrier » n'est pas coché, aucune date ne change quoi
//    que ce soit.
//
// CE QUE CE SÉLECTEUR N'EST PAS
//
// Ce n'est pas un contrôle d'accès. L'ambiance et la société affichée sont
// deux choses sans rapport : la société vient des droits de la session, et
// rien ici ne la touche. Le package le dit, et c'est la bonne règle.

const STYLE_BOUTON = {
  display: 'flex', alignItems: 'center', gap: 5,
  background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.7)', borderRadius: 6,
  padding: '4px 8px', fontSize: 12.5, cursor: 'pointer',
  fontFamily: "'Source Sans Pro', sans-serif", whiteSpace: 'nowrap',
}

export default function SelecteurAmbiance({ compact = false }) {
  const [pref, setPref] = useState(preferenceLue)
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const dehors = e => { if (ref.current && !ref.current.contains(e.target)) setOuvert(false) }
    document.addEventListener('mousedown', dehors)
    return () => document.removeEventListener('mousedown', dehors)
  }, [])

  // Une seule fonction écrit : elle applique, mémorise et met à jour l'état.
  // Trois chemins séparés auraient fini par diverger.
  const changer = (patch) => {
    const suivant = { ...pref, ...patch }
    if (suivant.auto) suivant.ambiance = ambianceDuCalendrier()
    setPref(suivant)
    preferenceEcrite(suivant)
    appliquer(suivant)
  }

  // Le calendrier ne reprend la main qu'au chargement, et seulement si
  // l'utilisateur l'a demandé. Pas de minuterie : une page ouverte toute la
  // nuit du 31 décembre ne doit pas changer de couleur sous les yeux de
  // quelqu'un qui travaille.
  useEffect(() => {
    if (!pref.auto) return
    const attendue = ambianceDuCalendrier()
    if (attendue !== pref.ambiance) changer({ ambiance: attendue })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const courante = AMBIANCES[pref.ambiance] || AMBIANCES.standard

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOuvert(o => !o)}
        title={`Ambiance : ${courante.label}${pref.auto ? ' (calendrier)' : ''}`}
        aria-haspopup="menu" aria-expanded={ouvert}
        style={STYLE_BOUTON}
      >
        <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{courante.symbole}</span>
        {!compact && courante.label}
      </button>

      {ouvert && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
          background: 'var(--hub-surface)', color: 'var(--hub-texte)',
          border: '1px solid var(--hub-bord)', borderRadius: 10,
          boxShadow: '0 12px 34px rgba(0,0,0,0.18)', padding: 6, minWidth: 212,
          fontFamily: "'Source Sans Pro', sans-serif",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--hub-texteFaible)', padding: '6px 10px 4px' }}>
            Ambiance
          </div>
          {CLES_AMBIANCE.map(cle => {
            const a = AMBIANCES[cle]
            const actif = pref.ambiance === cle
            return (
              <button key={cle} role="menuitem"
                onClick={() => changer({ ambiance: cle, auto: false })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  background: actif ? 'var(--hub-saisonDoux)' : 'transparent',
                  border: 'none', borderRadius: 7, padding: '8px 10px',
                  color: 'inherit', fontSize: 13, cursor: 'pointer', textAlign: 'left',
                  fontWeight: actif ? 600 : 400,
                }}>
                <span aria-hidden="true" style={{ width: 16, textAlign: 'center', color: 'var(--hub-saison)' }}>{a.symbole}</span>
                {a.label}
              </button>
            )
          })}

          <div style={{ height: 1, background: 'var(--hub-bord)', margin: '6px 4px' }} />

          {/* PAS DE BASCULE « MODE SOMBRE » ICI, ET C'EST UN CHOIX.
              Le mécanisme existe (themes.js porte les dix couples ambiance ×
              mode), mais 1 654 couleurs restent écrites en dur dans 71
              fichiers : en clair elles ne se voient pas, en sombre elles font
              des taches claires. Offrir le bouton, ce serait offrir un mode
              à moitié fini.
              Décision de Ludovic le 07/11 : « pas de mode sombre
              spécialement ». Le jour où les lots 2 et 3 sont faits, il suffit
              de remettre ces cinq lignes. */}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={pref.auto}
              onChange={e => changer({ auto: e.target.checked })} />
            Suivre le calendrier
          </label>

          <div style={{ fontSize: 11, color: 'var(--hub-texteFaible)', padding: '2px 10px 8px', lineHeight: 1.45 }}>
            {pref.auto
              ? `Le calendrier propose « ${AMBIANCES[ambianceDuCalendrier()].label} ».`
              : 'Décoché : aucune date ne change l’ambiance.'}
          </div>
        </div>
      )}
    </div>
  )
}
