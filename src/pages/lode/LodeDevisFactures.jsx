import { voile } from '../../lib/voile'
import { n8nWebhook } from '../../config/env'
import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { chargerCommerciaux } from '../../lib/collaborateurs'
import { PEPPOL_ACTIF } from '../../lib/peppol'
import Layout from '../../components/Layout'
import { LODE, TVA_TAUX, CGV, DELAI_PAIEMENT_JOURS } from '../../lib/lodeConfig'
import { I18N, CGV_I18N, LANGUES } from '../../lib/lodeI18n'
import { StatBanner, TabsBar, StatusBadge, ActionButton, DataCard, PrimaryButton, useMobile } from '../../components/ui/AccountableUI'
import { extraireDevis } from '../../lib/devisExtraction'
import { COUL } from '../../lib/theme'
import { useLocation, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'

// Comment un client s'affiche dans une liste de résultats.
//
// ⚠️ CETTE FONCTION DOIT RESTER AU NIVEAU DU FICHIER.
//
// Elle était définie À L'INTÉRIEUR d'un composant, et ModalClient — qui est
// un AUTRE composant — l'appelait. Le code se lisait bien, la page se
// chargeait bien, et elle plantait sur « labelClient is not defined » au
// moment précis où la recherche de client renvoyait un résultat. Autrement
// dit : elle ne marchait que tant qu'on ne trouvait personne.
//
// Elle ne dépend que de son argument : aucune raison qu'elle vive dans la
// portée d'un composant.
function labelClient(c) {
  const nom = c.denomination || (((c.prenom || '') + ' ' + (c.nom || '')).trim()) || '(sans nom)'
  const icon = c.type === 'entreprise' ? '\u{1F3E2}' : '\u{1F464}'
  const sub = [c.dossier ? '#' + c.dossier : '', c.ville || c.localite || '', c.email || ''].filter(Boolean).join(' \u00B7 ')
  return { icon, nom, sub }
}

const ORANGE = LODE.couleur
const NAVY = COUL.texte

// ── Chargement dynamique de libs via CDN (PDF / Excel) ──────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

// Charge une image distante et la convertit en dataURL (pour jsPDF)
async function loadImageDataURL(url) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
  } catch { return null }
}

const eur = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
// Format euro pour jsPDF : séparateur de milliers = point, décimale = virgule (évite l'espace insécable mal rendu)
const eurPDF = n => {
  const v = (Number(n) || 0).toFixed(2)
  const [ent, dec] = v.split('.')
  const entSep = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  // espace insécable avant € pour éviter que le sigle passe à la ligne dans une cellule étroite
  return `${entSep},${dec}\u00A0€`
}
const todayISO = () => new Date().toISOString().slice(0, 10)
const addDays = (iso, d) => { const t = new Date(iso); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10) }
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('fr-BE') : '—'

// ── Calcul des totaux d'un document ─────────────────────────────
function calcTotaux(lignesToutes, remiseGlobalePct) {
  // Deux familles de lignes sont AFFICHEES mais pas additionnees :
  //  - « optionnelle » : une option au choix du client ;
  //  - bloc 'projet'  : un article convenu, rappele sur une facture
  //    d'acompte. L'additionner ferait payer le projet entier au lieu de
  //    l'acompte — c'est l'erreur qui coute le plus cher ici.
  const lignes = (lignesToutes || []).filter(l => !l.optionnelle && l.bloc !== 'projet')
  let ht = 0, tva = 0
  const parTaux = {}
  lignes.forEach(l => {
    const brut = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0)
    const apresRemiseLigne = brut * (1 - (Number(l.remise_pct) || 0) / 100)
    ht += apresRemiseLigne
  })
  // remise globale
  const rg = Number(remiseGlobalePct) || 0
  const htApresGlobal = ht * (1 - rg / 100)
  // TVA par taux (sur base après remises)
  lignes.forEach(l => {
    const brut = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0)
    const apresLigne = brut * (1 - (Number(l.remise_pct) || 0) / 100)
    const apresGlobal = apresLigne * (1 - rg / 100)
    const t = Number(l.tva_pct) || 0
    parTaux[t] = (parTaux[t] || 0) + apresGlobal * t / 100
    tva += apresGlobal * t / 100
  })
  return { ht: htApresGlobal, tva, ttc: htApresGlobal + tva, parTaux }
}

const STATUTS_DEVIS = {
  brouillon: { bg: COUL.fondDoux, col: COUL.texteDoux, label: 'Brouillon' },
  'envoyé':  { bg: '#dbeafe', col: COUL.info, label: 'Envoyé' },
  'accepté': { bg: COUL.succesFond, col: COUL.succes, label: 'Accepté' },
  'refusé':  { bg: COUL.dangerFond, col: COUL.danger, label: 'Refusé' },
  'expiré':  { bg: COUL.alerteFond, col: COUL.alerteFonce, label: 'Expiré' },
}
const STATUTS_FACT = {
  brouillon: { bg: COUL.fondDoux, col: COUL.texteDoux, label: 'Brouillon' },
  'envoyée': { bg: '#dbeafe', col: COUL.info, label: 'Envoyée' },
  'payée':   { bg: COUL.succesFond, col: COUL.succes, label: 'Payée' },
  'partiellement payée': { bg: COUL.alerteFond, col: COUL.alerteFonce, label: 'Partielle' },
  'en retard': { bg: COUL.dangerFond, col: COUL.danger, label: 'En retard' },
  'annulée': { bg: COUL.fondDoux, col: COUL.texteFaible, label: 'Annulée' },
}

