import { COUL } from '../lib/theme'

/**
 * Légende des pastilles de la colonne FACTURE, posée dans le bandeau du module.
 *
 * POURQUOI. Sept états muets dans une colonne de 30 px : un document jaune, un
 * vert, une coche, une horloge, une croix, une case. Rien ne dit lequel appelle
 * une action. Ludovic, le 10/11 : « j'ai des icônes, mais ce serait bien
 * d'avoir une petite légende pour savoir ce que ça représente. »
 *
 * LE LIBELLÉ EST COURT, L'EXPLICATION EST AU SURVOL. Une légende qui prend
 * trois lignes n'est plus une légende, c'est un paragraphe — et personne ne
 * lit un paragraphe posé dans un en-tête. Deux mots suffisent à reconnaître ;
 * le `title` porte la phrase complète pour qui veut la lire.
 *
 * ⚠️ ELLE VIT SUR UN APLAT COLORÉ. Les pastilles gardent donc les couleurs
 * exactes du tableau — c'est tout l'intérêt d'une légende — mais le texte
 * autour prend `COUL.blanc`, qui est le jeton du texte sur fond coloré, et non
 * `COUL.surface` qui est un fond de carte. Les deux ne sont pas
 * interchangeables (voir CLAUDE.md).
 */

const ETATS = [
  { icone: 'ti ti-file-alert', fond: COUL.alerteFondDoux, trait: COUL.alerte, bord: '#fde68a',
    court: 'RCP manquant',
    long: "Relevé de compte producteur manquant — à réclamer à la compagnie" },
  { icone: 'ti ti-file-description', fond: COUL.succes, trait: COUL.blanc,
    court: 'RCP ok',
    long: "Relevé de compte producteur rattaché — cliquer pour ouvrir le PDF" },
  { texte: '✓', fond: COUL.succes, trait: COUL.blanc,
    court: 'FKT ok',
    long: "Facture liée — cliquer pour l'ouvrir. Un +N indique plusieurs factures sur le même mouvement" },
  { icone: 'ti ti-file-off', fond: COUL.tealFond, trait: COUL.teal, bord: '#99f6e4',
    court: 'Sans facture',
    long: "Sans facture nécessaire" },
  { icone: 'ti ti-clock', fond: COUL.fondDoux, trait: COUL.texteDoux, bord: '#e2e8f0',
    court: 'En attente',
    long: "En attente de facture" },
  { texte: '✕', fond: COUL.dangerFond, trait: COUL.danger,
    court: 'Aucune facture',
    long: "Aucune facture — cliquer pour en choisir une" },
  { texte: '☐', fond: 'transparent', trait: COUL.blanc, bord: 'rgba(255,255,255,0.55)',
    court: 'Sélection',
    long: "Sélectionner plusieurs mouvements pour les justifier avec une seule facture" },
]

export default function LegendeFactures() {
  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 14px',
        alignItems: 'center', justifyContent: 'flex-end',
        maxWidth: '520px',
      }}>
      {ETATS.map(e => (
        <span key={e.court} title={e.long}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'help' }}>
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
            background: e.fond, color: e.trait,
            border: e.bord ? `1px solid ${e.bord}` : 'none',
            fontSize: '12px', fontWeight: 700,
          }}>
            {e.icone ? <i className={e.icone} /> : e.texte}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: COUL.blanc, opacity: 0.92, whiteSpace: 'nowrap' }}>
            {e.court}
          </span>
        </span>
      ))}
    </div>
  )
}
