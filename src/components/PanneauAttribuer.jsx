import { voile } from '../lib/voile'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COUL } from '../lib/theme'

// Attribuer une facture d'achat à une destination.
//
// POURQUOI CE FICHIER EST PARTAGÉ
//
// Ludovic : « c'est un peu le désordre pour attribuer à un chantier ».
// Le désordre ne venait pas du panneau mais de son ENDROIT : il n'existait
// que dans l'écran Dossiers, alors que les factures d'achat se regardent
// depuis la comptabilité. Il fallait donc quitter l'écran où l'on voit la
// facture pour aller l'attribuer ailleurs.
//
// Un même geste à deux endroits, ce sont deux écrans qui divergent. D'où un
// seul composant, utilisé partout où une facture d'achat s'affiche.

const FONT = "'Source Sans Pro', sans-serif"
const OR = COUL.orange
const eur = v => v == null ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)
const fmtDate = d => {
  if (!d) return '—'
  const p = String(d).substring(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}
const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: FONT, background: COUL.surface, boxSizing: 'border-box' }

// Société → table de clients. Une société absente de cette table ne se voit
// PAS proposer « Client direct ».
//
// ⚠️ Sans ça, une facture DYNASSUR ou DTX se voyait proposer les clients de
// LODE — et l'attribution croisée se serait faite en silence, exactement
// comme le devis Dewez rattaché au chantier Detilloux. Ce panneau est partagé
// par toutes les sociétés depuis qu'il sert aussi la comptabilité.
const TABLE_TIERS = { LODE: 'lode_clients' }

