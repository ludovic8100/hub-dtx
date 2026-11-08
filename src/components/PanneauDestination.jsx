import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COUL } from '../lib/theme'

// Affecter une facture d'achat à une destination.
//
// LE PROBLÈME QU'IL RÈGLE
//
// Ludovic : « je ne savais plus à quelle facture ça appartenait ». Une facture
// Winsol arrive, elle est payée, elle est classée — et six mois plus tard
// personne ne sait pour quel chantier elle a été engagée. L'information
// existait au moment de l'achat et nulle part ensuite.
//
// DEUX AXES, PAS UN
//
// Ce panneau ne traite QUE la destination (pour qui la dépense a été faite).
// La refacturation (est-ce revendu, et où) est un autre axe, porté par
// refacture_statut — parce qu'un achat affecté à un chantier mais INCLUS dans
// un forfait ne doit jamais apparaître comme « à refacturer ».
//
// POURQUOI CERTAINS TYPES NE S'AFFICHENT PAS
//
// 'bien' est accepté par la base mais la table `biens` n'existe pas encore :
// l'offrir ici donnerait un choix qui ne mène nulle part. 'tiers' n'apparaît
// que pour les sociétés qui ont une table de clients. Mieux vaut trois choix
// qui marchent que cinq dont deux mentent.

const FONT = "'Source Sans Pro', sans-serif"
const fmt = (v) => v === null || v === undefined ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

// Société → table de tiers. Absente = le type « tiers » n'est pas proposé.
const TABLE_TIERS = { LODE: 'lode_clients' }

const TYPES = [
  { code: 'dossier',     label: 'Chantier / dossier', icone: 'ti-folder',      aide: 'Pour un client, un chantier identifié' },
  { code: 'tiers',       label: 'Client direct',      icone: 'ti-user',        aide: 'Sans dossier ouvert' },
  { code: 'structure',   label: 'Structure',          icone: 'ti-building',    aide: 'Frais de la société : loyer, énergie, assurances' },
  { code: 'consommable', label: 'Consommable',        icone: 'ti-box',         aide: 'Visserie, petit matériel — jamais affecté à un chantier' },
]

