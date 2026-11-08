// Voile d'un panneau modal : fermeture au clic « à côté ».
//
// Le piège corrigé ici : écrire onClick={onClose} sur le voile ferme le
// panneau dès qu'on RELÂCHE la souris dessus — donc quand on sélectionne du
// texte dans le panneau et que le geste déborde. Le panneau se refermait au
// milieu d'une sélection de montant ou de titre.
//
// On exige donc que l'appui ET le relâchement aient eu lieu sur le voile.
// L'état est au niveau du module et non dans un useRef : les évènements
// souris sont sérialisés, il n'y a jamais deux appuis en cours à la fois,
// et ça évite d'ajouter un hook dans quinze composants.
let depart = null

export const voile = onClose => ({
  onMouseDown: e => { depart = e.target === e.currentTarget ? e.currentTarget : null },
  onClick: e => {
    const dehors = depart === e.currentTarget && e.target === e.currentTarget
    depart = null
    if (dehors) onClose?.()
  },
})
