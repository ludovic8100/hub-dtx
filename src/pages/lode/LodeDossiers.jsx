import { voile } from '../../lib/voile'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { chargerCommerciaux } from '../../lib/collaborateurs'
import Layout from '../../components/Layout'
import { COUL } from '../../lib/theme'
import PanneauAttribuer from '../../components/PanneauAttribuer'
import DocumentsChantier from '../../components/DocumentsChantier'
import InterventionsChantier from '../../components/InterventionsChantier'
import { analyserTelephone, telephonePourBase, telephoneEnFrappe } from '../../lib/telephone'
import { useAuth } from '../../lib/auth'

// Les dossiers LODE — un par intervention.
//
// LE PROBLÈME, DIT PAR LUDOVIC
//
// « Il commande, je paie, je ne sais pas pourquoi, il va installer et me dit
// quoi facturer, quand il n'oublie pas. L'achat tombe et on ne sait plus
// l'attribuer. »
//
// Mesuré sur un dossier d'octobre 2026 pris au hasard : la facture
// fournisseur est là et impayée, un acompte client est encaissé, le prix
// annoncé au client est connu — et AUCUNE facture de vente n'existe. Le
// solde non réclamé dépasse deux mille euros, sur une seule intervention.
//
// ⚠️ Ce dépôt est PUBLIC. Aucun nom de client, aucun montant réel ne doit
// apparaître dans le code, les commentaires ou les messages de commit.
//
// L'INVARIANT
//
// Dépannage ou installation, il y a toujours UN dossier par intervention.
// C'est la seule chose qui ne varie pas, donc c'est la colonne vertébrale.
//
// LE NUMÉRO DE DOSSIER EST LA RÉFÉRENCE FOURNISSEUR
//
// JCL tape déjà quelque chose dans « Votre référence » chez Winsol — mesuré :
// « SCREENS EXACTE », « KINÉ », « 81222 ». Il tapera le numéro du dossier.
// Même geste, même champ. Mais ce que le fournisseur réimprime sur sa facture
// devient alors un identifiant que la base reconnaît, que la commande soit
// partie par mail ou depuis le site web — les deux canaux existent.
//
// ET ÇA NE DÉPEND PAS DE SA DISCIPLINE
//
// Règle du Hub : aucun maillon ne doit dépendre d'un geste que quelqu'un doit
// penser à faire. Sans numéro, la facture tombe dans « Achats à attribuer » et
// réclame le jour où elle arrive. Le geste est un raccourci, pas une condition.

const FONT = "'Source Sans Pro', sans-serif"
const OR = COUL.orange
const eur = v => v == null ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)
const fmtDate = d => {
  if (!d) return '—'
  const p = String(d).substring(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

const card = { background: COUL.surface, border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16 }
const th = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: COUL.texteSombre }
const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: FONT, background: COUL.surface, boxSizing: 'border-box' }
const btn = { padding: '9px 14px', borderRadius: 8, border: 'none', background: OR, color: COUL.blanc, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }

// Tri générique. Les valeurs nulles vont toujours en fin, dans les deux
// sens : une donnée absente n'est ni la plus grande ni la plus petite, et la
// voir remonter en tête à chaque inversion de tri est désorientant.
function trier(lignes, col, sens) {
  const signe = sens === 'asc' ? 1 : -1
  return [...lignes].sort((a, b) => {
    const x = a[col], y = b[col]
    const xVide = x === null || x === undefined || x === ''
    const yVide = y === null || y === undefined || y === ''
    if (xVide && yVide) return 0
    if (xVide) return 1
    if (yVide) return -1
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * signe
    return String(x).localeCompare(String(y), 'fr', { numeric: true }) * signe
  })
}

// L'entête dit qu'on peut cliquer AVANT qu'on ait cliqué. Première version :
// une flèche à 25 % d'opacité, donc invisible — personne ne pouvait deviner
// que les colonnes étaient triables. Une affordance qu'il faut découvrir par
// hasard n'existe pas.
function ThTri({ label, col, tri, setTri, droite }) {
  const actif = tri.col === col
  const [survol, setSurvol] = useState(false)
  return (
    <th onClick={() => setTri(t => ({ col, sens: t.col === col && t.sens === 'asc' ? 'desc' : 'asc' }))}
      onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)}
      title={`Trier par ${label}`}
      style={{
        ...(droite ? thR : th), cursor: 'pointer', userSelect: 'none',
        color: actif ? OR : survol ? COUL.texteDoux : COUL.texteFaible,
        background: actif ? '#fff7ed' : survol ? COUL.fond : 'transparent',
        transition: 'background .12s, color .12s',
      }}>
      {label}
      <span style={{
        marginLeft: 5, fontSize: 9, letterSpacing: '-1px',
        color: actif ? OR : '#94a3b8',
        opacity: actif ? 1 : 0.8,
      }}>
        {actif ? (tri.sens === 'desc' ? '▼' : '▲') : '⇅'}
      </span>
    </th>
  )
}

