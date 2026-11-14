import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './supabase'
import { COUL } from './theme'

const AuthContext = createContext(null)

// ⚠️ NE JAMAIS REMETTRE CE DRAPEAU À true.
//
// Vestige de l'accès libre ouvert du 31/10 au 02/11/2026, le temps de
// reconstruire l'authentification Microsoft. À true, il court-circuite tout le
// flux de connexion : quiconque ouvre hub-dtx.vercel.app entre directement avec
// les droits d'administrateur — clients, IBAN, contrats, commissions, visibles
// et modifiables par n'importe qui ayant le lien.
//
// Il reste là quelques jours, le temps de confirmer que la connexion fonctionne
// pour tout le monde, puis il sera retiré avec la branche qu'il commande.
// Voir docs/DROITS-ACCES.md.
const ACCES_LIBRE_TEMPORAIRE = false
const EMAIL_ACCES_LIBRE = 'lde@dynassur.be'

// ── Durée de vie des sessions, imposée par l'application ─────────────────────
//
// Supabase sait le faire côté serveur (« Time-box user sessions » et
// « Inactivity timeout »), mais ces deux réglages sont réservés au plan Pro ;
// le projet est en Free. On les applique donc ici.
//
// Ce que ça couvre : une session laissée ouverte, un poste partagé, un
// navigateur resté connecté chez quelqu'un. C'est le scénario réel.
// Ce que ça NE couvre PAS : un jeton exfiltré et rejoué depuis ailleurs — la
// règle vit dans le navigateur, ce n'est pas une frontière de sécurité. Seul
// un time-box côté serveur (plan Pro) la rendrait opposable.
//
// À noter : l'inactivité est mesurée sur les actions RÉELLES de l'utilisateur
// (clic, touche, retour sur l'onglet). Le réglage Supabase, lui, se fonde sur
// l'usage du jeton de rafraîchissement — que supabase-js renouvelle tout seul
// tant que l'onglet est ouvert. Une fenêtre abandonnée ne s'y fermait donc
// jamais ; ici, si.
const DUREE_MAX_SESSION = 24 * 60 * 60 * 1000   // 24 h depuis l'authentification Microsoft
const DUREE_MAX_INACTIVITE = 2 * 60 * 60 * 1000 // 2 h sans action de l'utilisateur
const CLE_DEBUT = 'hub.session.debut'
const CLE_ACTIVITE = 'hub.session.activite'

// Révocation d'accès : le Hub redemande à la base, à intervalle régulier, si le
// compte est toujours actif. C'est invisible pour l'utilisateur — une ligne lue,
// rien à l'écran — et c'est ce qui ramène le délai de coupure de 24 h à 10
// minutes le jour où on retire l'accès de quelqu'un. Sans cela, retirer
// quelqu'un d'Entra ou décocher son compte ne ferait rien tant que sa session
// en cours vit : Supabase ne redemande rien à Microsoft pour la renouveler.
// Coût : 6 requêtes par heure et par onglet actif, aucune pour un onglet en
// arrière-plan. Négligeable devant le reste du trafic.
const RELECTURE_COMPTE = 10 * 60 * 1000

// localStorage peut lever (navigation privée, stockage bloqué) : jamais au prix
// d'un plantage de l'authentification.
function lireHorodatage(cle) {
  try { return Number(window.localStorage.getItem(cle)) || 0 } catch { return 0 }
}
function ecrireHorodatage(cle, valeur) {
  try { window.localStorage.setItem(cle, String(valeur)) } catch { /* ignoré */ }
}
function oublierHorodatages() {
  try { window.localStorage.removeItem(CLE_DEBUT); window.localStorage.removeItem(CLE_ACTIVITE) } catch { /* ignoré */ }
}

/** Renvoie le motif d'expiration ('duree' | 'inactivite'), ou null si la session tient. */
function motifExpiration() {
  const maintenant = Date.now()
  const debut = lireHorodatage(CLE_DEBUT)
  const activite = lireHorodatage(CLE_ACTIVITE)
  // Horodatage absent (session d'avant cette règle, ou stockage vidé) : on ne
  // déconnecte pas sur une inconnue, on repart de maintenant.
  if (!debut) return null
  if (maintenant - debut > DUREE_MAX_SESSION) return 'duree'
  if (activite && maintenant - activite > DUREE_MAX_INACTIVITE) return 'inactivite'
  return null
}

