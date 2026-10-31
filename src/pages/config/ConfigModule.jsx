import { HUB_URL } from '../../config/env'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { bootstrapConfigs } from '../../lib/bootstrapConfigs'
import GestionCategories from './GestionCategories'
import { RdvCategoriesPanel } from '../admin/RdvCategories'
import BceSearch from '../../components/BceSearch'

// ─── Définition des accès par société (colonnes réelles de collaborateurs) ───
const ACCES = [
  { acc: 'acc_dynassur', label: 'Dynassur', pfx: 'dyn',  couleur: '#0080BD',
    pages: [['dashboard', 'Tableau de bord'], ['taches', 'Tâches'], ['clients', 'Clients'], ['production', 'Production'], ['bordereaux', 'Bordereaux'], ['credits', 'Crédits'], ['chiffres', 'Chiffres'], ['objectifs', 'Objectifs'], ['compagnies', 'Compagnies'], ['sinistres', 'Sinistres'], ['rdv', 'RDV / Agenda'], ['appels', 'Appels'], ['rentabilite', 'Rentabilité'], ['banque', 'Banque'], ['comptabilite', 'Comptabilité'], ['devis', 'Devis & Factures'], ['notesfrais', 'Notes de frais']] },
  { acc: 'acc_dtx', label: 'DTX', pfx: 'dtx', couleur: '#1B3A6B',
    pages: [['dashboard', 'Tableau de bord'], ['taches', 'Tâches'], ['immobilier', 'Immobilier'], ['vehicules', 'Véhicules'], ['trading', 'Trading'], ['comptabilite', 'Comptabilité'], ['devis', 'Devis & Factures'], ['notesfrais', 'Notes de frais']] },
  { acc: 'acc_lode', label: 'LODE', pfx: 'lode', couleur: '#F97316',
    pages: [['dashboard', 'Tableau de bord'], ['taches', 'Tâches'], ['clients', 'Clients'], ['banque', 'Banque'], ['comptabilite', 'Comptabilité'], ['devis', 'Devis & Factures'], ['notesfrais', 'Notes de frais']] },
  { acc: 'acc_hexagroup', label: 'Hexagroup', pfx: 'hex', couleur: '#ec4899',
    pages: [['dashboard', 'Tableau de bord'], ['taches', 'Tâches'], ['banque', 'Banque'], ['comptabilite', 'Comptabilité'], ['notesfrais', 'Notes de frais'], ['membres', 'Membres'], ['cotisations', 'Cotisations']] },
  { acc: 'acc_prive', label: 'Privé', pfx: 'prive', couleur: '#22c55e',
    pages: [['dashboard', 'Tableau de bord'], ['taches', 'Tâches'], ['banque', 'Banque'], ['comptabilite', 'Comptabilité'], ['notesfrais', 'Notes de frais']] },
  { acc: 'acc_holding', label: 'Groupe (consolidé)', pfx: 'grp', couleur: '#7c3aed', pages: [['taches', 'Tâches'], ['notesfrais', 'Notes de frais']] },
  { acc: 'acc_tools', label: 'Outils', pfx: 'tools', couleur: '#0ea5e9', pages: [] },
]

const FIELDS_SOC = [
  ['nom', 'Dénomination'], ['activite', 'Activité'], ['forme_juridique', 'Forme juridique'],
  ['bce', 'N° BCE'], ['tva', 'N° TVA'], ['fsma', 'N° FSMA'],
  ['adresse', 'Adresse (rue + n°)'], ['cp', 'Code postal'], ['ville', 'Ville'], ['pays', 'Pays'],
  ['iban_principal', 'IBAN'], ['bic', 'BIC'], ['telephone', 'Téléphone'],
  ['email_expediteur', 'Email expéditeur (devis)'], ['email_cc', 'Email en copie (CC)'],
]

const TYPES_TRAVAIL = ['Non-Vie', 'Vie', 'Santé', 'Crédit', 'SRDU', 'PJ']

