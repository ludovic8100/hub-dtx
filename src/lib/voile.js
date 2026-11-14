// Voile d'un panneau modal : fermeture au clic « à côté », et DÉPLACEMENT
// du panneau au glisser.
//
// ── La fermeture ──────────────────────────────────────────────────────────
//
// Le piège corrigé ici : écrire onClick={onClose} sur le voile ferme le
// panneau dès qu'on RELÂCHE la souris dessus — donc quand on sélectionne du
// texte dans le panneau et que le geste déborde. Le panneau se refermait au
// milieu d'une sélection de montant ou de titre.
//
// On exige donc que l'appui ET le relâchement aient eu lieu sur le voile.
//
// ── Le déplacement (ajouté le 14/11/2026) ─────────────────────────────────
//
// Demandé par Ludovic : « dans le Hub, on doit pouvoir déplacer toutes les
// fenêtres qui s'ouvrent ». Il y en a trente-neuf, dans vingt-quatre
// fichiers.
//
// ⚠️ POURQUOI ICI ET PAS DANS CHAQUE FENÊTRE. Trente-neuf copies d'un
// glisser-déposer, ce sont trente-neuf occasions de diverger : ici le champ
// de saisie se met à traîner la fenêtre, là on la perd hors de l'écran, et
// personne ne saura laquelle se comporte bien. Le voile est déjà l'élément
// commun à toutes — c'est donc lui qui porte le geste, et il déplace son
// propre enfant.
//
// Le panneau est déplacé par une TRANSFORMATION, écrite directement sur
// l'élément. C'est l'un des rares endroits où toucher au DOM se justifie :
// il s'agit d'un effet visuel qui ne survit pas à la fermeture, et le faire
// passer par l'état de React obligerait à poser un hook dans les
// vingt-quatre composants — précisément ce qu'on évite.
//
// Quatre pièges, et ce qui les évite :
//
// 1. ⚠️ ON NE DÉPLACE PAS DEPUIS UN CHAMP. Sans ça, sélectionner du texte
//    dans une zone de saisie, cocher une case ou faire défiler une liste
//    traînerait la fenêtre. Les éléments interactifs sont exclus.
//
// 2. ⚠️ ON NE PEUT PAS PERDRE LA FENÊTRE HORS DE L'ÉCRAN. Sans borne, un
//    geste trop ample la pousse dehors et il n'existe plus aucun moyen de la
//    ramener : il faut recharger la page. On garde toujours une bande
//    visible.
//
// 3. ⚠️ PAS SUR UN PETIT ÉCRAN. Les panneaux y prennent toute la largeur et
//    remontent du bas ; les déplacer n'aurait aucun sens et casserait la
//    disposition.
//
// 4. Un glisser n'est pas un clic. Au-delà de quelques pixels, le
//    relâchement ne doit pas être compris comme « clic à côté » et fermer la
//    fenêtre qu'on vient de déplacer.

// L'état est au niveau du module et non dans un useRef : les évènements de
// pointeur sont sérialisés, il n'y a jamais deux gestes en cours à la fois,
// et ça évite d'ajouter un hook dans vingt-quatre composants.
let depart = null       // le voile où l'appui a commencé, pour la fermeture
let glisse = null       // { panneau, x0, y0, dx, dy, bouge }

const INTERACTIF = 'input, textarea, select, button, a, label, [contenteditable], [role="button"]'
const MARGE = 48        // ce qui reste visible au minimum, en pixels
const SEUIL = 4         // en deçà, c'est un clic et non un glisser

const petitEcran = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches

/** Le décalage déjà appliqué à un élément, lu sur sa transformation. */
const decalageActuel = (el) => {
  const m = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(el.style.transform || '')
  return m ? { dx: parseFloat(m[1]), dy: parseFloat(m[2]) } : { dx: 0, dy: 0 }
}

/** Borne le décalage pour qu'il reste toujours de quoi rattraper la fenêtre. */
const borner = (el, dx, dy) => {
  const r = el.getBoundingClientRect()
  const act = decalageActuel(el)
  const gauche = r.left - act.dx, haut = r.top - act.dy
  return {
    dx: Math.min(window.innerWidth - gauche - MARGE, Math.max(-(gauche + r.width - MARGE), dx)),
    dy: Math.min(window.innerHeight - haut - MARGE, Math.max(-(haut + r.height - MARGE), dy)),
  }
}

export const voile = onClose => ({
  onMouseDown: e => { depart = e.target === e.currentTarget ? e.currentTarget : null },

  onPointerDown: e => {
    if (e.button !== 0 || petitEcran()) return
    // Le geste part du voile lui-même : c'est une fermeture, pas un
    // déplacement.
    if (e.target === e.currentTarget) return
    if (e.target.closest?.(INTERACTIF)) return
    // Un geste qui commence alors qu'un texte est sélectionné reprend cette
    // sélection ; il n'appartient pas à la fenêtre.
    const sel = window.getSelection?.()
    if (sel && String(sel).trim()) return

    // L'enfant direct du voile qui contient le point touché : c'est le
    // panneau, quelle que soit sa profondeur d'imbrication.
    let panneau = e.target
    while (panneau && panneau.parentElement !== e.currentTarget) panneau = panneau.parentElement
    if (!panneau) return

    const act = decalageActuel(panneau)
    glisse = { panneau, x0: e.clientX, y0: e.clientY, dx: act.dx, dy: act.dy, bouge: false }
    panneau.style.userSelect = 'none'
  },

  onPointerMove: e => {
    if (!glisse) return
    const dx = glisse.dx + e.clientX - glisse.x0
    const dy = glisse.dy + e.clientY - glisse.y0
    if (!glisse.bouge && Math.hypot(dx - glisse.dx, dy - glisse.dy) < SEUIL) return
    glisse.bouge = true
    const b = borner(glisse.panneau, dx, dy)
    glisse.panneau.style.transform = `translate(${b.dx}px, ${b.dy}px)`
  },

  onPointerUp: () => {
    if (!glisse) return
    glisse.panneau.style.userSelect = ''
    // ⚠️ UN GLISSER N'EST PAS UN CLIC, et il faut le dire à TOUT LE MONDE.
    //
    // Annuler `depart` suffit pour la fermeture gérée par ce helper. Mais
    // seize fenêtres portent encore leur propre onClick={onClose} sur le
    // voile, écrit avant lui : sans précaution, déplacer l'une d'elles et
    // relâcher au-dessus du voile la refermerait aussitôt — on perdrait sa
    // saisie en la rangeant.
    //
    // On avale donc le clic qui suit immédiatement un déplacement, à la
    // phase de capture, avant qu'il n'atteigne aucun gestionnaire. C'est le
    // seul moyen de couvrir des gestionnaires qu'on ne contrôle pas.
    if (glisse.bouge) {
      depart = null
      const avaler = (ev) => { ev.stopPropagation(); ev.preventDefault() }
      window.addEventListener('click', avaler, { capture: true, once: true })
      // Filet : si aucun clic ne suit (geste annulé, fenêtre fermée), on
      // retire l'écouteur plutôt que de laisser un piège armé.
      setTimeout(() => window.removeEventListener('click', avaler, { capture: true }), 300)
    }
    glisse = null
  },

  onPointerCancel: () => {
    if (!glisse) return
    glisse.panneau.style.userSelect = ''
    glisse = null
  },

  onClick: e => {
    const dehors = depart === e.currentTarget && e.target === e.currentTarget
    depart = null
    if (dehors) onClose?.()
  },
})
