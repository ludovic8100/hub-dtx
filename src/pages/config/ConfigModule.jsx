import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { bootstrapConfigs } from '../../lib/bootstrapConfigs'

// ─── Définition des accès par société (colonnes réelles de user_permissions) ───
const ACCES = [
  { acc: 'acc_dynassur', label: 'Dynassur', pfx: 'dyn',  couleur: '#0080BD',
    pages: [['dashboard', 'Tableau de bord'], ['taches', 'Tâches'], ['clients', 'Clients'], ['production', 'Production'], ['bordereaux', 'Bordereaux'], ['chiffres', 'Chiffres'], ['objectifs', 'Objectifs'], ['compagnies', 'Compagnies'], ['sinistres', 'Sinistres'], ['rdv', 'RDV / Agenda'], ['appels', 'Appels'], ['rentabilite', 'Rentabilité'], ['banque', 'Banque'], ['comptabilite', 'Comptabilité'], ['devis', 'Devis & Factures'], ['notesfrais', 'Notes de frais']] },
  { acc: 'acc_dtx', label: 'DTX', pfx: 'dtx', couleur: '#1B3A6B',
    pages: [['dashboard', 'Tableau de bord'], ['taches', 'Tâches'], ['immobilier', 'Immobilier'], ['vehicules', 'Véhicules'], ['trading', 'Trading'], ['comptabilite', 'Comptabilité'], ['devis', 'Devis & Factures'], ['notesfrais', 'Notes de frais']] },
  { acc: 'acc_lode', label: 'LODE', pfx: 'lode', couleur: '#F97316',
    pages: [['dashboard', 'Tableau de bord'], ['taches', 'Tâches'], ['clients', 'Clients'], ['banque', 'Banque'], ['comptabilite', 'Comptabilité'], ['devis', 'Devis & Factures'], ['notesfrais', 'Notes de frais']] },
  { acc: 'acc_hexagroup', label: 'Hexagroup', pfx: 'hex', couleur: '#ec4899',
    pages: [['dashboard', 'Tableau de bord'], ['taches', 'Tâches'], ['banque', 'Banque'], ['comptabilite', 'Comptabilité'], ['notesfrais', 'Notes de frais']] },
  { acc: 'acc_prive', label: 'Privé', pfx: 'prive', couleur: '#22c55e',
    pages: [['dashboard', 'Tableau de bord'], ['taches', 'Tâches'], ['banque', 'Banque'], ['comptabilite', 'Comptabilité'], ['notesfrais', 'Notes de frais']] },
  { acc: 'acc_holding', label: 'Groupe (consolidé)', pfx: 'grp', couleur: '#7c3aed', pages: [['taches', 'Tâches'], ['notesfrais', 'Notes de frais']] },
]

const FIELDS_SOC = [
  ['nom', 'Dénomination'], ['activite', 'Activité'], ['forme_juridique', 'Forme juridique'],
  ['bce', 'N° BCE'], ['tva', 'N° TVA'], ['fsma', 'N° FSMA'],
  ['adresse', 'Adresse (rue + n°)'], ['cp', 'Code postal'], ['ville', 'Ville'], ['pays', 'Pays'],
  ['iban_principal', 'IBAN'], ['bic', 'BIC'], ['telephone', 'Téléphone'],
  ['email_expediteur', 'Email expéditeur (devis)'], ['email_cc', 'Email en copie (CC)'],
]