const MESSAGE_EXPIRATION = {
  duree: 'Ta session a dépassé 24 heures. Reconnecte-toi avec ton compte Microsoft.',
  inactivite: 'Ta session a été fermée après 2 heures sans activité. Reconnecte-toi.',
  revoque: "Ton accès au Hub a été désactivé. Contacte l'administrateur.",
}

export const SOCIETES_CONFIG = {
  groupe: {
    key: 'groupe', label: 'Tableau de bord général', short: 'GRP',
    color: COUL.violet, colorDark: '#3b1f6e', colorLight: COUL.violetFond, colorAccent: '#a78bfa',
    acc_key: 'acc_holding',
  },
  dynassur: {
    key: 'dynassur', label: 'Dynassur SRL', short: 'DYN',
    color: COUL.bleu, colorDark: COUL.marine, colorLight: '#e0f2fe', colorAccent: '#5DC3E8',
    acc_key: 'acc_dynassur',
  },
  dtx: {
    key: 'dtx', label: 'DTX SRL', short: 'DTX',
    color: COUL.texteFaible, colorDark: COUL.texteSombre, colorLight: COUL.fond, colorAccent: COUL.bordFort,
    acc_key: 'acc_dtx',
  },
  lode: {
    key: 'lode', label: 'LODE SRL', short: 'LODE',
    color: COUL.orange, colorDark: '#7c2d12', colorLight: COUL.orangeFond, colorAccent: '#fb923c',
    acc_key: 'acc_lode',
  },
  hexagroup: {
    key: 'hexagroup', label: 'Hexagroup ASBL', short: 'HEX',
    color: COUL.danger, colorDark: '#7f1d1d', colorLight: COUL.dangerFondDoux, colorAccent: '#f87171',
    acc_key: 'acc_hexagroup',
  },
  prive: {
    key: 'prive', label: 'Privé', short: 'PRV',
    color: COUL.teal, colorDark: '#134e4a', colorLight: COUL.tealFond, colorAccent: '#2dd4bf',
    acc_key: 'acc_prive',
  },
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perms, setPerms] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSociete, setActiveSociete] = useState(null)
  const [erreurConnexion, setErreurConnexion] = useState(null)

  // Charge la fiche du collaborateur ET ses droits.
  //
  // La source de vérité des droits est désormais `collaborateur_acces`
  // (collaborateur × société × module). Les anciennes colonnes booléennes
  // (dyn_comptabilite, acc_lode…) sont RECONSTITUÉES à partir des attributions,
  // via la correspondance stockée dans `ref_modules_societes`. Les écrans qui
  // les lisent encore — App.jsx, Sidebar.jsx, outils.js — continuent donc de
  // fonctionner sans modification, mais ce ne sont plus elles qui décident.
  //
  // Important : on remet d'abord à false toutes les colonnes connues du
  // catalogue, sinon retirer un droit dans Paramètres ne le retirerait pas —
  // la valeur de l'ancienne colonne resterait vraie.
  // Microsoft ne renvoie pas toujours l'adresse telle qu'elle est dans la fiche.
  // Deux ecarts rencontres :
  //  - un INVITE porte une forme UPN : « machin_gmail.com#EXT#@tenant.onmicrosoft.com »
  //    alors que sa fiche porte « machin@gmail.com » ;
  //  - la casse varie (« Lorange.Ludivine@... » contre « lorange.ludivine@... »).
  // Une egalite exacte et sensible a la casse rate donc la fiche dans les deux cas,
  // et la personne se voit refuser l'acces alors qu'elle l'a.
  function adressesPossibles(email) {
    const brut = String(email || '').trim()
    if (!brut) return []
    const liste = [brut]
    const ext = brut.match(/^(.+)#EXT#@/i)
    if (ext) {
      const i = ext[1].lastIndexOf('_')          // le dernier _ separe le nom du domaine
      if (i > 0) liste.push(ext[1].slice(0, i) + '@' + ext[1].slice(i + 1))
    }
    return [...new Set(liste.map(a => a.toLowerCase()))]
  }

  async function loadPerms(email) {
    const candidats = adressesPossibles(email)
    if (!candidats.length) return null

    // ilike sans joker = egalite insensible a la casse.
    //
    // REPLI VOLONTAIRE : cette requete garde la porte d'entree du Hub. Si le
    // filtre `or` etait refuse pour une raison que je n'ai pas prevue, PERSONNE
    // ne pourrait plus se connecter — un correctif ne doit jamais pouvoir faire
    // pire que ce qu'il remplace. On retombe donc sur l'egalite exacte d'avant,
    // qui marche pour les 16 comptes internes.
    let data = null
    const { data: lignes, error } = await supabase
      .from('collaborateurs').select('*')
      .or(candidats.map(a => `email.ilike.${a}`).join(','))
      .eq('compte_hub_actif', true).limit(2)
    if (error) {
      const secours = await supabase
        .from('collaborateurs').select('*')
        .eq('email', email).eq('compte_hub_actif', true).maybeSingle()
      data = secours.data || null
    } else {
      data = (lignes || [])[0] || null
    }
    if (!data) return null

    const [{ data: acces }, { data: catalogue }] = await Promise.all([
      supabase.from('collaborateur_acces').select('societe,module_code').eq('collaborateur_id', data.id),
      supabase.from('ref_modules_societes').select('module_code,societe,colonnes_legacy,colonne_acces'),
    ])
    if (!catalogue) return data // catalogue illisible : on garde les colonnes telles quelles

    const drapeaux = {}
    for (const m of catalogue) {
      if (m.colonne_acces) drapeaux[m.colonne_acces] = false
      for (const col of (m.colonnes_legacy || [])) drapeaux[col] = false
    }
    const index = new Map(catalogue.map(m => [`${m.societe}|${m.module_code}`, m]))
    for (const a of (acces || [])) {
      const m = index.get(`${a.societe}|${a.module_code}`)
      if (!m) continue
      if (m.colonne_acces) drapeaux[m.colonne_acces] = true
      for (const col of (m.colonnes_legacy || [])) drapeaux[col] = true
    }
    // ⚠️ On CONSERVE le catalogue société × module, au lieu de le jeter après
    // en avoir tiré les drapeaux (14/11/2026).
    //
    // `acces_modules` dit ce à quoi CE collaborateur a droit. Le catalogue dit
    // tout autre chose : quelles sociétés possèdent tel module. Les écrans en
    // ont besoin — Ludovic a vu « Chantier / dossier » proposé chez Dynassur,
    // qui est un courtier et n'aura jamais de chantiers.
    //
    // Il est déjà chargé ici : le garder coûte zéro requête, alors que chaque
    // écran qui le relirait en paierait une.
    return { ...data, ...drapeaux, acces_modules: acces || [], modules_societes: catalogue }
  }

  // Suivi de connexion — additif, ne bloque jamais le login (fire-and-forget)
  async function trackConnexion(email) {
    try {
      const now = new Date().toISOString()
      await supabase.from('connexions_log').insert({ user_email: email })
      const { data: co } = await supabase.from('collaborateurs').select('premiere_connexion').eq('email', email).single()
      if (co && !co.premiere_connexion) {
        await supabase.from('collaborateurs').update({ premiere_connexion: now, derniere_connexion: now }).eq('email', email)
      } else {
        await supabase.from('collaborateurs').update({ derniere_connexion: now }).eq('email', email)
      }
    } catch (e) { /* silencieux : ne jamais bloquer la connexion */ }
  }

  function getDefaultSociete(p, admin) {
    if (!p) return null
    if (admin || p.acc_holding) return 'groupe'
    return Object.values(SOCIETES_CONFIG)
      .filter(s => s.key !== 'groupe')
      .find(s => p[s.acc_key])?.key || null
  }

  useEffect(() => {
    let cancelled = false

    if (ACCES_LIBRE_TEMPORAIRE) {
      loadPerms(EMAIL_ACCES_LIBRE).then(p => {
        if (cancelled) return
        setUser({ email: EMAIL_ACCES_LIBRE, id: 'acces-libre-temporaire' })
        setPerms(p)
        setActiveSociete(getDefaultSociete(p, true))
        setLoading(false)
      })
      return () => { cancelled = true }
    }

    // Applique une session : le chargement des permissions (requête Supabase) se fait
    // ICI, hors du callback onAuthStateChange, pour ne pas tenir le verrou d'auth.
    async function applySession(session, track) {
      if (cancelled) return
      if (session?.user) {
        // Nouvelle authentification Microsoft : l'horloge des 24 h repart.
        if (track) {
          ecrireHorodatage(CLE_DEBUT, Date.now())
          ecrireHorodatage(CLE_ACTIVITE, Date.now())
        } else if (!lireHorodatage(CLE_DEBUT)) {
          // Session déjà en place mais jamais horodatée (règle introduite après
          // sa création, ou stockage vidé) : on l'adopte à partir de maintenant.
          ecrireHorodatage(CLE_DEBUT, Date.now())
          ecrireHorodatage(CLE_ACTIVITE, Date.now())
        }

        const motif = motifExpiration()
        if (motif) {
          oublierHorodatages()
          await supabase.auth.signOut()
          if (cancelled) return
          setUser(null); setPerms(null); setActiveSociete(null)
          setErreurConnexion(MESSAGE_EXPIRATION[motif])
          setLoading(false)
          return
        }

        setUser(session.user)
        const p = await loadPerms(session.user.email)
        if (cancelled) return
        setPerms(p)
        setActiveSociete(getDefaultSociete(p, p?.est_admin === true))
        if (track) trackConnexion(p?.email || session.user.email)
      } else {
        setUser(null); setPerms(null); setActiveSociete(null)
      }
      if (!cancelled) setLoading(false)
    }

    // Session initiale (hors émission d'événement auth → pas d'interblocage)
    supabase.auth.getSession().then(({ data: { session } }) => applySession(session, false))

    // NE JAMAIS appeler Supabase directement dans ce callback : supabase-js détient un
    // Web Lock pendant l'émission de l'événement ; un await vers supabase.from(...) ici
    // interbloque le client → getSession() ne se résout jamais → loading reste true →
    // chargement infini au démarrage (que le refresh « débloque » par hasard de timing).
    // On diffère donc tout travail Supabase hors du callback avec setTimeout(0).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return // déjà géré par getSession()
      setTimeout(() => applySession(session, event === 'SIGNED_IN'), 0)
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  // Surveillance pendant la session : on note l'activité réelle de
  // l'utilisateur, et on vérifie chaque minute que la session tient encore.
  // Sans ce minuteur, un onglet laissé ouvert ne verrait jamais l'expiration —
  // c'est précisément le cas qu'on veut couvrir.
  useEffect(() => {
    if (ACCES_LIBRE_TEMPORAIRE || !user) return

    // Activité = une action délibérée. Revenir sur l'onglet n'en est PAS une :
    // retrouver une fenêtre ouverte depuis la veille doit déconnecter, pas
    // relancer le compteur.
    const noterActivite = () => ecrireHorodatage(CLE_ACTIVITE, Date.now())
    const actions = ['pointerdown', 'keydown']
    actions.forEach(e => window.addEventListener(e, noterActivite, { passive: true }))

    async function verifier() {
      const motif = motifExpiration()
      if (!motif) return
      oublierHorodatages()
      await supabase.auth.signOut()
      setUser(null); setPerms(null); setActiveSociete(null)
      setErreurConnexion(MESSAGE_EXPIRATION[motif])
    }

    // Le retour sur l'onglet déclenche une vérification immédiate : les
    // navigateurs ralentissent les minuteurs des onglets en arrière-plan, on
    // ne veut pas d'une minute de session en trop au réveil.
    const auRetour = () => { if (!document.hidden) verifier() }
    document.addEventListener('visibilitychange', auRetour)

    const minuteur = setInterval(verifier, 60 * 1000)

    // Le compte a-t-il été désactivé pendant la session ? On ne sollicite pas la
    // base pour un onglet en arrière-plan, et on ne déconnecte jamais sur une
    // erreur réseau : un incident de connexion ne doit pas ressembler à une
    // révocation.
    const minuteurCompte = setInterval(async () => {
      if (document.hidden) return
      const { data, error } = await supabase
        .from('collaborateurs').select('compte_hub_actif')
        .eq('email', perms?.email || user.email).maybeSingle()
      if (error) return
      if (data?.compte_hub_actif) return
      await supabase.auth.signOut()
      oublierHorodatages()
      setUser(null); setPerms(null); setActiveSociete(null)
      setErreurConnexion(MESSAGE_EXPIRATION.revoque)
    }, RELECTURE_COMPTE)

    return () => {
      actions.forEach(e => window.removeEventListener(e, noterActivite))
      document.removeEventListener('visibilitychange', auRetour)
      clearInterval(minuteur)
      clearInterval(minuteurCompte)
    }
    // perms?.email et non perms : une chaine, donc le minuteur ne redemarre
    // que si l'adresse change vraiment, pas a chaque nouvel objet.
  }, [user, perms?.email])

  // ── Connexion Microsoft ──────────────────────────────────────────────────
  //
  // POLITIQUE DE SESSION (le code ne fait qu'un tiers du travail) :
  //
  //  1. Supabase → Authentication → Sessions
  //       Time-box user sessions : 24 h — une vraie authentification par jour
  //       Inactivity timeout     :  4 h — session morte après 4 h sans usage
  //  2. `prompt: 'login'` ci-dessous
  //  3. Entra → méthodes d'authentification : passkey (FIDO2) en préféré,
  //     Authenticator en secours
  //
  // Pourquoi le point 2 est indispensable : sans lui, l'expiration côté
  // Supabase ne produit qu'une redirection INVISIBLE. Entra voit la session
  // SSO encore ouverte par Outlook ou Teams et re-délivre un jeton sans rien
  // demander — on croit se ré-authentifier tous les jours alors que personne
  // n'a rien saisi. `prompt: 'login'` force Entra à redemander les
  // identifiants, donc le facteur.
  //
  // Changement de navigateur ou d'appareil : rien à régler. La session vit
  // dans le localStorage, qui est propre à chaque profil de navigateur et à
  // chaque appareil — Chrome, Edge et le téléphone ne la partagent jamais.
  //
  // Les erreurs sont remontées à l'écran (voir pages/Login.jsx) : un provider
  // désactivé côté Supabase rendait le bouton silencieux, ce qui a fait
  // chercher la panne ailleurs pendant toute la session du 31/10/2026.
  async function signInWithMicrosoft() {
    setErreurConnexion(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'login' },
      },
    })
    if (error) setErreurConnexion(`La connexion Microsoft a échoué : ${error.message}`)
    return { error }
  }

  // Changer de compte : `select_account` affiche le sélecteur Microsoft, qui
  // demande de toute façon les identifiants du compte choisi.
  async function switchUser() {
    setErreurConnexion(null)
    await supabase.auth.signOut()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) setErreurConnexion(`La connexion Microsoft a échoué : ${error.message}`)
    return { error }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    oublierHorodatages()
    setUser(null); setPerms(null); setActiveSociete(null); setErreurConnexion(null)
    return { error }
  }

  const isAdmin = perms?.est_admin === true

  const societesDispo = perms ? [
    (isAdmin || perms.acc_holding)   && SOCIETES_CONFIG.groupe,
    perms.acc_dynassur               && SOCIETES_CONFIG.dynassur,
    perms.acc_dtx                    && SOCIETES_CONFIG.dtx,
    perms.acc_lode                   && SOCIETES_CONFIG.lode,
    perms.acc_hexagroup              && SOCIETES_CONFIG.hexagroup,
    perms.acc_prive                  && SOCIETES_CONFIG.prive,
  ].filter(Boolean) : []

  const societeActive = activeSociete ? SOCIETES_CONFIG[activeSociete] : null

  return (
    <AuthContext.Provider value={{ user, perms, loading, isAdmin, activeSociete, setActiveSociete, societesDispo, societeActive, signInWithMicrosoft, switchUser, signOut, erreurConnexion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