// ════════════════════════════════════════════════════════════════
//  ÉDITEUR (devis ou facture)
// ════════════════════════════════════════════════════════════════
function Editeur({ type, doc, onClose, onSaved }) {
  const isDevis = type === 'devis'
  const verrouille = !isDevis && !!(doc && doc.id) && !!(doc && doc.statut) && doc.statut !== 'brouillon'
  const mobE = useMobile()
  const table = isDevis ? 'lode_devis' : 'lode_factures'
  const tableLignes = isDevis ? 'lode_devis_lignes' : 'lode_factures_lignes'
  const fk = isDevis ? 'devis_id' : 'facture_id'

  const [f, setF] = useState({
    client_id: null, client_pays: 'Belgique',
    client_nom: '', client_adresse: '', client_cp: '', client_ville: '',
    client_email: '', client_telephone: '', client_tva: '',
    objet: '', notes: '', remise_pct: 0,
    date_devis: todayISO(), date_validite: addDays(todayISO(), 30),
    date_facture: todayISO(), date_echeance: addDays(todayISO(), DELAI_PAIEMENT_JOURS),
    statut: 'brouillon', langue: 'fr', type: 'facture', responsable: '', total_projet_ttc: '', facture_origine_id: null, montant_paye: '', ...(doc || {}),
  })
  const [lignes, setLignes] = useState([{ titre: '', descriptif: '', description: '', quantite: 1, prix_unitaire: 0, remise_pct: 0, tva_pct: 21, tva_categorie: 'S', photos: [] }])
  const [vue, setVue] = useState('editeur')        // 'editeur' | 'pdf'
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfErr, setPdfErr] = useState('')
  const [articleOuvert, setArticleOuvert] = useState(null)  // index de la ligne en cours d'edition
  const [clientOuvert, setClientOuvert] = useState(false)
  const [acomptePct, setAcomptePct] = useState('')
  const [dejaFacture, setDejaFacture] = useState(0)   // sur le meme projet (devis)
  const [acomptesDispo, setAcomptesDispo] = useState([])
  const [acomptesSel, setAcomptesSel] = useState(doc?._preselAcomptes || [])
  const [acLignes, setAcLignes] = useState({})
  const [origines, setOrigines] = useState([])
  const [saving, setSaving] = useState(false)
  const [importPDF, setImportPDF] = useState({ loading: false, msg: '', drag: false })

  // ⚠️ UN DEVIS SANS CHANTIER NE DOIT PAS POUVOIR ÊTRE ENREGISTRÉ.
  //
  // Ludovic : « en clair, chaque devis doit être rattaché à un chantier, ici
  // ce n'est pas le cas ».
  //
  // Un devis orphelin casse toute la chaîne : il n'apparaît pas dans les
  // chiffres du chantier, la marge l'ignore, et la facture qui en sortira
  // sera elle aussi hors dossier. C'est exactement par là que les 2 000 €
  // non réclamés sont passés.
  //
  // On BLOQUE donc l'enregistrement — mais sans jamais laisser dans une
  // impasse : si aucun chantier n'existe, un bouton le crée depuis ce que le
  // devis sait déjà (le client et l'objet).
  // Une seule source pour les commerciaux, partagée avec l'écran Dossiers.
  const [tousCollabs, setTousCollabs] = useState([])
  useEffect(() => {
    let annule = false
    // ⚠️ Le RATTACHEMENT à LODE, pas le droit d'ouvrir son module : les
    // commerciaux LODE n'ont pas `acc_lode`, et cette liste ne montrait donc
    // qu'eux-mêmes quand ils étaient déjà inscrits. Voir `collaborateurs.js`.
    // Le code déjà enregistré reste toujours proposable.
    chargerCommerciaux('LODE', f.responsable).then(d => { if (!annule) setTousCollabs(d) })
    return () => { annule = true }
  }, [f.responsable])
  const responsables = tousCollabs

  const [dossiersDispo, setDossiersDispo] = useState([])
  // Un seul avertissement par enregistrement : le second clic confirme.
  const [verifieSansChantier, setVerifieSansChantier] = useState(false)
  const [creationDossier, setCreationDossier] = useState(false)
  useEffect(() => {
    if (!isDevis) return
    let annule = false
    // ⚠️ LES CHANTIERS CLOS SONT PROPOSÉS AUSSI (14/11/2026).
    //
    // Ludovic : « le chantier est déjà créé… il ne le trouve pas ». Son devis
    // visait DOS-2026-002, fermé AUTOMATIQUEMENT le matin même parce que ses
    // deux factures étaient payées. Le filtre `neq statut clos` le rendait
    // introuvable — et comme la fenêtre de création des chantiers masque elle
    // aussi les clos, il n'avait aucun moyen de le voir nulle part.
    //
    // C'est sans danger, et vérifié plutôt que supposé : un trigger sur
    // `lode_devis` appelle `dossier_cloture_si_termine`, qui ROUVRE un
    // chantier fermé automatiquement dès qu'un devis vivant s'y rattache.
    // DOS-2026-002 porte `cloture_auto = true` : il se rouvrira seul.
    //
    // Un chantier fermé À LA MAIN, lui, restera fermé — c'est la règle de la
    // fonction, et elle est juste : une décision humaine ne se défait pas
    // toute seule. Le devis y sera quand même rattaché, rien n'est perdu.
    supabase.from('dossiers').select('id,numero,titre,client_nom,client_id,statut,cloture_auto')
      .eq('societe', 'LODE').order('created_at', { ascending: false })
      .then(({ data }) => { if (!annule) setDossiersDispo(data || []) })
    return () => { annule = true }
  }, [isDevis])

  // ⚠️ LA LISTE DES CHANTIERS DOIT ÊTRE FILTRÉE PAR CLIENT.
  //
  // Ludovic : « je peux ajouter ce que je veux... ici j'ai attribué Dewez au
  // chantier Detilloux ». Un chantier appartient à un client : proposer tous
  // les chantiers ouverts, c'est rendre l'erreur non seulement possible mais
  // probable — et une fois faite, elle est invisible, puisque les deux noms
  // s'affichent chacun à leur place.
  //
  // Sans client choisi, la liste est VIDE plutôt que complète : mieux vaut
  // une liste qui oblige à choisir le client qu'une liste qui laisse se
  // tromper.
  const dossiersDuClient = useMemo(
    () => f.client_id ? dossiersDispo.filter(d => String(d.client_id) === String(f.client_id)) : [],
    [dossiersDispo, f.client_id])

  // Changer de client invalide le chantier déjà choisi : il appartenait à
  // quelqu'un d'autre.
  //
  // Et quand le client n'a qu'UN chantier ouvert, on le choisit pour lui :
  // le champ est obligatoire, la liste n'a qu'une entrée, lui demander de la
  // sélectionner c'est lui demander de confirmer qu'il n'avait pas le choix.
  useEffect(() => {
    if (!f.dossier_id) {
      // ⚠️ L'auto-sélection ne porte que sur les chantiers OUVERTS. Depuis
      // que les clos sont proposés, choisir d'office un chantier fermé
      // reviendrait à décider à la place de l'utilisateur de le rouvrir.
      const ouverts = dossiersDuClient.filter(d => d.statut !== 'clos')
      if (ouverts.length === 1) set('dossier_id', ouverts[0].id)
      return
    }
    if (!dossiersDuClient.some(d => d.id === f.dossier_id)) set('dossier_id', null)
  }, [f.client_id, dossiersDispo])

  // Créer le chantier depuis le devis : tout est déjà là.
  const creerDossierDepuisDevis = async () => {
    setCreationDossier(true)
    const { data: numero, error: e1 } = await supabase.rpc('prochain_numero', {
      p_type: 'dossier', p_societe: 'LODE', p_prefixe: 'DOS',
    })
    if (e1) { alert(`Numérotation refusée — ${e1.message}`); setCreationDossier(false); return }
    const { data, error } = await supabase.from('dossiers').insert({
      societe: 'LODE', numero,
      titre: (f.objet || '').trim() || 'Chantier sans titre',
      type: 'intervention',
      client_type: f.client_id ? 'lode_client' : null,
      client_id: f.client_id || null,
      client_nom: f.client_nom || null,
      adresse: f.client_adresse || null, cp: f.client_cp || null, ville: f.client_ville || null,
      date_debut: todayISO(),
      // ⚠️ LE COMMERCIAL DU DEVIS NAÎT AVEC LE CHANTIER (14/11/2026).
      //
      // `synchroniser_commercial` existait déjà, mais elle ne tourne qu'à
      // l'ENREGISTREMENT du devis. Un chantier créé ici naissait donc sans
      // commercial, et le restait tant que le devis n'était pas réenregistré.
      // Mesuré : DOS-2026-077 et 078 sont vides alors que leurs devis portent
      // tous deux un commercial. Le poser à la création ferme le trou à la
      // source plutôt que de compter sur un geste ultérieur.
      responsable: f.responsable || null,
    }).select('id,numero,titre,client_nom,client_id,statut').single()
    setCreationDossier(false)
    if (error) { alert(`Création du chantier refusée — ${error.message}`); return }
    setDossiersDispo(p => [data, ...p])
    set('dossier_id', data.id)
  }

  // Import de devis fournisseur (SDA / Marquise) -> pré-remplit les lignes
  const importerPDFs = async (files) => {
    setImportPDF({ loading: true, msg: '', drag: false })
    const nouvelles = []
    let objetAuto = ''
    for (const file of files) {
      try {
        const ext = await extraireDevis(file)
        if (ext.fournisseur === 'Inconnu') { setImportPDF({ loading: false, msg: `⚠ ${file.name} : fournisseur non reconnu`, drag: false }); continue }
        if (!objetAuto && ext.lignes[0]) objetAuto = ext.lignes[0].designation
        for (const l of ext.lignes) {
          // titre = objet (désignation), descriptif = détail
          nouvelles.push({
            titre: (l.designation || '').slice(0, 200),
            descriptif: (l.description || '').slice(0, 1000),
            description: (l.designation || '').slice(0, 200),
            quantite: l.quantite || 1,
            prix_unitaire: l.prix_public || 0,
            remise_pct: l.remise_pct || 0,
            tva_pct: l.taux_tva || 21,
            tva_categorie: (l.taux_tva || 21) > 0 ? 'S' : 'AE',
            photos: [], optionnelle: false,
          })
        }
      } catch (e) { setImportPDF({ loading: false, msg: `Erreur ${file.name}: ${e.message}`, drag: false }) }
    }
    if (nouvelles.length) {
      setLignes(prev => {
        const pleines = prev.filter(l => (l.titre || '').trim() || (l.description || '').trim() || (l.descriptif || '').trim())
        return [...pleines, ...nouvelles]
      })
      if (objetAuto && !f.objet) set('objet', objetAuto)
      setImportPDF({ loading: false, msg: `✓ ${nouvelles.length} ligne(s) importée(s) — vérifiez et ajustez`, drag: false })
    } else {
      setImportPDF(p => ({ ...p, loading: false }))
    }
  }
  const CLIENT_TABLE = 'lode_clients'
  // colonnes texte candidates pour la recherche multi-champs (intersectees avec les colonnes reellement presentes dans la base de CETTE societe)
  const SEARCH_CANDIDATES = ['denomination','nom','prenom','dossier','ville','localite','email','telephone','tel_fixe','gsm','tva','bce','adresse','cp','code_postal','pays']
  const [searchCols, setSearchCols] = useState(['denomination'])
  const [hasActif, setHasActif] = useState(true)
  const [clientQuery, setClientQuery] = useState('')
  const [clientResults, setClientResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)

  // decouverte des colonnes reelles de la base client de cette societe (1 ligne echantillon) -> aucune hypothese de schema codee en dur
  useEffect(() => {
    supabase.from(CLIENT_TABLE).select('*').limit(1).then(({ data }) => {
      const keys = data && data[0] ? Object.keys(data[0]) : []
      if (keys.length) {
        setSearchCols(SEARCH_CANDIDATES.filter(k => keys.includes(k)))
        setHasActif(keys.includes('actif'))
      }
    })
  }, [])

  // recherche serveur, debounced, limitee -- chaque societe uniquement dans SA base
  useEffect(() => {
    const q = clientQuery.trim()
    if (q.length < 2) { setClientResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const safe = q.replace(/[,()%]/g, ' ').trim()
      const cols = searchCols.length ? searchCols : ['denomination']
      const orFilter = cols.map(c => c + '.ilike.%' + safe + '%').join(',')
      let req = supabase.from(CLIENT_TABLE).select('*')
      if (hasActif) req = req.eq('actif', true)
      const { data } = await req.or(orFilter).limit(30)
      setClientResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [clientQuery, searchCols, hasActif])


  const choisirClient = (c) => {
    if (!c) return
    const nomComplet = c.type === 'entreprise'
      ? (c.denomination || '')
      : ((((c.prenom || '') + ' ' + (c.nom || '')).trim()) || c.denomination || '')
    setF(p => ({
      ...p,
      client_id: c.id,
      client_nom: nomComplet,
      client_adresse: c.adresse || '',
      client_cp: c.cp || c.code_postal || '',
      client_ville: c.ville || c.localite || '',
      client_pays: c.pays || p.client_pays || 'Belgique',
      client_email: c.email || '',
      client_telephone: c.telephone || c.tel_fixe || c.gsm || '',
      client_tva: c.tva || c.bce || '',
      langue: c.langue || p.langue || 'fr',
    }))
    setClientQuery('')
    setClientResults([])
  }

  // Crée le client saisi manuellement dans la base clients de la société, puis lie le devis/facture au nouveau client_id
  const creerClient = async () => {
    const nom = (f.client_nom || '').trim()
    if (!nom) { alert('Renseigne au moins le nom / la société avant de créer le client.'); return }
    setCreatingClient(true)
    const estEntreprise = !!(f.client_tva || '').trim()
    const payload = {
      type: estEntreprise ? 'entreprise' : 'particulier',
      denomination: estEntreprise ? nom : null,
      nom: estEntreprise ? null : nom,
      adresse: f.client_adresse || null,
      cp: f.client_cp || null,
      ville: f.client_ville || null,
      pays: f.client_pays || 'Belgique',
      tva: f.client_tva || null,
      numero_bce: estEntreprise ? (f.client_tva || null) : null,
      email: f.client_email || null,
      telephone: f.client_telephone || null,
      langue: f.langue || 'fr',
      actif: true,
    }
    const { data, error } = await supabase.from(CLIENT_TABLE).insert(payload).select('id').single()
    setCreatingClient(false)
    if (error) { alert('Création client impossible : ' + error.message); return }
    setF(p => ({ ...p, client_id: data.id }))
    alert('Client créé et lié au ' + (isDevis ? 'devis' : 'facture') + '.')
  }

  useEffect(() => {
    if (doc?.id) {
      supabase.from(tableLignes).select('*').eq(fk, doc.id).order('position')
        .then(({ data }) => { if (data?.length) setLignes(data.map(l => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [], titre: l.titre || l.description || '', descriptif: l.descriptif || '' }))) })
    }
  }, [doc])

  // Ce qui a DEJA ete facture sur le meme projet. Le projet, c'est le devis :
  // c'est lui qui porte l'engagement initial. Sans devis lie, on ne peut pas
  // le savoir, et on le dit plutot que de l'inventer.
  useEffect(() => {
    let vivant = true
    if (isDevis || !f.devis_id) { setDejaFacture(0); return }
    supabase.from('lode_factures').select('id,total_ttc')
      .eq('devis_id', f.devis_id).neq('type', 'note_credit')
      .then(({ data }) => {
        if (!vivant) return
        const somme = (data || [])
          .filter(x => x.id !== doc?.id)
          .reduce((a, x) => a + (Number(x.total_ttc) || 0), 0)
        setDejaFacture(Math.round(somme * 100) / 100)
      })
    return () => { vivant = false }
  }, [isDevis, f.devis_id, doc?.id])

  // Charge les acomptes du client a deduire (uniquement pour un SOLDE en creation)
  useEffect(() => {
    if (isDevis || f.type !== 'solde' || doc?.id || !f.client_id) { setAcomptesDispo([]); return }
    let annule = false
    ;(async () => {
      const { data: acs } = await supabase.from('lode_factures')
        .select('id,numero,date_facture,objet,total_ht,total_tva,total_ttc')
        .eq('type', 'acompte').eq('client_id', f.client_id).order('date_facture')
      if (annule) return
      const list = acs || []
      setAcomptesDispo(list)
      if (list.length) {
        const { data: ls } = await supabase.from('lode_factures_lignes')
          .select('facture_id,tva_pct,tva_categorie,total_ht')
          .in('facture_id', list.map(a => a.id))
        if (annule) return
        const map = {}
        for (const l of (ls || [])) { (map[l.facture_id] = map[l.facture_id] || []).push(l) }
        setAcLignes(map)
      } else { setAcLignes({}) }
    })()
    return () => { annule = true }
  }, [isDevis, f.type, f.client_id, doc])

  // Note de credit : factures du client pouvant etre creditees
  useEffect(() => {
    if (isDevis || f.type !== 'note_credit' || !f.client_id) { setOrigines([]); return }
    let annule = false
    supabase.from('lode_factures').select('id,numero,date_facture,total_ttc')
      .eq('client_id', f.client_id).neq('type', 'note_credit').order('date_facture', { ascending: false })
      .then(({ data }) => { if (!annule) setOrigines(data || []) })
    return () => { annule = true }
  }, [isDevis, f.type, f.client_id])

  // Reprend les lignes de la facture d'origine en negatif
  const reprendreLignesNegatif = async () => {
    if (!f.facture_origine_id) return
    const { data } = await supabase.from('lode_factures_lignes').select('*').eq('facture_id', f.facture_origine_id).order('position')
    if (!data || !data.length) { alert('Aucune ligne sur la facture sélectionnée.'); return }
    setLignes(data.map(l => ({
      titre: l.titre || l.description || '', descriptif: l.descriptif || '',
      description: l.description || l.titre || '',
      quantite: Number(l.quantite) || 0, prix_unitaire: -Math.abs(Number(l.prix_unitaire) || 0),
      remise_pct: Number(l.remise_pct) || 0, tva_pct: Number(l.tva_pct) || 0,
      tva_categorie: l.tva_categorie || ((Number(l.tva_pct) || 0) > 0 ? 'S' : 'AE'),
      photos: Array.isArray(l.photos) ? l.photos : [], optionnelle: false,
    })))
    const ori = origines.find(o => o.id === f.facture_origine_id)
    if (ori && !f.objet) set('objet', 'Note de crédit relative à la facture ' + ori.numero)
  }

  // Lignes de deduction d'acompte (negatives, par taux) pour un SOLDE en creation
  const lignesDeduction = (!isDevis && f.type === 'solde' && !doc?.id)
    ? acomptesSel.flatMap(aid => {
        const ac = acomptesDispo.find(a => a.id === aid); if (!ac) return []
        const groups = {}
        for (const l of (acLignes[aid] || [])) {
          const pct = Number(l.tva_pct) || 0
          const cat = l.tva_categorie || (pct > 0 ? 'S' : 'AE')
          const k = pct + '|' + cat
          groups[k] = (groups[k] || 0) + (Number(l.total_ht) || 0)
        }
        if (!Object.keys(groups).length) {
          const ht = Number(ac.total_ht) || 0
          const pct = ht ? Math.round((Number(ac.total_tva) || 0) / ht * 100) : 0
          groups[pct + '|' + (pct > 0 ? 'S' : 'AE')] = ht
        }
        return Object.entries(groups).map(([k, ht]) => {
          const [pct, cat] = k.split('|')
          return {
            titre: 'Acompte déjà facturé — ' + ac.numero,
            descriptif: ac.date_facture ? ('Acompte du ' + String(ac.date_facture).slice(0, 10)) : '',
            description: 'Acompte déjà facturé — ' + ac.numero,
            quantite: 1, prix_unitaire: -(Math.round(Number(ht) * 100) / 100),
            remise_pct: 0, tva_pct: Number(pct), tva_categorie: cat,
            photos: [], optionnelle: false, _deduction: true,
          }
        })
      })
    : []

  const tot = calcTotaux([...lignes, ...lignesDeduction], f.remise_pct)
  const totDeduction = lignesDeduction.length ? calcTotaux(lignesDeduction, 0).ttc : 0

  // ── Acompte deja paye, et montant reellement du ────────────────────────
  // Deduit du TTC, pas du HT : la TVA est due sur la totalite, l'acompte
  // n'est qu'un paiement anticipe.
  // LE POURCENTAGE S'APPLIQUE AU HT, TAUX PAR TAUX — jamais au TTC d'un bloc.
  // Ainsi la TVA de l'acompte est exactement celle du projet : 30 % de
  // 2 746,39 HTVA a 6 % donne 823,92 + 49,44 = 873,36. Calculer 30 % du TTC
  // puis en deduire un HT donnerait une base imposable a plus de deux
  // decimales, donc une TVA infalsifiable a l'euro pres.
  const appliquerPourcentage = () => {
    const pct = Number(acomptePct) || 0
    if (pct <= 0 || pct > 100) { alert('Donne un pourcentage entre 0 et 100.'); return }
    const groupes = {}
    for (const l of lignes) {
      if (l._deduction) continue
      const ht = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
      const taux = Number(l.tva_pct) || 0
      const cat = l.tva_categorie || (taux > 0 ? 'S' : 'AE')
      groupes[taux + '|' + cat] = (groupes[taux + '|' + cat] || 0) + ht
    }
    const articles = lignes.filter(l => !l._deduction).map(l => l.titre || l.description).filter(Boolean)
    const nouvelles = Object.entries(groupes)
      .filter(([, ht]) => Math.abs(ht) > 0.004)
      .map(([k, ht]) => {
        const [taux, cat] = k.split('|')
        return {
          titre: 'Paiement échelonné',
          descriptif: 'Acompte de ' + pct + ' % sur le projet',
          description: 'Paiement échelonné',
          quantite: 1, prix_unitaire: Math.round(ht * pct) / 100,
          remise_pct: 0, tva_pct: Number(taux), tva_categorie: cat, photos: [],
          optionnelle: false, bloc: 'facture',
        }
      })
    if (!nouvelles.length) { alert('Ajoute d\'abord les lignes du projet : le pourcentage se calcule dessus.'); return }
    // ON NE REMPLACE PAS : les articles convenus restent, marques 'projet',
    // et la ligne d'acompte s'ajoute en 'facture'. Le client voit ce qu'il a
    // commande ET ce qu'on lui reclame maintenant.
    setLignes([
      ...lignes.filter(l => !l._deduction && l.bloc !== 'facture').map(l => ({ ...l, bloc: 'projet' })),
      ...nouvelles,
    ])
    if (!f.objet) set('objet', 'Acompte de ' + pct + ' % sur le projet')
  }

  // « Il reste X a facturer sur ce projet ». On ne l'affiche que si on peut
  // le calculer : sans total de projet, on ne devine pas.
  // Les deux blocs d'une facture d'acompte.
  const lignesProjet  = lignes.filter(l => l.bloc === 'projet')
  const lignesFacture = lignes.filter(l => l.bloc !== 'projet')
  const estAcompte    = lignesProjet.length > 0
  // Totaux du projet entier : calcules sur les lignes 'projet', qui sont
  // justement celles que calcTotaux ecarte du total facture.
  const totProjet = estAcompte
    ? calcTotaux(lignesProjet.map(l => ({ ...l, bloc: null })), f.remise_pct)
    : null

  const projetTTC = estAcompte ? (totProjet?.ttc || 0) : (Number(f.total_projet_ttc) || 0)
  const resteAFacturer = projetTTC > 0
    ? Math.round((projetTTC - dejaFacture - tot.ttc) * 100) / 100
    : null

  const acomptePaye = Math.max(0, Number(f.montant_paye) || 0)
  const montantDu = Math.round((tot.ttc - acomptePaye) * 100) / 100
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const setLigne = (i, k, v) => setLignes(p => p.map((l, j) => j === i ? { ...l, [k]: v } : l))
  // Compresse/redimensionne une image avant upload (max 1400px, qualité 82%)
  const compresserImage = (file) => new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1400
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(blob || file),
        'image/jpeg', 0.82
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })

  // Ajout de photos à une ligne : compression puis upload vers Supabase Storage
  const ajouterPhotos = async (i, files) => {
    const imgs = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      try {
        const blob = await compresserImage(file)
        const chemin = `${type}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
        const { error } = await supabase.storage.from('devis-photos').upload(chemin, blob, { upsert: true, contentType: 'image/jpeg' })
        if (error) { alert('Upload photo : ' + error.message); continue }
        const { data } = supabase.storage.from('devis-photos').getPublicUrl(chemin)
        imgs.push({ url: data.publicUrl, nom: file.name, chemin })
      } catch (e) { alert('Erreur photo : ' + e.message) }
    }
    if (imgs.length) setLignes(p => p.map((l, j) => j === i ? { ...l, photos: [...(l.photos || []), ...imgs] } : l))
  }
  const addLigne = () => setLignes(p => [...p, { titre: '', descriptif: '', description: '', quantite: 1, prix_unitaire: 0, remise_pct: 0, tva_pct: 21, tva_categorie: 'S', photos: [] }])
  const delLigne = i => setLignes(p => p.filter((_, j) => j !== i))

  const save = async () => {
    if (verrouille) { alert('Cette facture a déjà été émise/envoyée : elle ne peut plus être modifiée. Pour la corriger, créez une note de crédit.'); return }
    if (!f.client_nom.trim()) { alert('Le nom du client est obligatoire'); return }
    // ⚠️ LE CHANTIER N'EST PLUS EXIGÉ — TEMPORAIREMENT (14/11/2026).
    //
    // Ludovic : « tu dois ne plus obliger le chantier dans un premier temps,
    // pour que je puisse mettre de l'ordre ». Les chantiers viennent d'être
    // ramenés à deux ; exiger un rattachement alors qu'il n'y a presque rien
    // à quoi rattacher bloquerait justement la remise en ordre.
    //
    // La raison de l'obligation reste entière, et elle est de lui (08/11) :
    // « j'ai fait un devis, il est accepté, je réalise une facture, elle est
    // payée ; tout ça doit se voir dans le chantier ». Un document sans
    // chantier n'apparaît dans les chiffres d'aucun dossier et la marge
    // l'ignore. À REMETTRE une fois la reprise terminée, en même temps que le
    // verrouillage des numéros.
    //
    // D'ici là on AVERTIT au lieu de refuser : refuser bloque, se taire laisse
    // la dette grossir sans qu'on la voie.
    if (!f.dossier_id && !verifieSansChantier) {
      setVerifieSansChantier(true)
      alert(`${isDevis ? 'Ce devis' : 'Cette facture'} n'est rattaché${isDevis ? '' : 'e'} à aucun chantier.\n\n`
        + `Il n'apparaîtra donc dans les chiffres d'aucun dossier. C'est accepté le temps de la remise en ordre.\n\n`
        + `Clique à nouveau sur Enregistrer pour confirmer.`)
      return
    }
    setSaving(true)
    try {
      let docId = doc?.id
      const payload = {
        client_nom: f.client_nom, client_adresse: f.client_adresse, client_cp: f.client_cp,
        client_ville: f.client_ville, client_email: f.client_email, client_telephone: f.client_telephone,
        client_id: f.client_id || null,
        client_tva: f.client_tva, objet: f.objet, notes: f.notes,
        remise_pct: Number(f.remise_pct) || 0, statut: f.statut, langue: f.langue || 'fr',
        total_ht: tot.ht, total_tva: tot.tva, total_ttc: tot.ttc,
        responsable: f.responsable || null,
      }
      // Le dossier suit le document. Sans ça, un devis créé DEPUIS un dossier
      // de chantier perdrait son rattachement à l'enregistrement, et l'écran
      // Dossiers afficherait « rien de facturé » sur un chantier devisé.
      payload.dossier_id = f.dossier_id || null
      if (isDevis) { payload.date_devis = f.date_devis; payload.date_validite = f.date_validite }
      else { payload.date_facture = f.date_facture; payload.date_echeance = f.date_echeance; if (f.devis_id) payload.devis_id = f.devis_id }
      // L'acompte DEJA PAYE se deduit APRES la TVA : ce n'est pas une ligne de
      // facture, c'est un paiement deja recu. Verifie sur le document de
      // reference : 2 746,39 HTVA + 164,78 de TVA = 2 911,17, moins 500 recus
      // = 2 411,17 dus. En faire une ligne negative fausserait la TVA declaree.
      if (!isDevis) payload.montant_paye = Number(f.montant_paye) || 0
      if (!isDevis) { payload.type = f.type || 'facture'; if (f.total_projet_ttc !== undefined && f.total_projet_ttc !== null && f.total_projet_ttc !== '') payload.total_projet_ttc = Number(f.total_projet_ttc); if (f.type === 'solde' && acomptesSel[0]) payload.facture_origine_id = acomptesSel[0]; else if (f.facture_origine_id) payload.facture_origine_id = f.facture_origine_id }

      if (docId) {
        // Un numéro corrigé part dans la mise à jour — mais seulement pour un
        // devis, et seulement s'il a changé. L'index unique de la base refuse
        // un numéro déjà pris : on laisse l'erreur remonter plutôt que de
        // tenter un numéro de repli, parce qu'un numéro choisi par le système
        // à la place de celui qu'on a tapé est un numéro qu'on ne retrouve pas.
        // On renvoie le numéro à chaque enregistrement d'un devis plutôt que
        // de comparer à l'original : écrire la même valeur ne coûte rien, et
        // le recalage de séquence ne recule jamais. Comparer aurait demandé de
        // garder le document d'origine en mémoire — un état de plus à tenir à
        // jour, pour éviter une écriture qui ne change rien.
        const numCorrige = isDevis && !!(f.numero || '').trim()
        if (numCorrige) payload.numero = (f.numero || '').trim()
        const { error: eMaj } = await supabase.from(table).update(payload).eq('id', docId)
        if (eMaj) {
          throw new Error(eMaj.code === '23505'
            ? `Le numéro « ${payload.numero} » est déjà pris par un autre document.`
            : eMaj.message)
        }
        // La séquence ne recule jamais : elle est poussée au-delà du numéro
        // saisi, pour que le prochain devis créé ne retombe pas dessus.
        if (numCorrige) {
          await supabase.rpc('caler_sequence_lode', { p_type: 'devis', p_numero: payload.numero })
        }
        await supabase.from(tableLignes).delete().eq(fk, docId)
      } else {
        const pType = (!isDevis && f.type === 'note_credit') ? 'note_credit' : type
        const { data: num } = await supabase.rpc('next_lode_numero', { p_type: pType })
        payload.numero = num
        const { data, error } = await supabase.from(table).insert(payload).select('id').single()
        if (error) throw error
        docId = data.id
      }
      const lignesPayload = [...lignes, ...lignesDeduction].filter(l => (l.titre || '').trim() || (l.description || '').trim() || (l.descriptif || '').trim()).map((l, i) => ({
        [fk]: docId, position: i,
        titre: l.titre || '', descriptif: l.descriptif || '',
        description: l.description || l.titre || '',
        photos: l.photos || [], optionnelle: !!l.optionnelle,
        quantite: Number(l.quantite) || 0, prix_unitaire: Number(l.prix_unitaire) || 0,
        remise_pct: Number(l.remise_pct) || 0, tva_pct: Number(l.tva_pct) || 0,
        ...(isDevis ? {} : { tva_categorie: (Number(l.tva_pct) || 0) > 0 ? 'S' : (l.tva_categorie || 'AE') }),
        // Un devis n'a pas de blocs : la colonne n'existe que sur les factures.
        ...(isDevis ? {} : { bloc: l.bloc || null }),
        total_ht: (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100),
      }))
      // Le commercial choisi sur le devis remonte au CHANTIER, qui le
      // redescend sur les autres documents. Ludovic : « si j'attribue un
      // devis à LLO, le chantier doit être attribué aussi ». La propagation
      // vit en base (synchroniser_commercial) et non ici : deux écrans
      // peuvent changer le commercial, une seule règle doit décider.
      if (f.dossier_id) {
        await supabase.rpc('synchroniser_commercial', {
          p_dossier_id: f.dossier_id, p_code: f.responsable || null,
        })
      }
      if (lignesPayload.length) {
        const { error: errLignes } = await supabase.from(tableLignes).insert(lignesPayload)
        if (errLignes) throw new Error('Enregistrement des lignes : ' + errLignes.message)
      }
      onSaved()
    } catch (e) {
      alert('Erreur : ' + e.message)
    } finally { setSaving(false) }
  }

  // Une colonne « remise » qui ne sert a rien encombre le document : on ne
  // l'affiche que si au moins un article porte une remise.
  const hasRemiseDoc = lignes.some(l => Number(l.remise_pct) > 0)
  const soldeProjet = estAcompte ? Math.round(((totProjet?.ttc || 0) - (tot.ttc - acomptePaye)) * 100) / 100 : 0

  // Apercu PDF : on genere le vrai document, pas une imitation. Un apercu qui
  // ment ne sert a rien ; celui-ci sort de la meme fonction que l'envoi.
  useEffect(() => {
    if (vue !== 'pdf') return
    let annule = false
    let urlLocale = null
    setPdfUrl(null); setPdfErr('')
    ;(async () => {
      try {
        const b64 = await exportPDF(type, { ...f, numero: f.numero || 'BROUILLON', total_ttc: tot.ttc }, lignes, { save: false })
        if (annule) return
        const bin = atob(b64)
        const buf = new Uint8Array(bin.length)
        for (let k = 0; k < bin.length; k++) buf[k] = bin.charCodeAt(k)
        urlLocale = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
        setPdfUrl(urlLocale)
      } catch (e) {
        // Un script CDN qui ne charge pas rejette avec un Event, pas une Error :
        // sans ce garde-fou l'utilisateur lit « Aperçu impossible : undefined ».
        const motif = (e && e.message) ? e.message
          : (e instanceof Event ? 'jsPDF n’a pas pu être chargé (connexion ?)' : String(e))
        if (!annule) setPdfErr('Aperçu impossible — ' + motif)
      }
    })()
    return () => { annule = true; if (urlLocale) URL.revokeObjectURL(urlLocale) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vue])


  const inp = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const lbl = { fontSize: 11, fontWeight: 700, color: COUL.texteDoux, marginBottom: 3, display: 'block' }

  // ── Styles du document ───────────────────────────────────────────────
  // Un champ du document ne ressemble pas a un champ de formulaire : il
  // ressemble au texte imprime, et ne se revele qu'au survol. C'est toute la
  // difference entre « remplir un formulaire » et « ecrire son document ».
  const champDoc = {
    border: '1px solid transparent', background: 'transparent', borderRadius: 5,
    padding: '2px 5px', margin: '-2px -5px', fontFamily: 'inherit', fontSize: 'inherit',
    fontWeight: 'inherit', color: 'inherit', width: '100%', boxSizing: 'border-box',
    outline: 'none', transition: 'background .12s, border-color .12s',
  }
  const surDoc = {
    onFocus: e => { e.target.style.background = COUL.blanc; e.target.style.borderColor = ORANGE },
    onBlur: e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent' },
    onMouseEnter: e => { if (document.activeElement !== e.target) e.target.style.background = COUL.fondDoux },
    onMouseLeave: e => { if (document.activeElement !== e.target) e.target.style.background = 'transparent' },
  }
  const thDoc = { padding: '7px 8px', fontSize: 11, fontWeight: 800, color: COUL.blanc, textAlign: 'left', whiteSpace: 'nowrap' }
  const tdDoc = { padding: '9px 8px', fontSize: 12.5, verticalAlign: 'top', borderBottom: '1px solid #f1f5f9' }

  // Une ligne du tableau du document. Le clic ouvre la modale d'article :
  // c'est la seule facon d'avoir un document lisible ET tous les reglages.
  const RangeeDoc = ({ l, idx, cliquable }) => {
    const ht = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)

    // Six colonnes sur 390 px, ce n'est pas un tableau, c'est une grille de
    // mots coupes. Sur telephone chaque article devient une carte : le nom en
    // entier, puis une ligne de chiffres lisible.
    if (mobE) return (
      <tr onClick={cliquable ? () => setArticleOuvert(idx) : undefined}
        style={{ cursor: cliquable ? 'pointer' : 'default', background: l.optionnelle ? COUL.alerteFondDoux : 'transparent' }}>
        <td colSpan={9} style={{ padding: '11px 2px', borderBottom: `1px solid ${COUL.bord}`, verticalAlign: 'top' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: NAVY, fontSize: 13.5 }}>
                {l.titre || l.description || <span style={{ color: COUL.texteFaible, fontWeight: 500 }}>Article sans nom</span>}
                {l.optionnelle && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: COUL.alerte }}>OPTION</span>}
              </div>
              {l.descriptif && <div style={{ fontSize: 11.5, color: COUL.texteDoux, marginTop: 2, whiteSpace: 'pre-wrap' }}>{l.descriptif}</div>}
              <div style={{ fontSize: 11.5, color: COUL.texteDoux, marginTop: 4 }}>
                {l.quantite} × {eur(l.prix_unitaire)} · TVA {Number(l.tva_pct) || 0}%
                {Number(l.remise_pct) ? ` · remise ${l.remise_pct}%` : ''}
                {!!(l.photos || []).length && ` · 📷 ${l.photos.length}`}
              </div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: 800, color: NAVY, fontSize: 13.5 }}>{eur(ht)}</div>
              {cliquable && <span onClick={e => { e.stopPropagation(); delLigne(idx) }} style={{ color: COUL.texteFaible, cursor: 'pointer', fontSize: 17, lineHeight: 1 }}>×</span>}
            </div>
          </div>
        </td>
      </tr>
    )

    return (
      <tr
        onClick={cliquable ? () => setArticleOuvert(idx) : undefined}
        style={{ cursor: cliquable ? 'pointer' : 'default', background: l.optionnelle ? COUL.alerteFondDoux : 'transparent' }}
        onMouseEnter={e => { if (cliquable) e.currentTarget.style.background = COUL.orangeFond }}
        onMouseLeave={e => { if (cliquable) e.currentTarget.style.background = l.optionnelle ? COUL.alerteFondDoux : 'transparent' }}
      >
        <td style={tdDoc}>
          <div style={{ fontWeight: 700, color: NAVY }}>
            {l.titre || l.description || <span style={{ color: COUL.texteFaible, fontWeight: 500 }}>Article sans nom</span>}
            {l.optionnelle && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: COUL.alerte }}>OPTION</span>}
          </div>
          {l.descriptif && <div style={{ fontSize: 11.5, color: COUL.texteDoux, marginTop: 2, whiteSpace: 'pre-wrap' }}>{l.descriptif}</div>}
          {!!(l.photos || []).length && <div style={{ fontSize: 10.5, color: COUL.texteFaible, marginTop: 3 }}>📷 {l.photos.length} photo(s)</div>}
        </td>
        <td style={{ ...tdDoc, textAlign: 'right', whiteSpace: 'nowrap' }}>{eur(l.prix_unitaire)}</td>
        <td style={{ ...tdDoc, textAlign: 'center', whiteSpace: 'nowrap' }}>{Number(l.tva_pct) || 0}%</td>
        {hasRemiseDoc && <td style={{ ...tdDoc, textAlign: 'center' }}>{Number(l.remise_pct) ? `−${l.remise_pct}%` : ''}</td>}
        <td style={{ ...tdDoc, textAlign: 'center' }}>{l.quantite}</td>
        <td style={{ ...tdDoc, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{eur(ht)}</td>
        <td style={{ ...tdDoc, width: 22, textAlign: 'center' }}>
          {cliquable && (
            <span onClick={e => { e.stopPropagation(); delLigne(idx) }} title="Supprimer" style={{ color: COUL.texteFaible, cursor: 'pointer', fontSize: 15 }}>×</span>
          )}
        </td>
      </tr>
    )
  }

  const EnteteDoc = () => mobE ? null : (
    <thead>
      <tr style={{ background: ORANGE }}>
        <th style={thDoc}>Description</th>
        <th style={{ ...thDoc, textAlign: 'right' }}>P.U. HTVA</th>
        <th style={{ ...thDoc, textAlign: 'center' }}>TVA</th>
        {hasRemiseDoc && <th style={{ ...thDoc, textAlign: 'center' }}>Rem.</th>}
        <th style={{ ...thDoc, textAlign: 'center' }}>Qté</th>
        <th style={{ ...thDoc, textAlign: 'right' }}>Total HTVA</th>
        <th style={{ ...thDoc, width: 22 }}></th>
      </tr>
    </thead>
  )

  const LigneTotal = ({ label, valeur, fort, couleur }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, padding: fort ? '9px 0 0' : '3px 0', fontSize: fort ? 16 : 12.5, fontWeight: fort ? 800 : 500, color: couleur || (fort ? ORANGE : COUL.texteDoux), borderTop: fort ? `2px solid ${COUL.bord}` : 'none', marginTop: fort ? 6 : 0 }}>
      <span>{label}</span><span style={{ color: fort ? NAVY : 'inherit' }}>{valeur}</span>
    </div>
  )

  const blocPanneau = { borderBottom: `1px solid ${COUL.bord}`, padding: '16px 18px' }
  const titrePanneau = { fontSize: 11, fontWeight: 800, color: COUL.texteFaible, letterSpacing: .6, textTransform: 'uppercase', marginBottom: 10 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: COUL.fond, zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: "'Source Sans Pro', sans-serif" }}>

      {/* ── Barre du haut : identite du document, bascule, actions ── */}
      <div style={{ background: COUL.surface, borderBottom: `1px solid ${COUL.bord}`, padding: mobE ? '10px 12px' : '11px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={onClose} title="Fermer" style={{ background: 'none', border: 'none', fontSize: 19, cursor: 'pointer', color: COUL.texteDoux, padding: 0, lineHeight: 1 }}>←</button>
        <div style={{ fontSize: mobE ? 14 : 15, fontWeight: 800, color: NAVY, minWidth: 0 }}>
          {mobE
            ? (isDevis ? 'Devis' : (f.type === 'note_credit' ? 'Note de crédit' : 'Facture'))
            : `${doc?.id ? 'Modifier' : 'Créer'} ${isDevis ? 'un devis' : (f.type === 'note_credit' ? 'une note de crédit' : 'une facture')}`}
          {f.numero && <span style={{ color: ORANGE, marginLeft: 7 }}>{f.numero}</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button onClick={onClose} style={{ background: COUL.surface, border: `1px solid ${COUL.bord}`, borderRadius: 9, padding: mobE ? '7px 12px' : '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: COUL.texteMoyen }}>Annuler</button>
          <button onClick={save} disabled={saving || verrouille} style={{ background: verrouille ? COUL.bordFort : ORANGE, border: 'none', borderRadius: 9, padding: mobE ? '7px 14px' : '8px 20px', cursor: (saving || verrouille) ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: COUL.blanc }}>
            {verrouille ? '🔒' : (saving ? 'Enregistrement…' : 'Enregistrer')}
          </button>
        </div>

        {/* Sur telephone, les deux panneaux ne tiennent pas cote a cote ni l'un
            sous l'autre : on les met en onglets. Sur ordinateur, « Details »
            reste affiche en permanence, l'onglet n'a donc pas lieu d'etre. */}
        <div style={{ display: 'flex', background: COUL.fondDoux, borderRadius: 9, padding: 3, width: mobE ? '100%' : 'auto', marginLeft: mobE ? 0 : 'auto', marginRight: mobE ? 0 : 'auto', order: mobE ? 3 : 0 }}>
          {(mobE ? [['editeur', 'Document'], ['details', 'Détails'], ['pdf', 'PDF']] : [['editeur', 'Éditeur'], ['pdf', 'PDF']]).map(([v, lab]) => (
            <button key={v} type="button" onClick={() => setVue(v)}
              style={{ flex: mobE ? 1 : 'none', padding: mobE ? '7px 8px' : '6px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                       background: vue === v ? COUL.blanc : 'transparent', color: vue === v ? NAVY : COUL.texteDoux,
                       boxShadow: vue === v ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>{lab}</button>
          ))}
        </div>
      </div>

      {verrouille && (
        <div style={{ background: COUL.dangerFondDoux, borderBottom: `1px solid ${COUL.dangerBord}`, color: COUL.dangerFonce, padding: '9px 20px', fontSize: 12.5, fontWeight: 600 }}>
          🔒 Facture déjà émise — lecture seule. Une facture émise ne peut jamais être modifiée ni supprimée : pour la corriger, créez une note de crédit.
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0, flexDirection: mobE ? 'column' : 'row' }}>

        {/* ══════════ LE DOCUMENT ══════════ */}
        <div style={{ flex: 1, overflowY: 'auto', padding: mobE ? 12 : '26px 20px', minWidth: 0, display: (mobE && vue === 'details') ? 'none' : 'block' }}>
          {vue === 'pdf' ? (
            <div style={{ maxWidth: 860, margin: '0 auto' }}>
              {pdfUrl ? <>
                <iframe title="Aperçu PDF" src={pdfUrl} style={{ width: '100%', height: '78vh', border: `1px solid ${COUL.bord}`, borderRadius: 10, background: COUL.surface }} />
                {/* Repli : certains navigateurs refusent d'afficher un PDF dans
                    un cadre. L'apercu serait alors blanc, sans rien pour s'en sortir. */}
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: ORANGE }}>
                    Cadre vide ? Ouvrir le PDF dans un onglet
                  </a>
                </div>
              </> : <div style={{ padding: 40, textAlign: 'center', color: COUL.texteDoux, fontSize: 14 }}>{pdfErr || 'Génération de l’aperçu…'}</div>}
            </div>
          ) : (
          <div style={{ maxWidth: 860, margin: '0 auto', background: COUL.surface, borderRadius: 12, boxShadow: '0 1px 3px rgba(15,23,42,.08), 0 8px 28px rgba(15,23,42,.06)', padding: mobE ? 18 : 38 }}>

            {/* Titre + dates */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 26 }}>
              <div style={{ fontSize: mobE ? 22 : 27, fontWeight: 800, color: ORANGE, letterSpacing: -.5 }}>
                {isDevis ? 'DEVIS' : (f.type === 'note_credit' ? 'NOTE DE CRÉDIT' : 'FACTURE')}
                {/* LE NUMÉRO DE DEVIS EST CORRIGEABLE, celui d'une facture ne l'est pas.
                    Demandé par Ludovic le 13/11 : « le temps que je puisse mettre à jour
                    toutes les données ».
                    ⚠️ ET SEULEMENT POUR UN DEVIS. Un numéro de facture belge doit être
                    séquentiel, continu et jamais modifié après émission : le rendre
                    corrigeable ouvrirait un trou dans la numérotation légale, et on ne
                    s'en aperçoit qu'au contrôle. Une facture mal numérotée se corrige par
                    une note de crédit, pas par un champ de saisie.

                    ⚠️ `doc?.id` et NON `docId` : `docId` est une variable LOCALE à la
                    fonction d'enregistrement, pas une valeur du composant. L'employer
                    ici levait « docId is not defined » au rendu et cassait toute la page
                    Devis & Factures en production, le 14/11/2026.

                    Le piège : `npm run build` passe sans rien dire. Une variable absente
                    de la portée est une erreur d'EXÉCUTION, pas de compilation, et Vite
                    ne la voit pas. Ce qui l'aurait vue, c'est ESLint (`no-undef`) ou
                    simplement l'ouverture de la page après le déploiement. */}
                {/* ⚠️ MODIFIABLE À NOUVEAU, et c'est encore temporaire.
                    Je l'avais rebloqué le 14/11 à midi ; Ludovic l'a redemandé
                    dans la foulée : « tu dois me permettre de modifier les
                    numéros de devis […] pour que je puisse mettre de l'ordre ».
                    À refermer quand la reprise sera finie — un numéro métier
                    qui bouge finit porté deux fois, ou troue la séquence.

                    ⚠️ ET SEULEMENT POUR UN DEVIS. Un numéro de facture belge
                    doit être séquentiel, continu et jamais modifié après
                    émission : le rendre corrigeable ouvrirait un trou dans la
                    numérotation légale, et on ne s'en aperçoit qu'au contrôle.
                    Une facture mal numérotée se corrige par une note de
                    crédit, pas par un champ de saisie. */}
                {isDevis && doc?.id ? (
                  <input value={f.numero || ''} onChange={e => set('numero', e.target.value)}
                    placeholder="n° du devis" title="Corrigeable — le temps de la reprise"
                    style={{ marginLeft: 10, color: NAVY, fontWeight: 700, fontSize: 'inherit',
                      fontFamily: 'inherit', width: Math.max(9, String(f.numero || '').length + 1) + 'ch',
                      border: 'none', borderBottom: `1px dashed ${COUL.bord}`, background: 'transparent',
                      padding: '0 2px', outline: 'none' }} />
                ) : (
                  <span style={{ marginLeft: 10, color: f.numero ? NAVY : COUL.texteFaible, fontWeight: 700 }}>{f.numero || 'n° à l’enregistrement'}</span>
                )}

              </div>
              <div style={{ minWidth: 212, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(isDevis
                  ? [['Date', 'date_devis'], ['Valable jusqu’au', 'date_validite']]
                  : [['Date', 'date_facture'], ['Échéance', 'date_echeance']]
                ).map(([lab, k]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: COUL.texteFaible, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{lab}</span>
                    <input type="date" value={f[k] || ''} onChange={e => set(k, e.target.value)} {...surDoc}
                      style={{ ...champDoc, width: 142, fontSize: 13, fontWeight: 600, color: NAVY, textAlign: 'right' }} />
                  </div>
                ))}
              </div>
            </div>

            {/* De / À */}
            <div style={{ display: 'grid', gridTemplateColumns: mobE ? '1fr' : '1fr 1fr', gap: 18, background: COUL.fond, borderRadius: 10, padding: 16, marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>De</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: ORANGE }}>{LODE.raison_sociale}</div>
                <div style={{ fontSize: 12, color: COUL.texteMoyen, lineHeight: 1.55 }}>
                  {LODE.adresse}<br />{LODE.cp} {LODE.ville}<br />TVA {LODE.tva}
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: .5 }}>À</span>
                  <button type="button" onClick={() => setClientOuvert(true)}
                    style={{ background: 'none', border: 'none', color: ORANGE, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, padding: 0, textDecoration: 'underline' }}>
                    {f.client_nom ? 'modifier' : 'choisir un client'}
                  </button>
                  {f.client_id && <span title="Client lié à la base" style={{ fontSize: 11, color: COUL.succesFonce, fontWeight: 700 }}>✓ lié</span>}
                </div>
                {f.client_nom ? (
                  <div onClick={() => setClientOuvert(true)} style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{f.client_nom}</div>
                    <div style={{ fontSize: 12, color: COUL.texteMoyen, lineHeight: 1.55 }}>
                      {f.client_adresse && <>{f.client_adresse}<br /></>}
                      {(f.client_cp || f.client_ville) && <>{f.client_cp} {f.client_ville}<br /></>}
                      {f.client_tva && <>TVA {f.client_tva}<br /></>}
                      {f.client_email && <span style={{ color: COUL.texteFaible }}>{f.client_email}</span>}
                    </div>
                  </div>
                ) : (
                  <div onClick={() => setClientOuvert(true)} style={{ cursor: 'pointer', fontSize: 13, color: COUL.texteFaible, fontStyle: 'italic' }}>Aucun client — cliquez pour en choisir un</div>
                )}
              </div>
            </div>

            {/* Objet */}
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Objet : </span>
              <input value={f.objet || ''} onChange={e => set('objet', e.target.value)} {...surDoc}
                placeholder="ex : Installation porte sectionnelle"
                style={{ ...champDoc, width: 'auto', minWidth: 300, fontSize: 13, fontWeight: 700, color: NAVY }} />
            </div>

            {/* ── Tableau 1 : le projet (facture d'acompte seulement) ── */}
            {estAcompte && (
              <div style={{ marginBottom: 26 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: ORANGE }}>Répartition du projet</div>
                <div style={{ fontSize: 11.5, color: COUL.texteDoux, marginBottom: 8 }}>Articles initialement convenus — rappelés au client, non facturés ici</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <EnteteDoc />
                  <tbody>{lignes.map((l, i) => l.bloc === 'projet' ? <RangeeDoc key={i} l={l} idx={i} cliquable={!verrouille} /> : null)}</tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <div style={{ minWidth: 260 }}>
                    <LigneTotal label="Total du projet (hors TVA)" valeur={eur(totProjet?.ht)} />
                    <LigneTotal label="Total du projet (TVA incl.)" valeur={eur(totProjet?.ttc)} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Tableau 2 : ce qu'on facture ── */}
            {estAcompte && <div style={{ fontSize: 13.5, fontWeight: 800, color: ORANGE, marginBottom: 8 }}>À payer avec cette facture</div>}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <EnteteDoc />
              <tbody>
                {lignes.map((l, i) => l.bloc === 'projet' ? null : <RangeeDoc key={i} l={l} idx={i} cliquable={!verrouille} />)}
                {!lignesFacture.length && (
                  <tr><td colSpan={hasRemiseDoc ? 7 : 6} style={{ ...tdDoc, color: COUL.texteFaible, fontStyle: 'italic', textAlign: 'center', padding: 18 }}>Aucun article</td></tr>
                )}
              </tbody>
            </table>

            {!verrouille && (
              <button onClick={() => { addLigne(); setArticleOuvert(lignes.length) }}
                style={{ width: '100%', marginTop: 10, background: COUL.surface, border: `1px dashed ${COUL.bordFort}`, borderRadius: 9, padding: '11px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: ORANGE }}>
                ＋ Ajouter un article
              </button>
            )}

            {/* Totaux */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
              <div style={{ minWidth: 290 }}>
                <LigneTotal label="Total hors TVA" valeur={eur(tot.ht)} />
                {Object.entries(tot.parTaux).filter(([, v]) => v > 0).map(([t, v]) => (
                  <LigneTotal key={t} label={`TVA ${t}%`} valeur={eur(v)} />
                ))}
                {totDeduction < 0 && <LigneTotal label="Acomptes déjà facturés" valeur={eur(totDeduction)} couleur={COUL.alerte} />}
                {acomptePaye > 0 && <LigneTotal label="Acompte déjà payé" valeur={'− ' + eur(acomptePaye)} couleur={COUL.alerte} />}
                <LigneTotal fort label={acomptePaye > 0 ? 'Montant dû' : (isDevis ? 'Total TVA comprise' : 'Montant dû')} valeur={eur(acomptePaye > 0 ? montantDu : tot.ttc)} />
                {estAcompte && soldeProjet > 0.004 && (
                  <LigneTotal label="Solde restant sur le projet, à payer plus tard" valeur={eur(soldeProjet)} couleur={COUL.texteDoux} />
                )}
              </div>
            </div>

            {/* Pied : paiement */}
            <div style={{ marginTop: 26, paddingTop: 16, borderTop: `1px solid ${COUL.bord}`, fontSize: 11.5, color: COUL.texteDoux, lineHeight: 1.6 }}>
              Paiement par virement : <strong style={{ color: NAVY }}>{LODE.iban}</strong> ({LODE.bic})
              {!isDevis && f.type !== 'note_credit' && (
                <> — communication structurée : <strong style={{ color: NAVY }}>
                  {communicationStructuree(f.numero)?.affiche || '(à l’enregistrement)'}
                </strong></>
              )}
              {f.notes && <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{f.notes}</div>}
            </div>
          </div>
          )}
        </div>

        {/* ══════════ PANNEAU DÉTAILS ══════════ */}
        <div style={{ width: mobE ? '100%' : 340, flex: mobE ? 1 : 'none', flexShrink: 0, background: COUL.surface, borderLeft: mobE ? 'none' : `1px solid ${COUL.bord}`, overflowY: 'auto', display: (mobE && vue !== 'details') ? 'none' : 'block' }}>
          {!mobE && <div style={{ padding: '13px 18px', borderBottom: `1px solid ${COUL.bord}`, fontSize: 13.5, fontWeight: 800, color: NAVY }}>Détails</div>}

          {/* Type / responsable / langue / statut */}
          <div style={blocPanneau}>
            {!isDevis && (
              <div style={{ marginBottom: 14 }}>
                <div style={titrePanneau}>Type de document</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[['facture', 'Facture'], ['acompte', 'Acompte'], ['solde', 'Solde'], ['note_credit', 'Note de crédit']].map(([v, lab]) => {
                    const on = (f.type || 'facture') === v
                    return <button key={v} type="button" onClick={() => set('type', v)} style={{ padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, border: `1.5px solid ${on ? ORANGE : COUL.bord}`, background: on ? COUL.orangeFond : COUL.blanc, color: on ? ORANGE : COUL.texteDoux }}>{lab}</button>
                  })}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gap: 10 }}>
              {(
                <div>
                  {/* Plus d'étoile rouge : le champ n'est plus obligatoire le
                      temps de la reprise. L'avertissement à l'enregistrement
                      suffit à ce qu'on sache ce qu'on laisse derrière soi. */}
                  <label style={lbl}>Chantier</label>
                  <select style={{ ...inp, borderColor: f.dossier_id ? COUL.bord : '#fbbf24' }}
                    value={f.dossier_id || ''} onChange={e => set('dossier_id', e.target.value || null)}>
                    <option value="">— aucun (à rattacher plus tard)</option>
                    {dossiersDuClient.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.numero} · {d.titre}
                        {/* Un chantier clos reste choisissable, mais on le DIT :
                            le rattacher rouvrira celui qui s'est fermé tout
                            seul, pas celui qu'on a fermé à la main. */}
                        {d.statut === 'clos' ? (d.cloture_auto ? '  (clos — se rouvrira)' : '  (clos à la main)') : ''}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: COUL.texteFaible, marginTop: 4 }}>
                    {!f.client_id
                      ? 'Choisis d’abord le client : la liste s’y limitera.'
                      : dossiersDuClient.length === 0
                        ? `Aucun chantier ouvert pour ${f.client_nom || 'ce client'}.`
                        : `Chantiers de ${f.client_nom || 'ce client'} uniquement.`}
                  </div>
                  {!f.dossier_id && f.client_id && (
                    <button type="button" onClick={creerDossierDepuisDevis} disabled={creationDossier}
                      style={{ marginTop: 6, width: '100%', padding: '8px', borderRadius: 8, border: `1px solid ${ORANGE}`, background: COUL.blanc, color: ORANGE, fontSize: 12.5, fontWeight: 700, cursor: creationDossier ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                      {creationDossier ? 'Création…' : `+ Créer le chantier${f.client_nom ? ' pour ' + f.client_nom : ''}`}
                    </button>
                  )}
                </div>
              )}
              <div><label style={lbl}>Responsable</label>
                {/* La liste vient de `collaborateurs`, plus de trois noms écrits
                    en dur ici. Deux écrans avec deux listes différentes, c'est
                    exactement ce que Ludovic a vu : « je ne comprends pas
                    pourquoi un seul, et dans devis j'ai les trois ». */}
                <select style={inp} value={f.responsable || ''} onChange={e => set('responsable', e.target.value)}>
                  <option value="">—</option>
                  {responsables.map(r => <option key={r.code} value={r.code}>{r.code} — {r.nom_complet}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><label style={lbl}>Langue</label>
                  <select style={inp} value={f.langue || 'fr'} onChange={e => set('langue', e.target.value)}>
                    {LANGUES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Statut</label>
                  <select style={inp} value={f.statut} onChange={e => set('statut', e.target.value)}>
                    {Object.entries(isDevis ? STATUTS_DEVIS : STATUTS_FACT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Acompte */}
          {!isDevis && (
            <div style={blocPanneau}>
              <div style={titrePanneau}>Acompte</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <label style={lbl}>Acompte déjà payé par le client</label>
                  <input type="number" step="0.01" min="0" style={inp}
                    value={f.montant_paye === 0 ? '0' : (f.montant_paye || '')}
                    onChange={e => set('montant_paye', e.target.value)} placeholder="0,00" />
                  <div style={{ fontSize: 11, color: COUL.texteFaible, marginTop: 4, lineHeight: 1.5 }}>
                    Déduit <strong>après la TVA</strong> : la TVA reste due sur la totalité.
                    {acomptePaye > 0 && <> Il restera <strong>{eur(montantDu)}</strong> à payer.</>}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Facturer un % du projet</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="number" step="1" min="1" max="100" style={{ ...inp, flex: 1 }}
                      value={acomptePct} onChange={e => setAcomptePct(e.target.value)} placeholder="ex : 30" />
                    <button type="button" onClick={appliquerPourcentage}
                      style={{ padding: '0 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, border: 'none', background: ORANGE, color: COUL.blanc, whiteSpace: 'nowrap' }}>Calculer</button>
                  </div>
                  <div style={{ fontSize: 11, color: COUL.texteFaible, marginTop: 4, lineHeight: 1.5 }}>
                    Saisis d’abord les articles du projet. Le calcul garde ces articles en rappel et ajoute la ligne d’acompte, <strong>taux de TVA par taux de TVA</strong>.
                  </div>
                </div>
                {(f.type === 'acompte' || f.type === 'solde') && (
                  <div>
                    <label style={lbl}>Total projet TTC (pour mémoire)</label>
                    <input type="number" step="0.01" style={inp} value={f.total_projet_ttc || ''} onChange={e => set('total_projet_ttc', e.target.value)} placeholder="ex : 10000.00" />
                    {resteAFacturer !== null && (
                      <div style={{ fontSize: 11.5, color: ORANGE, fontWeight: 700, marginTop: 5 }}>
                        Il reste {eur(resteAFacturer)} à facturer{dejaFacture > 0 ? ` (${eur(dejaFacture)} déjà facturé)` : ''}.
                      </div>
                    )}
                  </div>
                )}
                {f.type === 'solde' && !doc?.id && (
                  <div>
                    <label style={lbl}>Acomptes déjà facturés à déduire</label>
                    {!f.client_id && <div style={{ fontSize: 11.5, color: COUL.alerte }}>Lie d’abord le client pour retrouver ses acomptes.</div>}
                    {f.client_id && acomptesDispo.length === 0 && <div style={{ fontSize: 11.5, color: COUL.texteDoux }}>Aucun acompte trouvé pour ce client.</div>}
                    {acomptesDispo.map(ac => (
                      <label key={ac.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, padding: '4px 0', cursor: 'pointer' }}>
                        <input type="checkbox" checked={acomptesSel.includes(ac.id)} onChange={e => setAcomptesSel(p => e.target.checked ? [...p, ac.id] : p.filter(x => x !== ac.id))} />
                        <span style={{ fontWeight: 700 }}>{ac.numero}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{eur(ac.total_ttc)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Note de credit */}
          {!isDevis && f.type === 'note_credit' && (
            <div style={{ ...blocPanneau, background: COUL.dangerFondDoux }}>
              <div style={{ ...titrePanneau, color: COUL.danger }}>Facture à créditer</div>
              {!f.client_id && <div style={{ fontSize: 11.5, color: COUL.alerte }}>Lie d’abord le client pour retrouver ses factures.</div>}
              {f.client_id && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <select style={inp} value={f.facture_origine_id || ''} onChange={e => set('facture_origine_id', e.target.value)}>
                    <option value="">—</option>
                    {origines.map(o => <option key={o.id} value={o.id}>{o.numero} · {eur(o.total_ttc)} · {(o.date_facture || '').slice(0, 10)}</option>)}
                  </select>
                  <button type="button" disabled={!f.facture_origine_id} onClick={reprendreLignesNegatif}
                    style={{ background: f.facture_origine_id ? COUL.danger : COUL.bordFort, color: COUL.blanc, border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 700, cursor: f.facture_origine_id ? 'pointer' : 'not-allowed' }}>↩ Reprendre les lignes en négatif</button>
                </div>
              )}
            </div>
          )}

          {/* Remise globale */}
          <div style={blocPanneau}>
            <div style={titrePanneau}>Remise globale</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" step="0.01" style={{ ...inp, width: 90 }} value={f.remise_pct} onChange={e => set('remise_pct', e.target.value)} />
              <span style={{ fontSize: 13, color: COUL.texteDoux, fontWeight: 600 }}>% sur tout le document</span>
            </div>
          </div>

          {/* Import PDF fournisseur */}
          <div style={blocPanneau}>
            <div style={titrePanneau}>Importer un devis fournisseur</div>
            <div
              onDragOver={e => { e.preventDefault(); setImportPDF(p => ({ ...p, drag: true })) }}
              onDragLeave={e => { e.preventDefault(); setImportPDF(p => ({ ...p, drag: false })) }}
              onDrop={e => { e.preventDefault(); const fs = [...e.dataTransfer.files].filter(x => x.type === 'application/pdf'); if (fs.length) importerPDFs(fs) }}
              style={{ border: `2px dashed ${importPDF.drag ? ORANGE : COUL.bordFort}`, background: importPDF.drag ? COUL.orangeFond : COUL.fond, borderRadius: 9, padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 11.5, color: COUL.texteDoux, marginBottom: 8, lineHeight: 1.5 }}>SDA / Marquise — glissez le PDF ici, les articles seront pré-remplis</div>
              <label style={{ display: 'inline-block', background: COUL.surface, border: `1px solid ${ORANGE}`, color: ORANGE, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {importPDF.loading ? 'Lecture…' : 'Parcourir…'}
                <input type="file" accept="application/pdf" multiple style={{ display: 'none' }} onChange={e => { const fs = [...e.target.files]; if (fs.length) importerPDFs(fs); e.target.value = '' }} />
              </label>
              {importPDF.msg && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: importPDF.msg.startsWith('✓') ? COUL.succes : importPDF.msg.startsWith('⚠') ? COUL.alerte : COUL.danger }}>{importPDF.msg}</div>}
            </div>
          </div>

          {/* Notes */}
          <div style={blocPanneau}>
            <div style={titrePanneau}>Note de bas de document</div>
            <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={f.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Visible sous le total, sur le document." />
          </div>
        </div>
      </div>

      {/* ── Modale d'article ── */}
      {articleOuvert !== null && lignes[articleOuvert] && (
        <ModalArticle
          l={lignes[articleOuvert]} i={articleOuvert} setLigne={setLigne}
          delLigne={delLigne} ajouterPhotos={ajouterPhotos} mobE={mobE}
          clientTva={f.client_tva} clientPays={f.client_pays}
          onClose={() => setArticleOuvert(null)}
        />
      )}

      {/* ── Modale client ── */}
      {clientOuvert && (
        <ModalClient
          f={f} set={set} mobE={mobE}
          clientQuery={clientQuery} setClientQuery={setClientQuery}
          clientResults={clientResults} searching={searching}
          choisirClient={c => { choisirClient(c); setClientOuvert(false) }}
          creerClient={creerClient} creatingClient={creatingClient}
          onClose={() => setClientOuvert(false)}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  MODALE ARTICLE — un article s'edite dans sa fiche, pas dans une
//  rangee de douze champs serres. Le document reste lisible, et tous
//  les reglages (TVA, categorie, remise, photos, option) tiennent ici.
// ════════════════════════════════════════════════════════════════
function ModalArticle({ l, i, setLigne, delLigne, ajouterPhotos, onClose, mobE, clientTva, clientPays }) {
  const taux = Number(l.tva_pct) || 0
  const pu = Number(l.prix_unitaire) || 0
  const [tvac, setTvac] = useState(false)
  const [remiseOuverte, setRemiseOuverte] = useState(Number(l.remise_pct) > 0)
  // Le prix saisi TVAC est reconverti en HTVA a 2 decimales : c'est le prix
  // HTVA qui est stocke, imprime et multiplie par la quantite. Garder plus de
  // decimales ferait un total qui ne colle pas au prix unitaire affiche.
  const prixAffiche = tvac ? Math.round(pu * (1 + taux / 100) * 100) / 100 : pu

  // ⚠️ LE CHAMP PRIX NE PEUT PAS ÊTRE DÉRIVÉ À CHAQUE FRAPPE.
  //
  // Ludovic : « je clique sur TVA comprise, et là je ne sais plus modifier le
  // montant ». Deux causes, toutes deux réelles :
  //
  //  1. `type="number"` rend une valeur VIDE dès qu'on tape une virgule — et
  //     `Number('')` vaut 0. Le montant s'effaçait à la frappe. En Belgique on
  //     tape une virgule : c'est le champ qui doit s'adapter, pas la personne.
  //
  //  2. En mode TVA comprise, la valeur affichée était recalculée à chaque
  //     frappe (TVAC → HTVA arrondi → TVAC arrondi). Le texte en cours de
  //     saisie était donc réécrit sous les doigts, curseur compris.
  //
  // On garde donc le texte TEL QUE TAPÉ pendant la saisie, et on ne le
  // resynchronise sur le modèle qu'à la sortie du champ ou quand la bascule
  // TVA / le taux change — c'est-à-dire quand la valeur affichée doit
  // légitimement changer.
  const [prixTexte, setPrixTexte] = useState(null)   // null = suit le modèle
  useEffect(() => { setPrixTexte(null) }, [tvac, taux])
  const majPrix = (v) => {
    setPrixTexte(v)
    const n = Number(String(v).replace(',', '.').replace(/\s/g, ''))
    if (!Number.isFinite(n)) return      // saisie intermédiaire (« 2500, ») : on attend
    setLigne(i, 'prix_unitaire', tvac ? Math.round((n / (1 + taux / 100)) * 100) / 100 : n)
  }
  const ht = (Number(l.quantite) || 0) * pu * (1 - (Number(l.remise_pct) || 0) / 100)
  const ttc = ht * (1 + taux / 100)
  // Un numero de TVA qui ne commence pas par BE, ou un pays autre que la
  // Belgique : on signale, on ne decide pas. La regle depend de la prestation
  // (un chantier immobilier en Belgique reste taxe en Belgique), et c'est au
  // comptable de trancher, pas au logiciel.
  const tvaCl = String(clientTva || '').replace(/[^A-Za-z]/g, '').toUpperCase()
  const paysCl = String(clientPays || '').trim().toLowerCase()
  const etranger = (tvaCl && !tvaCl.startsWith('BE')) || (!!paysCl && !['belgique', 'belgium', 'be', 'belgie', 'belgië'].includes(paysCl))

  const inp2 = { padding: '9px 11px', border: `1px solid ${COUL.bord}`, borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const lbl2 = { fontSize: 11.5, fontWeight: 700, color: COUL.texteDoux, marginBottom: 4, display: 'block' }
  const pas = (d) => setLigne(i, 'quantite', Math.max(0, (Number(l.quantite) || 0) + d))

  // ⚠️ FERMER SUR `onClick` SEUL FERME LA FENÊTRE QUAND ON SÉLECTIONNE DU TEXTE.
  //
  // Ludovic : « lorsque je veux sélectionner le montant, la fenêtre se ferme ».
  //
  // On appuie dans le champ, on glisse, on relâche hors de la carte : le
  // navigateur attribue alors le `click` à l'ancêtre commun, donc à
  // l'arrière-plan. Un geste de sélection parfaitement normal était lu comme
  // un clic dehors — et la saisie en cours était perdue.
  //
  // On ne ferme donc que si le bouton a été ENFONCÉ sur l'arrière-plan.
  return (
    <div
      {...voile(onClose)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 14px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: `1px solid ${COUL.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>Éditer l’article</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 21, cursor: 'pointer', color: COUL.texteFaible }}>×</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl2}>Nom</label>
            <input autoFocus style={inp2} value={l.titre || ''} onChange={e => setLigne(i, 'titre', e.target.value)} placeholder="ex : Porte sectionnelle" />
          </div>
          <div>
            <label style={lbl2}>Description <span style={{ fontWeight: 500, color: COUL.texteFaible }}>(optionnel)</span></label>
            <textarea style={{ ...inp2, minHeight: 64, resize: 'vertical', fontSize: 12.5 }} value={l.descriptif || ''} onChange={e => setLigne(i, 'descriptif', e.target.value)} placeholder="Dimensions, coloris, options…" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: mobE ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl2}>Quantité</label>
              <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${COUL.bord}`, borderRadius: 9, overflow: 'hidden' }}>
                <button type="button" onClick={() => pas(-1)} style={{ width: 36, height: 38, border: 'none', background: COUL.fondDoux, cursor: 'pointer', fontSize: 17, color: COUL.texteMoyen }}>−</button>
                <input type="number" step="0.01" value={l.quantite} onChange={e => setLigne(i, 'quantite', e.target.value)}
                  style={{ flex: 1, border: 'none', textAlign: 'center', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', outline: 'none', width: '100%', minWidth: 0 }} />
                <button type="button" onClick={() => pas(1)} style={{ width: 36, height: 38, border: 'none', background: COUL.fondDoux, cursor: 'pointer', fontSize: 17, color: COUL.texteMoyen }}>＋</button>
              </div>
            </div>
            <div>
              <label style={lbl2}>Taux de TVA</label>
              <select style={inp2} value={l.tva_pct} onChange={e => setLigne(i, 'tva_pct', e.target.value)}>
                {TVA_TAUX.map(t => <option key={t.val} value={t.val}>{t.val}%{t.label ? ' — ' + t.label : ''}</option>)}
              </select>
            </div>
          </div>

          {etranger && taux > 0 && (
            <div style={{ background: COUL.alerteFond, border: `1px solid ${COUL.alerteVif}`, borderRadius: 9, padding: '10px 13px', fontSize: 11.5, color: COUL.alerteFonce, lineHeight: 1.55 }}>
              <strong>Client hors Belgique ({String(clientTva || clientPays || '').trim()})</strong> — un taux de TVA belge est appliqué.
              Selon la nature de la prestation, c’est peut-être l’autoliquidation qui s’applique
              (TVA à 0 %, catégorie AE). À vérifier avant d’émettre.
            </div>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ ...lbl2, marginBottom: 0 }}>Prix unitaire</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: tvac ? ORANGE : COUL.texteDoux, cursor: 'pointer' }}>
                <input type="checkbox" checked={tvac} onChange={e => setTvac(e.target.checked)} />
                TVA comprise
              </label>
            </div>
            <input type="text" inputMode="decimal" style={inp2}
              value={prixTexte ?? String(prixAffiche)}
              onChange={e => majPrix(e.target.value)}
              onBlur={() => setPrixTexte(null)} />
            <div style={{ fontSize: 11, color: COUL.texteFaible, marginTop: 4 }}>
              {tvac ? `Soit ${eur(pu)} hors TVA` : `Soit ${eur(pu * (1 + taux / 100))} TVA comprise`}
            </div>
          </div>

          {taux === 0 && (
            <div>
              <label style={lbl2}>Catégorie TVA (exonération)</label>
              <select style={inp2} value={l.tva_categorie || 'AE'} onChange={e => setLigne(i, 'tva_categorie', e.target.value)}>
                <option value="AE">AE — autoliquidation</option>
                <option value="Z">Z — taux zéro</option>
                <option value="E">E — exonéré</option>
                <option value="K">K — intracommunautaire</option>
                <option value="G">G — exportation</option>
              </select>
            </div>
          )}

          {/* Remise, repliee tant qu'elle vaut zero */}
          {remiseOuverte ? (
            <div>
              <label style={lbl2}>Remise sur cet article</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" step="0.01" style={{ ...inp2, width: 110 }} value={l.remise_pct} onChange={e => setLigne(i, 'remise_pct', e.target.value)} />
                <span style={{ fontSize: 13, color: COUL.texteDoux, fontWeight: 600 }}>%</span>
                <button type="button" onClick={() => { setLigne(i, 'remise_pct', 0); setRemiseOuverte(false) }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: COUL.texteFaible, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>retirer</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setRemiseOuverte(true)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: ORANGE, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, padding: 0 }}>＋ Ajouter une remise</button>
          )}

          {/* Photos */}
          <div>
            <label style={lbl2}>Photos</label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {(l.photos || []).map((ph, pi) => (
                <div key={pi} style={{ width: 70, height: 70, borderRadius: 8, overflow: 'hidden', position: 'relative', border: `1px solid ${COUL.bord}`, background: COUL.fondDoux }}>
                  <img src={ph.url || ph} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span onClick={() => setLigne(i, 'photos', (l.photos || []).filter((_, j) => j !== pi))} style={{ position: 'absolute', top: 2, right: 3, background: 'rgba(0,0,0,.55)', color: COUL.blanc, borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>×</span>
                </div>
              ))}
              <label style={{ width: 70, height: 70, borderRadius: 8, border: `1px dashed ${ORANGE}`, background: COUL.orangeFond, color: ORANGE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10.5 }}>
                <span style={{ fontSize: 17 }}>＋</span>photo
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => ajouterPhotos(i, [...e.target.files])} />
              </label>
            </div>
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: COUL.texteMoyen, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!l.optionnelle} onChange={e => setLigne(i, 'optionnelle', e.target.checked)} />
            Option au choix — proposée au client, non comptée dans le total
          </label>

          <div style={{ background: COUL.fond, borderRadius: 9, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: COUL.texteDoux, fontWeight: 600 }}>Total hors TVA</span><span style={{ fontWeight: 700, color: NAVY }}>{eur(ht)}</span>
          </div>
          <div style={{ background: COUL.orangeFond, borderRadius: 9, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 14.5 }}>
            <span style={{ color: ORANGE, fontWeight: 700 }}>Total TVA comprise</span><span style={{ fontWeight: 800, color: ORANGE }}>{eur(ttc)}</span>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 2 }}>
            <button onClick={() => { delLigne(i); onClose() }} style={{ background: 'none', border: `1px solid ${COUL.dangerBord}`, color: COUL.danger, borderRadius: 9, padding: '9px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Supprimer</button>
            <button onClick={onClose} style={{ background: ORANGE, border: 'none', color: COUL.blanc, borderRadius: 9, padding: '9px 26px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Terminé</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  MODALE CLIENT — recherche dans la base, ou saisie manuelle.
// ════════════════════════════════════════════════════════════════
function ModalClient({ f, set, clientQuery, setClientQuery, clientResults, searching, choisirClient, creerClient, creatingClient, onClose, mobE }) {
  const inp2 = { padding: '9px 11px', border: `1px solid ${COUL.bord}`, borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const lbl2 = { fontSize: 11.5, fontWeight: 700, color: COUL.texteDoux, marginBottom: 4, display: 'block' }
  return (
    <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 14px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: '100%', maxWidth: 620, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: `1px solid ${COUL.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>Client</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 21, cursor: 'pointer', color: COUL.texteFaible }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ position: 'relative' }}>
            <label style={lbl2}>Rechercher dans la base (nom, dossier, ville, email, TVA…)</label>
            <input autoFocus style={inp2} value={clientQuery} placeholder="Tapez au moins 2 caractères" onChange={e => setClientQuery(e.target.value)} />
            {clientQuery.trim().length >= 2 && (
              <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, background: COUL.surface, border: `1px solid ${COUL.bord}`, borderRadius: 9, marginTop: 4, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
                {searching && <div style={{ padding: 10, fontSize: 13, color: COUL.texteDoux }}>Recherche…</div>}
                {!searching && clientResults.length === 0 && <div style={{ padding: 10, fontSize: 13, color: COUL.texteDoux }}>Aucun client trouvé</div>}
                {clientResults.map(c => {
                  const L = labelClient(c)
                  return (
                    <div key={c.id} onClick={() => choisirClient(c)} style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = COUL.fond} onMouseLeave={e => e.currentTarget.style.background = COUL.blanc}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{L.icon} {L.nom}</div>
                      {L.sub && <div style={{ fontSize: 11, color: COUL.texteDoux }}>{L.sub}</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: COUL.bord, margin: '2px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: mobE ? '1fr' : '2fr 1fr', gap: 10 }}>
            <div><label style={lbl2}>Nom / société *</label><input style={inp2} value={f.client_nom} onChange={e => set('client_nom', e.target.value)} /></div>
            <div><label style={lbl2}>N° TVA</label><input style={inp2} value={f.client_tva} onChange={e => set('client_tva', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobE ? '1fr' : '2fr 1fr 1fr', gap: 10 }}>
            <div><label style={lbl2}>Adresse</label><input style={inp2} value={f.client_adresse} onChange={e => set('client_adresse', e.target.value)} /></div>
            <div><label style={lbl2}>Code postal</label><input style={inp2} value={f.client_cp} onChange={e => set('client_cp', e.target.value)} /></div>
            <div><label style={lbl2}>Ville</label><input style={inp2} value={f.client_ville} onChange={e => set('client_ville', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mobE ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <div><label style={lbl2}>Email</label><input style={inp2} value={f.client_email} onChange={e => set('client_email', e.target.value)} /></div>
            <div><label style={lbl2}>Téléphone</label><input style={inp2} value={f.client_telephone} onChange={e => set('client_telephone', e.target.value)} /></div>
            <div><label style={lbl2}>Pays</label><input style={inp2} value={f.client_pays || ''} onChange={e => set('client_pays', e.target.value)} /></div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {f.client_id ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: COUL.succesFond, color: COUL.succesFonce, border: `1px solid ${COUL.succesBord}`, borderRadius: 8, padding: '7px 12px', fontSize: 12.5, fontWeight: 700 }}>
                ✓ Client lié à la base
                <button onClick={() => set('client_id', null)} title="Détacher pour ressaisir un autre client" style={{ background: 'none', border: 'none', color: COUL.succesFonce, cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>détacher</button>
              </div>
            ) : (
              <button onClick={creerClient} disabled={creatingClient || !f.client_nom.trim()}
                style={{ background: f.client_nom.trim() ? ORANGE : COUL.bordFort, color: COUL.blanc, border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 12.5, fontWeight: 700, cursor: (f.client_nom.trim() && !creatingClient) ? 'pointer' : 'not-allowed' }}>
                {creatingClient ? 'Création…' : '➕ Créer ce client dans la base'}
              </button>
            )}
            <button onClick={onClose} style={{ marginLeft: 'auto', background: ORANGE, border: 'none', color: COUL.blanc, borderRadius: 9, padding: '9px 26px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Terminé</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  EXPORTS PDF / EXCEL
// ════════════════════════════════════════════════════════════════
// Nom de fichier des pièces de vente : « 2026001 - CLIENT - 980,10 EUR.pdf » (montant TTC).
// Les devis gardent leur nom habituel.
// ── Communication structurée belge ──────────────────────────────────────
// Douze chiffres : dix libres, puis deux de controle = les dix premiers
// modulo 97, et 97 quand le reste est nul. Elle est DERIVEE du numero de
// facture, donc stable sans rien stocker : la meme facture rend toujours la
// meme communication, hier comme dans trois ans.
// Pas de communication sur un devis (rien a payer) ni sur une note de credit
// (l'argent va dans l'autre sens).
function communicationStructuree(numero) {
  const chiffres = String(numero || '').replace(/\D/g, '')
  if (!chiffres) return null
  const base = chiffres.slice(-10).padStart(10, '0')
  const reste = Number(BigInt(base) % 97n) || 97
  const douze = base + String(reste).padStart(2, '0')
  return { brut: douze, affiche: `+++${douze.slice(0, 3)}/${douze.slice(3, 7)}/${douze.slice(7)}+++` }
}

// ── QR code de paiement EPC (SEPA Credit Transfer) ──────────────────────
// Douze lignes. Les champs 10 (reference structuree ISO 11649, celles en
// « RF ») et 11 (communication libre) s'excluent : on n'en remplit qu'un.
// La communication belge « +++...+++ » n'est PAS une reference ISO 11649,
// elle part donc en champ 11 — c'est ce que fait deja l'ecran des notes de
// frais de ce meme Hub.
// Renvoie null plutot que de lever : un QR manquant est un desagrement, une
// facture qui refuse de sortir est un blocage.
async function qrPaiementEPC({ benef, iban, bic, montant, communication }) {
  const m = Math.round((Number(montant) || 0) * 100) / 100
  const compte = String(iban || '').replace(/\s+/g, '').toUpperCase()
  if (!(m > 0) || compte.length < 15) return null
  const payload = [
    'BCD', '002', '1', 'SCT',
    String(bic || '').replace(/\s+/g, ''),
    String(benef || '').slice(0, 70),
    compte,
    `EUR${m.toFixed(2)}`,
    '', '',
    String(communication || '').slice(0, 140),
    '',
  ].join('\n')
  try { return await QRCode.toDataURL(payload, { margin: 0, width: 320, errorCorrectionLevel: 'M' }) }
  catch { return null }
}

function nomFichierDoc(doc, type, ext) {
  if (type === 'devis') return `Devis_${doc.numero}.${ext}`
  const client = String(doc.client_nom || 'Client').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim()
  const montant = Math.abs(Number(doc.total_ttc || 0)).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
  return `${String(doc.numero || '').trim()} - ${client} - ${montant}€.${ext}`
}
async function exportPDF(type, doc, lignes, opts = {}) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  const { jsPDF } = window.jspdf
  const d = new jsPDF({ compress: true })  // Flate sur les flux : evite que le logo PNG soit embarque en bitmap brut (~5 Mo -> 413 a l envoi)
  const isDevis = type === 'devis'
  const tot = calcTotaux(lignes, doc.remise_pct)
  const O = [234, 88, 12]          // orange LODE
  const O_PALE = [253, 235, 224]   // orange très clair (fond du blob)
  const GREY = [100, 116, 139]
  const DARK = [30, 41, 59]
  const L = I18N[doc.langue] || I18N.fr
  const cgv = CGV_I18N[doc.langue] || CGV_I18N.fr
  const PW = 210  // largeur page A4

  // ---- Forme courbe orange pâle en arrière-plan (style Accountable) ----
  // Grand disque pâle qui déborde dans le coin supérieur gauche
  d.setFillColor(...O_PALE)
  d.circle(35, 30, 95, 'F')
  // On masque la partie qui dépasse en haut/gauche par un rectangle blanc géant en dehors,
  // jsPDF clippe déjà à la page : le cercle crée la courbe organique voulue.

  // ---- Logo LODE (en-tête, à gauche) ----
  if (LODE.logo_url) {
    const logo = await loadImageDataURL(LODE.logo_url)
    if (logo) { try { d.addImage(logo, 'PNG', 16, 12, 20, 20) } catch (e) { /* */ } }
  }

  // ---- Titre document (haut droite) ----
  d.setFontSize(20); d.setTextColor(...O); d.setFont(undefined, 'bold')
  const titre = isDevis ? L.devis : (doc.type === 'note_credit' ? 'Note de crédit' : L.facture)
  d.text(`${titre}  ${doc.numero || ''}`, PW - 16, 18, { align: 'right' })
  d.setFontSize(8.5); d.setTextColor(...GREY); d.setFont(undefined, 'normal')
  let yh = 25
  d.text(`${(L.date || 'Date').toUpperCase()}  ${fmtDate(isDevis ? doc.date_devis : doc.date_facture)}`, PW - 16, yh, { align: 'right' }); yh += 5
  if (isDevis) d.text(`${(L.validite || 'Validité').toUpperCase()}  ${fmtDate(doc.date_validite)}`, PW - 16, yh, { align: 'right' })
  else d.text(`${(L.echeance || 'Échéance').toUpperCase()}  ${fmtDate(doc.date_echeance)}`, PW - 16, yh, { align: 'right' })

  // ---- Blocs De / À (compacts) ----
  const yDeA = 40
  // De (LODE)
  d.setFontSize(7.5); d.setTextColor(...GREY); d.setFont(undefined, 'normal')
  d.text('De', 16, yDeA)
  d.setFontSize(11); d.setTextColor(...O); d.setFont(undefined, 'bold')
  d.text(LODE.raison_sociale, 16, yDeA + 5)
  d.setFontSize(8); d.setTextColor(...DARK); d.setFont(undefined, 'normal')
  d.text([LODE.adresse, `${LODE.cp} ${LODE.ville}`, `TVA ${LODE.tva}`], 16, yDeA + 10, { lineHeightFactor: 1.15 })

  // À (client) - aligné à droite
  d.setFontSize(7.5); d.setTextColor(...GREY)
  d.text('À', PW - 16, yDeA, { align: 'right' })
  d.setFontSize(10.5); d.setTextColor(...DARK); d.setFont(undefined, 'bold')
  d.text(doc.client_nom || '', PW - 16, yDeA + 5, { align: 'right' })
  d.setFont(undefined, 'normal'); d.setFontSize(8); d.setTextColor(...GREY)
  const cl = []
  if (doc.client_adresse) cl.push(doc.client_adresse)
  if (doc.client_cp || doc.client_ville) cl.push(`${doc.client_cp || ''} ${doc.client_ville || ''}`.trim())
  if (doc.client_tva) cl.push(`TVA ${doc.client_tva}`)
  d.text(cl, PW - 16, yDeA + 10, { align: 'right', lineHeightFactor: 1.15 })

  let startY = yDeA + 10 + cl.length * 3.8 + 6
  if (doc.objet) {
    d.setFontSize(10); d.setTextColor(...DARK); d.setFont(undefined, 'bold')
    d.text(`${L.objet} : ${doc.objet}`, 16, startY); startY += 8
  }

  // ---- Tableau lignes (en-tête orange plein) ----
  // Lignes normales (non optionnelles) dans le total ; les optionnelles iront dans un encadré séparé
  //
  // Sur une facture d'acompte, les articles du projet sont RAPPELES au-dessus
  // mais ne figurent pas dans le tableau facture : les additionner ferait
  // payer le projet entier.
  const lignesProjetPdf = lignes.filter(l => l.bloc === 'projet')
  const lignesNormales = lignes.filter(l => !l.optionnelle && l.bloc !== 'projet')
  const lignesOptions = lignes.filter(l => l.optionnelle)
  const hasRemiseLigne = lignes.some(x => Number(x.remise_pct) > 0)

  // Pré-charge les photos en dataURL (indexées par position dans la liste fournie)
  const prechargerPhotos = async (liste) => {
    const out = {}
    for (let idx = 0; idx < liste.length; idx++) {
      const l = liste[idx]
      if (l.photos && l.photos.length) {
        out[idx] = []
        for (const photo of l.photos) {
          const src = photo.url || photo
          try {
            const dataUrl = (typeof src === 'string' && src.startsWith('data:')) ? src : await loadImageDataURL(src)
            if (dataUrl) out[idx].push(dataUrl)
          } catch (e) { /* ignore */ }
        }
      }
    }
    return out
  }
  const photosData = await prechargerPhotos(lignesNormales)
  const photosDataOptions = await prechargerPhotos(lignesOptions)

  // Construit le libellé d'une ligne : titre + descriptif en dessous
  const libelleLigne = (l) => {
    const titre = l.titre || l.description || ''
    const desc = l.descriptif || ''
    return desc ? `${titre}\n${desc}` : titre
  }

  // ═══ Dessin manuel : GAUCHE = titre+descriptif | DROITE = chiffres puis photos dessous ═══
  const M_L = 10, M_R = 10
  const tableW = PW - M_L - M_R
  const BOTTOM = 280

  // La page est scindée en 2 : descriptif à gauche (~42%), zone droite (~58%)
  const wDescCol = tableW * 0.42
  const xDroite = M_L + wDescCol + 4        // début de la zone droite
  const wDroite = PW - M_R - xDroite        // largeur de la zone droite

  // Colonnes chiffres, calées à droite dans la zone droite
  const wPU = 28, wTVA = 11, wRem = hasRemiseLigne ? 11 : 0, wQte = 10, wHT = 27, wTTC = 29
  const wChiffres = wPU + wTVA + wRem + wQte + wHT + wTTC
  const xChiffresStart = PW - M_R - wChiffres

  const wDesc = wDescCol - 4                 // largeur texte descriptif

  // Photos : dans la zone droite, sous les chiffres, taille uniforme
  const PHOTO_SIZE = 42
  const photoParRangee = Math.max(1, Math.floor((wDroite + 2) / (PHOTO_SIZE + 3)))

  const numeroterPages = () => {
    const n = d.internal.getNumberOfPages()
    for (let i = 1; i <= n; i++) {
      d.setPage(i)
      d.setFontSize(8); d.setTextColor(...GREY); d.setFont(undefined, 'normal')
      d.text(`Page ${i}/${n}`, PW - M_R, 292, { align: 'right' })
    }
  }

  const dessinerEnteteColonnes = (yy) => {
    d.setFillColor(...O); d.rect(M_L, yy, tableW, 8, 'F')
    d.setFontSize(8); d.setTextColor(255, 255, 255); d.setFont(undefined, 'bold')
    d.text(L.description, M_L + 2, yy + 5.5)
    let cx = xChiffresStart
    d.text(L.pu, cx + wPU - 1, yy + 5.5, { align: 'right' }); cx += wPU
    d.text(L.tva, cx + wTVA / 2, yy + 5.5, { align: 'center' }); cx += wTVA
    if (hasRemiseLigne) { d.text('%', cx + wRem / 2, yy + 5.5, { align: 'center' }); cx += wRem }
    d.text(L.qte, cx + wQte / 2, yy + 5.5, { align: 'center' }); cx += wQte
    d.text(L.totalHT, cx + wHT - 1, yy + 5.5, { align: 'right' }); cx += wHT
    d.text('TTC', cx + wTTC - 1, yy + 5.5, { align: 'right' })
    return yy + 8
  }

  // ── RAPPEL DU PROJET (facture d'acompte) ───────────────────────────────
  // Le client doit reconnaitre sa commande sur la facture d'acompte, sinon il
  // recoit un montant sans objet. On rappelle ce qui a ete convenu et le total
  // du projet AVANT de montrer ce qu'on lui reclame aujourd'hui.
  let startYReel = startY
  if (lignesProjetPdf.length) {
    const totProjetPdf = calcTotaux(lignesProjetPdf.map(l => ({ ...l, bloc: null })), doc.remise_pct)
    let yr = startY
    d.setFontSize(10); d.setFont(undefined, 'bold'); d.setTextColor(...O)
    d.text('Répartition du projet', M_L, yr); yr += 4.6
    d.setFontSize(8); d.setFont(undefined, 'normal'); d.setTextColor(...GREY)
    d.text('Articles initialement convenus', M_L, yr); yr += 5

    // Memes colonnes que le tableau de la facture : le client compare deux
    // tableaux identiques, pas une liste face a un tableau. C'est la seule
    // facon de voir d'un coup d'oeil quelle part du projet il paie aujourd'hui.
    yr = dessinerEnteteColonnes(yr)
    let altProjet = false
    for (const l of lignesProjetPdf) {
      const htL = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
      const ttcL = htL * (1 + (Number(l.tva_pct) || 0) / 100)
      d.setFontSize(9); d.setFont(undefined, 'normal')
      const titreLn = d.splitTextToSize(String(l.titre || l.description || ''), wDesc)
      const hL = Math.max(8, titreLn.length * 4.2 + 3.6)
      if (yr + hL > BOTTOM) { d.addPage(); yr = dessinerEnteteColonnes(20); altProjet = false }
      if (altProjet) { d.setFillColor(252, 247, 243); d.rect(M_L, yr, tableW, hL, 'F') }
      altProjet = !altProjet
      let ty = yr + 5
      d.setFontSize(9); d.setTextColor(...DARK); d.setFont(undefined, 'normal')
      titreLn.forEach(ln => { d.text(ln, M_L + 2, ty); ty += 4.2 })
      d.setFontSize(8.5)
      const yc = yr + 5
      let cx = xChiffresStart
      d.text(eurPDF(l.prix_unitaire), cx + wPU - 1, yc, { align: 'right' }); cx += wPU
      d.text(`${l.tva_pct}%`, cx + wTVA / 2, yc, { align: 'center' }); cx += wTVA
      if (hasRemiseLigne) { d.text(`${l.remise_pct || 0}%`, cx + wRem / 2, yc, { align: 'center' }); cx += wRem }
      d.text(String(l.quantite), cx + wQte / 2, yc, { align: 'center' }); cx += wQte
      d.text(eurPDF(htL), cx + wHT - 1, yc, { align: 'right' }); cx += wHT
      d.setTextColor(...O); d.text(eurPDF(ttcL), cx + wTTC - 1, yc, { align: 'right' })
      d.setTextColor(...DARK)
      yr += hL
      d.setDrawColor(235, 235, 235); d.setLineWidth(0.2); d.line(M_L, yr, PW - M_R, yr)
    }
    yr += 5.5
    d.setFontSize(8.5); d.setFont(undefined, 'normal'); d.setTextColor(...GREY)
    d.text('Total du projet (hors TVA)', PW - 70, yr)
    d.setTextColor(...DARK); d.text(eurPDF(totProjetPdf.ht), PW - M_R - 2, yr, { align: 'right' }); yr += 4.6
    d.setTextColor(...GREY); d.text('Total du projet (TVA incl.)', PW - 70, yr)
    d.setTextColor(...DARK); d.setFont(undefined, 'bold')
    d.text(eurPDF(totProjetPdf.ttc), PW - M_R - 2, yr, { align: 'right' })
    d.setFont(undefined, 'normal'); yr += 11

    // Le titre du second tableau ne doit jamais finir seul en bas de page.
    if (yr > BOTTOM - 26) { d.addPage(); yr = 20 }
    d.setFontSize(10); d.setFont(undefined, 'bold'); d.setTextColor(...O)
    d.text('À payer avec cette facture', M_L, yr); yr += 4.5
    d.setFont(undefined, 'normal'); d.setTextColor(...DARK)
    startYReel = yr
  }

  let y = dessinerEnteteColonnes(startYReel)
  let rowAlt = false

  for (let idx = 0; idx < lignesNormales.length; idx++) {
    const l = lignesNormales[idx]
    const t = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
    const ttc = t * (1 + (Number(l.tva_pct) || 0) / 100)
    const titre = l.titre || l.description || ''
    const desc = l.descriptif || ''
    const photos = photosData[idx] || []

    // hauteur du texte (colonne descriptif, largeur wDesc)
    d.setFontSize(9.5); d.setFont(undefined, 'bold')
    const titreLignes = d.splitTextToSize(titre, wDesc)
    d.setFontSize(8); d.setFont(undefined, 'normal')
    const descLignes = desc ? d.splitTextToSize(desc, wDesc) : []
    const hTexte = titreLignes.length * 4.2 + descLignes.length * 3.4 + 4

    // hauteur zone droite = ligne de chiffres (~9mm) + photos dessous
    const nbRangees = photos.length ? Math.ceil(photos.length / photoParRangee) : 0
    const hPhotos = photos.length ? nbRangees * (PHOTO_SIZE + 3) + 2 : 0
    const hDroite = 9 + hPhotos

    const hLigne = Math.max(hTexte, hDroite, 9)

    // saut de page : article entier
    if (y + hLigne > BOTTOM) { d.addPage(); y = dessinerEnteteColonnes(20) }

    const yDebut = y
    if (rowAlt) { d.setFillColor(252, 247, 243); d.rect(M_L, y, tableW, hLigne, 'F') }
    rowAlt = !rowAlt

    // ── Colonne 1 : descriptif (gauche) ──
    let ty = y + 4.5
    d.setFontSize(9.5); d.setTextColor(...DARK); d.setFont(undefined, 'bold')
    titreLignes.forEach(ln => { d.text(ln, M_L + 2, ty); ty += 4.2 })
    if (descLignes.length) {
      d.setFontSize(8); d.setTextColor(...GREY); d.setFont(undefined, 'normal')
      descLignes.forEach(ln => { d.text(ln, M_L + 2, ty); ty += 3.4 })
    }

    // ── Zone droite : chiffres en haut ──
    d.setFontSize(8.5); d.setTextColor(...DARK); d.setFont(undefined, 'normal')
    const yc = y + 5
    let cx = xChiffresStart
    d.text(eurPDF(l.prix_unitaire), cx + wPU - 1, yc, { align: 'right' }); cx += wPU
    d.text(`${l.tva_pct}%`, cx + wTVA / 2, yc, { align: 'center' }); cx += wTVA
    if (hasRemiseLigne) { d.text(`${l.remise_pct || 0}%`, cx + wRem / 2, yc, { align: 'center' }); cx += wRem }
    d.text(String(l.quantite), cx + wQte / 2, yc, { align: 'center' }); cx += wQte
    d.setFont(undefined, 'bold')
    d.text(eurPDF(t), cx + wHT - 1, yc, { align: 'right' }); cx += wHT
    d.setTextColor(...O); d.text(eurPDF(ttc), cx + wTTC - 1, yc, { align: 'right' })
    d.setTextColor(...DARK); d.setFont(undefined, 'normal')

    // ── Zone droite : photos SOUS les chiffres, taille uniforme ──
    if (photos.length) {
      let py = y + 11
      let col = 0
      for (const dataUrl of photos) {
        const px = xDroite + col * (PHOTO_SIZE + 3)
        try {
          const fmt = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
          d.addImage(dataUrl, fmt, px, py, PHOTO_SIZE, PHOTO_SIZE, undefined, 'FAST')
        } catch (e) { /* ignore */ }
        col++
        if (col >= photoParRangee) { col = 0; py += PHOTO_SIZE + 3 }
      }
    }

    // ligne séparatrice fine
    y = yDebut + hLigne
    d.setDrawColor(235, 235, 235); d.setLineWidth(0.2); d.line(M_L, y, PW - M_R, y)
  }

  y += 4

  // ---- Totaux (alignés à droite, libellés orange) ----
  if (y > 250) { d.addPage(); y = 20 }
  const labelX = PW - 70, valX = PW - 16
  d.setFontSize(10); d.setFont(undefined, 'normal')
  if (doc.remise_pct > 0) {
    d.setTextColor(...GREY)
    d.text(`${L.remiseGlobale} ${doc.remise_pct}%`, labelX, y); d.text('', valX, y, { align: 'right' }); y += 6.5
  }
  d.setTextColor(...O); d.setFont(undefined, 'bold')
  d.text(L.totalHT, labelX, y)
  d.setTextColor(...DARK); d.setFont(undefined, 'normal')
  d.text(eurPDF(tot.ht), valX, y, { align: 'right' }); y += 6.5
  Object.entries(tot.parTaux).filter(([, v]) => v > 0).forEach(([t, v]) => {
    d.setTextColor(...O); d.setFont(undefined, 'bold'); d.text(`${L.totalTVA} ${t}%`, labelX, y)
    d.setTextColor(...DARK); d.setFont(undefined, 'normal'); d.text(eurPDF(v), valX, y, { align: 'right' }); y += 6.5
  })
  // Acompte deja recu : il apparait AVANT le total, et le total devient le
  // montant reellement du. Un PDF qui reclame la somme entiere alors que le
  // client a deja paye est pire qu'un PDF moche.
  const dejaPaye = Math.max(0, Number(doc.montant_paye) || 0)
  if (!isDevis && dejaPaye > 0) {
    d.setTextColor(...O); d.setFont(undefined, 'bold'); d.text('Acompte déjà payé', labelX, y)
    d.setTextColor(...DARK); d.setFont(undefined, 'normal')
    d.text('- ' + eurPDF(dejaPaye), valX, y, { align: 'right' }); y += 6.5
  }
  // Ligne séparatrice + Montant dû
  y += 1
  d.setDrawColor(...O); d.setLineWidth(0.4); d.line(labelX, y, valX, y); y += 7
  d.setFont(undefined, 'bold'); d.setFontSize(13); d.setTextColor(...O)
  d.text(isDevis ? L.totalTTC : (L.montantDu || L.totalTTC), labelX, y)
  d.setTextColor(...DARK); d.text(eurPDF(tot.ttc - dejaPaye), valX, y, { align: 'right' })

  // Ce qui restera a facturer une fois cet acompte paye. Sans cette ligne, le
  // client croit que la facture solde le projet.
  if (lignesProjetPdf.length) {
    const projetTtcPdf = calcTotaux(lignesProjetPdf.map(l => ({ ...l, bloc: null })), doc.remise_pct).ttc
    const solde = Math.round((projetTtcPdf - (tot.ttc - dejaPaye)) * 100) / 100
    if (solde > 0.004) {
      y += 7
      d.setFontSize(9); d.setFont(undefined, 'normal'); d.setTextColor(...O)
      d.text('Solde restant sur le projet, à payer plus tard', labelX - 28, y)
      d.setTextColor(...DARK); d.text(eurPDF(solde), valX, y, { align: 'right' })
    }
  }

  // ---- Options au choix (non comptées dans le total) ----
  if (lignesOptions.length) {
    y += 14
    // Pré-calcul des hauteurs (titre + descriptif + photos) pour dimensionner l'encadré
    d.setFontSize(9)
    const optMetrics = lignesOptions.map((l, idx) => {
      const titre = l.titre || l.description || ''
      const descLn = l.descriptif ? d.splitTextToSize(l.descriptif, PW - 80) : []
      const ph = photosDataOptions[idx] || []
      const nbRangees = ph.length ? Math.ceil(ph.length / photoParRangee) : 0
      const hPhotos = ph.length ? nbRangees * (PHOTO_SIZE + 3) + 3 : 0
      const h = 6 + (descLn.length ? descLn.length * 3.6 + 1 : 0) + hPhotos + 3
      return { titre, descLn, ph, h }
    })
    const optH = 8 + optMetrics.reduce((s, m) => s + m.h, 0) + 4
    if (y - 5 + optH > 285) { d.addPage(); y = 20 }
    d.setFillColor(255, 251, 235); d.setDrawColor(245, 158, 11); d.setLineWidth(0.3)
    d.roundedRect(16, y - 5, PW - 32, optH, 2, 2, 'FD')
    d.setFontSize(10); d.setTextColor(180, 83, 9); d.setFont(undefined, 'bold')
    d.text(isDevis ? 'Options au choix (à sélectionner — non comprises dans le total)' : 'Options', 20, y); y += 8
    optMetrics.forEach((m, idx) => {
      const l = lignesOptions[idx]
      const t = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
      const ttc = t * (1 + (Number(l.tva_pct) || 0) / 100)
      d.setFont(undefined, 'bold'); d.setFontSize(9); d.setTextColor(...DARK)
      d.text(m.titre, 20, y)
      d.setFont(undefined, 'normal'); d.text(`${eurPDF(t)} HT  /  ${eurPDF(ttc)} TTC`, valX, y, { align: 'right' })
      let yy = y
      if (m.descLn.length) {
        yy += 4.5; d.setFontSize(8); d.setTextColor(...GREY); d.setFont(undefined, 'normal')
        d.text(m.descLn, 20, yy); yy += m.descLn.length * 3.6
        d.setFontSize(9); d.setTextColor(...DARK)
      }
      if (m.ph.length) {
        let py = yy + 3, col = 0
        for (const dataUrl of m.ph) {
          const px = 20 + col * (PHOTO_SIZE + 3)
          try { d.addImage(dataUrl, dataUrl.includes('image/png') ? 'PNG' : 'JPEG', px, py, PHOTO_SIZE, PHOTO_SIZE, undefined, 'FAST') } catch (e) { /* ignore */ }
          col++; if (col >= photoParRangee) { col = 0; py += PHOTO_SIZE + 3 }
        }
      }
      y += m.h
    })
  }

  // ---- Paiement : IBAN, communication structuree, QR a scanner ----
  const comm = (!isDevis && doc.type !== 'note_credit') ? communicationStructuree(doc.numero) : null
  // Le QR annonce LE MONTANT DU, acompte deja recu deduit — pas le total.
  const duPDF = Math.round((tot.ttc - dejaPaye) * 100) / 100
  const qrPdf = comm ? await qrPaiementEPC({
    benef: LODE.raison_sociale, iban: LODE.iban, bic: LODE.bic,
    montant: duPDF, communication: comm.affiche,
  }) : null

  const QS = 27
  y += 16
  if (y + (qrPdf ? QS + 10 : 16) > BOTTOM) { d.addPage(); y = 22 }
  const yPaie = y
  d.setFontSize(9); d.setTextColor(...GREY); d.setFont(undefined, 'normal')
  d.text(`${L.paiement} : ${LODE.iban}  (${LODE.bic} – ${LODE.banque})`, 16, y)
  if (!isDevis) {
    y += 5.4
    d.setFont(undefined, 'bold'); d.setTextColor(...DARK); d.setFontSize(9.5)
    d.text(`${L.communication} : ${comm ? comm.affiche : doc.numero}`, 16, y)
    d.setFont(undefined, 'normal'); d.setTextColor(...GREY); d.setFontSize(9)
  }
  if (qrPdf) {
    try {
      const qx = PW - 16 - QS
      d.addImage(qrPdf, 'PNG', qx, yPaie - 6, QS, QS)
      d.setFontSize(7); d.setTextColor(...GREY)
      d.text('Scannez pour payer', qx + QS / 2, yPaie - 6 + QS + 3.4, { align: 'center' })
      d.setFontSize(9)
    } catch (e) { /* un QR absent est un desagrement, une facture bloquee non */ }
    y = Math.max(y, yPaie - 6 + QS + 4)
  }
  y += 9; d.setTextColor(...O); d.setFont(undefined, 'bold'); d.setFontSize(10)
  d.text(L.merci, 16, y)

  // Notes éventuelles
  if (doc.notes) {
    y += 8; d.setFontSize(8.5); d.setTextColor(...GREY); d.setFont(undefined, 'normal')
    d.text(d.splitTextToSize(doc.notes, PW - 32), 16, y)
  }

  // ---- Mention légale TVA 6 % (rénovation habitation > 10 ans) ----
  if ((lignes || []).some(l => Number(l.tva_pct) === 6)) {
    const M6 = isDevis
      ? ({
          fr: "TVA 6 % (rénovation) : taux applicable sous réserve que l'habitation ait plus de 10 ans et soit utilisée, exclusivement ou à titre principal, comme logement privé. La mention légale complète figurera sur la facture.",
          nl: "Btw 6 % (renovatie): tarief van toepassing mits de woning ouder is dan 10 jaar en uitsluitend of hoofdzakelijk als privéwoning wordt gebruikt. De volledige wettelijke vermelding verschijnt op de factuur.",
        })
      : ({
          fr: "Taux de TVA 6 % : En l'absence de contestation écrite dans un délai d'un mois à compter de la réception de la facture, le client est présumé reconnaître que (1) les travaux sont effectués à une habitation dont la première occupation remonte à au moins dix ans avant la première facture relative à ces travaux, (2) que l'habitation est, après travaux, utilisée exclusivement ou à titre principal comme logement privé, et (3) que les travaux sont fournis et facturés à un consommateur final. Si l'une de ces conditions n'est pas remplie, le taux normal de 21 % s'applique et le client en est responsable envers l'État.",
          nl: "Btw-tarief 6 % : Bij gebrek aan schriftelijke betwisting binnen één maand na ontvangst van de factuur wordt de klant geacht te erkennen dat (1) de werken worden verricht aan een woning waarvan de eerste ingebruikneming minstens tien jaar vóór de eerste factuur voor die werken plaatsvond, (2) dat de woning na de werken uitsluitend of hoofdzakelijk als privéwoning wordt gebruikt, en (3) dat de werken aan een eindverbruiker worden verstrekt en gefactureerd. Is een van die voorwaarden niet vervuld, dan geldt het normale tarief van 21 % en is de klant daarvoor aansprakelijk tegenover de Staat.",
        })
    const txt6 = M6[doc.langue] || M6.fr
    const ln6 = d.splitTextToSize(txt6, PW - 40)
    const h6 = ln6.length * 3.4 + 8
    if (y + h6 > 286) { d.addPage(); y = 20 }
    y += 10
    d.setFillColor(255, 251, 235); d.setDrawColor(245, 158, 11); d.setLineWidth(0.3)
    d.roundedRect(16, y - 5, PW - 32, h6, 2, 2, 'FD')
    d.setFontSize(7.5); d.setTextColor(120, 53, 15); d.setFont(undefined, 'normal')
    d.text(ln6, 20, y); y += h6 - 3
  }

  // ---- CGV (page 2) ----
  d.addPage()
  d.setFillColor(...O_PALE); d.circle(180, 12, 60, 'F')
  d.setFontSize(14); d.setTextColor(...O); d.setFont(undefined, 'bold')
  d.text(L.cgvTitre, 16, 22)
  d.setFontSize(8); d.setTextColor(70); d.setFont(undefined, 'normal')
  let cy = 33
  cgv.forEach(c => {
    const lines = d.splitTextToSize(c, PW - 32)
    if (cy + lines.length * 4 > 285) { d.addPage(); cy = 20 }
    d.text(lines, 16, cy); cy += lines.length * 4 + 3.5
  })

  numeroterPages()
  const outName = type === 'devis' ? `${titre}_${doc.numero}.pdf` : nomFichierDoc(doc, type, 'pdf')
  if (opts.save !== false) d.save(outName)
  return d.output('datauristring').split(',')[1]
}

async function exportExcel(type, doc, lignes) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')
  const XLSX = window.XLSX
  const tot = calcTotaux(lignes, doc.remise_pct)
  const isDevis = type === 'devis'
  const L = I18N[doc.langue] || I18N.fr
  const rows = [
    [LODE.raison_sociale, '', '', isDevis ? L.devis : (doc.type === 'note_credit' ? 'Note de crédit' : L.facture)],
    [LODE.adresse, '', '', doc.numero],
    [`${LODE.cp} ${LODE.ville}`, '', '', isDevis ? `${L.validite} : ${fmtDate(doc.date_validite)}` : `${L.echeance} : ${fmtDate(doc.date_echeance)}`],
    [`TVA ${LODE.tva}`, '', '', ''],
    [], [L.client, doc.client_nom], ['', doc.client_adresse || ''], ['', `${doc.client_cp || ''} ${doc.client_ville || ''}`],
    doc.client_tva ? ['TVA', doc.client_tva] : [],
    [L.objet, doc.objet || ''], [],
    [L.description, L.qte, L.pu, L.remise + ' %', L.tva + ' %', L.totalHT],
    ...lignes.map(l => {
      const t = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
      return [l.description, Number(l.quantite), Number(l.prix_unitaire), Number(l.remise_pct) || 0, Number(l.tva_pct), Number(t.toFixed(2))]
    }),
    [],
    ['', '', '', '', L.remiseGlobale + ' %', Number(doc.remise_pct) || 0],
    ['', '', '', '', L.totalHT, Number(tot.ht.toFixed(2))],
    ['', '', '', '', L.totalTVA, Number(tot.tva.toFixed(2))],
    ['', '', '', '', L.totalTTC, Number(tot.ttc.toFixed(2))],
    [], [L.paiement, `${LODE.iban} (${LODE.bic})`],
  ].filter(r => r.length > 0)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, isDevis ? L.devis : (doc.type === 'note_credit' ? 'Note de crédit' : L.facture))
  XLSX.writeFile(wb, `${isDevis ? L.devis : (doc.type === 'note_credit' ? 'Note de crédit' : L.facture)}_${doc.numero}.xlsx`)
}

// Export Word (.doc) éditable — via HTML que Word ouvre nativement
// Export Word (.docx natif) — reproduit la structure du PDF, éditable dans Word
async function exportWord(type, doc, lignes) {
  const docx = await import('docx')
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, ImageRun, HeadingLevel, ShadingType } = docx
  const isDevis = type === 'devis'
  const L = I18N[doc.langue] || I18N.fr
  const cgv = CGV_I18N[doc.langue] || CGV_I18N.fr
  const tot = calcTotaux(lignes, doc.remise_pct)
  const eurW = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const O = 'EA580C', DARK = '1E293B', GREY = '64748B'

  const lignesProjetW = lignes.filter(l => l.bloc === 'projet')
  const lignesNormales = lignes.filter(l => !l.optionnelle && l.bloc !== 'projet')
  const lignesOptions = lignes.filter(l => l.optionnelle)
  const hasRem = lignes.some(x => Number(x.remise_pct) > 0)

  // Charge une image en Uint8Array (docx exige des bytes)
  const imgBytes = async (src) => {
    try {
      const res = await fetch(src)
      const buf = await res.arrayBuffer()
      return new Uint8Array(buf)
    } catch { return null }
  }

  const noBorder = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
  const cellBorder = { top: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' }, left: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' }, right: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' } }

  // En-tête : LODE à gauche, titre à droite
  const entete = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorder,
    rows: [new TableRow({ children: [
      new TableCell({ borders: noBorder, width: { size: 50, type: WidthType.PERCENTAGE }, children: [
        new Paragraph({ children: [new TextRun({ text: LODE.raison_sociale, bold: true, color: O, size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: LODE.adresse, size: 18 })] }),
        new Paragraph({ children: [new TextRun({ text: `${LODE.cp} ${LODE.ville}`, size: 18 })] }),
        new Paragraph({ children: [new TextRun({ text: `TVA ${LODE.tva}`, size: 18 })] }),
      ] }),
      new TableCell({ borders: noBorder, width: { size: 50, type: WidthType.PERCENTAGE }, children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${isDevis ? L.devis : (doc.type === 'note_credit' ? 'Note de crédit' : L.facture)} ${doc.numero || ''}`, bold: true, color: O, size: 36 })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${L.date} ${fmtDate(isDevis ? doc.date_devis : doc.date_facture)}`, size: 18, color: GREY })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${isDevis ? L.validite : L.echeance} ${fmtDate(isDevis ? doc.date_validite : doc.date_echeance)}`, size: 18, color: GREY })] }),
      ] }),
    ] })],
  })

  // Client
  const clientPara = [
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'À : ', bold: true, size: 18, color: GREY }), new TextRun({ text: doc.client_nom || '', bold: true, size: 22 })] }),
  ]
  if (doc.client_adresse) clientPara.push(new Paragraph({ children: [new TextRun({ text: doc.client_adresse, size: 18 })] }))
  if (doc.client_cp || doc.client_ville) clientPara.push(new Paragraph({ children: [new TextRun({ text: `${doc.client_cp || ''} ${doc.client_ville || ''}`, size: 18 })] }))
  if (doc.client_tva) clientPara.push(new Paragraph({ children: [new TextRun({ text: `TVA ${doc.client_tva}`, size: 18 })] }))
  if (doc.objet) clientPara.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `${L.objet} : `, bold: true, size: 20 }), new TextRun({ text: doc.objet, size: 20 })] }))

  // En-tête tableau
  const th = (txt, align) => new TableCell({
    shading: { type: ShadingType.SOLID, color: O, fill: O },
    children: [new Paragraph({ alignment: align || AlignmentType.LEFT, children: [new TextRun({ text: txt, bold: true, color: 'FFFFFF', size: 16 })] })],
  })
  // Une TableRow docx ne peut pas servir dans deux tables : on en fabrique une
  // a chaque appel plutot que de partager la meme instance.
  const headRow2 = () => new TableRow({ tableHeader: true, children: [
    th(L.description), th('P.U.', AlignmentType.RIGHT), th('TVA', AlignmentType.CENTER),
    ...(hasRem ? [th('%', AlignmentType.CENTER)] : []),
    th(L.qte, AlignmentType.CENTER), th(L.totalHT, AlignmentType.RIGHT), th('TTC', AlignmentType.RIGHT),
  ] })

  // Lignes
  const bodyRows = []
  for (const l of lignesNormales) {
    const t = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
    const ttc = t * (1 + (Number(l.tva_pct) || 0) / 100)
    const descChildren = [new Paragraph({ children: [new TextRun({ text: l.titre || l.description || '', bold: true, size: 19, color: DARK })] })]
    if (l.descriptif) descChildren.push(new Paragraph({ children: [new TextRun({ text: l.descriptif, size: 16, color: GREY })] }))
    // photos
    if (l.photos && l.photos.length) {
      const imgRuns = []
      for (const p of l.photos) {
        const bytes = await imgBytes(p.url || p)
        if (bytes) imgRuns.push(new ImageRun({ data: bytes, transformation: { width: 120, height: 120 } }))
      }
      if (imgRuns.length) descChildren.push(new Paragraph({ spacing: { before: 100 }, children: imgRuns }))
    }
    const cell = (children) => new TableCell({ borders: cellBorder, children })
    const txtCell = (txt, align, bold) => cell([new Paragraph({ alignment: align, children: [new TextRun({ text: txt, size: 18, bold })] })])
    bodyRows.push(new TableRow({ children: [
      cell(descChildren),
      txtCell(eurW(l.prix_unitaire), AlignmentType.RIGHT),
      txtCell(`${l.tva_pct}%`, AlignmentType.CENTER),
      ...(hasRem ? [txtCell(`${l.remise_pct || 0}%`, AlignmentType.CENTER)] : []),
      txtCell(String(l.quantite), AlignmentType.CENTER),
      txtCell(eurW(t), AlignmentType.RIGHT, true),
      txtCell(eurW(ttc), AlignmentType.RIGHT, true),
    ] }))
  }

  // ── RAPPEL DU PROJET (facture d'acompte) ───────────────────────────────
  // Meme tableau, memes colonnes que la facture : deux tableaux identiques,
  // pour que le client voie quelle part du projet il paie aujourd'hui.
  const projetPara = []
  if (lignesProjetW.length) {
    const totProjetW = calcTotaux(lignesProjetW.map(l => ({ ...l, bloc: null })), doc.remise_pct)
    const cellP = (children) => new TableCell({ borders: cellBorder, children })
    const txtP = (txt, align, bold) => cellP([new Paragraph({ alignment: align, children: [new TextRun({ text: txt, size: 18, bold })] })])
    const rowsProjet = lignesProjetW.map(l => {
      const t = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
      const ttc = t * (1 + (Number(l.tva_pct) || 0) / 100)
      return new TableRow({ children: [
        cellP([new Paragraph({ children: [new TextRun({ text: l.titre || l.description || '', size: 19, color: DARK })] })]),
        txtP(eurW(l.prix_unitaire), AlignmentType.RIGHT),
        txtP(`${l.tva_pct}%`, AlignmentType.CENTER),
        ...(hasRem ? [txtP(`${l.remise_pct || 0}%`, AlignmentType.CENTER)] : []),
        txtP(String(l.quantite), AlignmentType.CENTER),
        txtP(eurW(t), AlignmentType.RIGHT),
        txtP(eurW(ttc), AlignmentType.RIGHT),
      ] })
    })
    projetPara.push(
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Répartition du projet', bold: true, size: 22, color: O })] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: 'Articles initialement convenus', size: 16, color: GREY })] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headRow2(), ...rowsProjet] }),
      new Paragraph({ spacing: { before: 120 }, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Total du projet (hors TVA) : ${eurW(totProjetW.ht)}`, size: 18, color: GREY })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Total du projet (TVA incl.) : ${eurW(totProjetW.ttc)}`, size: 20, bold: true })] }),
      new Paragraph({ spacing: { before: 280 }, children: [new TextRun({ text: 'À payer avec cette facture', bold: true, size: 22, color: O })] }),
      new Paragraph({ text: '', spacing: { after: 60 } }),
    )
  }

  const tableLignes = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headRow2(), ...bodyRows],
  })

  // Totaux
  const totauxPara = [
    new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${L.totalHT} : ${eurW(tot.ht)}`, size: 20 })] }),
    ...Object.entries(tot.parTaux).filter(([, v]) => v > 0).map(([tx, v]) =>
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `TVA ${tx}% : ${eurW(v)}`, size: 18, color: GREY })] })),
    ...((!isDevis && Number(doc.montant_paye) > 0)
      ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Acompte déjà payé : - ${eurW(Number(doc.montant_paye))}`, size: 20 })] })]
      : []),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${isDevis ? L.totalTTC : L.montantDu} : ${eurW(tot.ttc - (isDevis ? 0 : (Number(doc.montant_paye) || 0)))}`, bold: true, size: 26, color: O })] }),
  ]

  // Sans cette ligne, le client croit que la facture d'acompte solde le projet.
  if (lignesProjetW.length) {
    const projetTtcW = calcTotaux(lignesProjetW.map(l => ({ ...l, bloc: null })), doc.remise_pct).ttc
    const soldeW = Math.round((projetTtcW - (tot.ttc - (Number(doc.montant_paye) || 0))) * 100) / 100
    if (soldeW > 0.004) {
      totauxPara.push(new Paragraph({ spacing: { before: 120 }, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Solde restant sur le projet, à payer plus tard : ${eurW(soldeW)}`, size: 18, color: GREY })] }))
    }
  }

  // Options
  const optionsPara = []
  if (lignesOptions.length) {
    optionsPara.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: 'Options au choix (non comprises dans le total)', bold: true, size: 22, color: 'B45309' })] }))
    for (const l of lignesOptions) {
      const t = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
      const ttc = t * (1 + (Number(l.tva_pct) || 0) / 100)
      optionsPara.push(new Paragraph({ children: [new TextRun({ text: `${l.titre || l.description} — ${eurW(t)} HT / ${eurW(ttc)} TTC`, size: 18 })] }))
      if (l.descriptif) optionsPara.push(new Paragraph({ children: [new TextRun({ text: l.descriptif, size: 16, color: GREY })] }))
    }
  }

  // CGV (nouvelle page)
  const cgvPara = [
    new Paragraph({ pageBreakBefore: true, children: [new TextRun({ text: L.cgvTitre, bold: true, size: 26, color: O })] }),
    ...cgv.map(c => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: c, size: 15, color: '444444' })] })),
  ]

  // Paiement : IBAN, communication structuree, QR a scanner.
  const commW = (!isDevis && doc.type !== 'note_credit') ? communicationStructuree(doc.numero) : null
  const duW = Math.round((tot.ttc - (Number(doc.montant_paye) || 0)) * 100) / 100
  const paiementPara = [
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: `${L.paiement} : ${LODE.iban} (${LODE.bic})`, size: 16, color: GREY })] }),
  ]
  if (commW) {
    paiementPara.push(new Paragraph({ children: [new TextRun({ text: `${L.communication} : ${commW.affiche}`, size: 18, bold: true, color: DARK })] }))
    const qrW = await qrPaiementEPC({ benef: LODE.raison_sociale, iban: LODE.iban, bic: LODE.bic, montant: duW, communication: commW.affiche })
    if (qrW) {
      try {
        const brut = atob(String(qrW).split(',')[1])
        const octets = new Uint8Array(brut.length)
        for (let k = 0; k < brut.length; k++) octets[k] = brut.charCodeAt(k)
        paiementPara.push(
          new Paragraph({ spacing: { before: 120 }, children: [new ImageRun({ data: octets, transformation: { width: 96, height: 96 } })] }),
          new Paragraph({ children: [new TextRun({ text: 'Scannez pour payer', size: 14, color: GREY })] }),
        )
      } catch (e) { /* sans QR, le Word sort quand meme */ }
    }
  }

  const docObj = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        entete,
        ...clientPara,
        new Paragraph({ text: '', spacing: { after: 100 } }),
        ...projetPara,
        tableLignes,
        ...totauxPara,
        ...optionsPara,
        ...paiementPara,
        ...cgvPara,
      ],
    }],
  })

  const blob = await Packer.toBlob(docObj)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = isDevis ? `${L.devis}_${doc.numero}.docx` : nomFichierDoc(doc, type, 'docx')
  link.click()
  URL.revokeObjectURL(url)
}