export default function PanneauAttribuer({ facture, dossiers, onClose, onChoisir }) {
  const tableTiers = TABLE_TIERS[facture.societe]
  // ⚠️ Le type ouvert au départ dépend de CE QUI EXISTE, pas d'une valeur en
  // dur. Sans chantier, « dossier » n'est plus proposé (voir TYPES) ; et
  // `TABLE_TIERS` ne connaît que LODE, donc « tiers » n'est pas un repli
  // universel non plus. Ouvrir sur un onglet invisible donnerait une fenêtre
  // avec une zone de recherche qui ne trouve jamais rien — exactement ce que
  // Ludovic a vu chez Dynassur le 14/11.
  const [type, setType] = useState(
    dossiers.length ? 'dossier' : (TABLE_TIERS[facture.societe] ? 'tiers' : null))
  const [q, setQ] = useState('')
  const [tiers, setTiers] = useState([])
  const [chargeTiers, setChargeTiers] = useState(false)

  // Les tiers ne se chargent que si on en demande : une liste de clients
  // qu'on n'ouvrira jamais n'a pas à coûter une requête à chaque ouverture.
  useEffect(() => {
    if (type !== 'tiers' || !tableTiers) return
    let annule = false
    setChargeTiers(true)
    supabase.from(tableTiers).select('id,nom,prenom,denomination,ville').order('nom').limit(300)
      .then(({ data }) => { if (!annule) { setTiers(data || []); setChargeTiers(false) } })
    return () => { annule = true }
  }, [type, tableTiers])

  const nomTiers = (c) => c.denomination || [c.prenom, c.nom].filter(Boolean).join(' ') || '(sans nom)'
  const terme = q.trim().toLowerCase()

  const ouverts = dossiers.filter(d => d.statut !== 'clos')
  const listeDossiers = !terme ? ouverts : ouverts.filter(d =>
    `${d.numero || ''} ${d.titre || ''} ${d.client_nom || ''}`.toLowerCase().includes(terme))
  const listeTiers = !terme ? tiers : tiers.filter(c =>
    `${nomTiers(c)} ${c.ville || ''}`.toLowerCase().includes(terme))

  // ⚠️ « CHANTIER / DOSSIER » NE S'AFFICHE QUE LÀ OÙ DES CHANTIERS EXISTENT
  // (14/11/2026).
  //
  // Ce panneau vit dans `VueFactures`, donc dans `ComptabiliteView`, donc dans
  // la comptabilité des SIX sociétés. Chez Dynassur — un courtier en assurance
  // qui n'a ni chantiers ni onglet Dossiers — on proposait quand même
  // « Chantier / dossier », et on renvoyait vers « l'onglet Dossiers » qui
  // n'existe pas pour elle. Signalé par Ludovic, à juste titre.
  //
  // La condition est le CONTENU, pas un nom de société : le projet interdit la
  // règle métier en dur sur une entité. Aucun chantier → aucune raison de
  // proposer d'en choisir un. Et c'est auto-correctif : le jour où une société
  // ouvre des dossiers, l'option revient toute seule.
  //
  // (La liste est déjà filtrée par société côté requête — il n'y a donc jamais
  // eu de fuite des chantiers LODE vers une autre entité, seulement une option
  // qui ne menait nulle part.)
  //
  // 'bien' est accepté par la base mais la table n'existe pas encore : le
  // proposer donnerait un choix qui ne mène nulle part — même raison.
  const TYPES = [
    ...(dossiers.length ? [{ code: 'dossier', label: 'Chantier / dossier', icone: 'ti-folder', aide: 'Pour un client, un chantier identifié' }] : []),
    ...(tableTiers ? [{ code: 'tiers', label: 'Client direct', icone: 'ti-user', aide: 'Sans dossier ouvert' }] : []),
    { code: 'structure',   label: 'Structure',          icone: 'ti-building', aide: 'Loyer, énergie, téléphone, assurances' },
    { code: 'consommable', label: 'Consommable',        icone: 'ti-box',      aide: 'Visserie, petit matériel — jamais sur un chantier' },
  ]

  const choisirSimple = (t) => onChoisir({ destination_type: t.code, destination_id: null, destination_nom: t.label })
  const retirer = () => onChoisir({ destination_type: null, destination_id: null, destination_nom: null })

  return (
    <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: 'min(560px, 96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: COUL.texteFort }}>Cet achat, c&apos;est pour quoi&nbsp;?</div>
          <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 3 }}>
            {facture.fournisseur || 'fournisseur inconnu'} — <strong>{eur(facture.montant)}</strong> — {fmtDate(facture.date_facture)}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'grid', gap: 7 }}>
          {TYPES.map(t => {
            const actif = type === t.code
            const simple = t.code === 'structure' || t.code === 'consommable'
            return (
              <button key={t.code}
                onClick={() => simple ? choisirSimple(t) : (setType(t.code), setQ(''))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left',
                  padding: '9px 11px', borderRadius: 9, cursor: 'pointer', fontFamily: FONT,
                  border: `1px solid ${actif && !simple ? OR : '#e2e8f0'}`,
                  background: actif && !simple ? '#fff7ed' : COUL.surface,
                }}>
                <i className={`ti ${t.icone}`} style={{ fontSize: 17, color: actif && !simple ? OR : COUL.texteFaible }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: COUL.texteFort }}>{t.label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: COUL.texteFaible }}>{t.aide}</span>
                </span>
              </button>
            )
          })}
        </div>

        {(type === 'dossier' || type === 'tiers') && (
          <>
            <div style={{ padding: '11px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <input value={q} onChange={e => setQ(e.target.value)} autoFocus
                placeholder={type === 'dossier' ? 'Numéro, intervention, client…' : 'Nom du client…'}
                style={{ ...inp, width: '100%' }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 100 }}>
              {type === 'dossier' && listeDossiers.map(d => (
                <div key={d.id} onClick={() => onChoisir({
                    destination_type: 'dossier', destination_id: d.id,
                    destination_nom: `${d.numero ? d.numero + ' · ' : ''}${d.titre}`,
                  })}
                  style={{ padding: '11px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = COUL.fond }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COUL.texteFort }}>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, color: OR, marginRight: 8 }}>{d.numero}</span>
                    {d.titre}
                  </div>
                  <div style={{ fontSize: 11.5, color: COUL.texteFaible }}>{d.client_nom || 'sans client'}</div>
                </div>
              ))}
              {type === 'dossier' && listeDossiers.length === 0 && (
                <div style={{ padding: 28, textAlign: 'center', color: COUL.texteFaible, fontSize: 13 }}>
                  Aucun dossier ouvert ne correspond. Crée-le d&apos;abord dans l&apos;onglet Dossiers.
                </div>
              )}
              {type === 'tiers' && chargeTiers && <div style={{ padding: 28, textAlign: 'center', color: COUL.texteFaible, fontSize: 13 }}>Chargement…</div>}
              {type === 'tiers' && !chargeTiers && listeTiers.map(c => (
                <div key={c.id} onClick={() => onChoisir({ destination_type: 'tiers', destination_id: c.id, destination_nom: nomTiers(c) })}
                  style={{ padding: '11px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = COUL.fond }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COUL.texteFort }}>{nomTiers(c)}</div>
                  <div style={{ fontSize: 11.5, color: COUL.texteFaible }}>{c.ville || '—'}</div>
                </div>
              ))}
              {type === 'tiers' && !chargeTiers && listeTiers.length === 0 && (
                <div style={{ padding: 28, textAlign: 'center', color: COUL.texteFaible, fontSize: 13 }}>Aucun client ne correspond.</div>
              )}
            </div>
          </>
        )}

        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          {facture.destination_type
            ? <button onClick={retirer} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Retirer l&apos;attribution</button>
            : <span />}
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.texteDoux, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