export default function ConfigModule() {
  const { isAdmin, perms } = useAuth()
  const [tab, setTab] = useState('societes')
  const [societes, setSocietes] = useState([])
  const [users, setUsers] = useState([])
  const [selSoc, setSelSoc] = useState(null)   // form société courant
  const [selUser, setSelUser] = useState(null) // form user courant
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uSearch, setUSearch] = useState('')
  const [uStatut, setUStatut] = useState('tous')
  const [uSoc, setUSoc] = useState('toutes')
  const [uModule, setUModule] = useState('tous')
  const [bureaux, setBureaux] = useState([])            // ref_bureaux (adresses)
  const [collabBureau, setCollabBureau] = useState({})  // code collaborateur -> bureau_id
  const [sel, setSel] = useState(() => new Set())       // ids user cochés (attribution groupée)
  const [bulkBureau, setBulkBureau] = useState('')      // bureau cible de l'attribution groupée

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    ;(async () => {
      const { data: socs } = await supabase.from('societes').select('*').order('code')
      const { data: us } = await supabase.from('user_permissions').select('*').order('nom', { nullsFirst: false })
      setSocietes(socs || []); setUsers(us || [])
      const { data: brx } = await supabase.from('ref_bureaux').select('id,libelle,actif').eq('actif', true).order('libelle')
      const { data: cbs } = await supabase.from('collaborateurs').select('code,bureau_id')
      setBureaux(brx || [])
      const mB = {}; (cbs || []).forEach(c => { if (c.code) mB[c.code.toUpperCase()] = c.bureau_id }); setCollabBureau(mB)
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

  const userCodeOf = u => (u?.collab_code || (u?.user_email || '').split('@')[0] || '').toUpperCase()
  async function setBureau(bureauId) {
    if (!selUser) return
    const code = userCodeOf(selUser)
    if (!code || !(code in collabBureau)) { notify('❌ Aucun collaborateur lié au code ' + (code || '?')); return }
    setSaving(true)
    const val = bureauId === '' ? null : Number(bureauId)
    const { error } = await supabase.from('collaborateurs').update({ bureau_id: val }).eq('code', code)
    setSaving(false)
    if (error) { notify('❌ ' + error.message); return }
    setCollabBureau(m => ({ ...m, [code]: val }))
    notify('✓ Bureau attribué')
  }

  const toggleSel = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  async function assignBulk() {
    if (!bulkBureau || !sel.size) return
    const val = Number(bulkBureau)
    const codes = [...new Set(users.filter(u => sel.has(u.id)).map(u => userCodeOf(u)).filter(c => c && (c in collabBureau)))]
    if (!codes.length) { notify('❌ Aucun collaborateur lié aux utilisateurs cochés'); return }
    setSaving(true)
    const { error } = await supabase.from('collaborateurs').update({ bureau_id: val }).in('code', codes)
    setSaving(false)
    if (error) { notify('❌ ' + error.message); return }
    setCollabBureau(m => { const n = { ...m }; codes.forEach(c => { n[c] = val }); return n })
    setSel(new Set()); setBulkBureau('')
    notify(`✓ ${codes.length} collaborateur(s) rattaché(s) au bureau`)
  }

  async function saveUser() {
    if (!selUser) return
    setSaving(true)
    const { id, created_at, updated_at, ...payload } = selUser
    const { error } = await supabase.from('user_permissions').update(payload).eq('id', id)
    setSaving(false)
    if (error) { notify('❌ ' + error.message); return }
    setUsers(prev => prev.map(u => u.id === id ? { ...selUser } : u))
    notify('✓ Utilisateur enregistré')
  }

  async function renvoyerAcces() {
    if (!selUser) return
    setSaving(true)
    const now = new Date().toISOString()
    const email = selUser.user_email
    const nom = selUser.nom || email
    await supabase.from('user_permissions').update({ date_envoi_acces: now }).eq('id', selUser.id)
    await supabase.from('taches').insert({
      titre: `Suivi 1ère connexion — ${nom}`,
      description: `Accès au Hub envoyés à ${email}. Cette tâche se clôture automatiquement à sa première connexion.`,
      statut: 'todo', priorite: 'moyenne', categorie: 'Onboarding', source: 'acces',
      user_email: email, echeance: new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10),
      gestionnaire: (perms?.code || (perms?.user_email || '').split('@')[0] || '').toUpperCase(),
    })
    setSelUser(u => ({ ...u, date_envoi_acces: now }))
    setUsers(prev => prev.map(u => u.id === selUser.id ? { ...u, date_envoi_acces: now } : u))
    setSaving(false)
    notify('✓ Accès envoyés — tâche de suivi créée')
    const sujet = encodeURIComponent('Vos accès au Hub DTX')
    const corps = encodeURIComponent(`Bonjour ${selUser.nom || ''},\n\nVotre accès au Hub DTX est activé.\nConnectez-vous ici : https://hub-dtx.vercel.app\n\nUtilisez le bouton « Se connecter avec Microsoft » avec votre compte professionnel (${email}).\n\nÀ bientôt.`)
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

  const usersFiltres = users.filter(u => {
    const q = uSearch.trim().toLowerCase()
    if (q && !((u.nom || '').toLowerCase().includes(q) || (u.user_email || '').toLowerCase().includes(q))) return false
    if (uStatut === 'actifs' && !u.actif) return false
    if (uStatut === 'inactifs' && u.actif) return false
    if (uSoc !== 'toutes' && !(u.role === 'admin' || u[uSoc])) return false
    if (uModule !== 'tous' && !(u.role === 'admin' || u[uModule])) return false
    return true
  }).sort((a, b) => (a.nom || a.user_email || '').localeCompare(b.nom || b.user_email || '', 'fr', { sensitivity: 'base' }))

  const TABS = [['societes', '🏢 Sociétés'], ['documents', '📄 Documents'], ['users', '👥 Utilisateurs & accès']]

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

        {/* ─────────── UTILISATEURS & ACCÈS ─────────── */}
        {tab === 'users' && !loading && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, alignItems: 'center' }}>
              <input value={uSearch} onChange={e => setUSearch(e.target.value)} placeholder="Rechercher (nom ou email)…" style={{ ...inp, maxWidth: 260 }} />
              <select value={uStatut} onChange={e => setUStatut(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="tous">Statut : tous</option>
                <option value="actifs">Actifs</option>
                <option value="inactifs">Inactifs</option>
              </select>
              <select value={uSoc} onChange={e => setUSoc(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="toutes">Société : toutes</option>
                {ACCES.map(g => <option key={g.acc} value={g.acc}>{g.label}</option>)}
              </select>
              <select value={uModule} onChange={e => setUModule(e.target.value)} style={{ ...inp, width: 'auto' }}>
                <option value="tous">Module : tous</option>
                {ACCES.flatMap(g => g.pages.map(([pg, pl]) => <option key={`${g.pfx}_${pg}`} value={`${g.pfx}_${pg}`}>{g.label} · {pl}</option>))}
              </select>
              <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>{usersFiltres.length} / {users.length}</span>
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
                  <button onClick={() => setSelUser({ ...u })} style={{
                    flex: 1, minWidth: 0, textAlign: 'left', padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                    border: selUser?.id === u.id ? '2px solid #1e293b' : '1px solid #e2e8f0',
                    background: selUser?.id === u.id ? '#f8fafc' : '#fff',
                  }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{u.nom || u.user_email}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.user_email}
                      {u.role === 'admin' && <span style={{ color: '#7c3aed', fontWeight: 700 }}> · admin</span>}
                      {!u.actif && <span style={{ color: '#dc2626', fontWeight: 700 }}> · inactif</span>}
                    </div>
                  </button>
                </div>
              ))}
            </div>

            {selUser ? (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#1e293b' }}>{selUser.nom || selUser.user_email}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{selUser.user_email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'flex', gap: 6, alignItems: 'center' }}>
                      Rôle
                      <select value={selUser.role || 'user'} onChange={e => setSelUser(u => ({ ...u, role: e.target.value }))} style={{ ...inp, padding: '6px 8px' }}>
                        <option value="user">Utilisateur</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </label>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'flex', gap: 6, alignItems: 'center' }}>
                      Bureau
                      {(() => {
                        const code = userCodeOf(selUser)
                        return (code in collabBureau)
                          ? <select value={collabBureau[code] ?? ''} onChange={e => setBureau(e.target.value)} style={{ ...inp, padding: '6px 8px', minWidth: 210 }}>
                              <option value="">— Aucun —</option>
                              {bureaux.map(b => <option key={b.id} value={b.id}>{b.libelle}</option>)}
                            </select>
                          : <span style={{ fontSize: 12, color: '#94a3b8' }}>aucun collaborateur (code {code || '?'})</span>
                      })()}
                    </label>
                    <Toggle label="Actif" on={!!selUser.actif} onClick={() => setSelUser(u => ({ ...u, actif: !u.actif }))} />
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button onClick={saveUser} disabled={saving} style={{ ...btn('#1e293b'), padding: '9px 18px', fontSize: 14, opacity: saving ? .6 : 1 }}>{saving ? '…' : '💾 Enregistrer'}</button>
                  <button onClick={renvoyerAcces} disabled={saving} style={{ ...btn('#0080BD'), padding: '9px 16px', fontSize: 14, opacity: saving ? .6 : 1 }}>📧 {selUser.date_envoi_acces ? 'Renvoyer' : 'Envoyer'} les accès</button>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {selUser.date_envoi_acces ? `Accès envoyés le ${new Date(selUser.date_envoi_acces).toLocaleDateString('fr-BE')}` : 'Accès jamais envoyés'}
                    {selUser.premiere_connexion ? ` · 1ʳᵉ connexion le ${new Date(selUser.premiere_connexion).toLocaleDateString('fr-BE')}` : ' · pas encore connecté'}
                  </span>
                </div>

                {selUser.role === 'admin' && (
                  <div style={{ marginTop: 14, background: '#f5f3ff', color: '#6d28d9', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                    Les administrateurs ont accès à toutes les sociétés et toutes les pages — les cases ci-dessous sont alors sans effet.
                  </div>
                )}

                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
                  {ACCES.map(grp => (
                    <div key={grp.acc} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ background: grp.couleur, color: '#fff', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700 }}>{grp.label}</span>
                        <Toggle label="" on={!!selUser[grp.acc]} light onClick={() => setSelUser(u => ({ ...u, [grp.acc]: !u[grp.acc] }))} />
                      </div>
                      {grp.pages.length > 0 && (
                        <div style={{ padding: '6px 10px', opacity: selUser[grp.acc] ? 1 : .45, pointerEvents: selUser[grp.acc] ? 'auto' : 'none' }}>
                          {[...grp.pages].sort((a, b) => (a[0] === 'dashboard') !== (b[0] === 'dashboard') ? (a[0] === 'dashboard' ? -1 : 1) : a[1].localeCompare(b[1], 'fr', { sensitivity: 'base' })).map(([pg, plabel]) => {
                            const col = `${grp.pfx}_${pg}`
                            return <Toggle key={col} label={plabel} on={!!selUser[col]} small onClick={() => setSelUser(u => ({ ...u, [col]: !u[col] }))} />
                          })}
                          {grp.acc === 'acc_dynassur' && (
                            <div style={{ borderTop: '1px dashed #e2e8f0', marginTop: 6, paddingTop: 6 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Permissions</div>
                              <Toggle label="Voir les commissions" on={!!selUser.voir_commissions} small onClick={() => setSelUser(u => ({ ...u, voir_commissions: !u.voir_commissions }))} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
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
const btnGhost = { padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, color: '#475569' }
const btn = c => ({ padding: '11px 22px', border: 'none', borderRadius: 10, background: c || '#1e293b', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' })

function Lbl({ children }) { return <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>{children}</div> }
function Field({ label, value, onChange, type = 'text' }) {
  return <div><Lbl>{label}</Lbl><input type={type} value={value} onChange={e => onChange(e.target.value)} style={inp} /></div>
}
function Toggle({ label, on, onClick, small, light }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: small ? '4px 0' : 0, textAlign: 'left' }}>
      <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? (light ? 'rgba(255,255,255,.9)' : '#16a34a') : (light ? 'rgba(255,255,255,.35)' : '#cbd5e1'), position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: light && on ? '#16a34a' : '#fff', transition: 'left .15s' }} />
      </span>
      {label && <span style={{ fontSize: small ? 13 : 14, fontWeight: 600, color: light ? '#fff' : '#475569' }}>{label}</span>}
    </button>
  )
}