// ════════════════════════════════════════════════════════════════
//  PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════
const STATUT_CHIPS = [
  { key: 'brouillon', label: 'Pas envoyé', col: COUL.texteFaible },
  { key: 'envoyé',    label: 'Envoyé',     col: COUL.info },
  { key: 'accepté',   label: 'Approuvé',   col: COUL.succes },
  { key: 'refusé',    label: 'Rejeté',     col: COUL.danger },
]
const EVT = {
  cree:    { icon: '📝', label: 'Créé',                  col: COUL.texteDoux },
  envoye:  { icon: '📤', label: 'Envoyé au client',      col: COUL.info },
  ouvert:  { icon: '👁️', label: 'Email ouvert par le client', col: COUL.violet },
  accepte: { icon: '✅', label: 'Accepté par le client', col: COUL.succes },
  refuse:  { icon: '✋', label: 'Refusé par le client',   col: COUL.danger },
}

function Row2({ l, v }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: COUL.texteDoux }}><span>{l}</span><span>{v}</span></div>
}

function SuiviModal({ doc, color, onClose, onChanged, onConvertir, factureLiee }) {
  const mob = useMobile()
  const [events, setEvents] = useState(null)
  const [lignes, setLignes] = useState([])
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [statut, setStatut] = useState(doc.statut || 'brouillon')
  const lien = `${window.location.origin}/devis/${doc.accept_token}`

  const charge = () => supabase.from('lode_devis_events').select('*').eq('devis_id', doc.id)
    .order('created_at', { ascending: true }).then(({ data }) => setEvents(data || []))
  useEffect(() => {
    charge()
    supabase.from('lode_devis_lignes').select('*').eq('devis_id', doc.id).order('position', { ascending: true })
      .then(({ data }) => setLignes(data || []))
  }, [doc.id])

  async function logEvent(type, detail) {
    await supabase.from('lode_devis_events').insert({ devis_id: doc.id, type, detail })
  }
  async function marquerEnvoye(viaEmail) {
    const now = new Date()
    const valid = new Date(now); valid.setDate(valid.getDate() + 15)   // validité 15 jours calendrier
    await supabase.from('lode_devis').update({
      statut: 'envoyé', sent_at: now.toISOString(), date_validite: valid.toISOString().slice(0, 10),
    }).eq('id', doc.id)
    await logEvent('envoye', viaEmail ? 'Email envoyé depuis la plateforme' : 'Marqué comme envoyé (envoi manuel)')
    setStatut('envoyé')
    charge(); onChanged && onChanged()
  }
  async function changeStatut(s) {
    if (s === statut) return
    if (s === 'envoyé') { await marquerEnvoye(false); return }
    const patch = { statut: s }
    let evt = null, detail = null
    if (s === 'accepté') { patch.accepted_at = new Date().toISOString(); evt = 'accepte'; detail = 'Marqué accepté (manuel)' }
    else if (s === 'refusé') { patch.refused_at = new Date().toISOString(); evt = 'refuse'; detail = 'Marqué refusé (manuel)' }
    await supabase.from('lode_devis').update(patch).eq('id', doc.id)
    if (evt) await logEvent(evt, detail)
    setStatut(s); charge(); onChanged && onChanged()
  }
  async function envoyerEmail() {
    if (sending) return
    if (!doc.client_email) { alert("Ce devis n'a pas d'email client — ajoute-le d'abord (Modifier), ou copie le lien et envoie-le manuellement."); return }
    setSending(true)
    const now = new Date(); const valid = new Date(now); valid.setDate(valid.getDate() + 15)
    let ok = false, detail = ''
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/devis-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          client_nom: doc.client_nom, client_email: doc.client_email, numero: doc.numero,
          accept_token: doc.accept_token, date_validite: valid.toISOString().slice(0, 10),
          base: window.location.origin, entite: LODE.entite,
        }),
      })
      const j = await r.json().catch(() => ({})); ok = r.ok && j.ok; detail = j.detail || j.error || ''
    } catch (e) { ok = false; detail = String(e) }
    setSending(false)
    if (ok) { await marquerEnvoye(true); alert('Devis envoyé par email ✓') }
    else { alert("L'envoi automatique a échoué : " + (detail || 'erreur inconnue') + "\n\nVérifie les variables Azure dans Vercel, ou copie le lien ci-dessous et envoie-le, puis clique « Marquer envoyé ».") }
  }
  function copier() { navigator.clipboard?.writeText(lien); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  // Timeline = événements enregistrés (fallback : la date de création du devis)
  const timeline = (events && events.length) ? events
    : [{ type: 'cree', detail: 'Devis créé', created_at: doc.created_at }]

  return (
    <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: mob ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: mob ? '100vw' : 'min(1080px,96vw)', height: mob ? '100vh' : 'min(92vh,900px)', background: COUL.surface, borderRadius: mob ? 0 : 16, overflow: 'hidden', display: 'flex', flexDirection: mob ? 'column' : 'row', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>

        {/* ── Colonne gauche : aperçu du document ── */}
        <div style={{ flex: 1, background: COUL.fondDoux, overflow: 'auto', padding: mob ? 14 : 28, order: mob ? 2 : 1 }}>
          <div style={{ background: COUL.surface, maxWidth: 620, margin: '0 auto', borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,.08)', padding: mob ? '22px 18px' : '30px 34px', fontSize: 12, color: COUL.texte }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
              {LODE.logo_url ? <img src={LODE.logo_url} alt="LODE" style={{ height: 46 }} /> : <div style={{ fontWeight: 800, fontSize: 18, color }}>{LODE.raison_sociale}</div>}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color }}>DEVIS {doc.numero}</div>
                <div style={{ color: COUL.texteDoux }}>Émis le : {fmtDate(doc.date_devis)}</div>
                {doc.date_validite && <div style={{ color: COUL.texteDoux }}>Valide jusqu'au : {fmtDate(doc.date_validite)}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase' }}>De</div>
                <div style={{ fontWeight: 800 }}>{LODE.raison_sociale}</div>
                <div style={{ color: COUL.texteMoyen }}>{LODE.adresse}<br />{LODE.cp} {LODE.ville}<br />{LODE.pays}</div>
                <div style={{ color: COUL.texteMoyen, marginTop: 4 }}>TVA : {LODE.tva}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase' }}>Pour</div>
                <div style={{ fontWeight: 800 }}>{doc.client_nom}</div>
                <div style={{ color: COUL.texteMoyen }}>{doc.client_adresse}<br />{[doc.client_cp, doc.client_ville].filter(Boolean).join(' ')}</div>
                {doc.client_tva && <div style={{ color: COUL.texteMoyen, marginTop: 4 }}>TVA : {doc.client_tva}</div>}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
              <thead><tr style={{ background: color, color: COUL.blanc }}>
                {['Description', 'Prix HTVA', 'TVA', 'Qté', 'Total'].map((h, i) => <th key={h} style={{ textAlign: i ? 'right' : 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={l.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 8px', verticalAlign: 'top' }}>{l.description}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{eur(l.prix_unitaire)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{l.tva_pct} %</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{l.quantite}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{eur(l.total_ht)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ minWidth: 220 }}>
                <Row2 l="Sous-total HTVA" v={eur(doc.total_ht)} />
                <Row2 l="TVA" v={eur(doc.total_tva)} />
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `2px solid ${color}`, paddingTop: 6, marginTop: 4, fontWeight: 800, color }}><span>Montant</span><span>{eur(doc.total_ttc)}</span></div>
              </div>
            </div>
            {doc.notes && <><div style={{ fontSize: 9, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', marginTop: 18 }}>Notes &amp; commentaires</div><div style={{ color: COUL.texteMoyen }}>{doc.notes}</div></>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, paddingTop: 12, borderTop: '1px solid #e2e8f0', color: COUL.texteDoux, fontSize: 11 }}>
              <div>{LODE.iban && <>IBAN : {LODE.iban}<br /></>}{LODE.bic && <>BIC : {LODE.bic}</>}</div>
              <div style={{ textAlign: 'right' }}>{LODE.email}{LODE.telephone && <><br />{LODE.telephone}</>}</div>
            </div>
          </div>
        </div>

        {/* ── Colonne droite : statut / suivi ── */}
        <div style={{ width: mob ? '100%' : 380, borderLeft: mob ? 'none' : '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', order: mob ? 1 : 2, maxHeight: mob ? '46vh' : 'none' }}>
          <div style={{ background: `linear-gradient(135deg,${color},#7c2d12)`, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: COUL.blanc, fontSize: 18, fontWeight: 800 }}>Devis {doc.numero}</div>
              <div style={{ color: COUL.blanc, opacity: .9, fontSize: 14, marginTop: 2 }}>{eur(doc.total_ttc)} TVA incl.</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: COUL.blanc, width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {/* Statut (chips cliquables, façon Accountable) */}
          <div style={{ fontSize: 11, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', marginBottom: 8 }}>Statut</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            {STATUT_CHIPS.map(c => {
              const actif = statut === c.key
              return (
                <button key={c.key} onClick={() => changeStatut(c.key)}
                  style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${actif ? c.col : COUL.bord}`, background: actif ? c.col : COUL.blanc, color: actif ? '#fff' : COUL.texteDoux }}>
                  {c.label}
                </button>
              )
            })}
          </div>

          {/* Lien d'acceptation */}
          <div style={{ fontSize: 11, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', marginBottom: 6 }}>Lien d'acceptation (client)</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <input readOnly value={lien} style={{ flex: 1, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', color: COUL.texteMoyen, background: COUL.fond }} />
            <button onClick={copier} style={{ padding: '9px 14px', border: 'none', borderRadius: 8, background: color, color: COUL.blanc, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{copied ? '✓ Copié' : 'Copier'}</button>
          </div>

          {/* L'ACTION QUI SUIT DEPEND DU STATUT.
              Ludovic : « des que le devis est accepte, le bouton transformer
              en facture doit apparaitre, ce bouton ne doit pas rester dans le
              menu ». Un devis accepte n'a plus a etre envoye : la seule suite
              logique est de le facturer. Enterrer ce geste dans un menu
              deroulant, c'est le rendre invisible au moment ou il compte. */}
          {statut === 'accepté' ? (
            <div style={{ marginBottom: 22 }}>
              {factureLiee ? (
                <div style={{ padding: '12px 14px', borderRadius: 10, background: COUL.fond, border: `1px solid ${COUL.bord}`, fontSize: 13.5, color: COUL.texteDoux }}>
                  🔒 Déjà facturé — facture <strong style={{ color: COUL.texte }}>{factureLiee.numero}</strong>.
                </div>
              ) : (
                <>
                  <button onClick={() => onConvertir?.(doc)}
                    style={{ width: '100%', padding: '13px 16px', border: 'none', borderRadius: 10, background: COUL.succes, color: COUL.blanc, fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                    → Convertir en facture
                  </button>
                  <div style={{ fontSize: 11.5, color: COUL.texteFaible, marginTop: 6, textAlign: 'center' }}>
                    Le devis reste consultable ; la facture reprend ses articles et son client.
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
              <button onClick={envoyerEmail} disabled={sending} style={{ flex: 1, minWidth: 180, padding: '11px 16px', border: 'none', borderRadius: 10, background: COUL.succes, color: COUL.blanc, fontWeight: 700, fontSize: 14, cursor: sending ? 'wait' : 'pointer' }}>{sending ? '…' : '📧 Envoyer par email'}</button>
              <button onClick={() => marquerEnvoye(false)} style={{ padding: '11px 16px', border: '1px solid #e2e8f0', borderRadius: 10, background: COUL.surface, color: COUL.texteDoux, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Marquer envoyé</button>
            </div>
          )}

          {/* Timeline */}
          <div style={{ fontSize: 11, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', marginBottom: 12 }}>Historique</div>
          {events === null ? <p style={{ color: COUL.texteFaible, fontSize: 13 }}>Chargement…</p> : (
            <div style={{ position: 'relative', paddingLeft: 26 }}>
              <div style={{ position: 'absolute', left: 9, top: 4, bottom: 4, width: 2, background: COUL.bord }} />
              {timeline.map((ev, i) => {
                const cfg = EVT[ev.type] || { icon: '•', label: ev.type, col: COUL.texteDoux }
                return (
                  <div key={ev.id || i} style={{ position: 'relative', marginBottom: 18 }}>
                    <div style={{ position: 'absolute', left: -26, width: 20, height: 20, borderRadius: '50%', background: COUL.surface, border: `2px solid ${cfg.col}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{cfg.icon}</div>
                    <div style={{ fontWeight: 700, color: COUL.texte, fontSize: 14 }}>{cfg.label}</div>
                    <div style={{ fontSize: 12, color: COUL.texteFaible }}>{ev.created_at ? new Date(ev.created_at).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}{ev.detail ? ` · ${ev.detail}` : ''}</div>
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ApercuFacture({ fid, nom }) {
  const [etat, setEtat] = useState('load')
  useEffect(() => { setEtat('load') }, [fid])
  const src = `/api/apercu-facture?fid=${encodeURIComponent(fid)}`
  return (
    <div style={{ position: 'fixed', top: '50%', right: 24, transform: 'translateY(-50%)', zIndex: 2100, width: 520, maxWidth: '48vw', maxHeight: '88vh', background: COUL.surface, borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
      <div style={{ padding: '10px 14px', background: COUL.texteFort, color: COUL.blanc, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📄 {nom}</div>
      <div style={{ overflowY: 'auto', background: COUL.fond }}>
        <img src={src} alt="Apercu facture" onLoad={() => setEtat('ok')} onError={() => setEtat('err')} style={{ width: '100%', height: 'auto', display: etat === 'ok' ? 'block' : 'none' }} />
        {etat === 'load' && <div style={{ padding: '34px 20px', textAlign: 'center', color: COUL.texteFaible, fontSize: 13 }}>Chargement de l\'apercu…</div>}
        {etat === 'err' && <div style={{ padding: '34px 20px', textAlign: 'center', color: COUL.texteFaible, fontSize: 13 }}>Apercu indisponible.</div>}
      </div>
    </div>
  )
}

function EnvoiFactureModal({ doc, b64, fileName, onClose, onSent }) {
  const C = LODE.couleur
  const [to, setTo] = useState(doc.client_email || '')
  const [cc, setCc] = useState('contact@lode-group.be')
  const [cci, setCci] = useState('info@lode-group.be')
  const [subject, setSubject] = useState(`Facture ${doc.numero} de LODE`)
  // La communication structuree dans le corps du mail : le client qui paie
  // depuis son ordinateur ne scanne pas le QR du PDF, il recopie.
  const commMail = communicationStructuree(doc.numero)
  const duMail = Math.round(((Number(doc.total_ttc) || 0) - (Number(doc.montant_paye) || 0)) * 100) / 100
  const [body, setBody] = useState(
    `Bonjour ${doc.client_nom || ''},\n\n`
    + `Veuillez trouver ci-joint notre facture ${doc.numero} d'un montant de ${eur(duMail)}.\n\n`
    + `IBAN : ${LODE.iban} (${LODE.bic})\n`
    + (commMail ? `Communication structuree : ${commMail.affiche}\n` : '')
    + `\nBien a vous,\nLODE`)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  const envoyer = async () => {
    if (!to.trim()) { setErr('Destinataire manquant.'); return }
    setSending(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Session expiree \u2014 reconnecte-toi.')
      const r = await fetch('/api/facture-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ entite: 'lode', client_email: to.trim(), cc: cc.trim(), bcc: cci.trim(), subject, body, numero: doc.numero, fileName, pdfBase64: b64 }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) throw new Error(j.error || j.detail || ('HTTP ' + r.status))
      try {
        const annee = (doc.date_facture || doc.numero || '').toString().slice(0, 4) || String(new Date().getFullYear())
        const ar = await fetch(n8nWebhook('lode-facture-archive'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName, annee, pdfBase64: b64 }),
        })
        const ad = await ar.json().catch(() => ({}))
        if (ad.ok && ad.fid) {
          const url = String(ad.url).includes('?') ? ad.url : ad.url + '?web=1'
          await supabase.from('lode_factures').update({ pdf_fid: ad.fid, pdf_url: url }).eq('id', doc.id)
        }
      } catch (_) { /* archivage best-effort */ }
      alert('Facture envoyee \u2713')
      onSent()
    } catch (e) { setErr(e.message); setSending(false) }
  }

  const champ = { width: '100%', padding: '9px 11px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl = { fontSize: 12, fontWeight: 700, color: COUL.texteDoux, marginBottom: 4, display: 'block' }

  return (
    <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 16, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        <div style={{ background: C, color: COUL.blanc, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Envoyer la facture {doc.numero}</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: COUL.blanc, width: 30, height: 30, borderRadius: 15, cursor: 'pointer', fontSize: 16 }}>{'\u00d7'}</button>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div><label style={lbl}>A</label><input value={to} onChange={e => setTo(e.target.value)} style={champ} placeholder="client@email.be" /></div>
          <div><label style={lbl}>Cc</label><input value={cc} onChange={e => setCc(e.target.value)} style={champ} placeholder="(optionnel)" /></div>
          <div><label style={lbl}>Cci</label><input value={cci} onChange={e => setCci(e.target.value)} style={champ} placeholder="(optionnel)" /></div>
          <div><label style={lbl}>Objet</label><input value={subject} onChange={e => setSubject(e.target.value)} style={champ} /></div>
          <div><label style={lbl}>Message</label><textarea value={body} onChange={e => setBody(e.target.value)} rows={7} style={{ ...champ, resize: 'vertical', lineHeight: 1.5 }} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: COUL.fond, border: '1px solid #eef2f6', borderRadius: 8, padding: '9px 12px', fontSize: 13 }}>
            <span style={{ fontSize: 16 }}>📎</span><span style={{ color: COUL.texteMoyen, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
          </div>
          {err && <div style={{ color: COUL.danger, fontSize: 13, fontWeight: 600 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} disabled={sending} style={{ padding: '10px 18px', border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.texteMoyen, borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Annuler</button>
            <button onClick={envoyer} disabled={sending} style={{ padding: '10px 22px', border: 'none', background: COUL.succes, color: COUL.blanc, borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: sending ? 'wait' : 'pointer' }}>{sending ? 'Envoi\u2026' : '\u2709 Envoyer la facture'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  RAPPROCHER UNE FACTURE DE VENTE AVEC LA RENTREE QUI L'A PAYEE
//
//  Volontairement MANUEL. Mesure du 06/11 sur les donnees reelles :
//  sur 22 factures, 4 seulement ont une rentree au montant exact. Les
//  clients paient en montants ronds, partiellement, ou groupent plusieurs
//  factures. Un automate se tromperait plus souvent qu'il n'aiderait ;
//  l'ecran classe les candidats et c'est un humain qui tranche.
// ════════════════════════════════════════════════════════════════
function ModalPaiement({ facture, factures, onClose, onLie }) {
  const [mouvements, setMouvements] = useState(null)
  const [erreur, setErreur] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const du = Math.round(((Number(facture.total_ttc) || 0) - (Number(facture.montant_paye) || 0)) * 100) / 100

  useEffect(() => {
    let vivant = true
    ;(async () => {
      try {
        const { data: soc } = await supabase.from('societes').select('id').eq('code', 'LODE').single()
        if (!soc) throw new Error('Société LODE introuvable')
        const { data: comptes } = await supabase.from('comptes_bancaires').select('id').eq('societe_id', soc.id)
        const ids = (comptes || []).map(c => c.id)
        if (!ids.length) throw new Error('Aucun compte bancaire LODE')
        const { data, error } = await supabase
          .from('transactions')
          .select('id,date_valeur,montant,contrepartie_nom,description,information_paiement')
          .in('compte_id', ids).gt('montant', 0)
          .order('date_valeur', { ascending: false }).limit(400)
        if (error) throw error
        if (vivant) setMouvements(data || [])
      } catch (e) { if (vivant) { setErreur(e.message); setMouvements([]) } }
    })()
    return () => { vivant = false }
  }, [facture.id])

  // Deja pris par une autre facture : on le montre plutot que de le cacher,
  // sinon on cherche en vain un virement qu'on a deja affecte ailleurs.
  const prisPar = {}
  for (const f of (factures || [])) if (f.transaction_id && f.id !== facture.id) prisPar[f.transaction_id] = f.numero

  const sansAccent = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const motsClient = sansAccent(facture.client_nom).split(/\s+/).filter(m => m.length > 3)

  const classes = (mouvements || [])
    .map(m => {
      const montantExact = Math.abs((Number(m.montant) || 0) - du) < 0.01
      const texte = sansAccent(`${m.contrepartie_nom || ''} ${m.description || ''} ${m.information_paiement || ''}`)
      const nomColle = motsClient.length > 0 && motsClient.some(mot => texte.includes(mot))
      const numeroCite = facture.numero && texte.includes(sansAccent(facture.numero))
      // Le numero cite en communication est le signe le plus sur, loin devant
      // le montant : c'est le client qui l'a ecrit.
      const score = (numeroCite ? 100 : 0) + (montantExact ? 40 : 0) + (nomColle ? 20 : 0)
      return { ...m, montantExact, nomColle, numeroCite, score }
    })
    .filter(m => {
      if (!q.trim()) return true
      const t = sansAccent(`${m.contrepartie_nom || ''} ${m.description || ''} ${m.information_paiement || ''} ${m.montant}`)
      return sansAccent(q).split(/\s+/).filter(Boolean).every(mot => t.includes(mot))
    })
    .sort((a, b) => b.score - a.score || String(b.date_valeur).localeCompare(String(a.date_valeur)))

  const lier = async (m) => {
    const couvre = (Number(m.montant) || 0) + 0.01 >= du
    const txt = `Rapprocher la facture ${facture.numero} de la rentrée du ${fmtDate(m.date_valeur)} ?\n\n`
      + `Montant reçu : ${eur(m.montant)}\nMontant dû : ${eur(du)}\n\n`
      + (couvre ? 'La facture sera marquée « payée ».' : 'Le paiement ne couvre pas tout : le statut ne change pas.')
    if (!window.confirm(txt)) return
    setBusy(true)
    const maj = { transaction_id: m.id }
    if (couvre) maj.statut = 'payée'
    const { error } = await supabase.from('lode_factures').update(maj).eq('id', facture.id)
    setBusy(false)
    if (error) { alert('Rapprochement impossible : ' + error.message); return }
    onLie({ ...facture, ...maj })
    onClose()
  }

  const delier = async () => {
    if (!window.confirm(`Retirer le paiement rapproché à la facture ${facture.numero} ?`)) return
    setBusy(true)
    const { error } = await supabase.from('lode_factures').update({ transaction_id: null }).eq('id', facture.id)
    setBusy(false)
    if (error) { alert('Impossible : ' + error.message); return }
    onLie({ ...facture, transaction_id: null })
    onClose()
  }

  const inp2 = { padding: '9px 11px', border: `1px solid ${COUL.bord}`, borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }

  return (
    <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 14px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: '100%', maxWidth: 680, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '86vh' }}>
        <div style={{ padding: '15px 20px', borderBottom: `1px solid ${COUL.bord}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>Rapprocher un paiement</div>
            <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 2 }}>
              Facture {facture.numero} · {facture.client_nom} · <strong style={{ color: ORANGE }}>{eur(du)}</strong> dû
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 21, cursor: 'pointer', color: COUL.texteFaible }}>×</button>
        </div>

        {facture.transaction_id && (
          <div style={{ padding: '11px 20px', background: COUL.succesFondDoux, borderBottom: `1px solid ${COUL.succesBord}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: COUL.succesFonce }}>✓ Un paiement est déjà rapproché</span>
            <button onClick={delier} disabled={busy} style={{ marginLeft: 'auto', background: COUL.surface, border: `1px solid ${COUL.dangerBord}`, color: COUL.danger, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Le retirer</button>
          </div>
        )}

        <div style={{ padding: '12px 20px 0' }}>
          <input value={q} onChange={e => setQ(e.target.value)} style={inp2} placeholder="Filtrer — nom, communication, montant" />
        </div>

        <div style={{ padding: '10px 14px 16px', overflowY: 'auto' }}>
          {mouvements === null && <div style={{ padding: 24, textAlign: 'center', color: COUL.texteDoux, fontSize: 13 }}>Lecture des rentrées…</div>}
          {erreur && <div style={{ padding: 16, color: COUL.danger, fontSize: 13, fontWeight: 600 }}>{erreur}</div>}
          {mouvements !== null && !erreur && !classes.length && (
            <div style={{ padding: 24, textAlign: 'center', color: COUL.texteDoux, fontSize: 13 }}>Aucune rentrée ne correspond.</div>
          )}
          {classes.map(m => (
            <div key={m.id} onClick={() => !busy && lier(m)}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 9, cursor: busy ? 'wait' : 'pointer', borderBottom: `1px solid ${COUL.fondDoux}` }}
              onMouseEnter={e => e.currentTarget.style.background = COUL.fond}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>{m.contrepartie_nom || '(sans nom)'}</div>
                <div style={{ fontSize: 11.5, color: COUL.texteDoux, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fmtDate(m.date_valeur)}{m.information_paiement ? ' · ' + m.information_paiement : (m.description ? ' · ' + m.description : '')}
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                  {m.numeroCite && <span style={{ fontSize: 10, fontWeight: 800, color: COUL.succesFonce, background: COUL.succesFond, borderRadius: 4, padding: '1px 6px' }}>N° DE FACTURE CITÉ</span>}
                  {m.montantExact && <span style={{ fontSize: 10, fontWeight: 800, color: ORANGE, background: COUL.orangeFond, borderRadius: 4, padding: '1px 6px' }}>MONTANT EXACT</span>}
                  {m.nomColle && <span style={{ fontSize: 10, fontWeight: 800, color: COUL.info, background: COUL.infoFond, borderRadius: 4, padding: '1px 6px' }}>NOM DU CLIENT</span>}
                  {prisPar[m.id] && <span style={{ fontSize: 10, fontWeight: 800, color: COUL.alerteFonce, background: COUL.alerteFond, borderRadius: 4, padding: '1px 6px' }}>DÉJÀ SUR {prisPar[m.id]}</span>}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{eur(m.montant)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  MENU DE LIGNE — sept boutons sur chaque ligne, c'est sept fois
//  rien de lisible. Les deux gestes courants restent visibles, le
//  reste tient ici.
// ════════════════════════════════════════════════════════════════
function MenuLigne({ anchor, items, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ top: 0, pret: false })

  // Le tableau vit dans une carte `overflow-x: auto`, qui decoupe tout ce qui
  // depasse — un menu ouvert sur la derniere ligne etait simplement invisible.
  // On le sort donc du flux : position fixe, calee sur le bouton a l'ecran.
  useLayoutEffect(() => {
    const h = ref.current ? ref.current.offsetHeight : 0
    const sousLeBouton = anchor.bottom + 4
    const place = (sousLeBouton + h > window.innerHeight - 8 && anchor.top - 4 - h > 8)
      ? anchor.top - 4 - h                                   // il tient au-dessus
      : Math.max(8, Math.min(sousLeBouton, window.innerHeight - 8 - h))
    setPos({ top: place, pret: true })
  }, [anchor])

  // Un menu fixe ne suit pas le defilement : plutot que de le voir deriver
  // loin de sa ligne, on le ferme.
  useEffect(() => {
    const fermer = () => onClose()
    window.addEventListener('scroll', fermer, true)
    window.addEventListener('resize', fermer)
    return () => { window.removeEventListener('scroll', fermer, true); window.removeEventListener('resize', fermer) }
  }, [onClose])

  return (
    <>
      <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, zIndex: 1200 }} />
      <div ref={ref} style={{ position: 'fixed', top: pos.top, right: Math.max(8, window.innerWidth - anchor.right), zIndex: 1201, visibility: pos.pret ? 'visible' : 'hidden', background: COUL.surface, border: `1px solid ${COUL.bord}`, borderRadius: 10, boxShadow: '0 10px 30px rgba(15,23,42,.18)', minWidth: 206, overflow: 'hidden', textAlign: 'left' }}>
        {items.filter(Boolean).map((it, k) => it.sep ? (
          <div key={k} style={{ height: 1, background: COUL.bord }} />
        ) : (
          <button key={k} type="button" disabled={it.disabled}
            onClick={() => { onClose(); it.onClick() }}
            onMouseEnter={e => { if (!it.disabled) e.currentTarget.style.background = COUL.fond }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '9px 13px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: it.danger ? COUL.danger : COUL.texteMoyen, cursor: it.disabled ? 'not-allowed' : 'pointer', opacity: it.disabled ? .5 : 1 }}>
            <span style={{ width: 16, textAlign: 'center' }}>{it.icon}</span>{it.label}
          </button>
        ))}
      </div>
    </>
  )
}

export default function LodeDevisFactures() {
  // Arrivée depuis l'écran Dossiers : « créer un devis » y pousse le client
  // et le dossier, et l'éditeur s'ouvre déjà rempli. On efface l'état de
  // navigation aussitôt, sinon un simple rechargement rouvrirait l'éditeur.
  const navLocation = useLocation()
  const navigateVers = useNavigate()
  const [tab, setTab] = useState('devis')
  const [devis, setDevis] = useState([])
  const [factures, setFactures] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // {type, doc}
  useEffect(() => {
    const d = navLocation.state?.nouveauDevis
    if (!d) return
    setEditing({ type: 'devis', doc: d })
    navigateVers(navLocation.pathname, { replace: true, state: null })
  }, [navLocation.state])
  const [busy, setBusy] = useState(null)
  const [suivi, setSuivi] = useState(null)      // devis dont on affiche le suivi
  const [apercu, setApercu] = useState(null)      // {fid,nom} apercu PDF au survol
  const [envoi, setEnvoi] = useState(null)        // { doc, b64, fileName } facture a envoyer par email
  const [paiement, setPaiement] = useState(null)  // facture dont on cherche la rentree bancaire
  const [sort, setSort] = useState({ key: 'numero', dir: 'desc' })
  const [recherche, setRecherche] = useState('')
  const [filtreStatut, setFiltreStatut] = useState(null)
  const [menu, setMenu] = useState(null)        // id du document dont le menu est ouvert
  const [menuStatut, setMenuStatut] = useState(null)  // id du document dont le menu de statut est ouvert

  const load = async () => {
    setLoading(true)
    const [d, fa] = await Promise.all([
      supabase.from('lode_devis').select('*').order('created_at', { ascending: false }),
      supabase.from('lode_factures').select('*').order('created_at', { ascending: false }),
    ])
    setDevis(d.data || []); setFactures(fa.data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const getLignes = async (type, id) => {
    const t = type === 'devis' ? 'lode_devis_lignes' : 'lode_factures_lignes'
    const fk = type === 'devis' ? 'devis_id' : 'facture_id'
    const { data } = await supabase.from(t).select('*').eq(fk, id).order('position')
    return data || []
  }

  const doExport = async (fmt, type, doc) => {
    setBusy(doc.id + fmt)
    try {
      const lignes = await getLignes(type, doc.id)
      if (fmt === 'pdf') await exportPDF(type, doc, lignes)
      else await exportWord(type, doc, lignes)
    } catch (e) { alert('Erreur export : ' + e.message) }
    finally { setBusy(null) }
  }

  // Envoi de la facture sur le réseau Peppol, via /api/peppol-send → Billit.
  // L'OrderID renvoyé par Billit est conservé : c'est la seule trace qui permet
  // de retrouver la facture chez eux si quelque chose cloche après coup.
  const envoyerPeppol = async (doc) => {
    if (!PEPPOL_ACTIF) { alert('Le lien Peppol est désactivé pour le moment.'); return }
    if (!doc.client_tva) { alert('Numéro de TVA du client manquant — Peppol route sur la TVA.'); return }
    // On annonce LE MONTANT RECLAME, pas seulement le numero. Une facture
    // electronique fait foi : si l'acompte ne passait pas, le client serait
    // debite du montant plein sans que personne s'en apercoive avant la
    // reclamation. Autant le voir avant d'envoyer.
    const dejaPaye = Math.max(0, Number(doc.montant_paye) || 0)
    const reclame = Math.round(((Number(doc.total_ttc) || 0) - dejaPaye) * 100) / 100
    const recap = dejaPaye > 0
      ? `Envoyer la facture ${doc.numero} sur le réseau Peppol via Billit ?\n\n`
        + `Total : ${eur(Number(doc.total_ttc) || 0)}\n`
        + `Acompte déjà payé : − ${eur(dejaPaye)}\n`
        + `MONTANT RÉCLAMÉ AU CLIENT : ${eur(reclame)}\n\n`
        + `Vérifie ce montant chez Billit après l'envoi : c'est la première fois `
        + `qu'une facture avec acompte part en Peppol.`
      : `Envoyer la facture ${doc.numero} sur le réseau Peppol via Billit ?\n\nMontant : ${eur(Number(doc.total_ttc) || 0)}`
    if (!confirm(recap)) return
    setBusy(doc.id + 'peppol')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Session expirée — reconnecte-toi.')
      const lignes = await getLignes('facture', doc.id)
      const res = await fetch('/api/peppol-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ entite: 'lode', facture: { ...doc, lignes } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        // Étape « envoi » : la facture existe déjà chez Billit, il ne faut surtout
        // pas la recréer — on garde l'OrderID pour la relancer depuis Billit.
        if (data.orderID) {
          await supabase.from('lode_factures')
            .update({ billit_order_id: String(data.orderID), billit_statut: 'erreur_envoi' })
            .eq('id', doc.id)
          load()
        }
        throw new Error([data.error, data.detail].filter(Boolean).join(' — ') || `HTTP ${res.status}`)
      }
      await supabase.from('lode_factures')
        .update({ statut: 'envoyée', billit_order_id: String(data.orderID), billit_statut: 'envoye' })
        .eq('id', doc.id)
      alert(`Facture ${doc.numero} envoyée sur Peppol ✓`)
      load()
    } catch (e) {
      alert(`Échec de l'envoi Peppol : ${e.message}`)
    } finally { setBusy(null) }
  }

  const ARCHIVE_WEBHOOK = n8nWebhook('lode-facture-archive')

  // Facture : genere le PDF, l'archive dans SharePoint _LODE/VENTES, stocke pdf_fid/pdf_url, puis OUVRE le PDF dans SharePoint (aucun telechargement).
  const genererFacturePDF = async (doc) => {
    const win = window.open('', '_blank')  // onglet reserve dans le geste de clic (anti popup-block)
    setBusy(doc.id + 'pdf')
    try {
      const lignes = await getLignes('facture', doc.id)
      const b64 = await exportPDF('facture', doc, lignes, { save: false })
      const annee = (doc.date_facture || doc.numero || '').toString().slice(0, 4) || String(new Date().getFullYear())
      const fileName = nomFichierDoc(doc, 'facture', 'pdf')
      const res = await fetch(ARCHIVE_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, annee, pdfBase64: b64 }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok && data.fid) {
        const url = String(data.url).includes('?') ? data.url : data.url + '?web=1'
        await supabase.from('lode_factures').update({ pdf_fid: data.fid, pdf_url: url }).eq('id', doc.id)
        load()
        if (win) win.location = url; else window.open(url, '_blank', 'noopener')
      } else {
        if (win) win.close()
        alert('Archivage SharePoint echoue — reessaie dans un instant.')
      }
    } catch (e) {
      if (win) win.close()
      alert('Erreur PDF : ' + e.message)
    } finally { setBusy(null) }
  }

  // Facture : prepare le PDF (base64, sans telechargement) puis ouvre le modal d'envoi par email.
  const ouvrirEnvoiFacture = async (doc) => {
    setBusy(doc.id + 'mail')
    try {
      const lignes = await getLignes('facture', doc.id)
      const b64 = await exportPDF('facture', doc, lignes, { save: false })
      const fileName = nomFichierDoc(doc, 'facture', 'pdf')
      setEnvoi({ doc, b64, fileName })
    } catch (e) { alert('Erreur preparation PDF : ' + e.message) }
    finally { setBusy(null) }
  }

  // Changer le statut sans ouvrir le document : c'est le geste le plus
  // frequent de la liste (« le client a dit oui »), il ne doit pas couter
  // l'ouverture de l'editeur.
  const changerStatut = async (doc, nouveau) => {
    const table = tab === 'devis' ? 'lode_devis' : 'lode_factures'
    const avant = doc.statut
    const maj = (st) => {
      const appliquer = (arr) => arr.map(x => x.id === doc.id ? { ...x, statut: st } : x)
      if (tab === 'devis') setDevis(appliquer); else setFactures(appliquer)
    }
    maj(nouveau)                                   // on montre tout de suite
    const { error } = await supabase.from(table).update({ statut: nouveau }).eq('id', doc.id)
    if (error) { maj(avant); alert('Statut non enregistré : ' + error.message) }
  }

  const convertir = async (devisDoc) => {
    if (!confirm(`Convertir le devis ${devisDoc.numero} en facture ?`)) return
    const lignes = await getLignes('devis', devisDoc.id)
    const { data: num } = await supabase.rpc('next_lode_numero', { p_type: 'facture' })
    const { data: fact, error } = await supabase.from('lode_factures').insert({
      numero: num, devis_id: devisDoc.id, statut: 'brouillon', type: 'facture', responsable: devisDoc.responsable || null,
      // Le chantier et le client suivent le devis. Sans ces deux lignes, la
      // facture naissait orpheline : mesuré le 08/11, 0 des 23 factures de
      // vente portait un chantier, alors que la colonne existait. Le devis
      // était rattaché, la facture qui en sortait ne l'était plus.
      dossier_id: devisDoc.dossier_id || null,
      client_id: devisDoc.client_id || null,
      client_nom: devisDoc.client_nom, client_adresse: devisDoc.client_adresse, client_cp: devisDoc.client_cp,
      client_ville: devisDoc.client_ville, client_email: devisDoc.client_email, client_telephone: devisDoc.client_telephone,
      client_tva: devisDoc.client_tva, objet: devisDoc.objet, notes: devisDoc.notes, remise_pct: devisDoc.remise_pct,
      total_ht: devisDoc.total_ht, total_tva: devisDoc.total_tva, total_ttc: devisDoc.total_ttc,
      langue: devisDoc.langue || 'fr',
      date_facture: todayISO(), date_echeance: addDays(todayISO(), DELAI_PAIEMENT_JOURS),
    }).select('id').single()
    if (error) { alert('Erreur : ' + error.message); return }
    if (lignes.length) {
      // Le devis porte titre, descriptif, photos et options ; la facture a les
      // memes colonnes. Ne recopier que `description` vidait la facture de tout
      // ce que le client avait lu dans son devis.
      await supabase.from('lode_factures_lignes').insert(lignes.map((l, i) => ({
        facture_id: fact.id, position: i,
        titre: l.titre || '', descriptif: l.descriptif || '',
        description: l.description || l.titre || '',
        photos: l.photos || [], optionnelle: !!l.optionnelle,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire, remise_pct: l.remise_pct, tva_pct: l.tva_pct, tva_categorie: l.tva_categorie || ((Number(l.tva_pct) || 0) > 0 ? 'S' : 'AE'), total_ht: l.total_ht,
      })))
    }
    setTab('factures'); load()
  }

  // Un devis deja converti est reference par sa facture : la cle etrangere est
  // en NO ACTION, Postgres refuse donc la suppression. On le sait AVANT de
  // demander confirmation — les factures sont deja chargees.
  const factureDuDevis = (id) => factures.find(f => f.devis_id === id) || null

  const supprimer = async (type, id) => {
    if (type !== 'devis') { alert("Une facture ne peut pas être supprimée (numérotation légale continue). Pour l'annuler, créez une note de crédit."); return }
    const doc = devis.find(d => d.id === id)
    const liee = factureDuDevis(id)
    if (liee) {
      alert(`Le devis ${doc?.numero || ''} a été converti en facture ${liee.numero}.\n\n`
        + `Il ne peut plus être supprimé : la facture y fait référence. Pour annuler `
        + `la facture, créez une note de crédit.`)
      return
    }
    if (!confirm(`Supprimer définitivement le devis ${doc?.numero || ''} ?`)) return

    // La ligne disparait tout de suite. L'ancien code ignorait l'erreur de la
    // base, rechargeait, et le devis revenait sans un mot d'explication : on
    // croyait a un ecran qui ne se rafraichit pas, c'etait un refus silencieux.
    setDevis(p => p.filter(d => d.id !== id))
    const { error } = await supabase.from('lode_devis').delete().eq('id', id)
    if (error) {
      load()   // la base a le dernier mot : on reprend son etat
      alert(error.code === '23503'
        ? `Ce devis est référencé ailleurs dans le Hub (une facture d'achat y renvoie, par exemple) : il ne peut pas être supprimé.`
        : 'Suppression impossible : ' + error.message)
    }
  }

  const listeBrute = tab === 'devis' ? devis : factures
  // La recherche porte sur ce qu'on a sous les yeux : numero, client, objet.
  // Pas de recherche plein texte cote base — la liste tient en memoire.
  const motsRecherche = recherche.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const liste = listeBrute.filter(d => {
    if (filtreStatut && d.statut !== filtreStatut) return false
    if (!motsRecherche.length) return true
    const foin = `${d.numero || ''} ${d.client_nom || ''} ${d.objet || ''}`.toLowerCase()
    return motsRecherche.every(m => foin.includes(m))
  })

  // Suivi acomptes : dossiers (par devis) avec un acompte facture mais un reste a facturer > 0.
  // Les devis acceptés qui attendent leur facture.
  //
  // Ludovic : « dès que le devis est accepté, le bouton transformer en
  // facture doit apparaître, ce bouton ne doit pas rester dans le menu ».
  //
  // Un geste qui n'a de valeur qu'à un moment précis ne doit pas être rangé
  // dans un menu déroulant : au mieux on le cherche, au pire on l'oublie —
  // et un devis accepté jamais facturé est exactement l'oubli qui coûte de
  // l'argent. Il monte donc en bandeau, comme « À solder » pour les factures.
  // ⚠️ Pas de `COUL.x || '#fallback'` dans ce bandeau : depuis le passage aux
  // variables CSS, COUL.succesBord vaut la CHAÎNE « var(--hub-succesBord) »,
  // donc toujours vraie. Un repli par `||` sur un jeton COUL est du code mort.
  const aFacturer = devis.filter(d => d.statut === 'accepté' && !factureDuDevis(d.id))

  const aSolder = (() => {
    const acs = factures.filter(x => x.type === 'acompte')
    if (!acs.length) return []
    const parDevis = {}
    factures.forEach(x => { const k = x.devis_id || ('f:' + x.id); (parDevis[k] = parDevis[k] || []).push(x) })
    const out = []
    acs.forEach(ac => {
      const k = ac.devis_id || ('f:' + ac.id)
      if (out.find(r => r.key === k)) return
      const grp = parDevis[k] || [ac]
      const projet = Math.max(0, ...grp.map(x => Number(x.total_projet_ttc) || 0))
      const facture = grp.reduce((sum, x) => sum + (Number(x.total_ttc) || 0), 0)
      const reste = Math.round((projet - facture) * 100) / 100
      if (projet > 0 && reste > 0.01) out.push({ key: k, acompte: ac, grp, projet, facture, reste })
    })
    return out.sort((a, b) => b.reste - a.reste)
  })()

  const facturerSolde = (d) => {
    const ac = d.acompte
    setEditing({ type: 'facture', doc: {
      type: 'solde',
      client_id: ac.client_id, client_nom: ac.client_nom, client_adresse: ac.client_adresse,
      client_cp: ac.client_cp, client_ville: ac.client_ville, client_email: ac.client_email,
      client_telephone: ac.client_telephone, client_tva: ac.client_tva,
      devis_id: ac.devis_id || null, total_projet_ttc: ac.total_projet_ttc,
      dossier_id: ac.dossier_id || null,
      langue: ac.langue || 'fr', objet: ac.objet || '',
      _preselAcomptes: d.grp.filter(x => x.type === 'acompte').map(x => x.id),
    } })
  }
  // Le menu du statut. Quand un devis est accepte, l'action qui suit n'est
  // pas « changer le statut » mais « facturer » : elle passe en tete.
  const itemsStatut = (doc) => {
    const suite = []
    if (tab === 'devis' && doc.statut === 'envoyé') {
      suite.push({ icon: '📊', label: 'Voir si le client a ouvert', onClick: () => setSuivi(doc) }, { sep: true })
    }
    return [
      ...suite,
      ...Object.entries(STAT).map(([k, v]) => ({
        icon: doc.statut === k ? '✓' : ' ',
        label: v.label,
        disabled: doc.statut === k,
        onClick: () => changerStatut(doc, k),
      })),
    ]
  }

  // Les gestes d'un document, au meme endroit pour le tableau et les cartes :
  // deux listes qui divergent, c'est un bouton qui manque d'un cote.
  const actionsDoc = (doc) => {
    const t = tab === 'devis' ? 'devis' : 'facture'
    return [
      { icon: '✎', label: 'Modifier', onClick: () => setEditing({ type: t, doc }) },
      tab === 'devis' && { icon: '📊', label: 'Suivi du devis', onClick: () => setSuivi(doc) },
      tab !== 'devis' && { icon: doc.transaction_id ? '🔗' : '🏦',
        label: doc.transaction_id ? 'Paiement rapproché — modifier' : 'Rapprocher un paiement',
        onClick: () => setPaiement(doc) },
      { sep: true },
      { icon: '📄', label: 'Télécharger le PDF', disabled: busy === doc.id + 'pdf',
        onClick: () => (tab === 'devis' ? doExport('pdf', 'devis', doc) : genererFacturePDF(doc)) },
      tab === 'devis' && { icon: '📝', label: 'Télécharger le Word', disabled: busy === doc.id + 'word', onClick: () => doExport('word', 'devis', doc) },
      tab !== 'devis' && doc.pdf_url && { icon: '🔗', label: 'Ouvrir le PDF archivé', onClick: () => window.open(doc.pdf_url, '_blank', 'noopener') },
      tab !== 'devis' && { sep: true },
      tab !== 'devis' && { icon: '✉', label: 'Envoyer par mail', disabled: busy === doc.id + 'mail', onClick: () => ouvrirEnvoiFacture(doc) },
      PEPPOL_ACTIF && tab === 'factures' && doc.client_tva && doc.statut !== 'payée' && doc.statut !== 'annulée'
        && { icon: '📨', label: 'Envoyer via Peppol', disabled: busy === doc.id + 'peppol', onClick: () => envoyerPeppol(doc) },
      tab === 'devis' && { sep: true },
      tab === 'devis' && (factureDuDevis(doc.id)
        ? { icon: '🔒', label: `Facturé (${factureDuDevis(doc.id).numero})`, disabled: true, onClick: () => {} }
        : { icon: '🗑', label: 'Supprimer', danger: true, onClick: () => supprimer('devis', doc.id) }),
    ].filter(Boolean)
  }

  const COLS = [
    { h: 'N°', key: 'numero', align: 'left' },
    { h: 'Client', key: 'client_nom', align: 'left' },
    { h: 'Objet', key: 'objet', align: 'left' },
    { h: 'Date', key: 'date', align: 'left' },
    { h: 'Total TTC', key: 'total_ttc', align: 'right' },
    { h: 'Statut', key: 'statut', align: 'left' },
    { h: '', key: null, align: 'right' },
  ]
  const sortVal = (doc, k) => k === 'date' ? ((tab === 'devis' ? doc.date_devis : doc.date_facture) || '') : doc[k]
  const listeTriee = [...liste].sort((a, b) => {
    const k = sort.key
    const va = sortVal(a, k), vb = sortVal(b, k)
    let cmp
    if (k === 'total_ttc') cmp = (Number(va) || 0) - (Number(vb) || 0)
    else cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'fr', { numeric: true, sensitivity: 'base' })
    return sort.dir === 'asc' ? cmp : -cmp
  })
  const STAT = tab === 'devis' ? STATUTS_DEVIS : STATUTS_FACT
  const C = LODE.couleur
  const C_DARK = '#7c2d12'
  const mob = useMobile()

  // Stats du bandeau
  const sum = (arr) => arr.reduce((a, d) => a + (Number(d.total_ttc) || 0), 0)
  const factEnAttente = factures.filter(f => !['payée', 'annulée'].includes(f.statut))
  const stats = tab === 'devis'
    ? [
        { label: 'Devis', value: devis.length },
        { label: 'Total devis', value: eur(sum(devis)) },
        { label: 'Acceptés', value: devis.filter(d => d.statut === 'accepté').length },
      ]
    : [
        { label: 'Factures', value: factures.length },
        { label: 'Total facturé', value: eur(sum(factures)) },
        { label: 'En attente', value: eur(sum(factEnAttente)) },
      ]

  return (
    <Layout currentPage="Devis & Factures">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner
          color={C} colorDark={C_DARK} logoUrl={LODE.logo_url}
          title={tab === 'devis' ? 'Devis' : 'Factures'}
          subtitle={`LODE SRL — ${LODE.activite}`}
          stats={stats}
          action={<PrimaryButton color={C} onClick={() => setEditing({ type: tab === 'factures' ? 'facture' : 'devis', doc: null })}>
            <i className="ti ti-plus" /> {tab === 'factures' ? 'Nouvelle facture' : 'Nouveau devis'}
          </PrimaryButton>}
        />

        <TabsBar color={C} active={tab} onChange={setTab}
          tabs={[{ key: 'devis', label: 'Devis', count: devis.length }, { key: 'factures', label: 'Factures', count: factures.length }]} />

        {tab === 'devis' && aFacturer.length > 0 && (
          <DataCard style={{ padding: 0, marginBottom: 14, border: `1px solid ${COUL.succesBord}`, overflow: 'hidden' }}>
            <div style={{ background: COUL.succesFond, color: COUL.succesFonce, fontWeight: 800, fontSize: 13.5, padding: '10px 16px', borderBottom: `1px solid ${COUL.succesBord}` }}>
              ✅ Accepté, pas encore facturé — {aFacturer.length} devis
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {aFacturer.map(d => (
                <div key={d.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderTop: '1px solid #f8fafc' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: COUL.texte, fontSize: 14 }}>{d.client_nom}</div>
                    <div style={{ color: COUL.texteFaible, fontSize: 12 }}>
                      Devis {d.numero}{d.objet ? ' · ' + d.objet : ''}
                      {d.accepted_at ? ' · accepté le ' + new Date(d.accepted_at).toLocaleDateString('fr-BE') : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10.5, color: COUL.succesFonce, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>Montant</div>
                      <div style={{ fontWeight: 800, color: COUL.succesFonce, fontSize: 16 }}>{eur(d.total_ttc)}</div>
                    </div>
                    <button onClick={() => convertir(d)} style={{ background: COUL.succes, color: COUL.blanc, border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Convertir en facture</button>
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        )}

        {tab === 'factures' && aSolder.length > 0 && (
          <DataCard style={{ padding: 0, marginBottom: 14, border: '1px solid #fed7aa', overflow: 'hidden' }}>
            <div style={{ background: COUL.orangeFond, color: '#9a3412', fontWeight: 800, fontSize: 13.5, padding: '10px 16px', borderBottom: '1px solid #fed7aa' }}>
              ⏳ À solder — {aSolder.length} dossier{aSolder.length > 1 ? 's' : ''} avec acompte facturé, reste à facturer
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {aSolder.map(d => (
                <div key={d.key} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderTop: '1px solid #f8fafc' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: COUL.texte, fontSize: 14 }}>{d.acompte.client_nom}</div>
                    <div style={{ color: COUL.texteFaible, fontSize: 12 }}>Acompte {d.acompte.numero} · projet {eur(d.projet)} · déjà facturé {eur(d.facture)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10.5, color: '#9a3412', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .3 }}>Reste</div>
                      <div style={{ fontWeight: 800, color: '#9a3412', fontSize: 16 }}>{eur(d.reste)}</div>
                    </div>
                    <button onClick={() => facturerSolde(d)} style={{ background: COUL.succes, color: COUL.blanc, border: 'none', borderRadius: 9, padding: '9px 15px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Facturer le solde</button>
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        )}

        {/* ── Barre d'outils : chercher, filtrer ──────────────────────────
            Une liste de factures sans recherche oblige a scroller ; passe
            cinquante lignes, c'est la premiere chose qui manque. */}
        {!loading && listeBrute.length > 0 && (
          <DataCard style={{ padding: '11px 13px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200 }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: COUL.texteFaible, fontSize: 13, pointerEvents: 'none' }}>⌕</span>
              <input value={recherche} onChange={e => setRecherche(e.target.value)}
                placeholder={tab === 'devis' ? 'Chercher un devis — client, numéro, objet' : 'Chercher une facture — client, numéro, objet'}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 30px 9px 28px', border: `1px solid ${COUL.bord}`, borderRadius: 9, fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = C} onBlur={e => e.target.style.borderColor = COUL.bord} />
              {recherche && (
                <button type="button" onClick={() => setRecherche('')} title="Effacer"
                  style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: COUL.texteFaible, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[{ k: null, lab: 'Tous', n: listeBrute.length, col: COUL.texteMoyen },
                ...Object.entries(STAT)
                  .map(([k, v]) => ({ k, lab: v.label, n: listeBrute.filter(d => d.statut === k).length, col: v.col }))
                  .filter(c => c.n > 0),
              ].map(c => {
                const on = filtreStatut === c.k
                return (
                  <button key={c.k || 'tous'} type="button" onClick={() => setFiltreStatut(on ? null : c.k)}
                    style={{ padding: '7px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit',
                             border: `1.5px solid ${on ? c.col : COUL.bord}`, background: on ? c.col : COUL.blanc, color: on ? COUL.blanc : COUL.texteDoux, whiteSpace: 'nowrap' }}>
                    {c.lab} <span style={{ opacity: .7, fontWeight: 600 }}>{c.n}</span>
                  </button>
                )
              })}
            </div>
            {(recherche || filtreStatut) && (
              <div style={{ fontSize: 12.5, color: COUL.texteDoux, fontWeight: 600, marginLeft: 'auto' }}>
                {liste.length} sur {listeBrute.length}
                <button type="button" onClick={() => { setRecherche(''); setFiltreStatut(null) }}
                  style={{ marginLeft: 8, background: 'none', border: 'none', color: C, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, textDecoration: 'underline', fontFamily: 'inherit' }}>tout afficher</button>
              </div>
            )}
          </DataCard>
        )}

        {loading ? <p style={{ color: COUL.texteFaible }}>Chargement…</p> :
          liste.length === 0 ? (
            <DataCard style={{ padding: '48px 24px', textAlign: 'center' }}>
              {(recherche || filtreStatut) ? (
                <>
                  <p style={{ color: COUL.texteDoux, margin: '0 0 10px', fontWeight: 600 }}>Aucun résultat pour cette recherche.</p>
                  <button type="button" onClick={() => { setRecherche(''); setFiltreStatut(null) }}
                    style={{ background: C, color: COUL.blanc, border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Tout afficher</button>
                </>
              ) : (
                <p style={{ color: COUL.texteFaible, fontStyle: 'italic', margin: 0 }}>Aucun{tab === 'devis' ? ' devis' : 'e facture'} pour le moment.</p>
              )}
            </DataCard>
          ) : mob ? (
            /* === Vue mobile : cartes empilées === */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {listeTriee.map((doc) => {
                const s = STAT[doc.statut] || STAT.brouillon
                const t = tab === 'devis' ? 'devis' : 'facture'
                return (
                  <DataCard key={doc.id} style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: C, fontSize: 13 }}>{doc.numero}</div>
                        <div style={{ color: COUL.texte, fontWeight: 700, fontSize: 15, marginTop: 2 }}>{doc.client_nom}</div>
                        {doc.objet && <div style={{ color: COUL.texteDoux, fontSize: 12.5, marginTop: 2 }}>{doc.objet}</div>}
                      </div>
                      <StatusBadge bg={s.bg} col={s.col} label={s.label} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                      <span style={{ color: COUL.texteFaible, fontSize: 12 }}>{fmtDate(tab === 'devis' ? doc.date_devis : doc.date_facture)}</span>
                      <span style={{ fontWeight: 800, color: NAVY, fontSize: 16 }}>{eur(doc.total_ttc)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10, position: 'relative' }} onClick={e => e.stopPropagation()}>
                      <ActionButton tone="grey" onClick={() => setEditing({ type: t, doc })}>Modifier</ActionButton>
                      {tab === 'devis'
                        ? <ActionButton tone="pdf" disabled={busy === doc.id + 'pdf'} onClick={() => doExport('pdf', t, doc)}>{busy === doc.id + 'pdf' ? '…' : 'PDF'}</ActionButton>
                        : <ActionButton tone="accent" color={C} disabled={busy === doc.id + 'mail'} onClick={() => ouvrirEnvoiFacture(doc)}>{busy === doc.id + 'mail' ? '…' : '✉ Envoyer'}</ActionButton>}
                      <button type="button" title="Autres actions" onClick={e => setMenu(menu?.id === doc.id ? null : { id: doc.id, rect: e.currentTarget.getBoundingClientRect() })}
                        style={{ marginLeft: 'auto', background: menu?.id === doc.id ? COUL.fondDoux : 'none', border: `1px solid ${menu?.id === doc.id ? COUL.bordFort : COUL.bord}`, borderRadius: 8, width: 34, height: 30, cursor: 'pointer', color: COUL.texteDoux, fontSize: 17, lineHeight: 1, fontWeight: 800 }}>⋯</button>
                      {menu?.id === doc.id && <MenuLigne anchor={menu.rect} items={actionsDoc(doc)} onClose={() => setMenu(null)} />}
                    </div>
                  </DataCard>
                )
              })}
            </div>
          ) : (
            /* === Vue desktop : tableau === */
            <DataCard style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
                <thead style={{ background: COUL.fond }}>
                  <tr>{COLS.map(c => (
                    <th key={c.h} onClick={() => c.key && setSort(s => ({ key: c.key, dir: s.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))} style={{ padding: '11px 14px', textAlign: c.align, fontSize: 10, fontWeight: 700, color: sort.key === c.key ? C : COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '0.03em', cursor: c.key ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>{c.h}{sort.key === c.key ? (sort.dir === 'asc' ? ' \u25B2' : ' \u25BC') : (c.key ? ' \u21C5' : '')}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {listeTriee.map((doc) => {
                    const s = STAT[doc.statut] || STAT.brouillon
                    return (
                      <tr key={doc.id} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
                        onClick={() => setEditing({ type: tab === 'devis' ? 'devis' : 'facture', doc })}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                        onMouseLeave={e => e.currentTarget.style.background = COUL.blanc}>
                        <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700, color: C }}>{doc.numero}</td>
                        <td style={{ padding: '11px 14px', color: COUL.texte, fontWeight: 600 }}>{doc.client_nom}</td>
                        <td style={{ padding: '11px 14px', color: COUL.texteDoux }}>{doc.objet || '—'}</td>
                        <td style={{ padding: '11px 14px', color: COUL.texteDoux }}>{fmtDate(tab === 'devis' ? doc.date_devis : doc.date_facture)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>{eur(doc.total_ttc)}</td>
                        <td style={{ padding: '11px 14px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <button type="button" title="Changer le statut"
                            onClick={e => setMenuStatut(menuStatut?.id === doc.id ? null : { id: doc.id, rect: e.currentTarget.getBoundingClientRect() })}
                            style={{ background: s.bg, color: s.col, border: `1px solid ${menuStatut?.id === doc.id ? s.col : 'transparent'}`, borderRadius: 999, padding: '4px 10px 4px 11px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                            {s.label}<span style={{ fontSize: 9, opacity: .75 }}>▾</span>
                          </button>
                          {menuStatut?.id === doc.id && <MenuLigne anchor={menuStatut.rect} items={itemsStatut(doc)} onClose={() => setMenuStatut(null)} />}
                        </td>
                        <td style={{ padding: '11px 14px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                            {tab === 'devis'
                              ? <ActionButton tone="pdf" disabled={busy === doc.id + 'pdf'} onClick={() => doExport('pdf', 'devis', doc)}>{busy === doc.id + 'pdf' ? '…' : 'PDF'}</ActionButton>
                              : <ActionButton tone="accent" color={C} disabled={busy === doc.id + 'mail'} onClick={() => ouvrirEnvoiFacture(doc)}>{busy === doc.id + 'mail' ? '…' : '✉ Envoyer'}</ActionButton>}
                            <button type="button" title="Autres actions"
                              onClick={e => setMenu(menu?.id === doc.id ? null : { id: doc.id, rect: e.currentTarget.getBoundingClientRect() })}
                              style={{ background: menu?.id === doc.id ? COUL.fondDoux : 'none', border: `1px solid ${menu?.id === doc.id ? COUL.bordFort : 'transparent'}`, borderRadius: 8, width: 30, height: 28, cursor: 'pointer', color: COUL.texteDoux, fontSize: 16, lineHeight: 1, fontWeight: 800 }}
                              onMouseEnter={e => { if (menu?.id !== doc.id) e.currentTarget.style.background = COUL.fondDoux }}
                              onMouseLeave={e => { if (menu?.id !== doc.id) e.currentTarget.style.background = 'none' }}>⋯</button>
                          </div>
                          {menu?.id === doc.id && <MenuLigne anchor={menu.rect} items={actionsDoc(doc)} onClose={() => setMenu(null)} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </DataCard>)}
      </div>

      {editing && <Editeur type={editing.type} doc={editing.doc} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {suivi && (
        <SuiviModal doc={suivi} color={C}
          factureLiee={factureDuDevis(suivi.id)}
          onConvertir={(d) => { setSuivi(null); convertir(d) }}
          onClose={() => setSuivi(null)} onChanged={() => { load() }} />
      )}
      {apercu && <ApercuFacture fid={apercu.fid} nom={apercu.nom} />}
      {paiement && (
        <ModalPaiement
          facture={paiement} factures={factures}
          onClose={() => setPaiement(null)}
          onLie={maj => setFactures(prev => prev.map(f => f.id === maj.id ? { ...f, ...maj } : f))}
        />
      )}

      {envoi && <EnvoiFactureModal doc={envoi.doc} b64={envoi.b64} fileName={envoi.fileName} onClose={() => setEnvoi(null)} onSent={() => { setEnvoi(null); load() }} />}
    </Layout>
  )
}
