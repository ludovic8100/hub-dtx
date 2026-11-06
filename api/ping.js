// Fonction d'essai, JAMAIS fusionnee dans main.
//
// Elle existe le temps d'une preview, pour repondre a une seule question :
// le plan Pro a-t-il bien leve le plafond de 12 fonctions serverless ?
// 12 fonctions + celle-ci = 13. Sur le plan gratuit, le deploiement echoue.
//
// La preview ne touche pas la production : c'est exactement le genre de
// verification pour laquelle elle est faite.
export default function handler(req, res) {
  res.status(200).json({ ok: true, but: 'verifier le plafond des fonctions' })
}