function Kpi({ label, value, c, sub, onClic, actif }) {
  return (
    <div onClick={onClic} title={onClic ? 'Ouvrir' : undefined} style={{
      flex: '1 1 160px', background: COUL.surface, borderRadius: 12, padding: '12px 14px',
      border: `1px solid ${actif ? c : '#e2e8f0'}`,
      cursor: onClic ? 'pointer' : 'default',
      boxShadow: actif ? `0 0 0 1px ${c}` : 'none',
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COUL.texteFaible, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function LodeDossiers() {
  const [onglet, setOnglet] = useState('dossiers')
  const [dossiers, setDossiers] = useState([])
  const [achats, setAchats] = useState([])
  const [ventes, setVentes] = useState([])
  const [devis, setDevis] = useState([])
  const [loading, setLoading] = useState(true)
  const [nouveau, setNouveau] = useState(null)   // dossier fraîchement créé, à montrer en grand
  const [aAttribuer, setAAttribuer] = useState(null) // facture d'achat en cours d'attribution
  const [erreur, setErreur] = useState('')
  const [creation, setCreation] = useState(false)
  const [ouvert, setOuvert] = useState(null)      // dossier dont la fiche est ouverte
  const navigate = useNavigate()
  const [tri, setTri]   = useState({ col: 'numero', sens: 'desc' })
  const [triA, setTriA] = useState({ col: 'date_facture', sens: 'desc' })
  // Sans cette bascule, « Retirer l'attribution » serait inatteignable : un
  // achat déjà attribué ne figure plus dans la corbeille. Une corbeille qui
  // ne montre que les erreurs futures et jamais les erreurs passées ne sert
  // qu'à moitié — on ne peut pas corriger ce qu'on ne voit plus.
  const [toutVoir, setToutVoir] = useState(false)
  // Un dossier clos n'a plus rien à dire : il encombre une liste qui doit
  // montrer ce qui reste à faire. Il reste consultable d'une case à cocher —
  // masqué n'est pas supprimé.
  const [voirClos, setVoirClos] = useState(false)
  const { isAdmin } = useAuth() || {}

  async function charger() {
    setLoading(true)
    const [d, a, v, dv] = await Promise.all([
      supabase.from('dossiers')
        .select('id,numero,titre,client_nom,client_type,client_id,statut,montant_a_facturer,date_debut,created_at,cloture_auto,cloture_motif,cloture_le,mo_heures,mo_visites,mo_collaborateur_id,mo_taux_horaire,responsable,materiel_commande_le,materiel_livraison_prevue,materiel_note')
        .eq('societe', 'LODE').order('created_at', { ascending: false }),
      // ⚠️ `societe` DANS LE SELECT : un chantier peut être payé par plusieurs
      // sociétés du groupe (LODE rénove pour DTX, chacun règle une partie).
      // Sans cette colonne, la fiche ne saurait pas dire qui a avancé quoi —
      // et c'est précisément ce que Ludovic veut voir.
      supabase.from('factures_achat')
        .select('id,fichier_id,nom,societe,fournisseur,montant,date_facture,url,destination_type,destination_id,destination_nom,transaction_id')
        .eq('societe', 'LODE').eq('sens', 'achat').order('date_facture', { ascending: false }),
      supabase.from('lode_factures')
        .select('id,numero,objet,client_id,client_nom,total_ttc,montant_paye,dossier_id,statut,date_facture'),
      // La section s'appelle « Devis et factures » : sans ce chargement elle
      // n'a jamais montré que des factures, et un devis rattaché au chantier
      // restait invisible. Un écran qui annonce deux choses et n'en montre
      // qu'une fait douter de la donnée, pas de l'écran.
      supabase.from('lode_devis')
        .select('id,numero,client_id,client_nom,objet,total_ttc,statut,date_devis,dossier_id'),
    ])
    const chantiers = d.data || []
    let achatsTous = a.data || []

    // ⚠️ LES ACHATS DES AUTRES SOCIÉTÉS AFFECTÉS À CES CHANTIERS (14/11/2026).
    //
    // Demande de Ludovic : « LODE réalise un chantier de rénovation pour DTX,
    // donc des factures sont payées par LODE et par DTX, mais je suis le seul
    // gestionnaire et le seul à pouvoir voir ce genre de chose. C'est pour
    // calculer le coût de ce travail. »
    //
    // Sans cette seconde lecture, une facture DTX rattachée à un chantier LODE
    // serait INVISIBLE ici, et le coût affiché serait faux sans le dire — le
    // pire des cas : un chiffre crédible et incomplet.
    //
    // ⚠️ RÉSERVÉ AUX ADMINISTRATEURS, comme Ludovic l'a demandé. Pour tout le
    // monde, rien ne change : chacun ne voit que les achats de sa société. La
    // RLS reste la dernière barrière — ce filtre est du confort d'affichage,
    // pas une protection.
    if (isAdmin && chantiers.length) {
      const { data: croises } = await supabase.from('factures_achat')
        .select('id,fichier_id,nom,societe,fournisseur,montant,date_facture,url,destination_type,destination_id,destination_nom,transaction_id')
        .eq('sens', 'achat').eq('destination_type', 'dossier')
        .in('destination_id', chantiers.map(x => x.id))
        .neq('societe', 'LODE')
      if (croises?.length) achatsTous = [...achatsTous, ...croises]
    }

    setDossiers(chantiers); setAchats(achatsTous); setVentes(v.data || []); setDevis(dv.data || [])
    setLoading(false)
  }
  useEffect(() => { charger() }, [isAdmin])

  // Les quatre chiffres d'un dossier. « coûté » ne compte que les achats
  // RÉELLEMENT affectés : un dossier sans achat affecté affiche 0, pas une
  // estimation — un zéro mesuré vaut mieux qu'un chiffre inventé.
  const parDossier = useMemo(() => {
    const m = {}
    for (const d of dossiers) m[d.id] = { coute: 0, nbAchats: 0, facture: 0, encaisse: 0, nbVentes: 0 }
    for (const a of achats) {
      if (a.destination_type === 'dossier' && m[a.destination_id]) {
        m[a.destination_id].coute += Number(a.montant) || 0
        m[a.destination_id].nbAchats += 1
      }
    }
    for (const f of ventes) {
      if (f.dossier_id && m[f.dossier_id]) {
        m[f.dossier_id].facture += Number(f.total_ttc) || 0
        m[f.dossier_id].encaisse += Number(f.montant_paye) || 0
        m[f.dossier_id].nbVentes += 1
      }
    }
    return m
  }, [dossiers, achats, ventes])

  // Les devis et factures de vente du MÊME client qui ne sont rattachés à
  // aucun chantier. Filtrer par client est la même règle que dans l'éditeur :
  // un devis avait pu être attribué au chantier d'un autre client.
  // ⚠️ TOUS les documents libres, pas seulement ceux du même client
  // (14/11/2026).
  //
  // Ludovic : « je ne sais pas rattacher un devis s'il est déjà existant ».
  // La cause n'était pas qu'il manquait un bouton : c'est qu'il était
  // INVISIBLE. Il ne s'affichait que si un document libre du même client
  // existait, et la liste était filtrée sur `client_id`.
  //
  // Mesuré : 11 devis sans chantier, répartis sur 6 clients — dont 4 n'ont
  // aucun chantier. Résultat, **7 chantiers sur 9 ne voyaient aucun devis**,
  // sans que rien n'explique pourquoi.
  //
  // Le filtre par client reste la bonne valeur par défaut — un devis attribué
  // au chantier d'un autre client est presque toujours une erreur. Mais il ne
  // doit pas être un cul-de-sac : les cas légitimes existent (devis au nom de
  // Monsieur, chantier au nom de Madame ; fiche client en double). On rend
  // donc tout, en marquant qui appartient à ce client, et c'est la fenêtre
  // qui range et prévient.
  const documentsLibres = (d) => {
    if (!d) return []
    const memeClient = (x) => String(x.client_id ?? '') === String(d.client_id ?? '')
    const marquer = (x, type) => ({ ...x, _doc: type, _memeClient: memeClient(x) })
    return [
      ...devis.filter(x => !x.dossier_id).map(x => marquer(x, 'devis')),
      ...ventes.filter(x => !x.dossier_id).map(x => marquer(x, 'facture')),
    ].sort((a, b) => (b._memeClient ? 1 : 0) - (a._memeClient ? 1 : 0))
  }

  // Rattacher après coup. On RECHARGE au lieu de patcher l'état local : le
  // rattachement peut déclencher la clôture automatique du chantier côté
  // base, et un état local bricolé afficherait encore « ouvert ».
  const rattacherVente = async (doc) => {
    const table = doc._doc === 'devis' ? 'lode_devis' : 'lode_factures'
    const { error } = await supabase.from(table)
      .update({ dossier_id: ouvert.id }).eq('id', doc.id)
    if (error) { alert(`Rattachement refusé — ${error.message}`); return false }
    await charger()
    // La fiche ouverte garde sa copie : on relit la ligne pour que la clôture
    // automatique, si elle a eu lieu, s'affiche tout de suite.
    const { data } = await supabase.from('dossiers')
      .select('statut,cloture_auto,cloture_motif,cloture_le,date_fin')
      .eq('id', ouvert.id).single()
    if (data) setOuvert(o => (o ? { ...o, ...data } : o))
    return true
  }

  // Les colonnes calculées doivent exister AVANT le tri, sinon on ne peut
  // pas trier sur « Manquant » — qui est précisément la colonne qu'on veut
  // trier en premier.
  const lignes = useMemo(() => dossiers.map(d => {
    const c = parDossier[d.id] || {}
    const aFact = d.montant_a_facturer == null ? null : Number(d.montant_a_facturer)
    return {
      ...d,
      coute:    c.nbAchats ? c.coute : null,
      nbAchats: c.nbAchats || 0,
      aFact,
      facture:  c.nbVentes ? c.facture : null,
      encaisse: c.nbVentes ? c.encaisse : null,
      manque:   aFact == null ? null : Math.max(0, aFact - (c.facture || 0)),
    }
  }), [dossiers, parDossier])

  const lignesTriees = useMemo(
    () => trier(voirClos ? lignes : lignes.filter(d => d.statut !== 'clos'), tri.col, tri.sens),
    [lignes, tri, voirClos])
  const nbClos = useMemo(() => dossiers.filter(d => d.statut === 'clos').length, [dossiers])

  const nonAffectes = useMemo(
    () => trier(achats.filter(a => !a.destination_type), triA.col, triA.sens),
    [achats, triA])

  const listeAchats = useMemo(
    () => toutVoir ? trier(achats, triA.col, triA.sens) : nonAffectes,
    [toutVoir, achats, nonAffectes, triA])

  // Le chiffre qui justifie l'écran : ce qui a été annoncé au client et
  // jamais facturé. Null quand aucun prix n'a été saisi — on ne déduit pas
  // un manque d'une absence de donnée.
  const manquantTotal = useMemo(() => dossiers.reduce((s, d) => {
    if (d.montant_a_facturer == null) return s
    const c = parDossier[d.id] || {}
    return s + Math.max(0, (Number(d.montant_a_facturer) || 0) - (c.facture || 0))
  }, 0), [dossiers, parDossier])

  // Rien ici ne doit échouer en silence. La première version sortait sans
  // rien dire quand les champs étaient vides, et n'affichait aucune trace
  // quand la base refusait : vu de l'écran, le bouton « ne marchait pas ».
  // Un échec muet est pire qu'un message laid.
  //
  // ⚠️ ET LE MESSAGE DOIT REMONTER À L'APPELANT, pas seulement s'afficher ici.
  // Corrigé le 14/11 : cette fonction écrivait la vraie raison dans la
  // bannière de la PAGE, que la fenêtre de création recouvre entièrement. La
  // fenêtre, elle, affichait « voir le message sur l'écran » — un message qui
  // renvoie à un message invisible. Vu de l'utilisateur, le refus n'avait
  // aucune cause. Elle rend donc la raison, et c'est la fenêtre qui l'affiche,
  // là où on regarde.
  // La raison part DES DEUX CÔTÉS : la bannière de la page pour qui a fermé
  // la fenêtre, et la valeur de retour pour la fenêtre elle-même.
  const echec = (message) => { setErreur(message); return { ok: false, message } }

  // LE NUMÉRO EST VISIBLE ET MODIFIABLE À LA CRÉATION (14/11/2026).
  //
  // Demandé par Ludovic, le temps de remettre les numéros de chantier dans
  // l'ordre. La fenêtre affiche le prochain numéro libre ; on peut le
  // remplacer par celui qu'on veut.
  //
  // ⚠️ L'aperçu NE CONSOMME PAS de numéro — c'est tout l'intérêt de
  // `apercu_numero` face à `prochain_numero`. Ouvrir la fenêtre puis annuler
  // brûlait un numéro à chaque fois : c'est exactement ce qui a mené le
  // compteur LODE à 1007 pour huit dossiers, et de là à la troncature de
  // `lpad` qui a cassé la création (voir CLAUDE.md).
  //
  // Le compteur est recalé APRÈS l'insertion réussie, par `caler_numero`, qui
  // ne le fait jamais reculer. Si le numéro saisi est déjà pris, on le dit
  // avec le numéro en cause et on propose le prochain libre — plutôt que de
  // renvoyer la violation de contrainte brute, qui accuse la table.
  async function creerDossier(titre, client, montant, numeroSaisi) {   // client = { id, nom } | null
    setErreur('')
    try {
      let numero = String(numeroSaisi || '').trim()
      if (!numero) {
        const { data, error: e1 } = await supabase.rpc('prochain_numero', {
          p_type: 'dossier', p_societe: 'LODE', p_prefixe: 'DOS',
        })
        if (e1) return echec(`Numérotation refusée — ${e1.message}`)
        if (!data) return echec('Numérotation : aucun numéro rendu.')
        numero = data
      }

      const montantNum = montant === '' || montant == null ? null : Number(String(montant).replace(',', '.'))
      if (montantNum != null && Number.isNaN(montantNum)) {
        return echec(`« ${String(montant).trim()} » n'est pas un montant. Attendu : un nombre, par exemple 2841,96.`)
      }

      const { data, error } = await supabase.from('dossiers').insert({
        societe: 'LODE', numero, titre: titre || 'Sans titre',
        // Le client est désormais une VRAIE fiche, pas un nom tapé à la main :
        // sans elle, on ne peut lui envoyer ni devis ni facture, et deux
        // orthographes du même nom font deux clients.
        client_type: client?.id ? 'lode_client' : null,
        client_id:   client?.id || null,
        client_nom:  client?.nom || null,
        type: 'intervention',
        montant_a_facturer: montantNum,
        date_debut: new Date().toISOString().slice(0, 10),
      }).select('id,numero,titre,client_nom,client_type,client_id,statut,montant_a_facturer,date_debut,created_at,mo_heures,mo_visites,mo_collaborateur_id,mo_taux_horaire,responsable,materiel_commande_le,materiel_livraison_prevue,materiel_note').single()

      if (error) {
        // 23505 = violation d'unicité. Le message brut de Postgres nomme la
        // contrainte, pas le problème. Ici on nomme le numéro, et on donne
        // celui qui est libre.
        if (error.code === '23505') {
          // ⚠️ DIRE LEQUEL, et surtout dire s'il est CLOS (14/11/2026).
          //
          // « déjà utilisé par un autre chantier » envoyait Ludovic chercher
          // DOS-2026-002 dans une liste où il ne pouvait pas le trouver : les
          // chantiers clos y sont masqués. Un message exact qui désigne
          // l'invisible se lit comme un bug.
          const [{ data: libre }, { data: occupant }] = await Promise.all([
            supabase.rpc('apercu_numero', { p_type: 'dossier', p_societe: 'LODE', p_prefixe: 'DOS' }),
            supabase.from('dossiers').select('titre,client_nom,statut')
              .eq('societe', 'LODE').eq('numero', numero).maybeSingle(),
          ])
          const qui = occupant
            ? ` — « ${occupant.titre || 'sans titre'} »${occupant.client_nom ? ' pour ' + occupant.client_nom : ''}`
              + (occupant.statut === 'clos' ? ', qui est CLOS et n’apparaît donc pas dans la liste' : '')
            : ''
          const r = echec(`Le numéro ${numero} est déjà pris${qui}.`
            + (libre ? ` Le prochain libre est ${libre}.` : ''))
          return { ...r, numeroLibre: libre || null }
        }
        return echec(`Création refusée — ${error.message}`)
      }

      // Le compteur suit le numéro réellement posé — jamais en arrière.
      await supabase.rpc('caler_numero', { p_type: 'dossier', p_societe: 'LODE', p_numero: numero })

      setDossiers(p => [data, ...p])
      setNouveau(data)
      return { ok: true, message: '' }
    } catch (e) {
      // Une exception inattendue (réseau coupé, session expirée) ne doit pas
      // laisser le bouton tourner dans le vide.
      return echec(`Erreur inattendue — ${e?.message || e}`)
    }
  }

  // Une facture d'achat ne va pas forcément sur un chantier.
  //
  // Première version : on ne pouvait l'attribuer qu'à un dossier. Du coup
  // l'électricité, le téléphone et la visserie restaient éternellement dans
  // la corbeille « Achats à attribuer » — qui se remplissait de lignes
  // parfaitement en ordre et devenait du bruit. Une corbeille qu'on ne peut
  // pas vider, personne ne l'ouvre.
  async function affecter(facture, patch) {
    setErreur('')
    const { error } = await supabase.from('factures_achat').update(patch).eq('id', facture.id)
    if (error) { setErreur(`Attribution refusée — ${error.message}`); return }
    setAchats(p => p.map(a => a.id === facture.id ? { ...a, ...patch } : a))
    setAAttribuer(null)
  }

  return (
    <Layout>
      <div style={{ fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: COUL.texteFort, margin: 0 }}>Dossiers LODE</h1>
          <span style={{ fontSize: 13, color: COUL.texteFaible }}>Un dossier par intervention — dépannage comme installation</span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Kpi label="Dossiers ouverts" value={dossiers.filter(d => d.statut !== 'clos').length} c={OR}
               onClic={() => setOnglet('dossiers')} actif={onglet === 'dossiers'} sub="voir la liste" />
          <Kpi label="Achats à attribuer" value={nonAffectes.length} c={nonAffectes.length ? COUL.danger : COUL.succes}
               onClic={() => setOnglet('attribuer')} actif={onglet === 'attribuer'}
               sub={nonAffectes.length ? eur(nonAffectes.reduce((s, a) => s + (Number(a.montant) || 0), 0)) : 'tout est affecté'} />
          <Kpi label="Annoncé, pas facturé" value={manquantTotal > 0 ? eur(manquantTotal) : '—'} c={manquantTotal > 0 ? COUL.danger : COUL.texteFaible}
               onClic={() => { setOnglet('dossiers'); setTri({ col: 'manque', sens: 'desc' }) }}
               sub={dossiers.some(d => d.montant_a_facturer != null) ? 'trier par manquant' : 'aucun prix client saisi'} />
        </div>

        <div style={{ display: 'flex', gap: 0, marginTop: 18, borderBottom: '2px solid #e2e8f0' }}>
          {[['dossiers', 'Dossiers'], ['attribuer', `Achats à attribuer${nonAffectes.length ? ` (${nonAffectes.length})` : ''}`]].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)} style={{
              background: 'none', border: 'none', padding: '9px 16px', fontFamily: FONT, fontSize: 13.5,
              cursor: 'pointer', marginBottom: -2,
              color: onglet === k ? OR : COUL.texteFaible, fontWeight: onglet === k ? 700 : 500,
              borderBottom: `2px solid ${onglet === k ? OR : 'transparent'}`,
            }}>{l}</button>
          ))}
        </div>

        {/* Le message apparaît ici ET dans la fenêtre quand elle est ouverte.
            J'allais supprimer ce doublon ; Ludovic a demandé de le laisser
            (14/11/2026) — la bannière reste lisible quand la fenêtre est
            déplacée ou refermée. */}
        {erreur && <div style={{ ...card, background: COUL.dangerFondDoux, color: COUL.dangerFonce, fontSize: 13 }}>{erreur}</div>}
        {loading && <div style={{ ...card, textAlign: 'center', color: COUL.texteFaible }}>Chargement…</div>}

        {!loading && onglet === 'dossiers' && (
          <>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setCreation(true)} style={btn}>
                <i className="ti ti-plus" style={{ marginRight: 6 }} />Nouveau dossier
              </button>
              <span style={{ fontSize: 12.5, color: COUL.texteFaible, flex: 1 }}>
                Le dossier commence par le client : on le retrouve s&apos;il existe, on le crée sinon.
              </span>
              {nbClos > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: COUL.texteDoux, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={voirClos} onChange={e => setVoirClos(e.target.checked)} />
                  Voir les {nbClos} dossier{nbClos > 1 ? 's' : ''} clos
                </label>
              )}
            </div>
            <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead><tr>
                  <ThTri label="N°"          col="numero"     tri={tri} setTri={setTri} />
                  {/* Le client avant l'intervention : on cherche un chantier
                      en pensant « chez qui », pas « quoi ». */}
                  <ThTri label="Client"       col="client_nom" tri={tri} setTri={setTri} />
                  <ThTri label="Intervention" col="titre"      tri={tri} setTri={setTri} />
                  <ThTri label="Comm."        col="responsable" tri={tri} setTri={setTri} />
                  <ThTri label="Coûté"        col="coute"      tri={tri} setTri={setTri} droite />
                  <ThTri label="À facturer"   col="aFact"      tri={tri} setTri={setTri} droite />
                  <ThTri label="Facturé"      col="facture"    tri={tri} setTri={setTri} droite />
                  <ThTri label="Encaissé"     col="encaisse"   tri={tri} setTri={setTri} droite />
                  <ThTri label="Manquant"     col="manque"     tri={tri} setTri={setTri} droite />
                </tr></thead>
                <tbody>
                  {dossiers.length === 0 && <tr><td style={{ ...td, textAlign: 'center', padding: 36, color: COUL.texteFaible }} colSpan={9}>
                    Aucun dossier. Crée le premier ci-dessus — son numéro est la référence à taper chez le fournisseur.
                  </td></tr>}
                  {lignesTriees.map(d => {
                    const vide = <span style={{ color: '#cbd5e1' }}>—</span>
                    return (
                      <tr key={d.id} onClick={() => setOuvert(d)}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background = COUL.fond }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <td style={{ ...td, fontWeight: 700, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 }}>{d.numero || '—'}</td>
                        <td style={{ ...td, color: COUL.texteDoux }}>{d.client_nom || '—'}</td>
                        <td style={td}>{d.titre}{d.nbAchats > 0 && <span style={{ fontSize: 11, color: COUL.texteFaible, marginLeft: 6 }}>· {d.nbAchats} achat{d.nbAchats > 1 ? 's' : ''}</span>}</td>
                        <td style={{ ...td, fontSize: 12, fontWeight: 700, color: d.responsable ? OR : '#cbd5e1' }}>{d.responsable || '—'}</td>
                        <td style={tdR}>{d.coute == null ? vide : eur(d.coute)}</td>
                        <td style={tdR}>{d.aFact == null ? vide : eur(d.aFact)}</td>
                        <td style={tdR}>{d.facture == null ? vide : eur(d.facture)}</td>
                        <td style={tdR}>{d.encaisse == null ? vide : eur(d.encaisse)}</td>
                        <td style={{ ...tdR, fontWeight: 700, color: d.manque > 0 ? COUL.danger : COUL.texteFaible }}>
                          {d.manque == null ? '—' : d.manque > 0 ? eur(d.manque) : '✓'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && onglet === 'attribuer' && (
          <>
          <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: COUL.texteDoux, cursor: 'pointer' }}>
              <input type="checkbox" checked={toutVoir} onChange={e => setToutVoir(e.target.checked)} />
              Montrer aussi les achats déjà attribués
            </label>
            <span style={{ fontSize: 12.5, color: COUL.texteFaible }}>
              {toutVoir
                ? `${achats.length} achat${achats.length > 1 ? 's' : ''} · ${nonAffectes.length} sans destination`
                : 'pour corriger une attribution, coche la case'}
            </span>
          </div>
          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead><tr>
                <ThTri label="Date"        col="date_facture"   tri={triA} setTri={setTriA} />
                <ThTri label="Fournisseur" col="fournisseur"    tri={triA} setTri={setTriA} />
                <ThTri label="Facture"     col="nom"            tri={triA} setTri={setTriA} />
                <ThTri label="Montant"     col="montant"        tri={triA} setTri={setTriA} droite />
                <ThTri label="Payée"       col="transaction_id" tri={triA} setTri={setTriA} />
                <ThTri label="Destination" col="destination_nom" tri={triA} setTri={setTriA} />
                <th style={th}></th>
              </tr></thead>
              <tbody>
                {listeAchats.length === 0 && <tr><td style={{ ...td, textAlign: 'center', padding: 36, color: COUL.succes }} colSpan={7}>
                  Tous les achats LODE sont affectés.
                </td></tr>}
                {listeAchats.map(a => (
                  <tr key={a.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDate(a.date_facture)}</td>
                    <td style={td}>{a.fournisseur || <span style={{ color: COUL.texteFaible }}>inconnu</span>}</td>
                    <td style={{ ...td, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.url
                        ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: OR, textDecoration: 'none' }}>{(a.nom || '').replace(/\.pdf$/i, '')}</a>
                        : (a.nom || '').replace(/\.pdf$/i, '')}
                    </td>
                    <td style={tdR}>{eur(a.montant)}</td>
                    <td style={td}>{a.transaction_id
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: COUL.succes }}>payée</span>
                      : <span style={{ fontSize: 11, fontWeight: 700, color: COUL.danger }}>non payée</span>}</td>
                    <td style={{ ...td, color: a.destination_nom ? COUL.texteDoux : '#cbd5e1', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.destination_nom || '—'}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => setAAttribuer(a)} style={{
                        ...btn, padding: '6px 11px', fontSize: 12.5,
                        background: a.destination_type ? COUL.surface : OR,
                        color: a.destination_type ? COUL.texteDoux : COUL.blanc,
                        border: a.destination_type ? '1px solid #e2e8f0' : 'none',
                      }}>{a.destination_type ? 'Changer' : 'Attribuer'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {creation && (
        <PanneauNouveauDossier
          onClose={() => setCreation(false)}
          onCreer={async (titre, client, montant, numero) => {
            const r = await creerDossier(titre, client, montant, numero)
            if (r.ok) setCreation(false)
            return r
          }} />
      )}
      {ouvert && (
        <FicheDossier
          dossier={ouvert}
          achats={achats.filter(a => a.destination_type === 'dossier' && a.destination_id === ouvert.id)}
          achatsLibres={achats.filter(a => !a.destination_type)}
          onRattacher={(facture) => affecter(facture, {
            destination_type: 'dossier',
            destination_id: ouvert.id,
            destination_nom: `${ouvert.numero ? ouvert.numero + ' · ' : ''}${ouvert.titre}`,
          })}
          ventes={ventes.filter(v => v.dossier_id === ouvert.id)}
          devis={devis.filter(v => v.dossier_id === ouvert.id)}
          ventesLibres={documentsLibres(ouvert)}
          onRattacherVente={rattacherVente}
          onRecharger={charger}
          onClose={() => setOuvert(null)}
          onEnregistre={(patch) => {
            setDossiers(p => p.map(x => x.id === ouvert.id ? { ...x, ...patch } : x))
            setOuvert(o => ({ ...o, ...patch }))
          }}
          onDevis={async () => navigate('/lode/devis-factures', { state: { nouveauDevis: await devisDepuisDossier(ouvert) } })}
        />
      )}
      {nouveau && <PanneauNumero dossier={nouveau} onClose={() => setNouveau(null)} />}
      {aAttribuer && (
        <PanneauAttribuer facture={aAttribuer} dossiers={dossiers}
          onClose={() => setAAttribuer(null)} onChoisir={patch => affecter(aAttribuer, patch)} />
      )}
    </Layout>
  )
}

// La fenêtre de création d'un dossier. Elle commence par le CLIENT.
//
// POURQUOI LE CLIENT D'ABORD
//
// Ludovic : « lorsque je tape Detilloux et nouveau dossier, il crée le
// dossier mais il ne propose pas de créer le client. Or on a dit qu'on devait
// impérativement avoir le client créé, ce qui est logique si on veut pouvoir
// envoyer un devis. »
//
// Un dossier rattaché à un nom tapé à la main ne sert à rien : on ne peut lui
// envoyer ni devis ni facture, et deux orthographes du même nom font deux
// clients. La fenêtre cherche donc d'abord dans les clients existants — «
// DUPLAND » existe, il doit être retrouvé, pas recréé — et n'ouvre le
// formulaire de création que si personne ne correspond.
//
// LE CONSENTEMENT RGPD N'EST PAS ENCORE ENVOYÉ
//
// Décidé avec Ludovic : tout nouveau client doit recevoir un mail
// l'informant de l'encodage de ses données. La case est posée ici et la date
// sera stockée, mais l'ENVOI reste à brancher — un envoi de courrier est un
// geste qui sort du Hub, il se construit et se teste à part.

function PanneauNouveauDossier({ onClose, onCreer }) {
  const [etape, setEtape] = useState('client')   // client | creerClient | dossier
  const [q, setQ] = useState('')
  const [clients, setClients] = useState([])
  const [cherche, setCherche] = useState(false)
  const [client, setClient] = useState(null)     // { id, nom }
  const [titre, setTitre] = useState('')
  const [montant, setMontant] = useState('')
  const [numero, setNumero] = useState('')
  const [numeroPropose, setNumeroPropose] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const [fiche, setFiche] = useState({ type: 'particulier', nom: '', prenom: '', denomination: '',
                                       email: '', gsm: '', adresse: '', cp: '', ville: '', tva: '' })

  const nomClient = (c) => c.denomination || [c.prenom, c.nom].filter(Boolean).join(' ') || '(sans nom)'

  // Le prochain numéro libre, dès l'ouverture de la fenêtre. Lecture seule :
  // il n'est consommé qu'à la création, sinon annuler coûterait un numéro.
  useEffect(() => {
    let annule = false
    supabase.rpc('apercu_numero', { p_type: 'dossier', p_societe: 'LODE', p_prefixe: 'DOS' })
      .then(({ data }) => {
        if (annule || !data) return
        setNumeroPropose(data)
        setNumero(n => n || data)
      })
    return () => { annule = true }
  }, [])

  // Recherche à la frappe, sur le nom, le prénom, la dénomination et la ville.
  useEffect(() => {
    let annule = false
    const t = setTimeout(async () => {
      setCherche(true)
      const terme = q.trim()
      let req = supabase.from('lode_clients').select('id,nom,prenom,denomination,ville,email').limit(40)
      if (terme) {
        const m = `%${terme}%`
        req = req.or(`nom.ilike.${m},prenom.ilike.${m},denomination.ilike.${m},ville.ilike.${m}`)
      }
      const { data } = await req.order('nom')
      if (!annule) { setClients(data || []); setCherche(false) }
    }, 220)
    return () => { annule = true; clearTimeout(t) }
  }, [q])

  async function creerClient() {
    const estSociete = fiche.type === 'entreprise'
    if (estSociete ? !fiche.denomination.trim() : !fiche.nom.trim()) {
      setErreur(estSociete ? 'La dénomination est obligatoire.' : 'Le nom est obligatoire.'); return
    }
    setOccupe(true); setErreur('')
    const { data, error } = await supabase.from('lode_clients').insert({
      type: fiche.type,
      nom:          estSociete ? null : fiche.nom.trim().toUpperCase(),
      prenom:       estSociete ? null : (fiche.prenom.trim() || null),
      denomination: estSociete ? fiche.denomination.trim() : null,
      email:   fiche.email.trim()   || null,
      gsm:     telephonePourBase(fiche.gsm),
      adresse: fiche.adresse.trim() || null,
      cp:      fiche.cp.trim()      || null,
      ville:   fiche.ville.trim()   || null,
      tva:     estSociete ? (fiche.tva.trim() || null) : null,
      actif: true,
    }).select('id,nom,prenom,denomination').single()
    setOccupe(false)
    if (error) { setErreur(`Création du client refusée — ${error.message}`); return }
    setClient({ id: data.id, nom: nomClient(data) })
    setEtape('dossier')
  }

  async function valider() {
    if (!titre.trim()) { setErreur("Donne un intitulé à l'intervention."); return }
    if (!numero.trim()) { setErreur('Donne un numéro de dossier.'); return }
    setOccupe(true); setErreur('')
    const r = await onCreer(titre.trim(), client, montant, numero.trim())
    setOccupe(false)
    // On affiche LA RAISON, jamais un renvoi vers un message qu'on ne voit pas.
    if (!r?.ok) {
      setErreur(r?.message || 'La création du dossier a échoué.')
      // Numéro déjà pris : on met le champ sur le prochain libre, pour que
      // le second essai soit un simple clic.
      if (r?.numeroLibre) { setNumero(r.numeroLibre); setNumeroPropose(r.numeroLibre) }
    }
  }

  // Le téléphone a son propre champ : il se met en forme pendant la frappe
  // et dit s'il n'a pas été reconnu, au lieu de l'accepter en silence.
  const tel = analyserTelephone(fiche.gsm)
  const champTelephone = () => (
    <div style={{ flex: '1 1 150px' }}>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Téléphone</label>
      <input value={fiche.gsm}
        onChange={e => setFiche(f => ({ ...f, gsm: telephoneEnFrappe(e.target.value) }))}
        onBlur={() => setFiche(f => ({ ...f, gsm: tel.valide ? tel.affichage : f.gsm }))}
        placeholder="0479 28 01 20" style={{
          ...inp, width: '100%',
          borderColor: fiche.gsm.trim() && !tel.valide ? COUL.danger : '#cbd5e1',
        }} />
      <div style={{ fontSize: 10.5, marginTop: 3, color: tel.valide ? COUL.succes : COUL.texteFaible, minHeight: 14 }}>
        {tel.vide ? 'Belgique par défaut — tape l\u2019indicatif pour un autre pays'
          : tel.valide ? `${tel.affichage}${tel.pays && tel.pays !== 'BE' ? ' · ' + tel.pays : ''}`
          : 'Numéro non reconnu — il sera gardé tel quel'}
      </div>
    </div>
  )

  const champ = (libelle, cle, opts = {}) => (
    <div style={{ flex: opts.large ? '1 1 100%' : '1 1 150px' }}>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{libelle}</label>
      <input value={fiche[cle]} onChange={e => setFiche(f => ({ ...f, [cle]: e.target.value }))}
        placeholder={opts.ph || ''} style={{ ...inp, width: '100%' }} />
    </div>
  )

  return (
    <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: 'min(620px, 96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: COUL.texteFort }}>Nouveau dossier</div>
          <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 3 }}>
            {etape === 'client'      && 'Pour qui ? Cherche le client, ou crée-le.'}
            {etape === 'creerClient' && 'Nouveau client — ces données serviront au devis et à la facture.'}
            {etape === 'dossier'     && <>Client : <strong>{client?.nom}</strong> · <button onClick={() => setEtape('client')} style={{ border: 'none', background: 'none', color: OR, cursor: 'pointer', fontSize: 12.5, fontFamily: FONT, padding: 0, textDecoration: 'underline' }}>changer</button></>}
          </div>
        </div>

        {etape === 'client' && (
          <>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <input value={q} onChange={e => setQ(e.target.value)} autoFocus
                placeholder="Nom, prénom, société, ville…" style={{ ...inp, width: '100%' }} />
              <div style={{ fontSize: 11, color: COUL.texteFaible, marginTop: 6 }}>
                {cherche ? 'Recherche…' : `${clients.length} client${clients.length > 1 ? 's' : ''} trouvé${clients.length > 1 ? 's' : ''}`}
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 120 }}>
              {clients.map(c => (
                <div key={c.id} onClick={() => { setClient({ id: c.id, nom: nomClient(c) }); setEtape('dossier') }}
                  style={{ padding: '11px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = COUL.fond }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COUL.texteFort }}>{nomClient(c)}</div>
                  <div style={{ fontSize: 11.5, color: COUL.texteFaible }}>{[c.ville, c.email].filter(Boolean).join(' · ') || '—'}</div>
                </div>
              ))}
              {!cherche && clients.length === 0 && (
                <div style={{ padding: '24px 20px', textAlign: 'center', color: COUL.texteFaible, fontSize: 13 }}>
                  Aucun client ne correspond.
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => { setFiche(f => ({ ...f, nom: q.trim().toUpperCase() })); setEtape('creerClient') }}
                style={{ ...btn, width: '100%' }}>
                <i className="ti ti-user-plus" style={{ marginRight: 6 }} />
                Créer le client{q.trim() ? ` « ${q.trim()} »` : ''}
              </button>
            </div>
          </>
        )}

        {etape === 'creerClient' && (
          <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[['particulier', 'Particulier'], ['entreprise', 'Société']].map(([v, l]) => (
                <button key={v} onClick={() => setFiche(f => ({ ...f, type: v }))}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                           border: `1px solid ${fiche.type === v ? OR : '#e2e8f0'}`,
                           background: fiche.type === v ? '#fff7ed' : COUL.surface,
                           color: fiche.type === v ? OR : COUL.texteDoux }}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {fiche.type === 'entreprise'
                ? <>{champ('Dénomination', 'denomination', { large: true })}{champ('N° TVA', 'tva', { ph: 'BE0123.456.789' })}</>
                : <>{champ('Nom', 'nom')}{champ('Prénom', 'prenom')}</>}
              {champ('Courriel', 'email', { ph: 'nom@exemple.be' })}
              {champTelephone()}
              {champ('Adresse', 'adresse', { large: true })}
              {champ('Code postal', 'cp')}
              {champ('Ville', 'ville')}
            </div>
            <div style={{ fontSize: 11.5, color: COUL.texteFaible, marginTop: 12, lineHeight: 1.5, background: COUL.fondDoux, borderRadius: 8, padding: '9px 11px' }}>
              <strong>RGPD</strong> — tout nouveau client doit être informé de l&apos;encodage de ses données.
              L&apos;envoi automatique du courriel n&apos;est <strong>pas encore branché</strong> : à faire à la main
              pour l&apos;instant.
            </div>
          </div>
        )}

        {etape === 'dossier' && (
          <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Numéro de dossier</label>
              <input value={numero} onChange={e => setNumero(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && valider()}
                placeholder={numeroPropose || 'DOS-2026-…'}
                style={{ ...inp, width: '100%', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }} />
              <div style={{ fontSize: 11.5, color: COUL.texteFaible, marginTop: 4 }}>
                {numeroPropose && numero.trim() === numeroPropose
                  ? 'Prochain numéro libre — modifiable.'
                  : numeroPropose
                    ? <>Le prochain libre est <strong>{numeroPropose}</strong>.{' '}
                        <button type="button" onClick={() => setNumero(numeroPropose)}
                          style={{ border: 'none', background: 'none', padding: 0, color: OR, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, textDecoration: 'underline' }}>
                          le reprendre
                        </button></>
                    : 'Numéro modifiable.'}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Intervention</label>
              <input value={titre} onChange={e => setTitre(e.target.value)} autoFocus
                onKeyDown={e => e.key === 'Enter' && valider()}
                placeholder="Remplacement moteur, pose pergola…" style={{ ...inp, width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Prix annoncé au client (TTC)</label>
              <input value={montant} onChange={e => setMontant(e.target.value)} inputMode="decimal"
                onKeyDown={e => e.key === 'Enter' && valider()}
                placeholder="facultatif — sert à repérer un oubli de facturation" style={{ ...inp, width: '100%' }} />
              {/* LE CHAMP DIT LUI-MÊME CE QUI CLOCHE, pendant la frappe.
                  Découvrir au moment de valider que « fe » n'est pas un prix,
                  c'est l'apprendre trop tard — et sur un formulaire qu'on
                  croyait fini. */}
              {montant.trim() && Number.isNaN(Number(montant.replace(',', '.'))) && (
                <div style={{ fontSize: 12.5, color: '#b45309', marginTop: 4 }}>
                  « {montant.trim()} » n'est pas un montant — un nombre est attendu, par exemple 2841,96.
                </div>
              )}
            </div>
          </div>
        )}

        {erreur && (
          <div style={{ padding: '10px 20px', fontSize: 12.5, color: COUL.dangerFonce, background: COUL.dangerFondDoux, borderTop: '1px solid #f1f5f9' }}>{erreur}</div>
        )}

        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <button onClick={etape === 'client' ? onClose : () => { setErreur(''); setEtape('client') }}
            style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.texteDoux, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
            {etape === 'client' ? 'Annuler' : 'Retour'}
          </button>
          {etape === 'creerClient' && (
            <button onClick={creerClient} disabled={occupe} style={{ ...btn, opacity: occupe ? 0.6 : 1 }}>
              {occupe ? 'Création…' : 'Créer le client et continuer'}
            </button>
          )}
          {etape === 'dossier' && (
            <button onClick={valider} disabled={occupe} style={{ ...btn, opacity: occupe ? 0.6 : 1 }}>
              {occupe ? 'Création…' : 'Créer le dossier'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Le brouillon de devis qu'un dossier engendre : le client et le dossier,
// rien d'autre. L'éditeur de devis fait le reste.
//
// On recopie aussi les coordonnées du client sur le document, comme le fait
// l'éditeur : un devis doit rester lisible tel qu'il a été émis, même si le
// client déménage ensuite.
// ⚠️ LES COORDONNÉES VIENNENT DU CLIENT, PAS DU DOSSIER.
//
// Première version : je recopiais `d.adresse`, `d.cp`, `d.ville` — les
// champs du DOSSIER, que la fenêtre de création ne demande même pas. Un
// devis engendré depuis un dossier sortait donc avec « Ludovic DETILLOUX »
// et rien d'autre : ni rue, ni code postal, ni TVA. Inutilisable.
//
// On va donc lire la fiche client. Si elle est introuvable, on retombe sur
// ce que le dossier sait — un devis incomplet vaut mieux qu'un écran qui
// refuse de s'ouvrir.
async function devisDepuisDossier(d) {
  const base = {
    dossier_id: d.id,
    client_id: d.client_type === 'lode_client' ? d.client_id : null,
    client_nom: d.client_nom || '',
    objet: d.titre || '',
    responsable: d.responsable || '',
  }
  if (!base.client_id) return base

  const { data: c } = await supabase.from('lode_clients')
    .select('nom,prenom,denomination,type,adresse,cp,ville,pays,email,telephone,gsm,tva,langue')
    .eq('id', base.client_id).maybeSingle()
  if (!c) return base

  return {
    ...base,
    client_nom: c.type === 'entreprise'
      ? (c.denomination || base.client_nom)
      : ([c.prenom, c.nom].filter(Boolean).join(' ') || base.client_nom),
    client_adresse:   c.adresse || '',
    client_cp:        c.cp || '',
    client_ville:     c.ville || '',
    client_pays:      c.pays || 'Belgique',
    client_email:     c.email || '',
    client_telephone: c.telephone || c.gsm || '',
    client_tva:       c.tva || '',
    langue:           c.langue || 'fr',
  }
}

// La fiche d'un dossier.
//
// Ludovic : « il manque la date de création du dossier — attention, la date
// doit être modifiable et l'intervention aussi », puis « tu cliques sur le
// dossier et tu sais créer un devis ».
//
// Les deux vont ensemble : un dossier qu'on ne peut pas corriger est un
// dossier qu'on recrée, et un dossier qui ne débouche sur rien n'a pas de
// raison d'exister.
function FicheDossier({ dossier, achats, achatsLibres = [], ventes, devis = [], ventesLibres = [], onClose, onEnregistre, onDevis, onRattacher, onRattacherVente, onRecharger }) {
  const [titre, setTitre] = useState(dossier.titre || '')
  const [date, setDate] = useState((dossier.date_debut || '').slice(0, 10))
  const [montant, setMontant] = useState(dossier.montant_a_facturer == null ? '' : String(dossier.montant_a_facturer))
  const [statut, setStatut] = useState(dossier.statut || 'ouvert')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  // Le chantier peut se clôturer tout seul pendant que la fiche est ouverte
  // (facture rattachée puis payée). Sans cette resynchronisation, le sélecteur
  // d'état afficherait encore « Ouvert » sur un chantier clos en base, et
  // enregistrer le rouvrirait sans que personne ne l'ait demandé.
  useEffect(() => { setStatut(dossier.statut || 'ouvert') }, [dossier.statut])

  const [rattacher, setRattacher] = useState(false)
  const [rattacherVente, setRattacherVente] = useState(false)
  const [numero, setNumero] = useState(dossier.numero || '')
  const [commercial, setCommercial] = useState(dossier.responsable || '')
  const [commerciaux, setCommerciaux] = useState([])
  // La commande de matériel : deux dates corrigées à la main quand le
  // fournisseur décale, et une remarque libre.
  const [cmdLe,   setCmdLe]   = useState((dossier.materiel_commande_le      || '').slice(0, 10))
  const [cmdLiv,  setCmdLiv]  = useState((dossier.materiel_livraison_prevue || '').slice(0, 10))
  const [cmdNote, setCmdNote] = useState(dossier.materiel_note || '')
  useEffect(() => {
    let annule = false
    // ⚠️ PAS de filtre sur `compte_hub_actif`.
    //
    // Un commercial n'a pas besoin d'un accès au Hub pour qu'un chantier lui
    // soit attribué — JCL n'en a aucun aujourd'hui, et c'est précisément la
    // personne qu'on veut créditer. Filtrer sur la connexion revenait à
    // confondre « qui travaille ici » et « qui peut se connecter ».
    //
    // En revanche, un commercial Dynassur n'a rien à faire dans la liste d'un
    // chantier LODE.
    //
    // ⚠️ LE RATTACHEMENT À LA SOCIÉTÉ, PAS LE DROIT D'ACCÈS (14/11/2026).
    // Cette liste s'appuyait sur `acc_lode`, que 2 collaborateurs actifs sur
    // 31 possèdent — et pas les commerciaux LODE. Ludovic ne voyait donc plus
    // qu'une seule personne, et seulement sur les chantiers où elle était déjà
    // inscrite. On lit maintenant `collaborateur_societes` par sa vue.
    // « Qui a vendu » n'est pas « qui a posé » : la fiche ne charge donc que
    // les COMMERCIAUX, pour l'attribution. La liste des intervenants vit dans
    // `InterventionsChantier`, son seul utilisateur — une liste chargée là où
    // personne ne s'en sert est une requête payée pour rien.
    chargerCommerciaux('LODE', dossier.responsable)
      .then(c => { if (!annule) setCommerciaux(c) })
    return () => { annule = true }
  }, [dossier.responsable])

  // ⚠️ LE PRESTATAIRE NE SE PRÉ-REMPLIT PAS AVEC LE COMMERCIAL, et c'est une
  // décision, pas un oubli (14/11/2026).
  //
  // J'avais ajouté cette proposition de moi-même en lisant « le commercial
  // doit être pré-défini partout ». Ludovic parlait du COMMERCIAL, pas du
  // prestataire — et les deux ne sont pas la même personne : LLO vend mais
  // « ne fera jamais de l'installation ou de la gestion de chantier ».
  //
  // Une heure inscrite au mauvais nom fausse le coût de revient sans que rien
  // ne le signale. Qui a presté se saisit, il ne se devine pas.

  const coute    = achats.reduce((s, a) => s + (Number(a.montant) || 0), 0)

  // QUI A PAYÉ QUOI (14/11/2026).
  //
  // Ludovic : « des factures sont payées par LODE et par DTX […] c'est pour
  // calculer le coût de ce travail ». Le total seul ne le dit pas : il faut
  // la part de chacun, c'est-à-dire ce que chaque société a avancé.
  //
  // Affiché seulement quand il y a VRAIMENT plusieurs sociétés. Sur un
  // chantier ordinaire — l'immense majorité — une ligne « dont LODE 100 % »
  // n'apprendrait rien et ferait du bruit.
  const parSociete = (() => {
    const m = {}
    for (const a of achats) m[a.societe || '—'] = (m[a.societe || '—'] || 0) + (Number(a.montant) || 0)
    const entrees = Object.entries(m).sort((x, y) => y[1] - x[1])
    return entrees.length > 1 ? entrees : null
  })()
  const facture  = ventes.reduce((s, v) => s + (Number(v.total_ttc) || 0), 0)
  const encaisse = ventes.reduce((s, v) => s + (Number(v.montant_paye) || 0), 0)
  const aFact    = montant === '' ? null : Number(String(montant).replace(',', '.'))
  const manque   = aFact == null || Number.isNaN(aFact) ? null : Math.max(0, aFact - facture)

  const modifie = titre !== (dossier.titre || '')
    || date !== (dossier.date_debut || '').slice(0, 10)
    || montant !== (dossier.montant_a_facturer == null ? '' : String(dossier.montant_a_facturer))
    || statut !== (dossier.statut || 'ouvert')
    || numero !== (dossier.numero || '')
    || commercial !== (dossier.responsable || '')
    || cmdLe   !== (dossier.materiel_commande_le      || '').slice(0, 10)
    || cmdLiv  !== (dossier.materiel_livraison_prevue || '').slice(0, 10)
    || cmdNote !== (dossier.materiel_note || '')

  async function enregistrer() {
    if (!titre.trim()) { setErreur("L'intervention ne peut pas être vide."); return }
    if (aFact != null && Number.isNaN(aFact)) { setErreur('Le prix annoncé doit être un nombre.'); return }
    setOccupe(true); setErreur('')
    const patch = {
      numero: numero.trim() || null,
      titre: titre.trim(),
      date_debut: date || null,
      montant_a_facturer: aFact,
      statut,
      materiel_commande_le:      cmdLe  || null,
      materiel_livraison_prevue: cmdLiv || null,
      materiel_note:             cmdNote.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('dossiers').update(patch).eq('id', dossier.id)
    setOccupe(false)
    if (error) {
      setErreur(error.code === '23505'
        ? `Le numéro « ${patch.numero} » est déjà pris par un autre chantier.`
        : `Enregistrement refusé — ${error.message}`)
      return
    }
    // Le compteur automatique ignore les renumérotations manuelles : sans ce
    // recalage, le prochain dossier créé reprendrait un numéro déjà attribué
    // et l'index unique refuserait l'écriture — des semaines plus tard, chez
    // quelqu'un qui n'aura rien fait de mal.
    // Le commercial se propage au devis et aux factures de vente du chantier.
    // Les factures d'ACHAT n'ont pas de colonne : elles sont déjà rattachées
    // au chantier, donc elles héritent. Une quatrième copie serait une
    // quatrième occasion de diverger.
    if (commercial !== (dossier.responsable || '')) {
      const { error: eSync } = await supabase.rpc('synchroniser_commercial', {
        p_dossier_id: dossier.id, p_code: commercial || null,
      })
      if (eSync) { setErreur(`Commercial non propagé — ${eSync.message}`); return }
    }
    if (patch.numero && patch.numero !== dossier.numero) {
      await supabase.rpc('caler_numero', {
        p_type: 'dossier', p_societe: dossier.societe || 'LODE', p_numero: patch.numero,
      })
    }
    onEnregistre({ ...patch, responsable: commercial || null })
    // Enregistrer ferme la fenêtre.
    //
    // Ludovic : « quand on clique sur clos puis enregistrer, il doit fermer
    // la fenêtre, pas la laisser ouverte ». C'est vrai de tout enregistrement,
    // pas seulement de la clôture : laisser la fenêtre ouverte avec un « ✓ »
    // qui s'efface au bout de deux secondes oblige à se demander si c'est
    // parti. Fermer EST la confirmation — et la ligne mise à jour derrière la
    // montre.
    onClose()
  }

  const lbl = { display: 'block', fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }

  return (
    <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: 'min(700px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* ⚠️ NUMÉRO ÉDITABLE — MESURE TEMPORAIRE.
                Ludovic, à la mise en production : « place les noms des
                dossiers en mode éditable, que je puisse réécrire correctement
                et remettre dans l'ordre, puis tu enlèveras cette option
                après ». Le temps de la reprise, donc — à retirer ensuite,
                sinon deux dossiers finiront par porter le même numéro malgré
                l'index unique, ou par trouer la séquence. */}
            <input value={numero} onChange={e => setNumero(e.target.value)}
              title="Numéro modifiable — mesure temporaire, le temps de la reprise"
              style={{
                fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, fontWeight: 700,
                color: OR, border: `1px dashed ${OR}`, borderRadius: 6, padding: '2px 6px',
                background: COUL.surface, width: 160,
              }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: COUL.texteFort, marginTop: 2 }}>{dossier.client_nom || 'Sans client'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: COUL.texteFaible }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '2 1 240px' }}>
              <label style={lbl}>Intervention</label>
              <input value={titre} onChange={e => setTitre(e.target.value)} style={{ ...inp, width: '100%' }} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={lbl}>Date du dossier</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, width: '100%' }} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={lbl}>Prix annoncé (TTC)</label>
              <input value={montant} onChange={e => setMontant(e.target.value)} inputMode="decimal" placeholder="—" style={{ ...inp, width: '100%' }} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              {/* Le commercial vit sur le CHANTIER, pas seulement sur le devis :
                  un dépannage n'a pas de devis, et un chantier peut en porter
                  deux. Le déduire du premier devis — ce que faisait Rentabilité
                  faute de mieux — donnait une colonne vide ou un résultat
                  arbitraire. */}
              <label style={lbl}>Commercial</label>
              <select value={commercial} onChange={e => setCommercial(e.target.value)} style={{ ...inp, width: '100%' }}>
                <option value="">—</option>
                {commerciaux.filter(e => e.code).map(e => (
                  <option key={e.code} value={e.code}>{e.code} — {e.nom_complet}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={lbl}>État</label>
              <select value={statut} onChange={e => setStatut(e.target.value)} style={{ ...inp, width: '100%' }}>
                <option value="ouvert">Ouvert</option>
                <option value="clos">Clos</option>
              </select>
            </div>
          </div>

          {dossier.cloture_auto && dossier.statut === 'clos' && (
            <div style={{ margin: '0 20px 14px', padding: '9px 12px', borderRadius: 9, background: COUL.succesFondDoux, border: `1px solid ${COUL.succesBord}`, fontSize: 12.5, color: COUL.texteSombre }}>
              <strong>Clôturé automatiquement</strong> — {dossier.cloture_motif || 'plus rien en attente'}
              {dossier.cloture_le ? ` le ${fmtDate(dossier.cloture_le)}` : ''}. Repasse-le en « Ouvert » si c'est une erreur.
            </div>
          )}

          <div style={{ padding: '0 20px 14px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[['Coûté', coute, COUL.texteSombre, parSociete], ['À facturer', aFact, COUL.texteSombre],
              ['Facturé', facture, COUL.texteSombre], ['Encaissé', encaisse, COUL.succes],
              ['Manquant', manque, manque > 0 ? COUL.danger : COUL.texteFaible]].map(([l, v, c, detail]) => (
              <div key={l} style={{ flex: '1 1 110px', background: COUL.fond, borderRadius: 9, padding: '9px 11px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em' }}>{l}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums' }}>
                  {v == null ? '—' : eur(v)}
                </div>
                {detail && (
                  <div style={{ fontSize: 11, color: COUL.texteDoux, marginTop: 3, lineHeight: 1.45 }}>
                    {detail.map(([soc, mt]) => (
                      <div key={soc} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span>{soc}</span>
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{eur(mt)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* LES PASSAGES, ET NON PLUS UNE SAISIE UNIQUE.
              « 4 h le mardi, il manque une pièce, 4 h le vendredi » : le
              vendredi écrasait le mardi, deux personnes étaient impossibles, et
              la raison du retour n'avait nulle part où aller. Une ligne par
              personne et par déplacement règle les trois — et compte les
              trajets, qui sont le vrai coût d'un retour. */}
          <Section titre="Passages sur le chantier">
            <InterventionsChantier dossier={dossier} onChange={onRecharger} />
          </Section>

          {/* Entre le devis accepté et la pose : la commande et le délai.
              Les dates se corrigent à la main quand le fournisseur décale —
              choix explicite de Ludovic plutôt qu'une alerte automatique. */}
          <Section titre="Matériel">
            <div style={{ padding: '2px 20px 14px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label style={lbl}>Commandé le</label>
                <input type="date" value={cmdLe} onChange={e => setCmdLe(e.target.value)} style={{ ...inp, width: '100%' }} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={lbl}>Livraison annoncée</label>
                <input type="date" value={cmdLiv} onChange={e => setCmdLiv(e.target.value)} style={{ ...inp, width: '100%' }} />
              </div>
              <div style={{ flex: '2 1 220px' }}>
                <label style={lbl}>Remarque</label>
                <input value={cmdNote} onChange={e => setCmdNote(e.target.value)}
                  placeholder="ex. réf. fournisseur, délai annoncé par téléphone" style={{ ...inp, width: '100%' }} />
              </div>
              {cmdLe && cmdLiv && cmdLiv < new Date().toISOString().slice(0, 10) && (
                <div style={{ flex: '1 1 100%', fontSize: 12.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px' }}>
                  La livraison était annoncée pour le {new Date(cmdLiv).toLocaleDateString('fr-BE')} — corrige la date si le fournisseur a décalé.
                </div>
              )}
            </div>
          </Section>

          {/* Les pièces libres du chantier : bon de commande fournisseur, devis
              fournisseur, fiches techniques, QR du moteur… Elles vivent dans
              SharePoint (ADMINISTRATION/LODE_CHANTIERS), le Hub n'en garde que
              l'adresse et une vignette. */}
          <Section titre="Documents">
            <DocumentsChantier dossier={dossier} />
          </Section>

          <Section titre={`Achats rattachés (${achats.length})`}
            action={achatsLibres.length > 0 && (
              <button onClick={() => setRattacher(true)} style={{
                border: `1px solid ${OR}`, background: COUL.surface, color: OR, borderRadius: 7,
                padding: '4px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
              }}>+ Rattacher une facture</button>
            )}>
            {achats.length === 0 && <Vide texte={achatsLibres.length
              ? "Aucun achat rattaché — utilise le bouton ci-dessus."
              : "Aucun achat rattaché, et aucune facture d'achat en attente."} />}
            {achats.map(a => (
              <Ligne2 key={a.id}
                gauche={a.fournisseur || 'fournisseur inconnu'}
                sousGauche={`${fmtDate(a.date_facture)}${a.numero ? ' · n°' + a.numero : ''}`
                  // Qui a payé — affiché UNIQUEMENT quand ce n'est pas la
                  // société du chantier. Répéter « LODE » sur chaque ligne
                  // d'un chantier LODE n'apprendrait rien et noierait la
                  // seule ligne qui compte : celle payée par l'autre société.
                  + (a.societe && a.societe !== (dossier.societe || 'LODE') ? ` · payée par ${a.societe}` : '')}
                droite={eur(a.montant)}
                sousDroite={a.transaction_id ? 'payée' : 'non payée'}
                tonDroite={a.transaction_id ? COUL.succes : COUL.danger} />
            ))}
          </Section>

          <Section titre={`Devis et factures (${devis.length + ventes.length})`}
            action={ventesLibres.length > 0 && (
              <button onClick={() => setRattacherVente(true)} style={{
                border: `1px solid ${OR}`, background: COUL.surface, color: OR, borderRadius: 7,
                padding: '4px 9px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
              }}>+ Rattacher</button>
            )}>
            {devis.length === 0 && ventes.length === 0 && <Vide texte={ventesLibres.length
              ? "Rien d'émis pour ce dossier — utilise le bouton ci-dessus."
              : "Rien d'émis pour ce dossier."} />}
            {devis.map(d => (
              <Ligne2 key={'d' + d.id}
                gauche={`Devis ${d.numero}${d.objet ? ' — ' + d.objet : ''}`}
                sousGauche={`${d.statut || ''}${d.date_devis ? ' · ' + fmtDate(d.date_devis) : ''}`}
                droite={eur(d.total_ttc)}
                sousDroite={d.statut === 'accepté' ? 'à facturer' : ''}
                tonDroite={d.statut === 'accepté' ? COUL.danger : COUL.texteFaible} />
            ))}
            {ventes.map(v => (
              <Ligne2 key={v.id}
                gauche={`${v.numero} — ${v.objet || ''}`}
                sousGauche={v.statut || ''}
                droite={eur(v.total_ttc)}
                sousDroite={`encaissé ${eur(v.montant_paye || 0)}`}
                tonDroite={COUL.texteFaible} />
            ))}
          </Section>
        </div>

        {erreur && <div style={{ padding: '10px 20px', fontSize: 12.5, color: COUL.dangerFonce, background: COUL.dangerFondDoux }}>{erreur}</div>}

        {rattacherVente && (
          <ChoisirVente documents={ventesLibres} dossier={dossier}
            onClose={() => setRattacherVente(false)}
            onChoisir={async (d) => { if (await onRattacherVente?.(d)) setRattacherVente(false) }} />
        )}

        {rattacher && (
          <ChoisirFacture achats={achatsLibres} dossier={dossier}
            onClose={() => setRattacher(false)}
            onChoisir={(f) => { onRattacher?.(f); setRattacher(false) }} />
        )}

        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={onDevis} style={{ ...btn, background: COUL.surface, color: OR, border: `1px solid ${OR}` }}>
            <i className="ti ti-file-plus" style={{ marginRight: 6 }} />Créer un devis
          </button>
          <span style={{ flex: 1 }} />
          <button onClick={enregistrer} disabled={occupe || !modifie}
            style={{ ...btn, opacity: occupe || !modifie ? 0.5 : 1 }}>
            {occupe ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Choisir une facture d'achat à rattacher au dossier.
//
// C'est le même geste que la colonne « Chantier » de la comptabilité, pris
// par l'autre bout : là on part de la facture, ici on part du chantier.
// Les deux existent parce qu'on n'aborde pas toujours le problème du même
// côté — « cette facture, c'est pour quoi ? » et « ce chantier, qu'est-ce
// qu'il m'a coûté ? » sont deux questions, pas deux écrans.
// Rattacher après coup un devis ou une facture de vente déjà émis.
// La liste est limitée au client du chantier et aux documents qui ne sont
// rattachés nulle part : on ne « déplace » pas un document d'un chantier à
// l'autre d'un clic, ça se fait depuis le document lui-même.
function ChoisirVente({ documents, dossier, onClose, onChoisir }) {
  const [enCours, setEnCours] = useState(null)
  return (
    <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: 'min(560px, 96vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: COUL.texteFort }}>Rattacher un devis ou une facture</div>
          <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 3 }}>
            Documents de {dossier.client_nom || 'ce client'} sans chantier.
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '6px 0' }}>
          {documents.length === 0 && (
            <div style={{ padding: '22px 20px', fontSize: 13, color: COUL.texteFaible, textAlign: 'center' }}>
              Aucun document libre pour ce client.
            </div>
          )}
          {documents.map(d => (
            <div key={d._doc + d.id} onClick={async () => { setEnCours(d.id); await onChoisir(d); setEnCours(null) }}
              style={{ padding: '10px 20px', cursor: enCours ? 'progress' : 'pointer', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', gap: 12, opacity: enCours && enCours !== d.id ? 0.5 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: COUL.texteFort, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d._doc === 'devis' ? 'Devis' : 'Facture'} {d.numero}{d.objet ? ' — ' + d.objet : ''}
                </div>
                <div style={{ fontSize: 11.5, color: COUL.texteDoux }}>{d.statut || ''}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: COUL.texteFort, whiteSpace: 'nowrap' }}>{eur(d.total_ttc)}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.texteDoux, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

function ChoisirFacture({ achats, dossier, onClose, onChoisir }) {
  const [q, setQ] = useState('')
  const terme = q.trim().toLowerCase()
  const liste = !terme ? achats : achats.filter(a =>
    `${a.fournisseur || ''} ${a.nom || ''} ${a.numero || ''}`.toLowerCase().includes(terme))

  return (
    <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: 'min(560px, 96vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: COUL.texteFort }}>Rattacher une facture</div>
          <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 3 }}>
            vers <strong>{dossier.numero}</strong> · {dossier.titre}
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus
            placeholder="Fournisseur, numéro, nom de fichier…" style={{ ...inp, width: '100%' }} />
          <div style={{ fontSize: 11, color: COUL.texteFaible, marginTop: 6 }}>
            {liste.length} facture{liste.length > 1 ? 's' : ''} sans destination
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 100 }}>
          {liste.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: COUL.texteFaible, fontSize: 13 }}>
              Aucune facture en attente ne correspond.
            </div>
          )}
          {liste.map(a => (
            <div key={a.id} onClick={() => onChoisir(a)}
              style={{ padding: '10px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}
              onMouseEnter={e => { e.currentTarget.style.background = COUL.fond }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COUL.texteFort }}>{a.fournisseur || 'fournisseur inconnu'}</div>
                <div style={{ fontSize: 11.5, color: COUL.texteFaible, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fmtDate(a.date_facture)}{a.numero ? ' · n°' + a.numero : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{eur(a.montant)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: a.transaction_id ? COUL.succes : COUL.danger }}>
                  {a.transaction_id ? 'payée' : 'non payée'}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.texteDoux, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

function Section({ titre, children, action }) {
  return (
    <div style={{ borderTop: '1px solid #f1f5f9' }}>
      <div style={{ padding: '10px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em' }}>{titre}</span>
        {action || null}
      </div>
      <div style={{ paddingBottom: 8 }}>{children}</div>
    </div>
  )
}
function Vide({ texte }) {
  return <div style={{ padding: '10px 20px 14px', fontSize: 12.5, color: COUL.texteFaible }}>{texte}</div>
}
function Ligne2({ gauche, sousGauche, droite, sousDroite, tonDroite }) {
  return (
    <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COUL.texteFort, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gauche}</div>
        <div style={{ fontSize: 11.5, color: COUL.texteFaible }}>{sousGauche}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{droite}</div>
        <div style={{ fontSize: 11, color: tonDroite, fontWeight: 600 }}>{sousDroite}</div>
      </div>
    </div>
  )
}

// Après création, le numéro est montré en grand : c'est la seule chose que la
// personne doit emporter pour la taper chez le fournisseur.
function PanneauNumero({ dossier, onClose }) {
  const [copie, setCopie] = useState(false)
  return (
    <div {...voile(onClose)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: 'min(420px, 94vw)', padding: '26px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 13.5, color: COUL.texteDoux, marginBottom: 6 }}>Dossier créé</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: COUL.texteFort, marginBottom: 16 }}>{dossier.titre}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Référence à taper chez le fournisseur
        </div>
        <div style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 28, fontWeight: 800, color: OR, margin: '8px 0 4px', letterSpacing: '.02em' }}>
          {dossier.numero}
        </div>
        <div style={{ fontSize: 12, color: COUL.texteFaible, lineHeight: 1.5, margin: '10px 0 18px' }}>
          À recopier dans « Votre référence » chez Winsol ou SDA.<br />
          La facture se rangera toute seule dans ce dossier.
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(dossier.numero); setCopie(true); setTimeout(() => setCopie(false), 2000) }}
          style={{ ...btn, width: '100%' }}>{copie ? '✓ Copié' : 'Copier le numéro'}</button>
        <button onClick={onClose} style={{ marginTop: 8, width: '100%', padding: '9px', borderRadius: 8, border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.texteDoux, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Fermer</button>
      </div>
    </div>
  )
}

