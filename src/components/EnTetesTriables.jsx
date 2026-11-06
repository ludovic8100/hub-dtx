import { basculerTri } from '../lib/tri'
import { COUL } from '../lib/theme'

// Les en-têtes d'un tableau triable — un seul rendu pour tout le Hub.
//
// `cols` est la MÊME liste que celle qui sert à trier et à remplir les
// cellules : { cle, titre, val, type }. C'est ce qui évite le défaut classique
// d'un tableau dont l'en-tête et la cellule sont écrits à deux endroits, et
// qui finit par trier sur une colonne en affichant l'autre.
//
// La flèche est TOUJOURS présente, en gris pâle sur les colonnes inactives :
// sans elle, rien ne dit que les titres se cliquent.
export default function EnTetesTriables({ cols, tri, onTri, couleur = COUL.marine, style = {} }) {
  const base = {
    textAlign: 'left', padding: '9px 16px', fontSize: 10, fontWeight: 700,
    color: COUL.texteFaible, textTransform: 'uppercase', whiteSpace: 'nowrap',
    borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none',
    ...style,
  }
  return (
    <tr style={{ background: COUL.fond }}>
      {cols.map(col => {
        const actif = tri?.col === col.cle
        return (
          <th key={col.cle} onClick={() => onTri(basculerTri(tri, col.cle))}
            title={actif ? 'Inverser le tri' : `Trier sur « ${col.titre} »`}
            style={{ ...base, color: actif ? couleur : base.color }}>
            {col.titre}
            <span style={{ marginLeft: 5, opacity: actif ? 1 : .25 }}>{actif && tri.sens < 0 ? '▾' : '▴'}</span>
          </th>
        )
      })}
    </tr>
  )
}