export default function PanneauDestination({ facture, color, onClose, onEnregistre }) {
  const [type, setType] = useState(facture.destination_type || null)
  const [recherche, setRecherche] = useState('')
  const [liste, setListe] = useState([])
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  const tableTiers = TABLE_TIERS[facture.societe]
  const types = TYPES.filter(t => t.code !== 'tiers' || tableTiers)

  // Charge la liste correspondant au type choisi (dossiers ouverts, ou tiers).
  useEffect(() => {
    if (type !== 'dossier' && type !== 'tiers') { setListe([]); return }
    let annule = false
    setChargement(true)
    ;(async () => {
      if (type === 'dossier') {
        const { data } = await supabase.from('dossiers')
          .select('id,numero,titre,client_nom,statut,ville')
          .eq('societe', facture.societe).neq('statut', 'clos')
          .order('created_at', { ascending: false }).limit(300)
        if (!annule) setListe(data || [])
      } else {
        const { data } = await supabase.from(tableTiers)
          .select('id,nom,prenom,denomination,ville')
          .order('nom').limit(500)
        if (!annule) setListe(data || [])
      }
      if (!annule) setChargement(false)
    })()
    return () => { annule = true }
  }, [type, facture.societe])

  // Écrit la destination. destination_id reste null pour structure et
  // consommable : ces deux-là ne désignent pas un objet, et un CHECK en base
  // refuse qu'on leur en donne un.
  async function enregistrer(destType, destId, destNom) {
    setOccupe(true); setErreur('')
    const patch = {
      destination_type: destType,
      destination_id: destId || null,
      destination_nom: destNom || null,
    }
    const { error } = await supabase.from('factures_achat').update(patch).eq('fichier_id', facture.fichier_id)
    setOccupe(false)
    if (error) { setErreur(error.message); return }
    onEnregistre(patch)
    onClose()
  }

  async function effacer() {
    setOccupe(true); setErreur('')
    const patch = { destination_type: null, destination_id: null, destination_nom: null }
    const { error } = await supabase.from('factures_achat').update(patch).eq('fichier_id', facture.fichier_id)
    setOccupe(false)
    if (error) { setErreur(error.message); return }
    onEnregistre(patch); onClose()
  }

  // Crée un dossier depuis le texte de recherche. Le numéro vient de
  // prochain_numero() : atomique, donc deux personnes qui créent en même temps
  // n'obtiennent pas le même numéro.
  async function creerDossier() {
    const titre = recherche.trim()
    if (!titre) return
    setOccupe(true); setErreur('')
    const { data: numero, error: eNum } = await supabase.rpc('prochain_numero', {
      p_type: 'dossier', p_societe: facture.societe, p_prefixe: 'DOS',
    })
    if (eNum) { setErreur(eNum.message); setOccupe(false); return }
    const { data, error } = await supabase.from('dossiers')
      .insert({ societe: facture.societe, numero, titre, type: 'chantier' })
      .select('id,numero,titre').single()
    setOccupe(false)
    if (error) { setErreur(error.message); return }
    await enregistrer('dossier', data.id, `${data.numero} · ${data.titre}`)
  }

  const q = recherche.trim().toLowerCase()
  const filtree = !q ? liste : liste.filter(o => {
    const texte = type === 'dossier'
      ? `${o.numero || ''} ${o.titre || ''} ${o.client_nom || ''} ${o.ville || ''}`
      : `${o.denomination || ''} ${o.nom || ''} ${o.prenom || ''} ${o.ville || ''}`
    return texte.toLowerCase().includes(q)
  })

  const nomTiers = (o) => o.denomination || [o.prenom, o.nom].filter(Boolean).join(' ') || '(sans nom)'

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: '14px', width: 'min(560px, 96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: COUL.texteFort }}>Cette dépense, c&apos;est pour qui&nbsp;?</div>
          <div style={{ fontSize: '12.5px', color: COUL.texteDoux, marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(facture.nom || '').replace(/\.pdf$/i, '')} — <strong>{fmt(facture.montant)}</strong>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'grid', gap: '8px' }}>
          {types.map(t => {
            const actif = type === t.code
            return (
              <button key={t.code} disabled={occupe}
                onClick={() => (t.code === 'dossier' || t.code === 'tiers') ? (setType(t.code), setRecherche('')) : enregistrer(t.code, null, t.label)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '11px', width: '100%', textAlign: 'left',
                  padding: '10px 12px', borderRadius: '9px', cursor: occupe ? 'default' : 'pointer',
                  border: `1px solid ${actif ? color : '#e2e8f0'}`,
                  background: actif ? '#eff6ff' : COUL.surface, fontFamily: FONT,
                }}>
                <i className={`ti ${t.icone}`} style={{ fontSize: '18px', color: actif ? color : COUL.texteFaible }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13.5px', fontWeight: '700', color: COUL.texteFort }}>{t.label}</span>
                  <span style={{ display: 'block', fontSize: '11.5px', color: COUL.texteFaible }}>{t.aide}</span>
                </span>
              </button>
            )
          })}
        </div>

        {(type === 'dossier' || type === 'tiers') && (
          <>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <input value={recherche} onChange={e => setRecherche(e.target.value)} autoFocus
                placeholder={type === 'dossier' ? 'Nom du chantier, client, numéro…' : 'Nom du client…'}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box' }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: '90px' }}>
              {chargement && <div style={{ padding: '30px', textAlign: 'center', color: COUL.texteFaible, fontSize: '13px' }}>Chargement…</div>}
              {!chargement && filtree.length === 0 && (
                <div style={{ padding: '26px 20px', textAlign: 'center', color: COUL.texteFaible, fontSize: '13px' }}>
                  {type === 'dossier' ? 'Aucun dossier ouvert ne correspond.' : 'Aucun client ne correspond.'}
                </div>
              )}
              {!chargement && filtree.map(o => (
                <div key={o.id} onClick={() => occupe ? null : enregistrer(
                  type,
                  o.id,
                  type === 'dossier' ? `${o.numero ? o.numero + ' · ' : ''}${o.titre}` : nomTiers(o),
                )}
                  style={{ padding: '10px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = COUL.fond }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: COUL.texteFort }}>
                    {type === 'dossier' ? `${o.numero ? o.numero + ' · ' : ''}${o.titre}` : nomTiers(o)}
                  </div>
                  <div style={{ fontSize: '11.5px', color: COUL.texteFaible }}>
                    {type === 'dossier' ? [o.client_nom, o.ville].filter(Boolean).join(' · ') || 'sans client' : (o.ville || '')}
                  </div>
                </div>
              ))}
            </div>
            {type === 'dossier' && recherche.trim() && (
              <div style={{ padding: '10px 20px', borderTop: '1px solid #f1f5f9' }}>
                <button onClick={creerDossier} disabled={occupe}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: color, color: COUL.blanc, fontSize: '13.5px', fontWeight: '700', cursor: occupe ? 'default' : 'pointer', fontFamily: FONT }}>
                  <i className="ti ti-plus" style={{ marginRight: '6px' }} />
                  Créer le dossier « {recherche.trim()} »
                </button>
              </div>
            )}
          </>
        )}

        {erreur && (
          <div style={{ padding: '10px 20px', fontSize: '12.5px', color: COUL.dangerFonce, background: COUL.dangerFondDoux, borderTop: '1px solid #f1f5f9' }}>{erreur}</div>
        )}

        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          {facture.destination_type
            ? <button onClick={effacer} disabled={occupe} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.danger, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: FONT }}>Retirer l&apos;affectation</button>
            : <span />}
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.texteDoux, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: FONT }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