export default function ConfigModule() {
  const { isAdmin, perms } = useAuth()
  const [tab, setTab] = useState('societes')
  const [societes, setSocietes] = useState([])
  const [users, setUsers] = useState([])
  const [taux, setTaux] = useState({})          // collaborateur_id -> { type_travail: valeur }
  const [selTaux, setSelTaux] = useState({})    // taux de la fiche ouverte
  const [selSoc, setSelSoc] = useState(null)   // form société courant
  const [selUser, setSelUser] = useState(null) // form user courant
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uSearch, setUSearch] = useState('')
  const [uStatut, setUStatut] = useState('tous')
  const [uSoc, setUSoc] = useState('toutes')
  const [uModule, setUModule] = useState('tous')
  const [uRole, setURole] = useState('tous')
  const [uBureau, setUBureau] = useState('tous')
  const [bureaux, setBureaux] = useState([])            // ref_bureaux (adresse complète)
  const [showBureaux, setShowBureaux] = useState(false) // panneau "Gérer les bureaux"
  const [showFrais, setShowFrais] = useState(false)     // coûts internes (confidentiel)
  const [sel, setSel] = useState(() => new Set())       // ids user cochés (attribution groupée)
  const [bulkBureau, setBulkBureau] = useState('')      // bureau cible de l'attribution groupée
  const [bulkAcces, setBulkAcces] = useState('')        // page cible de l'attribution groupée d'accès

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    ;(async () => {
      const { data: socs } = await supabase.from('societes').select('*').order('code')
      const { data: us } = await supabase.from('collaborateurs').select('*').order('nom_complet', { nullsFirst: false })
      const { data: ts } = await supabase.from('collaborateur_taux').select('*')
      const { data: brx } = await supabase.from('ref_bureaux').select('id,libelle,rue,numero,boite,code_postal,ville,actif').order('libelle')
      const mt = {}
      ;(ts || []).forEach(t => { (mt[t.collaborateur_id] || (mt[t.collaborateur_id] = {}))[t.type_travail] = t.taux })
      setSocietes(socs || []); setUsers(us || []); setTaux(mt); setBureaux(brx || [])
      if (socs?.length) setSelSoc({ ...socs.find(s => s.entite_key) || socs[0] })
      setLoading(false)
    })()
  }, [isAdmin])

  function notify(msg) { setFlash(msg); setTimeout(() => setFlash(null), 2500) }

  async function saveSociete() {
    if (!selSoc) return
    setSaving(true)
    const { id, created_at, ...payload } = selSoc
    const { error } = await supabase.from('societes').update(payload).eq('id', id)
    setSaving(false)
    if (error) { notify('❌ ' + error.message); return }
    setSocietes(prev => prev.map(s => s.id === id ? { ...selSoc } : s))
    await bootstrapConfigs(true)   // rafraîchit les configs devis en direct
    notify('✓ Société enregistrée')
  }

  async function uploadLogo(file) {
    if (!file || !selSoc) return
    setSaving(true)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${(selSoc.code || 'soc').toLowerCase()}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true, contentType: file.type })
    if (error) { setSaving(false); notify('❌ Upload : ' + error.message); return }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    setSelSoc(s => ({ ...s, logo_url: data.publicUrl }))
    setSaving(false)
    notify('✓ Logo chargé — clique « Enregistrer » pour valider')
  }

  // ── Bureaux (adresse complète — devoirs d'information, courriers clients) ──
  async function majBureauChamp(id, champ, val) {
    setBureaux(list => list.map(b => b.id === id ? { ...b, [champ]: val } : b))
  }
  async function saveBureauRow(id) {
    const row = bureaux.find(b => b.id === id)
    if (!row) return
    const { id: _id, ...payload } = row
    const { error } = await supabase.from('ref_bureaux').update(payload).eq('id', id)
    if (error) notify('❌ ' + error.message)
    // Pas besoin de resynchroniser `users` : bureauLabelOf() relit `bureaux` à chaque rendu.
  }
  async function ajouterBureau() {
    const { data, error } = await supabase.from('ref_bureaux').insert({ libelle: 'Nouveau bureau', actif: true }).select().single()
    if (error) { notify('❌ ' + error.message); return }
    setBureaux(list => [...list, data])
  }
  async function supprimerBureau(id) {
    const utilise = users.some(u => u.bureau_id === id)
    if (utilise) { notify('❌ Bureau encore attribué à au moins un utilisateur'); return }
    if (!window.confirm('Retirer ce bureau ?')) return
    const { error } = await supabase.from('ref_bureaux').delete().eq('id', id)
    if (error) { notify('❌ ' + error.message); return }
    setBureaux(list => list.filter(b => b.id !== id))
  }

  async function setBureau(bureauId) {
    if (!selUser?.id) return
    setSaving(true)
    const val = bureauId === '' ? null : Number(bureauId)
    const { error } = await supabase.from('collaborateurs').update({ bureau_id: val }).eq('id', selUser.id)
    setSaving(false)
    if (error) { notify('❌ ' + error.message); return }
    setSelUser(u => ({ ...u, bureau_id: val }))
    setUsers(prev => prev.map(u => u.id === selUser.id ? { ...u, bureau_id: val } : u))
    notify('✓ Bureau attribué')
  }

  const toggleSel = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  async function assignBulk() {
    if (!bulkBureau || !sel.size) return
    const val = Number(bulkBureau)
    const ids = [...sel]
    setSaving(true)
    const { error } = await supabase.from('collaborateurs').update({ bureau_id: val }).in('id', ids)
    setSaving(false)
    if (error) { notify('❌ ' + error.message); return }
    setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, bureau_id: val } : u))
    setSel(new Set()); setBulkBureau('')
    notify(`✓ ${ids.length} collaborateur(s) rattaché(s) au bureau`)
  }

  function pick(u) {
    setSelUser({ ...u, noms_repris_str: (u.noms_repris || []).join(', ') })
    setSelTaux({ ...(taux[u.id] || {}) })
    setShowFrais(false)
  }

  async function saveUser() {
    if (!selUser) return
    const estNouveau = !selUser.id
    const email = (selUser.email || '').trim().toLowerCase()
    const nom = (selUser.nom_complet || '').trim() || email || '(sans nom)'
    if (!email && !nom) { notify('❌ Le nom ou l\'email est obligatoire'); return }
    setSaving(true)

    const { id, created_at, updated_at, _nouveau, noms_repris_str, personne_id, ...rest } = selUser
    const payload = {
      ...rest,
      email: email || null,
      nom_complet: nom,
      numero: (rest.numero === '' || rest.numero == null) ? null : Number(rest.numero),
      frais_annuels: (rest.frais_annuels === '' || rest.frais_annuels == null) ? null : Number(rest.frais_annuels),
      noms_repris: noms_repris_str ? noms_repris_str.split(',').map(s => s.trim()).filter(Boolean) : null,
    }

    // Coordonnées personnelles → table personnes (identité unique, voir docs/DROITS-ACCES.md),
    // dupliquées sur collaborateurs pour ne pas casser les écrans qui les lisent encore directement.
    const champsPersonne = {
      nom_complet: nom, date_naissance: payload.date_naissance || null,
      gsm: payload.gsm || null, gsm_e164: payload.gsm_e164 || null,
      email: email || null, adresse: payload.adresse || null,
      code_postal: payload.code_postal || null, ville: payload.ville || null,
    }

    let cid = id, pid = personne_id
    if (estNouveau) {
      payload.compte_hub_actif = payload.compte_hub_actif ?? false
      payload.est_admin = payload.est_admin || false
      payload.type = payload.type || 'physique'
      payload.actif = payload.actif ?? true
      const { data, error } = await supabase.from('collaborateurs').insert(payload).select().single()
      if (error) { setSaving(false); notify('❌ ' + (error.code === '23505' ? 'Un compte existe déjà avec cet email' : error.message)); return }
      cid = data.id
    } else {
      const { error } = await supabase.from('collaborateurs').update(payload).eq('id', id)
      if (error) { setSaving(false); notify('❌ ' + error.message); return }
    }

    if (pid) {
      await supabase.from('personnes').update(champsPersonne).eq('id', pid)
    } else {
      const { data: np } = await supabase.from('personnes').insert(champsPersonne).select('id').single()
      if (np) { pid = np.id; await supabase.from('collaborateurs').update({ personne_id: pid }).eq('id', cid) }
    }

    // Taux de commission par type de travail
    const trows = TYPES_TRAVAIL.map(t => ({
      collaborateur_id: cid, type_travail: t,
      taux: (selTaux[t] === '' || selTaux[t] == null) ? null : Number(selTaux[t]),
      actif: true,
    }))
    await supabase.from('collaborateur_taux').upsert(trows, { onConflict: 'collaborateur_id,type_travail' })
    setTaux(m => ({ ...m, [cid]: { ...selTaux } }))

    setSaving(false)
    notify('✓ Enregistré')
    const { data: fresh } = await supabase.from('collaborateurs').select('*').eq('id', cid).single()
    if (fresh) {
      setUsers(prev => estNouveau ? [...prev, fresh] : prev.map(u => u.id === cid ? fresh : u))
      pick(fresh)
    }
  }

  async function bulkAccesApply(grant) {
    if (!bulkAcces) { notify('❌ Choisis d\'abord une page'); return }
    const grp = ACCES.find(g => bulkAcces.startsWith(g.pfx + '_'))
    if (!grp) return
    const pageLabel = grp.pages.find(([pg]) => `${grp.pfx}_${pg}` === bulkAcces)?.[1] || bulkAcces
    // Admins exclus : ils ont déjà l'accès total, un flag par page n'a aucun effet pour eux
    const ids = usersFiltres.filter(u => sel.has(u.id) && !u.est_admin).map(u => u.id)
    if (!ids.length) { notify('❌ Aucun utilisateur coché (hors admins)'); return }
    if (!window.confirm(`${grant ? 'Donner' : 'Retirer'} l'accès « ${grp.label} · ${pageLabel} » à ${ids.length} utilisateur(s) ?`)) return
    setSaving(true)
    // Donner : on active aussi la société parente, sinon la page reste inaccessible
    const patch = grant ? { [bulkAcces]: true, [grp.acc]: true } : { [bulkAcces]: false }
    const { error } = await supabase.from('collaborateurs').update(patch).in('id', ids)
    setSaving(false)
    if (error) { notify('❌ ' + error.message); return }
    setUsers(prev => prev.map(u => ids.includes(u.id) ? { ...u, ...patch } : u))
    notify(`✓ Accès ${grant ? 'donné' : 'retiré'} à ${ids.length} utilisateur(s)`)
  }

  async function deleteUser() {
    if (!selUser?.id) { setSelUser(null); return }
    // La fiche collaborateur porte aussi les données métier (code, commissions, portefeuille...) :
    // si elle a un rôle métier ou un code, on coupe seulement l'accès Hub sans supprimer la fiche.
    const aUnRoleMetier = selUser.code || selUser.est_commercial || selUser.est_gestionnaire || selUser.est_sous_agent || selUser.est_apporteur
    if (aUnRoleMetier) {
      if (!window.confirm(`Retirer l'accès au Hub de « ${selUser.nom_complet || selUser.email} » ?\n\nLa fiche (rôle métier, commissions) est conservée ; seule la connexion au Hub est coupée.`)) return
      setSaving(true)
      const { error } = await supabase.from('collaborateurs').update({ compte_hub_actif: false }).eq('id', selUser.id)
      setSaving(false)
      if (error) { notify('❌ ' + error.message); return }
      setUsers(prev => prev.map(u => u.id === selUser.id ? { ...u, compte_hub_actif: false } : u))
      setSelUser(null)
      notify('✓ Accès Hub retiré')
      return
    }
    if (!window.confirm(`Supprimer définitivement le compte « ${selUser.nom_complet || selUser.email} » ?\n\nAction irréversible.`)) return
    setSaving(true)
    const delId = selUser.id
    const { error } = await supabase.from('collaborateurs').delete().eq('id', delId)
    setSaving(false)
    if (error) { notify('❌ ' + error.message); return }
    setUsers(prev => prev.filter(u => u.id !== delId))
    setSel(s => { const n = new Set(s); n.delete(delId); return n })
    setSelUser(null)
    notify('✓ Compte supprimé')
  }

  async function renvoyerAcces() {
    if (!selUser) return
    setSaving(true)
    const now = new Date().toISOString()
    const email = selUser.email
    const nom = selUser.nom_complet || email
    await supabase.from('collaborateurs').update({ date_envoi_acces: now }).eq('id', selUser.id)
    await supabase.from('taches').insert({
      titre: `Suivi 1ère connexion — ${nom}`,
      description: `Accès au Hub envoyés à ${email}. Cette tâche se clôture automatiquement à sa première connexion.`,
      statut: 'todo', priorite: 'moyenne', categorie: 'Onboarding', source: 'acces',
      user_email: email, echeance: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
      gestionnaire: (perms?.code || (perms?.email || '').split('@')[0] || '').toUpperCase(),
    })
    setSelUser(u => ({ ...u, date_envoi_acces: now }))
    setUsers(prev => prev.map(u => u.id === selUser.id ? { ...u, date_envoi_acces: now } : u))
    setSaving(false)
    notify('✓ Accès envoyés — tâche de suivi créée')
    const sujet = encodeURIComponent('Vos accès au Hub DTX')
    const corps = encodeURIComponent(`Bonjour ${selUser.nom_complet || ''},\n\nVotre accès au Hub DTX est activé.\nConnectez-vous ici : ${HUB_URL}\n\nUtilisez le bouton « Se connecter avec Microsoft » avec votre compte professionnel (${email}).\n\nÀ bientôt.`)
    window.open(`mailto:${email}?subject=${sujet}&body=${corps}`)
  }

  if (!isAdmin) return (
    <Layout currentPage="Configuration">
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <h2 style={{ color: '#1e293b' }}>Accès réservé aux administrateurs</h2>
      </div>
    </Layout>
  )

  const bureauLabelOf = u => bureaux.find(b => b.id === u.bureau_id)?.libelle || null
  const usersFiltres = users.filter(u => {
    const q = uSearch.trim().toLowerCase()
    if (q && !((u.nom_complet || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.code || '').toLowerCase().includes(q))) return false
    if (uStatut === 'actifs' && !u.compte_hub_actif) return false
    if (uStatut === 'inactifs' && u.compte_hub_actif) return false
    if (uRole !== 'tous' && (u.est_admin ? 'admin' : 'user') !== uRole) return false
    if (uBureau !== 'tous') {
      if (uBureau === 'sans') { if (u.bureau_id != null) return false }
      else if (String(u.bureau_id) !== uBureau) return false
    }
    if (uSoc !== 'toutes' && !(u.est_admin || u[uSoc])) return false
    if (uModule !== 'tous' && !(u.est_admin || u[uModule])) return false
    return true
  }).sort((a, b) => (a.nom_complet || a.email || '').localeCompare(b.nom_complet || b.email || '', 'fr', { sensitivity: 'base' }))

  const TABS = [['societes', '🏢 Sociétés'], ['documents', '📄 Documents'], ['users', '👥 Utilisateurs & acteurs métier'], ['categories', '🏷️ Catégories compta'], ['categoriesrdv', '📅 Catégories RDV']]

  return (
    <Layout currentPage="Configuration">
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 18, flexWrap: 'wrap' }}>
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              border: 'none', background: 'none', padding: '10px 14px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              color: tab === k ? '#1e293b' : '#94a3b8', borderBottom: tab === k ? '2px solid #1e293b' : '2px solid transparent', marginBottom: -2,
            }}>{l}</button>
          ))}
        </div>

        {flash && <div style={{ position: 'fixed', top: 16, right: 16, background: '#1e293b', color: '#fff', padding: '10px 16px', borderRadius: 10, zIndex: 50, fontWeight: 600 }}>{flash}</div>}
        {loading && <div style={{ color: '#94a3b8', padding: 20 }}>Chargement…</div>}

        {tab === 'categories' && <GestionCategories />}

        {tab === 'categoriesrdv' && <RdvCategoriesPanel />}

        {/* ─────────── SOCIÉTÉS & DOCUMENTS ─────────── */}
        {(tab === 'societes' || tab === 'documents') && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,220px) 1fr', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...societes].sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' })).map(s => (
                <button key={s.id} onClick={() => setSelSoc({ ...s })} style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700,
                  border: selSoc?.id === s.id ? `2px solid ${s.couleur || '#1e293b'}` : '1px solid #e2e8f0',
                  background: selSoc?.id === s.id ? '#f8fafc' : '#fff', color: '#1e293b',
                }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: s.couleur || '#94a3b8', marginRight: 8 }} />
                  {s.nom}{s.entite_key && <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}> · devis</span>}
                </button>
              ))}
            </div>

            {selSoc && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
                {tab === 'societes' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                      {FIELDS_SOC.map(([k, l]) => (
                        <Field key={k} label={l} value={selSoc[k] || ''} onChange={v => setSelSoc(s => ({ ...s, [k]: v }))} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 24, marginTop: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <Lbl>Couleur</Lbl>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="color" value={selSoc.couleur || '#1e293b'} onChange={e => setSelSoc(s => ({ ...s, couleur: e.target.value }))} style={{ width: 44, height: 38, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }} />
                          <input value={selSoc.couleur || ''} onChange={e => setSelSoc(s => ({ ...s, couleur: e.target.value }))} style={inp} />
                        </div>
                      </div>
                      <div>
                        <Lbl>Logo</Lbl>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {selSoc.logo_url && <img src={selSoc.logo_url} alt="" style={{ height: 38, background: '#f1f5f9', borderRadius: 8, padding: 3 }} />}
                          <label style={{ ...btnGhost, cursor: 'pointer' }}>
                            Changer…
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadLogo(e.target.files?.[0])} />
                          </label>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                      <Field label="Délai de paiement (jours)" type="number" value={selSoc.delai_paiement_jours ?? 30} onChange={v => setSelSoc(s => ({ ...s, delai_paiement_jours: v === '' ? null : Number(v) }))} />
                      <Field label="Taux TVA par défaut (%)" type="number" value={selSoc.tva_taux_defaut ?? 21} onChange={v => setSelSoc(s => ({ ...s, tva_taux_defaut: v === '' ? null : Number(v) }))} />
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <Lbl>Conditions générales (une clause par ligne)</Lbl>
                      <textarea value={selSoc.cgv || ''} onChange={e => setSelSoc(s => ({ ...s, cgv: e.target.value }))} rows={10}
                        style={{ ...inp, width: '100%', fontFamily: 'inherit', resize: 'vertical' }} />
                    </div>
                  </>
                )}
                <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={saveSociete} disabled={saving} style={{ ...btn(selSoc.couleur), opacity: saving ? .6 : 1 }}>{saving ? '…' : 'Enregistrer'}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────── UTILISATEURS & ACTEURS MÉTIER ─────────── */}
        {tab === 'users' && !loading && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'center' }}>
              <input value={uSearch} onChange={e => setUSearch(e.target.value)} placeholder="Rechercher (nom, email, code)…" style={{ ...inp, maxWidth: 230 }} />
              <select value={uRole} onChange={e => setURole(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="tous">Rôle : tous</option>
                <option value="admin">Administrateurs</option>
                <option value="user">Utilisateurs</option>
              </select>
              <select value={uStatut} onChange={e => setUStatut(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="tous">Accès Hub : tous</option>
                <option value="actifs">Actifs</option>
                <option value="inactifs">Inactifs / sans accès</option>
              </select>
              <select value={uSoc} onChange={e => setUSoc(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="toutes">Société : toutes</option>
                {ACCES.map(g => <option key={g.acc} value={g.acc}>{g.label}</option>)}
              </select>
              <select value={uBureau} onChange={e => setUBureau(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="tous">Bureau : tous</option>
                {bureaux.map(b => <option key={b.id} value={String(b.id)}>{b.libelle}</option>)}
                <option value="sans">— Sans bureau —</option>
              </select>
              <select value={uModule} onChange={e => setUModule(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="tous">Accès page : tous</option>
                {ACCES.flatMap(g => g.pages.map(([pg, pl]) => <option key={`${g.pfx}_${pg}`} value={`${g.pfx}_${pg}`}>{g.label} · {pl}</option>))}
              </select>
              {(uSearch || uRole !== 'tous' || uStatut !== 'tous' || uSoc !== 'toutes' || uBureau !== 'tous' || uModule !== 'tous') && (
                <button onClick={() => { setUSearch(''); setURole('tous'); setUStatut('tous'); setUSoc('toutes'); setUBureau('tous'); setUModule('tous') }} style={{ ...btnGhost }}>✕ Réinitialiser</button>
              )}
              <button onClick={() => { setSelUser({ _nouveau: true, nom_complet: '', email: '', est_admin: false, compte_hub_actif: false, actif: true, type: 'physique' }); setSelTaux({}) }} style={{ ...btn('#16a34a'), padding: '8px 14px', fontSize: 13 }}>➕ Nouvel utilisateur</button>
              <button onClick={() => setShowBureaux(v => !v)} style={{ ...btnGhost }}>🏢 Gérer les bureaux</button>
              <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>{usersFiltres.length} / {users.length}</span>
            </div>

            {showBureaux && (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 10 }}>
                  Bureaux — adresse complète (devoirs d'information, courriers clients)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 60px 70px 90px 1fr 32px', gap: 8, fontSize: 10.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>
                  <span>Nom</span><span>Rue</span><span>N°</span><span>Bte</span><span>CP</span><span>Ville</span><span></span>
                </div>
                {bureaux.map(b => (
                  <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 60px 70px 90px 1fr 32px', gap: 8, marginBottom: 6 }}>
                    <input style={inp} value={b.libelle || ''} onChange={e => majBureauChamp(b.id, 'libelle', e.target.value)} onBlur={() => saveBureauRow(b.id)} placeholder="Nom du bureau" />
                    <input style={inp} value={b.rue || ''} onChange={e => majBureauChamp(b.id, 'rue', e.target.value)} onBlur={() => saveBureauRow(b.id)} placeholder="Rue" />
                    <input style={inp} value={b.numero || ''} onChange={e => majBureauChamp(b.id, 'numero', e.target.value)} onBlur={() => saveBureauRow(b.id)} placeholder="N°" />
                    <input style={inp} value={b.boite || ''} onChange={e => majBureauChamp(b.id, 'boite', e.target.value)} onBlur={() => saveBureauRow(b.id)} placeholder="Bte" />
                    <input style={inp} value={b.code_postal || ''} onChange={e => majBureauChamp(b.id, 'code_postal', e.target.value)} onBlur={() => saveBureauRow(b.id)} placeholder="CP" />
                    <input style={inp} value={b.ville || ''} onChange={e => majBureauChamp(b.id, 'ville', e.target.value)} onBlur={() => saveBureauRow(b.id)} placeholder="Ville" />
                    <button onClick={() => supprimerBureau(b.id)} title="Retirer" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                ))}
                <button onClick={ajouterBureau} style={{ ...btn('#1e293b'), marginTop: 6, padding: '7px 14px', fontSize: 13 }}>➕ Ajouter un bureau</button>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'center', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0369a1' }}>Attribution groupée d'un accès page</span>
              <select value={bulkAcces} onChange={e => setBulkAcces(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="">— Choisir une page —</option>
                {ACCES.flatMap(g => g.pages.map(([pg, pl]) => <option key={`${g.pfx}_${pg}`} value={`${g.pfx}_${pg}`}>{g.label} · {pl}</option>))}
              </select>
              {bulkAcces && (() => {
                const holders = usersFiltres.filter(u => u[bulkAcces]).length
                const admins = usersFiltres.filter(u => u.est_admin).length
                return <span style={{ fontSize: 12, color: '#0369a1' }}>{holders} ont l'accès{admins ? ` · ${admins} admin(s) accès total` : ''}</span>
              })()}
              <button onClick={() => { if (!bulkAcces) { notify('❌ Choisis d\'abord une page'); return } setSel(new Set(usersFiltres.filter(u => u[bulkAcces]).map(u => u.id))) }} style={{ ...btnGhost }}>Pré-cocher les détenteurs</button>
              <button onClick={() => bulkAccesApply(true)} disabled={saving || !sel.size} style={{ ...btn('#0284c7'), opacity: (saving || !sel.size) ? .5 : 1 }}>✓ Donner aux cochés ({sel.size})</button>
              <button onClick={() => bulkAccesApply(false)} disabled={saving || !sel.size} style={{ ...btnGhost, color: '#dc2626', borderColor: '#fecaca', opacity: (saving || !sel.size) ? .5 : 1 }}>✕ Retirer aux cochés</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Attribution groupée d'un bureau</span>
              <button onClick={() => setSel(new Set(usersFiltres.map(u => u.id)))} style={{ ...btnGhost }}>Tout cocher ({usersFiltres.length})</button>
              {sel.size > 0 && <button onClick={() => setSel(new Set())} style={{ ...btnGhost }}>Décocher</button>}
              <select value={bulkBureau} onChange={e => setBulkBureau(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 220 }}>
                <option value="">Choisir un bureau…</option>
                {bureaux.map(b => <option key={b.id} value={b.id}>{b.libelle}</option>)}
              </select>
              <button onClick={assignBulk} disabled={!bulkBureau || !sel.size || saving} style={{ ...btn('#1e293b'), padding: '8px 16px', fontSize: 14, opacity: (!bulkBureau || !sel.size || saving) ? .5 : 1 }}>Attribuer ({sel.size})</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,280px) 1fr', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '70vh', overflowY: 'auto' }}>
              {usersFiltres.map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={sel.has(u.id)} onChange={() => toggleSel(u.id)} style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                  <button onClick={() => pick(u)} style={{
                    flex: 1, minWidth: 0, textAlign: 'left', padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                    border: selUser?.id === u.id ? '2px solid #1e293b' : '1px solid #e2e8f0',
                    background: selUser?.id === u.id ? '#f8fafc' : '#fff',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{u.nom_complet || u.email || u.code || '(sans nom)'}</span>
                      {u.est_admin && <span style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', borderRadius: 5, padding: '1px 6px' }}>ADMIN</span>}
                      {!u.compte_hub_actif && <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', background: '#f1f5f9', borderRadius: 5, padding: '1px 6px' }}>SANS ACCÈS HUB</span>}
                    </div>
                    {u.email && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{u.email}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                      {u.est_admin
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: '#7c3aed', borderRadius: 5, padding: '2px 7px' }}>Toutes sociétés</span>
                        : ACCES.filter(g => u[g.acc]).map(g => <span key={g.acc} style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: g.couleur, borderRadius: 5, padding: '2px 7px' }}>{g.label}</span>)}
                      {[['est_commercial','Commercial'],['est_gestionnaire','Gestionnaire'],['est_sous_agent','Sous-agent'],['est_apporteur','Apporteur']].filter(([k]) => u[k]).map(([k,l]) => (
                        <span key={k} style={{ fontSize: 10, fontWeight: 700, color: '#475569', background: '#f1f5f9', borderRadius: 5, padding: '2px 7px' }}>{l}</span>
                      ))}
                      {(() => { const bl = bureauLabelOf(u); return bl ? <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', borderRadius: 5, padding: '2px 7px' }}>🏢 {bl}</span> : null })()}
                    </div>
                  </button>
                </div>
              ))}
            </div>

            {selUser ? (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ flex: 1 }} />
                  <button onClick={deleteUser} disabled={saving} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: '1px solid #fecaca', background: '#fff', color: '#dc2626' }}>
                    {selUser.id ? (selUser.code || selUser.est_commercial || selUser.est_gestionnaire || selUser.est_sous_agent || selUser.est_apporteur ? '🗑 Retirer l\'accès Hub' : '🗑 Supprimer le compte') : '✕ Annuler'}
                  </button>
                </div>

                {/* ── Coordonnées ── */}
                <Section titre="Coordonnées">
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 220 }}><Lbl>Nom complet</Lbl><input value={selUser.nom_complet || ''} onChange={e => setSelUser(u => ({ ...u, nom_complet: e.target.value }))} placeholder="Prénom Nom" style={{ ...inp, fontWeight: 700 }} /></div>
                    <div style={{ minWidth: 220 }}><Lbl>Email</Lbl><input value={selUser.email || ''} onChange={e => setSelUser(u => ({ ...u, email: e.target.value }))} placeholder="prenom@dynassur.be" style={inp} /></div>
                  </div>
                  <Grid>
                    <F label="Titre / fonction" value={selUser.titre} onChange={v => setSelUser(u => ({ ...u, titre: v }))} />
                    <F label="GSM" value={selUser.gsm} onChange={v => setSelUser(u => ({ ...u, gsm: v }))} />
                    <F label="Adresse" value={selUser.adresse} onChange={v => setSelUser(u => ({ ...u, adresse: v }))} />
                    <F label="Code postal" value={selUser.code_postal} onChange={v => setSelUser(u => ({ ...u, code_postal: v }))} />
                    <F label="Ville" value={selUser.ville} onChange={v => setSelUser(u => ({ ...u, ville: v }))} />
                    <F label="Date de naissance" type="date" value={selUser.date_naissance} onChange={v => setSelUser(u => ({ ...u, date_naissance: v }))} />
                  </Grid>
                  {!selUser.id && <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 8 }}>Nouveau compte — reconnu au 1ᵉʳ login Microsoft si un email est renseigné</div>}
                </Section>

                {/* ── Rôle métier & commissions ── */}
                <Section titre="Rôle métier & commissions">
                  <BceSearch onSelect={c => {
                    const a = c.address || {}
                    setSelUser(s => ({
                      ...s, type: 'morale',
                      nom_complet: c.denomination_with_legal_form || c.denomination || s.nom_complet,
                      bce: c.cbe_number_formatted || c.cbe_number || s.bce,
                      adresse: a.street ? `${a.street} ${a.street_number || ''}`.trim() : s.adresse,
                      code_postal: a.post_code || s.code_postal, ville: a.city || s.ville,
                    }))
                  }} />
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '12px 0' }}>
                    <Chk label="Commercial" on={!!selUser.est_commercial} onClick={() => setSelUser(s => ({ ...s, est_commercial: !s.est_commercial }))} />
                    <Chk label="Gestionnaire" on={!!selUser.est_gestionnaire} onClick={() => setSelUser(s => ({ ...s, est_gestionnaire: !s.est_gestionnaire }))} />
                    <Chk label="Sous-agent" on={!!selUser.est_sous_agent} onClick={() => setSelUser(s => ({ ...s, est_sous_agent: !s.est_sous_agent }))} />
                    <Chk label="Apporteur" on={!!selUser.est_apporteur} onClick={() => setSelUser(s => ({ ...s, est_apporteur: !s.est_apporteur }))} />
                    <Chk label="Actif (statut métier)" on={selUser.actif !== false} onClick={() => setSelUser(s => ({ ...s, actif: !(s.actif !== false) }))} />
                  </div>
                  {!selUser.est_commercial && !selUser.est_gestionnaire && !selUser.est_sous_agent && !selUser.est_apporteur && (
                    <div style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic', marginBottom: 10 }}>Aucun rôle métier coché — employé sans commission, c'est un état normal.</div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10, marginBottom: 12 }}>
                    {TYPES_TRAVAIL.map(t => (
                      <div key={t}><Lbl>{t}</Lbl>
                        <div style={{ position: 'relative' }}>
                          <input type="number" step="0.01" value={selTaux[t] ?? ''} onChange={e => setSelTaux(m => ({ ...m, [t]: e.target.value }))} style={{ ...inp, paddingRight: 24 }} />
                          <span style={{ position: 'absolute', right: 9, top: 9, color: '#94a3b8', fontSize: 12 }}>%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Grid>
                    <F label="Code" value={selUser.code} onChange={v => setSelUser(s => ({ ...s, code: (v || '').toUpperCase() }))} />
                    <F label="N° producteur" type="number" value={selUser.numero} onChange={v => setSelUser(s => ({ ...s, numero: v }))} />
                    <F label="N° BCE" value={selUser.bce} onChange={v => setSelUser(s => ({ ...s, bce: v }))} />
                    <F label="IBAN" value={selUser.iban} onChange={v => setSelUser(s => ({ ...s, iban: v }))} />
                    <F label="BIC" value={selUser.bic} onChange={v => setSelUser(s => ({ ...s, bic: v }))} />
                  </Grid>
                  <div style={{ marginTop: 10 }}>
                    <Grid>
                      <F label="Nom en donnée SOUS-AGENT (quittances)" value={selUser.nom_sa_data} onChange={v => setSelUser(s => ({ ...s, nom_sa_data: v }))} />
                      <F label="Nom en donnée GESTIONNAIRE (quittances)" value={selUser.nom_gestionnaire_data} onChange={v => setSelUser(s => ({ ...s, nom_gestionnaire_data: v }))} />
                      <F label="Alias / noms repris (séparés par ,)" value={selUser.noms_repris_str} onChange={v => setSelUser(s => ({ ...s, noms_repris_str: v }))} />
                    </Grid>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    {showFrais ? (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ maxWidth: 220 }}>
                          <Lbl>Frais annuels (confidentiel)</Lbl>
                          <input type="number" step="0.01" value={selUser.frais_annuels ?? ''} onChange={e => setSelUser(s => ({ ...s, frais_annuels: e.target.value }))} style={inp} />
                        </div>
                        <button onClick={() => setShowFrais(false)} style={btnGhost}>🙈 Masquer</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowFrais(true)} style={{ ...btnGhost, borderStyle: 'dashed' }}>👁 Afficher les coûts internes</button>
                    )}
                  </div>
                </Section>

                {/* ── Accès au Hub ── */}
                <Section titre="Accès au Hub">
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'flex', gap: 6, alignItems: 'center' }}>
                      Rôle
                      <select value={selUser.est_admin ? 'admin' : 'user'} onChange={e => setSelUser(u => ({ ...u, est_admin: e.target.value === 'admin' }))} style={{ ...inp, padding: '6px 8px' }}>
                        <option value="user">Utilisateur</option>
                        <option value="admin">Administrateur du Hub (toutes sociétés)</option>
                      </select>
                    </label>
                    <Toggle label="Connexion au Hub active" on={!!selUser.compte_hub_actif} onClick={() => setSelUser(u => ({ ...u, compte_hub_actif: !u.compte_hub_actif }))} />
                    <Toggle label="Employé" on={!!selUser.est_employe} onClick={() => setSelUser(u => ({ ...u, est_employe: !u.est_employe }))} />
                  </div>

                  {selUser.id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                      <button onClick={renvoyerAcces} disabled={saving} style={{ ...btn('#0080BD'), padding: '8px 14px', fontSize: 13 }}>📧 {selUser.date_envoi_acces ? 'Renvoyer' : 'Envoyer'} les accès</button>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>
                        {selUser.date_envoi_acces ? `Accès envoyés le ${new Date(selUser.date_envoi_acces).toLocaleDateString('fr-BE')}` : 'Accès jamais envoyés'}
                        {selUser.premiere_connexion ? ` · 1ʳᵉ connexion le ${new Date(selUser.premiere_connexion).toLocaleDateString('fr-BE')}` : ' · pas encore connecté'}
                      </span>
                    </div>
                  )}

                  {selUser.est_admin ? (
                    <div style={{ background: '#f5f3ff', color: '#6d28d9', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                      Administrateur du Hub : accès à toutes les sociétés, tous les modules. La grille ci-dessous est sans effet.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
                      {ACCES.map(grp => {
                        const estAdminSoc = grp.pages.length > 0 && grp.pages.every(([pg]) => selUser[`${grp.pfx}_${pg}`])
                        return (
                        <div key={grp.acc} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                          <div style={{ background: grp.couleur, color: '#fff', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700 }}>{grp.label}{estAdminSoc ? ' — Admin' : ''}</span>
                            <Toggle label="" on={!!selUser[grp.acc]} light onClick={() => setSelUser(u => ({ ...u, [grp.acc]: !u[grp.acc] }))} />
                          </div>
                          {grp.pages.length > 0 && (
                            <div style={{ padding: '6px 10px', opacity: selUser[grp.acc] ? 1 : .45, pointerEvents: selUser[grp.acc] ? 'auto' : 'none' }}>
                              <button
                                onClick={() => {
                                  const toutCoche = grp.pages.every(([pg]) => selUser[`${grp.pfx}_${pg}`])
                                  setSelUser(u => {
                                    const n = { ...u }
                                    grp.pages.forEach(([pg]) => { n[`${grp.pfx}_${pg}`] = !toutCoche })
                                    return n
                                  })
                                }}
                                style={{ fontSize: 10.5, color: grp.couleur, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '2px 0 6px', textAlign: 'left' }}
                                title="Tout cocher = administrateur de cette société"
                              >{estAdminSoc ? '✕ Décocher tout' : '✓ Tout cocher (admin société)'}</button>
                              {[...grp.pages].sort((a, b) => (a[0] === 'dashboard') !== (b[0] === 'dashboard') ? (a[0] === 'dashboard' ? -1 : 1) : a[1].localeCompare(b[1], 'fr', { sensitivity: 'base' })).map(([pg, plabel]) => {
                                const col = `${grp.pfx}_${pg}`
                                return <Toggle key={col} label={plabel} on={!!selUser[col]} small onClick={() => setSelUser(u => ({ ...u, [col]: !u[col] }))} />
                              })}
                              {grp.acc === 'acc_dynassur' && (
                                <div style={{ borderTop: '1px dashed #e2e8f0', marginTop: 6, paddingTop: 6 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Portefeuille clients</div>
                                  <label style={{ display: 'block', marginBottom: 6 }}>
                                    <Lbl>Bureau</Lbl>
                                    <select value={selUser.bureau_id ?? ''} onChange={e => setBureau(e.target.value)} style={{ ...inp, padding: '6px 8px' }} disabled={!selUser.id}>
                                      <option value="">— Aucun —</option>
                                      {bureaux.map(b => <option key={b.id} value={b.id}>{b.libelle}</option>)}
                                    </select>
                                  </label>
                                  <Toggle label="Voir tout le portefeuille (ignore le bureau)" on={!!selUser.voit_tout_portefeuille} small onClick={() => setSelUser(u => ({ ...u, voit_tout_portefeuille: !u.voit_tout_portefeuille }))} />
                                  <div style={{ borderTop: '1px dashed #e2e8f0', marginTop: 6, paddingTop: 6 }}>
                                    <Toggle label="Voir les commissions" on={!!selUser.voir_commissions} small onClick={() => setSelUser(u => ({ ...u, voir_commissions: !u.voir_commissions }))} />
                                  </div>
                                </div>
                              )}
                              {(grp.acc === 'acc_lode' || grp.acc === 'acc_dtx' || grp.acc === 'acc_hexagroup') && (
                                <div style={{ borderTop: '1px dashed #e2e8f0', marginTop: 6, paddingTop: 6, fontSize: 10.5, color: '#94a3b8' }}>Pas de portefeuille par bureau — un seul portefeuille pour {grp.label}.</div>
                              )}
                            </div>
                          )}
                        </div>
                      )})}
                    </div>
                  )}
                </Section>

                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                  <button onClick={saveUser} disabled={saving} style={{ ...btn('#1e293b'), padding: '10px 20px', fontSize: 14, opacity: saving ? .6 : 1 }}>{saving ? '…' : (selUser.id ? '💾 Enregistrer' : '➕ Créer')}</button>
                </div>
              </div>
            ) : <div style={{ color: '#94a3b8', padding: 20 }}>Sélectionne un utilisateur.</div>}
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, fontSize: 12 }}><Link to="/" style={{ color: '#64748b' }}>← Retour au Hub</Link></div>
      </div>
    </Layout>
  )
}

// ─────────── petits composants ───────────
const inp = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', width: '100%', boxSizing: 'border-box' }
const btnGhost = { padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }
const btn = c => ({ padding: '11px 22px', border: 'none', borderRadius: 10, background: c || '#1e293b', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' })

function Section({ titre, children }) {
  return <div style={{ marginBottom: 20 }}>
    <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.03em' }}>{titre}</div>
    {children}
  </div>
}
function Grid({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>{children}</div> }
function Lbl({ children }) { return <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>{children}</div> }
function F({ label, value, onChange, type = 'text' }) { return <div><Lbl>{label}</Lbl><input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} style={inp} /></div> }
function Field({ label, value, onChange, type = 'text' }) {
  return <div><Lbl>{label}</Lbl><input type={type} value={value} onChange={e => onChange(e.target.value)} style={inp} /></div>
}
function Chk({ label, on, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? '#16a34a' : '#cbd5e1', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>{label}</span>
    </button>
  )
}
function Toggle({ label, on, onClick, small, light }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, width: label ? '100%' : 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: small ? '4px 0' : 0, textAlign: 'left' }}>
      <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? (light ? 'rgba(255,255,255,.9)' : '#16a34a') : (light ? 'rgba(255,255,255,.35)' : '#cbd5e1'), position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: light && on ? '#16a34a' : '#fff', transition: 'left .15s' }} />
      </span>
      {label && <span style={{ fontSize: small ? 13 : 14, fontWeight: 600, color: light ? '#fff' : '#475569' }}>{label}</span>}
    </button>
  )
}
