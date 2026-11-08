import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { COUL } from '../../lib/theme'
import { analyserTelephone, telephonePourBase, telephoneEnFrappe } from '../../lib/telephone'

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
  const [loading, setLoading] = useState(true)
  const [nouveau, setNouveau] = useState(null)   // dossier fraîchement créé, à montrer en grand
  const [aAttribuer, setAAttribuer] = useState(null) // facture d'achat en cours d'attribution
  const [erreur, setErreur] = useState('')
  const [creation, setCreation] = useState(false)
  const [tri, setTri]   = useState({ col: 'numero', sens: 'desc' })
  const [triA, setTriA] = useState({ col: 'date_facture', sens: 'desc' })

  async function charger() {
    setLoading(true)
    const [d, a, v] = await Promise.all([
      supabase.from('dossiers')
        .select('id,numero,titre,client_nom,statut,montant_a_facturer,date_debut,created_at')
        .eq('societe', 'LODE').order('created_at', { ascending: false }),
      supabase.from('factures_achat')
        .select('id,fichier_id,nom,fournisseur,montant,date_facture,url,destination_type,destination_id,destination_nom,transaction_id')
        .eq('societe', 'LODE').eq('sens', 'achat').order('date_facture', { ascending: false }),
      supabase.from('lode_factures')
        .select('id,numero,client_nom,total_ttc,montant_paye,dossier_id,statut'),
    ])
    setDossiers(d.data || []); setAchats(a.data || []); setVentes(v.data || [])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

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

  const lignesTriees = useMemo(() => trier(lignes, tri.col, tri.sens), [lignes, tri])

  const nonAffectes = useMemo(
    () => trier(achats.filter(a => !a.destination_type), triA.col, triA.sens),
    [achats, triA])

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
  async function creerDossier(titre, client, montant) {   // client = { id, nom } | null
    setErreur('')
    try {
      const { data: numero, error: e1 } = await supabase.rpc('prochain_numero', {
        p_type: 'dossier', p_societe: 'LODE', p_prefixe: 'DOS',
      })
      if (e1) { setErreur(`Numérotation refusée — ${e1.message}`); return false }
      if (!numero) { setErreur('Numérotation : aucun numéro rendu.'); return false }

      const montantNum = montant === '' || montant == null ? null : Number(String(montant).replace(',', '.'))
      if (montantNum != null && Number.isNaN(montantNum)) {
        setErreur('Le prix annoncé doit être un nombre (ex. 2841.96).'); return false
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
      }).select('id,numero,titre,client_nom,statut,montant_a_facturer,date_debut,created_at').single()

      if (error) { setErreur(`Création refusée — ${error.message}`); return false }
      setDossiers(p => [data, ...p])
      setNouveau(data)
      return true
    } catch (e) {
      // Une exception inattendue (réseau coupé, session expirée) ne doit pas
      // laisser le bouton tourner dans le vide.
      setErreur(`Erreur inattendue — ${e?.message || e}`)
      return false
    }
  }

  async function affecter(facture, dossier) {
    setErreur('')
    const patch = {
      destination_type: 'dossier',
      destination_id: dossier.id,
      destination_nom: `${dossier.numero ? dossier.numero + ' · ' : ''}${dossier.titre}`,
    }
    const { error } = await supabase.from('factures_achat').update(patch).eq('id', facture.id)
    if (error) { setErreur(error.message); return }
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

        {erreur && <div style={{ ...card, background: COUL.dangerFondDoux, color: COUL.dangerFonce, fontSize: 13 }}>{erreur}</div>}
        {loading && <div style={{ ...card, textAlign: 'center', color: COUL.texteFaible }}>Chargement…</div>}

        {!loading && onglet === 'dossiers' && (
          <>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setCreation(true)} style={btn}>
                <i className="ti ti-plus" style={{ marginRight: 6 }} />Nouveau dossier
              </button>
              <span style={{ fontSize: 12.5, color: COUL.texteFaible }}>
                Le dossier commence par le client : on le retrouve s&apos;il existe, on le crée sinon.
              </span>
            </div>
            <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead><tr>
                  <ThTri label="N°"          col="numero"     tri={tri} setTri={setTri} />
                  <ThTri label="Intervention" col="titre"      tri={tri} setTri={setTri} />
                  <ThTri label="Client"       col="client_nom" tri={tri} setTri={setTri} />
                  <ThTri label="Coûté"        col="coute"      tri={tri} setTri={setTri} droite />
                  <ThTri label="À facturer"   col="aFact"      tri={tri} setTri={setTri} droite />
                  <ThTri label="Facturé"      col="facture"    tri={tri} setTri={setTri} droite />
                  <ThTri label="Encaissé"     col="encaisse"   tri={tri} setTri={setTri} droite />
                  <ThTri label="Manquant"     col="manque"     tri={tri} setTri={setTri} droite />
                </tr></thead>
                <tbody>
                  {dossiers.length === 0 && <tr><td style={{ ...td, textAlign: 'center', padding: 36, color: COUL.texteFaible }} colSpan={8}>
                    Aucun dossier. Crée le premier ci-dessus — son numéro est la référence à taper chez le fournisseur.
                  </td></tr>}
                  {lignesTriees.map(d => {
                    const vide = <span style={{ color: '#cbd5e1' }}>—</span>
                    return (
                      <tr key={d.id}>
                        <td style={{ ...td, fontWeight: 700, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 }}>{d.numero || '—'}</td>
                        <td style={td}>{d.titre}{d.nbAchats > 0 && <span style={{ fontSize: 11, color: COUL.texteFaible, marginLeft: 6 }}>· {d.nbAchats} achat{d.nbAchats > 1 ? 's' : ''}</span>}</td>
                        <td style={{ ...td, color: COUL.texteDoux }}>{d.client_nom || '—'}</td>
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
          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead><tr>
                <ThTri label="Date"        col="date_facture"   tri={triA} setTri={setTriA} />
                <ThTri label="Fournisseur" col="fournisseur"    tri={triA} setTri={setTriA} />
                <ThTri label="Facture"     col="nom"            tri={triA} setTri={setTriA} />
                <ThTri label="Montant"     col="montant"        tri={triA} setTri={setTriA} droite />
                <ThTri label="Payée"       col="transaction_id" tri={triA} setTri={setTriA} />
                <th style={th}></th>
              </tr></thead>
              <tbody>
                {nonAffectes.length === 0 && <tr><td style={{ ...td, textAlign: 'center', padding: 36, color: COUL.succes }} colSpan={6}>
                  Tous les achats LODE sont affectés.
                </td></tr>}
                {nonAffectes.map(a => (
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
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => setAAttribuer(a)} style={{ ...btn, padding: '6px 11px', fontSize: 12.5 }}>Attribuer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creation && (
        <PanneauNouveauDossier
          onClose={() => setCreation(false)}
          onCreer={async (titre, client, montant) => {
            const ok = await creerDossier(titre, client, montant)
            if (ok) setCreation(false)
            return ok
          }} />
      )}
      {nouveau && <PanneauNumero dossier={nouveau} onClose={() => setNouveau(null)} />}
      {aAttribuer && (
        <PanneauAttribuer facture={aAttribuer} dossiers={dossiers}
          onClose={() => setAAttribuer(null)} onChoisir={d => affecter(aAttribuer, d)} />
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
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const [fiche, setFiche] = useState({ type: 'particulier', nom: '', prenom: '', denomination: '',
                                       email: '', gsm: '', adresse: '', cp: '', ville: '', tva: '' })

  const nomClient = (c) => c.denomination || [c.prenom, c.nom].filter(Boolean).join(' ') || '(sans nom)'

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
    setOccupe(true); setErreur('')
    const ok = await onCreer(titre.trim(), client, montant)
    setOccupe(false)
    if (!ok) setErreur("La création du dossier a échoué — voir le message sur l'écran.")
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
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

// Après création, le numéro est montré en grand : c'est la seule chose que la
// personne doit emporter pour la taper chez le fournisseur.
function PanneauNumero({ dossier, onClose }) {
  const [copie, setCopie] = useState(false)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
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

function PanneauAttribuer({ facture, dossiers, onClose, onChoisir }) {
  const [q, setQ] = useState('')
  const ouverts = dossiers.filter(d => d.statut !== 'clos')
  const liste = !q.trim() ? ouverts : ouverts.filter(d =>
    `${d.numero || ''} ${d.titre || ''} ${d.client_nom || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: 'min(520px, 96vw)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: COUL.texteFort }}>Cet achat, c&apos;est pour quel dossier&nbsp;?</div>
          <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 3 }}>
            {facture.fournisseur || 'fournisseur inconnu'} — <strong>{eur(facture.montant)}</strong> — {fmtDate(facture.date_facture)}
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Numéro, intervention, client…" style={{ ...inp, width: '100%' }} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {liste.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: COUL.texteFaible, fontSize: 13 }}>
            Aucun dossier ouvert ne correspond. Crée-le d&apos;abord dans l&apos;onglet Dossiers.
          </div>}
          {liste.map(d => (
            <div key={d.id} onClick={() => onChoisir(d)} style={{ padding: '11px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = COUL.fond }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COUL.texteFort }}>
                <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, color: OR, marginRight: 8 }}>{d.numero}</span>
                {d.titre}
              </div>
              <div style={{ fontSize: 11.5, color: COUL.texteFaible }}>{d.client_nom || 'sans client'}</div>
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
