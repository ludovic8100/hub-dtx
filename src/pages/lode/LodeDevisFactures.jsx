import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { LODE, TVA_TAUX, CGV, DELAI_PAIEMENT_JOURS } from '../../lib/lodeConfig'
import { I18N, CGV_I18N, LANGUES } from '../../lib/lodeI18n'
import { StatBanner, TabsBar, StatusBadge, ActionButton, DataCard, PrimaryButton, useMobile } from '../../components/ui/AccountableUI'
import { extraireDevis } from '../../lib/devisExtraction'

const ORANGE = LODE.couleur
const NAVY = '#1e293b'

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
  // les lignes marquées "optionnelle" (option au choix) ne sont pas additionnées au total
  const lignes = (lignesToutes || []).filter(l => !l.optionnelle)
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
  brouillon: { bg: '#f1f5f9', col: '#64748b', label: 'Brouillon' },
  'envoyé':  { bg: '#dbeafe', col: '#2563eb', label: 'Envoyé' },
  'accepté': { bg: '#dcfce7', col: '#16a34a', label: 'Accepté' },
  'refusé':  { bg: '#fee2e2', col: '#dc2626', label: 'Refusé' },
  'expiré':  { bg: '#fef3c7', col: '#92400e', label: 'Expiré' },
}
const STATUTS_FACT = {
  brouillon: { bg: '#f1f5f9', col: '#64748b', label: 'Brouillon' },
  'envoyée': { bg: '#dbeafe', col: '#2563eb', label: 'Envoyée' },
  'payée':   { bg: '#dcfce7', col: '#16a34a', label: 'Payée' },
  'partiellement payée': { bg: '#fef3c7', col: '#92400e', label: 'Partielle' },
  'en retard': { bg: '#fee2e2', col: '#dc2626', label: 'En retard' },
  'annulée': { bg: '#f1f5f9', col: '#94a3b8', label: 'Annulée' },
}

// ════════════════════════════════════════════════════════════════
//  ÉDITEUR (devis ou facture)
// ════════════════════════════════════════════════════════════════
function Editeur({ type, doc, onClose, onSaved }) {
  const isDevis = type === 'devis'
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
    statut: 'brouillon', langue: 'fr', ...(doc || {}),
  })
  const [lignes, setLignes] = useState([{ titre: '', descriptif: '', description: '', quantite: 1, prix_unitaire: 0, remise_pct: 0, tva_pct: 21, photos: [] }])
  const [afficherTVAC, setAfficherTVAC] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importPDF, setImportPDF] = useState({ loading: false, msg: '', drag: false })

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

  const labelClient = (c) => {
    const nom = c.denomination || (((c.prenom || '') + ' ' + (c.nom || '')).trim()) || '(sans nom)'
    const icon = c.type === 'entreprise' ? '\u{1F3E2}' : '\u{1F464}'
    const sub = [c.dossier ? '#' + c.dossier : '', c.ville || c.localite || '', c.email || ''].filter(Boolean).join(' \u00B7 ')
    return { icon, nom, sub }
  }

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

  useEffect(() => {
    if (doc?.id) {
      supabase.from(tableLignes).select('*').eq(fk, doc.id).order('position')
        .then(({ data }) => { if (data?.length) setLignes(data.map(l => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [], titre: l.titre || l.description || '', descriptif: l.descriptif || '' }))) })
    }
  }, [doc])

  const tot = calcTotaux(lignes, f.remise_pct)
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
  const addLigne = () => setLignes(p => [...p, { titre: '', descriptif: '', description: '', quantite: 1, prix_unitaire: 0, remise_pct: 0, tva_pct: 21, photos: [] }])
  const delLigne = i => setLignes(p => p.filter((_, j) => j !== i))

  const save = async () => {
    if (!f.client_nom.trim()) { alert('Le nom du client est obligatoire'); return }
    setSaving(true)
    try {
      let docId = doc?.id
      const payload = {
        client_nom: f.client_nom, client_adresse: f.client_adresse, client_cp: f.client_cp,
        client_ville: f.client_ville, client_email: f.client_email, client_telephone: f.client_telephone,
        client_tva: f.client_tva, objet: f.objet, notes: f.notes,
        remise_pct: Number(f.remise_pct) || 0, statut: f.statut, langue: f.langue || 'fr',
        total_ht: tot.ht, total_tva: tot.tva, total_ttc: tot.ttc,
      }
      if (isDevis) { payload.date_devis = f.date_devis; payload.date_validite = f.date_validite }
      else { payload.date_facture = f.date_facture; payload.date_echeance = f.date_echeance; if (f.devis_id) payload.devis_id = f.devis_id }

      if (docId) {
        await supabase.from(table).update(payload).eq('id', docId)
        await supabase.from(tableLignes).delete().eq(fk, docId)
      } else {
        const { data: num } = await supabase.rpc('next_lode_numero', { p_type: type })
        payload.numero = num
        const { data, error } = await supabase.from(table).insert(payload).select('id').single()
        if (error) throw error
        docId = data.id
      }
      const lignesPayload = lignes.filter(l => (l.titre || '').trim() || (l.description || '').trim() || (l.descriptif || '').trim()).map((l, i) => ({
        [fk]: docId, position: i,
        titre: l.titre || '', descriptif: l.descriptif || '',
        description: l.description || l.titre || '',
        photos: l.photos || [], optionnelle: !!l.optionnelle,
        quantite: Number(l.quantite) || 0, prix_unitaire: Number(l.prix_unitaire) || 0,
        remise_pct: Number(l.remise_pct) || 0, tva_pct: Number(l.tva_pct) || 0,
        total_ht: (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100),
      }))
      if (lignesPayload.length) {
        const { error: errLignes } = await supabase.from(tableLignes).insert(lignesPayload)
        if (errLignes) throw new Error('Enregistrement des lignes : ' + errLignes.message)
      }
      onSaved()
    } catch (e) {
      alert('Erreur : ' + e.message)
    } finally { setSaving(false) }
  }

  const inp = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const lbl = { fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 3, display: 'block' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: mobE ? 8 : 20, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 880, width: '100%', padding: mobE ? 16 : 24, fontFamily: "'Source Sans Pro', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>
            {doc?.id ? 'Modifier' : 'Nouveau'} {isDevis ? 'devis' : 'facture'} {doc?.numero ? `· ${doc.numero}` : ''}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>

        {/* Client */}
        <div style={{ fontSize: 13, fontWeight: 800, color: ORANGE, marginBottom: 8 }}>Client</div>
        <div style={{ marginBottom: 10, position: 'relative' }}>
          <label style={lbl}>Rechercher un client encodé (nom, prénom, dossier, ville, email, TVA…)</label>
          <input style={inp} value={clientQuery} placeholder="Tapez au moins 2 caractères — ou saisie manuelle ci-dessous" onChange={e => setClientQuery(e.target.value)} />
          {clientQuery.trim().length >= 2 && (
            <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 4, maxHeight: 280, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
              {searching && <div style={{ padding: 10, fontSize: 13, color: '#64748b' }}>Recherche…</div>}
              {!searching && clientResults.length === 0 && <div style={{ padding: 10, fontSize: 13, color: '#64748b' }}>Aucun client trouvé</div>}
              {clientResults.map(c => {
                const L = labelClient(c)
                return (
                  <div key={c.id} onClick={() => choisirClient(c)} style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{L.icon} {L.nom}</div>
                    {L.sub && <div style={{ fontSize: 11, color: '#64748b' }}>{L.sub}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobE ? '1fr' : '2fr 1fr', gap: 10, marginBottom: 8 }}>
          <div><label style={lbl}>Nom / société *</label><input style={inp} value={f.client_nom} onChange={e => set('client_nom', e.target.value)} /></div>
          <div><label style={lbl}>N° TVA</label><input style={inp} value={f.client_tva} onChange={e => set('client_tva', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobE ? '1fr' : '2fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
          <div><label style={lbl}>Adresse</label><input style={inp} value={f.client_adresse} onChange={e => set('client_adresse', e.target.value)} /></div>
          <div><label style={lbl}>Code postal</label><input style={inp} value={f.client_cp} onChange={e => set('client_cp', e.target.value)} /></div>
          <div><label style={lbl}>Ville</label><input style={inp} value={f.client_ville} onChange={e => set('client_ville', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobE ? '1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div><label style={lbl}>Email</label><input style={inp} value={f.client_email} onChange={e => set('client_email', e.target.value)} /></div>
          <div><label style={lbl}>Téléphone</label><input style={inp} value={f.client_telephone} onChange={e => set('client_telephone', e.target.value)} /></div>
          <div><label style={lbl}>Pays</label><input style={inp} value={f.client_pays || ''} onChange={e => set('client_pays', e.target.value)} /></div>
        </div>

        {/* Objet + dates */}
        <div style={{ display: 'grid', gridTemplateColumns: mobE ? '1fr' : '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div><label style={lbl}>Objet</label><input style={inp} value={f.objet} onChange={e => set('objet', e.target.value)} placeholder="ex: Installation porte sectionnelle" /></div>
          {isDevis ? <>
            <div><label style={lbl}>Date devis</label><input type="date" style={inp} value={f.date_devis} onChange={e => set('date_devis', e.target.value)} /></div>
            <div><label style={lbl}>Validité jusqu'au</label><input type="date" style={inp} value={f.date_validite} onChange={e => set('date_validite', e.target.value)} /></div>
          </> : <>
            <div><label style={lbl}>Date facture</label><input type="date" style={inp} value={f.date_facture} onChange={e => set('date_facture', e.target.value)} /></div>
            <div><label style={lbl}>Échéance</label><input type="date" style={inp} value={f.date_echeance} onChange={e => set('date_echeance', e.target.value)} /></div>
          </>}
        </div>

        {/* Import PDF fournisseur (glisser-déposer) */}
        <div
          onDragOver={e => { e.preventDefault(); setImportPDF(p => ({ ...p, drag: true })) }}
          onDragLeave={e => { e.preventDefault(); setImportPDF(p => ({ ...p, drag: false })) }}
          onDrop={e => { e.preventDefault(); const fs = [...e.dataTransfer.files].filter(x => x.type === 'application/pdf'); if (fs.length) importerPDFs(fs) }}
          style={{ border: `2px dashed ${importPDF.drag ? ORANGE : '#cbd5e1'}`, background: importPDF.drag ? '#FFF7ED' : '#fafafa', borderRadius: 10, padding: '14px 16px', marginBottom: 14, textAlign: 'center', transition: 'all .15s' }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>📄 Importer un devis fournisseur (SDA / Marquise)</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Glissez vos PDF ici, ou cliquez pour parcourir — les lignes seront pré-remplies</div>
          <label style={{ display: 'inline-block', background: '#fff', border: `1px solid ${ORANGE}`, color: ORANGE, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {importPDF.loading ? 'Lecture en cours…' : 'Parcourir…'}
            <input type="file" accept="application/pdf" multiple style={{ display: 'none' }} onChange={e => { const fs = [...e.target.files]; if (fs.length) importerPDFs(fs); e.target.value = '' }} />
          </label>
          {importPDF.msg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: importPDF.msg.startsWith('✓') ? '#16a34a' : importPDF.msg.startsWith('⚠') ? '#b45309' : '#dc2626' }}>{importPDF.msg}</div>}
        </div>

        {/* Lignes */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>Lignes</div>
          <button type="button" onClick={() => setAfficherTVAC(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: afficherTVAC ? ORANGE : '#f1f5f9', color: afficherTVAC ? '#fff' : '#64748b', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>💶 {afficherTVAC ? 'Prix TVAC affichés' : 'Afficher prix TVA comprise'}</button>
        </div>
        <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lignes.map((l, i) => {
            const totLigne = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
            const totTTC = totLigne * (1 + (Number(l.tva_pct) || 0) / 100)
            return (
              <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: l.optionnelle ? '#FFFBEB' : '#fff' }}>
                {/* Rangée 1 : titre + chiffres */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: mobE ? 'wrap' : 'nowrap' }}>
                  <div style={{ flex: 1, minWidth: mobE ? '100%' : 180 }}>
                    <input style={{ ...inp, fontWeight: 700, padding: '7px 9px' }} placeholder="Titre / objet (ex: Porte sectionnelle)" value={l.titre || ''} onChange={e => setLigne(i, 'titre', e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <ChampL label="Qté"><input type="number" style={{ ...inp, width: 52, padding: '6px', textAlign: 'center' }} value={l.quantite} onChange={e => setLigne(i, 'quantite', e.target.value)} /></ChampL>
                    <ChampL label="P.U. €"><input type="number" step="0.01" style={{ ...inp, width: 82, padding: '6px', textAlign: 'right' }} value={l.prix_unitaire} onChange={e => setLigne(i, 'prix_unitaire', e.target.value)} /></ChampL>
                    <ChampL label="Rem.%"><input type="number" style={{ ...inp, width: 50, padding: '6px', textAlign: 'center' }} value={l.remise_pct} onChange={e => setLigne(i, 'remise_pct', e.target.value)} /></ChampL>
                    <ChampL label="TVA">
                      <select style={{ ...inp, width: 64, padding: '6px' }} value={l.tva_pct} onChange={e => setLigne(i, 'tva_pct', e.target.value)}>
                        {TVA_TAUX.map(t => <option key={t.val} value={t.val}>{t.val}%</option>)}
                      </select>
                    </ChampL>
                    <ChampL label="HT"><div style={{ minWidth: 78, textAlign: 'right', fontWeight: 700, color: NAVY, padding: '7px 0' }}>{eur(totLigne)}</div></ChampL>
                    <ChampL label="TTC"><div style={{ minWidth: 82, textAlign: 'right', fontWeight: 700, color: ORANGE, padding: '7px 0' }}>{eur(totTTC)}</div></ChampL>
                    <button onClick={() => delLigne(i)} title="Supprimer la ligne" style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 18, alignSelf: 'center', marginTop: 12 }}>×</button>
                  </div>
                </div>
                {/* Rangée 2 : descriptif + photos à côté */}
                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: mobE ? 'wrap' : 'nowrap' }}>
                  <textarea style={{ ...inp, flex: 1, minHeight: 54, fontSize: 12, color: '#475569', resize: 'vertical', minWidth: mobE ? '100%' : 200 }} placeholder="Descriptif détaillé (dimensions, coloris, options…)" value={l.descriptif || ''} onChange={e => setLigne(i, 'descriptif', e.target.value)} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {(l.photos || []).map((ph, pi) => (
                      <div key={pi} style={{ width: 76, height: 76, borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                        <img src={ph.url || ph} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span onClick={() => setLigne(i, 'photos', (l.photos || []).filter((_, j) => j !== pi))} style={{ position: 'absolute', top: 2, right: 3, background: 'rgba(0,0,0,.5)', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>×</span>
                      </div>
                    ))}
                    <label style={{ width: 76, height: 76, borderRadius: 8, border: `1px dashed ${ORANGE}`, background: '#FFF7ED', color: ORANGE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11 }}>
                      <span style={{ fontSize: 18 }}>＋</span>photo
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => ajouterPhotos(i, [...e.target.files])} />
                    </label>
                  </div>
                </div>
                {/* Option : ligne optionnelle (non additionnée) */}
                <div style={{ marginTop: 6 }}>
                  <label style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!l.optionnelle} onChange={e => setLigne(i, 'optionnelle', e.target.checked)} />
                    Option au choix (non comptée dans le total)
                  </label>
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={addLigne} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 16 }}>+ Ajouter une ligne</button>

        {/* Totaux + remise globale */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <div style={{ width: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Remise globale %</span>
              <input type="number" style={{ ...inp, width: 70, padding: '5px', textAlign: 'center' }} value={f.remise_pct} onChange={e => set('remise_pct', e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}><span style={{ color: '#64748b' }}>Total HT</span><span style={{ fontWeight: 600 }}>{eur(tot.ht)}</span></div>
            {Object.entries(tot.parTaux).filter(([, v]) => v > 0).map(([t, v]) => (
              <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', color: '#64748b' }}><span>TVA {t}%</span><span>{eur(v)}</span></div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: ORANGE, padding: '8px 0', borderTop: '2px solid #f1f5f9', marginTop: 4 }}><span>Total TTC</span><span>{eur(tot.ttc)}</span></div>
          </div>
        </div>

        {/* Notes + statut */}
        <div style={{ display: 'grid', gridTemplateColumns: mobE ? '1fr' : '2fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div><label style={lbl}>Notes (optionnel)</label><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div><label style={lbl}>Langue du document</label>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 9, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748b' }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ background: ORANGE, border: 'none', borderRadius: 9, padding: '10px 24px', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  EXPORTS PDF / EXCEL
// ════════════════════════════════════════════════════════════════
async function exportPDF(type, doc, lignes) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  const { jsPDF } = window.jspdf
  const d = new jsPDF()
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
  const titre = isDevis ? L.devis : L.facture
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
  const lignesNormales = lignes.filter(l => !l.optionnelle)
  const lignesOptions = lignes.filter(l => l.optionnelle)
  const hasRemiseLigne = lignes.some(x => Number(x.remise_pct) > 0)

  // Pré-charge toutes les photos en dataURL (indexées par ligne)
  const photosData = {}  // index de ligne -> [dataUrl, ...]
  for (let idx = 0; idx < lignesNormales.length; idx++) {
    const l = lignesNormales[idx]
    if (l.photos && l.photos.length) {
      photosData[idx] = []
      for (const photo of l.photos) {
        const src = photo.url || photo
        try {
          const dataUrl = (typeof src === 'string' && src.startsWith('data:')) ? src : await loadImageDataURL(src)
          if (dataUrl) photosData[idx].push(dataUrl)
        } catch (e) { /* ignore */ }
      }
    }
  }

  // Construit le libellé d'une ligne : titre + descriptif en dessous
  const libelleLigne = (l) => {
    const titre = l.titre || l.description || ''
    const desc = l.descriptif || ''
    return desc ? `${titre}\n${desc}` : titre
  }

  // ═══ Dessin manuel des lignes : descriptif | photos | chiffres ═══
  const M_L = 10, M_R = 10          // marges latérales réduites
  const tableW = PW - M_L - M_R
  const BOTTOM = 280

  // Zone chiffres à droite — colonnes élargies pour que "30.203,04 €" tienne sur une ligne
  const wPU = 28, wTVA = 11, wRem = hasRemiseLigne ? 11 : 0, wQte = 10, wHT = 27, wTTC = 29
  const wChiffres = wPU + wTVA + wRem + wQte + wHT + wTTC
  const xChiffresStart = PW - M_R - wChiffres

  // Zone de gauche (avant les chiffres) scindée 2/5 descriptif - 3/5 photos
  const wGauche = xChiffresStart - M_L - 3
  const wDesc = wGauche * 2 / 5 - 2
  const wPhotoZone = wGauche * 3 / 5
  const xPhotoZone = M_L + wGauche * 2 / 5 + 2

  // taille photo = largeur de la zone photo (2 par rangée si ça rentre, sinon 1)
  const photoParRangee = wPhotoZone >= 60 ? 2 : 1
  const PHOTO_SIZE = Math.min(38, (wPhotoZone - (photoParRangee - 1) * 2) / photoParRangee)

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

  let y = dessinerEnteteColonnes(startY)
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

    // hauteur photos (colonne photos, empilées par rangées)
    const nbRangees = photos.length ? Math.ceil(photos.length / photoParRangee) : 0
    const hPhotos = nbRangees * (PHOTO_SIZE + 2) + 2

    const hLigne = Math.max(hTexte, hPhotos, 9)

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

    // ── Colonne 2 : photos (milieu) ──
    if (photos.length) {
      let py = y + 3
      let count = 0, col = 0
      for (const dataUrl of photos) {
        const px = xPhotoZone + col * (PHOTO_SIZE + 2)
        try {
          const fmt = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
          d.addImage(dataUrl, fmt, px, py, PHOTO_SIZE, PHOTO_SIZE, undefined, 'FAST')
        } catch (e) { /* ignore */ }
        col++
        if (col >= photoParRangee) { col = 0; py += PHOTO_SIZE + 2 }
      }
    }

    // ── Colonne 3 : chiffres (droite) ──
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
  // Ligne séparatrice + Montant dû
  y += 1
  d.setDrawColor(...O); d.setLineWidth(0.4); d.line(labelX, y, valX, y); y += 7
  d.setFont(undefined, 'bold'); d.setFontSize(13); d.setTextColor(...O)
  d.text(isDevis ? L.totalTTC : (L.montantDu || L.totalTTC), labelX, y)
  d.setTextColor(...DARK); d.text(eurPDF(tot.ttc), valX, y, { align: 'right' })

  // ---- Options au choix (non comptées dans le total) ----
  if (lignesOptions.length) {
    y += 14
    d.setFillColor(255, 251, 235); d.setDrawColor(245, 158, 11); d.setLineWidth(0.3)
    const optH = 8 + lignesOptions.length * 11 + 4
    d.roundedRect(16, y - 5, PW - 32, optH, 2, 2, 'FD')
    d.setFontSize(10); d.setTextColor(180, 83, 9); d.setFont(undefined, 'bold')
    d.text(isDevis ? 'Options au choix (à sélectionner — non comprises dans le total)' : 'Options', 20, y); y += 8
    d.setFont(undefined, 'normal'); d.setFontSize(9); d.setTextColor(...DARK)
    lignesOptions.forEach(l => {
      const t = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
      const ttc = t * (1 + (Number(l.tva_pct) || 0) / 100)
      const titre = l.titre || l.description || ''
      d.setFont(undefined, 'bold'); d.text(titre, 20, y)
      d.setFont(undefined, 'normal'); d.text(`${eurPDF(t)} HT  /  ${eurPDF(ttc)} TTC`, valX, y, { align: 'right' })
      if (l.descriptif) { y += 4.5; d.setFontSize(8); d.setTextColor(...GREY); d.text(d.splitTextToSize(l.descriptif, PW - 80), 20, y); d.setFontSize(9); d.setTextColor(...DARK) }
      y += 7
    })
  }

  // ---- Paiement ----
  y += 16; d.setFontSize(9); d.setTextColor(...GREY); d.setFont(undefined, 'normal')
  d.text(`${L.paiement} : ${LODE.iban}  (${LODE.bic} – ${LODE.banque})`, 16, y)
  if (!isDevis) { y += 5; d.text(`${L.communication} : ${doc.numero}`, 16, y) }
  y += 9; d.setTextColor(...O); d.setFont(undefined, 'bold'); d.setFontSize(10)
  d.text(L.merci, 16, y)

  // Notes éventuelles
  if (doc.notes) {
    y += 8; d.setFontSize(8.5); d.setTextColor(...GREY); d.setFont(undefined, 'normal')
    d.text(d.splitTextToSize(doc.notes, PW - 32), 16, y)
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
  d.save(`${titre}_${doc.numero}.pdf`)
}

async function exportExcel(type, doc, lignes) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')
  const XLSX = window.XLSX
  const tot = calcTotaux(lignes, doc.remise_pct)
  const isDevis = type === 'devis'
  const L = I18N[doc.langue] || I18N.fr
  const rows = [
    [LODE.raison_sociale, '', '', isDevis ? L.devis : L.facture],
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
  XLSX.utils.book_append_sheet(wb, ws, isDevis ? L.devis : L.facture)
  XLSX.writeFile(wb, `${isDevis ? L.devis : L.facture}_${doc.numero}.xlsx`)
}

// ════════════════════════════════════════════════════════════════
//  PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════
const STATUT_CHIPS = [
  { key: 'brouillon', label: 'Pas envoyé', col: '#94a3b8' },
  { key: 'envoyé',    label: 'Envoyé',     col: '#2563eb' },
  { key: 'accepté',   label: 'Approuvé',   col: '#16a34a' },
  { key: 'refusé',    label: 'Rejeté',     col: '#dc2626' },
]
const EVT = {
  cree:    { icon: '📝', label: 'Créé',                  col: '#64748b' },
  envoye:  { icon: '📤', label: 'Envoyé au client',      col: '#2563eb' },
  ouvert:  { icon: '👁️', label: 'Email ouvert par le client', col: '#7c3aed' },
  accepte: { icon: '✅', label: 'Accepté par le client', col: '#16a34a' },
  refuse:  { icon: '✋', label: 'Refusé par le client',   col: '#dc2626' },
}

function Row2({ l, v }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#64748b' }}><span>{l}</span><span>{v}</span></div>
}

function SuiviModal({ doc, color, onClose, onChanged }) {
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
    const relance = new Date(now); relance.setDate(relance.getDate() + 7)  // rappel à mi-parcours
    const dejaEnvoye = doc.statut && doc.statut !== 'brouillon'
    await supabase.from('lode_devis').update({
      statut: 'envoyé', sent_at: now.toISOString(), date_validite: valid.toISOString().slice(0, 10),
    }).eq('id', doc.id)
    await logEvent('envoye', viaEmail ? 'Email envoyé depuis la plateforme' : 'Marqué comme envoyé (envoi manuel)')
    // Tâche de suivi (une seule fois, au 1er envoi) — échéance à la mi-parcours pour ne pas oublier
    if (!dejaEnvoye) {
      await supabase.from('taches').insert({
        titre: `Suivre le devis ${doc.numero} — ${doc.client_nom}`,
        description: `Devis envoyé le ${now.toLocaleDateString('fr-BE')}. Valable jusqu'au ${valid.toLocaleDateString('fr-BE')} (15 j). Relance à prévoir vers le ${relance.toLocaleDateString('fr-BE')} si pas de réponse.`,
        categorie: 'Devis', source: 'devis', statut: 'todo', priorite: 'moyenne',
        echeance: relance.toISOString().slice(0, 10),
        client_id: doc.client_id || null, dossier_client: doc.numero,
        lien_url: `/devis/${doc.accept_token}`,
      })
    }
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: mob ? 0 : 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: mob ? '100vw' : 'min(1080px,96vw)', height: mob ? '100vh' : 'min(92vh,900px)', background: '#fff', borderRadius: mob ? 0 : 16, overflow: 'hidden', display: 'flex', flexDirection: mob ? 'column' : 'row', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>

        {/* ── Colonne gauche : aperçu du document ── */}
        <div style={{ flex: 1, background: '#f1f5f9', overflow: 'auto', padding: mob ? 14 : 28, order: mob ? 2 : 1 }}>
          <div style={{ background: '#fff', maxWidth: 620, margin: '0 auto', borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,.08)', padding: mob ? '22px 18px' : '30px 34px', fontSize: 12, color: '#1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
              {LODE.logo_url ? <img src={LODE.logo_url} alt="LODE" style={{ height: 46 }} /> : <div style={{ fontWeight: 800, fontSize: 18, color }}>{LODE.raison_sociale}</div>}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color }}>DEVIS {doc.numero}</div>
                <div style={{ color: '#64748b' }}>Émis le : {fmtDate(doc.date_devis)}</div>
                {doc.date_validite && <div style={{ color: '#64748b' }}>Valide jusqu'au : {fmtDate(doc.date_validite)}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>De</div>
                <div style={{ fontWeight: 800 }}>{LODE.raison_sociale}</div>
                <div style={{ color: '#475569' }}>{LODE.adresse}<br />{LODE.cp} {LODE.ville}<br />{LODE.pays}</div>
                <div style={{ color: '#475569', marginTop: 4 }}>TVA : {LODE.tva}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Pour</div>
                <div style={{ fontWeight: 800 }}>{doc.client_nom}</div>
                <div style={{ color: '#475569' }}>{doc.client_adresse}<br />{[doc.client_cp, doc.client_ville].filter(Boolean).join(' ')}</div>
                {doc.client_tva && <div style={{ color: '#475569', marginTop: 4 }}>TVA : {doc.client_tva}</div>}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
              <thead><tr style={{ background: color, color: '#fff' }}>
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
            {doc.notes && <><div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginTop: 18 }}>Notes &amp; commentaires</div><div style={{ color: '#475569' }}>{doc.notes}</div></>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, paddingTop: 12, borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: 11 }}>
              <div>{LODE.iban && <>IBAN : {LODE.iban}<br /></>}{LODE.bic && <>BIC : {LODE.bic}</>}</div>
              <div style={{ textAlign: 'right' }}>{LODE.email}{LODE.telephone && <><br />{LODE.telephone}</>}</div>
            </div>
          </div>
        </div>

        {/* ── Colonne droite : statut / suivi ── */}
        <div style={{ width: mob ? '100%' : 380, borderLeft: mob ? 'none' : '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', order: mob ? 1 : 2, maxHeight: mob ? '46vh' : 'none' }}>
          <div style={{ background: `linear-gradient(135deg,${color},#7c2d12)`, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>Devis {doc.numero}</div>
              <div style={{ color: '#fff', opacity: .9, fontSize: 14, marginTop: 2 }}>{eur(doc.total_ttc)} TVA incl.</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {/* Statut (chips cliquables, façon Accountable) */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Statut</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            {STATUT_CHIPS.map(c => {
              const actif = statut === c.key
              return (
                <button key={c.key} onClick={() => changeStatut(c.key)}
                  style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${actif ? c.col : '#e2e8f0'}`, background: actif ? c.col : '#fff', color: actif ? '#fff' : '#64748b' }}>
                  {c.label}
                </button>
              )
            })}
          </div>

          {/* Lien d'acceptation */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Lien d'acceptation (client)</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <input readOnly value={lien} style={{ flex: 1, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', color: '#475569', background: '#f8fafc' }} />
            <button onClick={copier} style={{ padding: '9px 14px', border: 'none', borderRadius: 8, background: color, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>{copied ? '✓ Copié' : 'Copier'}</button>
          </div>

          {/* Actions d'envoi */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
            <button onClick={envoyerEmail} disabled={sending} style={{ flex: 1, minWidth: 180, padding: '11px 16px', border: 'none', borderRadius: 10, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 14, cursor: sending ? 'wait' : 'pointer' }}>{sending ? '…' : '📧 Envoyer par email'}</button>
            <button onClick={() => marquerEnvoye(false)} style={{ padding: '11px 16px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Marquer envoyé</button>
          </div>

          {/* Timeline */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Historique</div>
          {events === null ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Chargement…</p> : (
            <div style={{ position: 'relative', paddingLeft: 26 }}>
              <div style={{ position: 'absolute', left: 9, top: 4, bottom: 4, width: 2, background: '#e2e8f0' }} />
              {timeline.map((ev, i) => {
                const cfg = EVT[ev.type] || { icon: '•', label: ev.type, col: '#64748b' }
                return (
                  <div key={ev.id || i} style={{ position: 'relative', marginBottom: 18 }}>
                    <div style={{ position: 'absolute', left: -26, width: 20, height: 20, borderRadius: '50%', background: '#fff', border: `2px solid ${cfg.col}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{cfg.icon}</div>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{cfg.label}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{ev.created_at ? new Date(ev.created_at).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}{ev.detail ? ` · ${ev.detail}` : ''}</div>
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

function ChampL({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </div>
  )
}

export default function LodeDevisFactures() {
  const [tab, setTab] = useState('devis')
  const [devis, setDevis] = useState([])
  const [factures, setFactures] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // {type, doc}
  const [busy, setBusy] = useState(null)
  const [suivi, setSuivi] = useState(null)      // devis dont on affiche le suivi

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
      else await exportExcel(type, doc, lignes)
    } catch (e) { alert('Erreur export : ' + e.message) }
    finally { setBusy(null) }
  }

  // Envoi de la facture sur le réseau Peppol via le proxy Billit (n8n)
  const PEPPOL_WEBHOOK = 'https://n8n.srv1082740.hstgr.cloud/webhook/lode-peppol-send'
  const envoyerPeppol = async (doc) => {
    if (!confirm(`Envoyer la facture ${doc.numero} sur le réseau Peppol via Billit ?`)) return
    setBusy(doc.id + 'peppol')
    try {
      const lignes = await getLignes('facture', doc.id)
      const res = await fetch(PEPPOL_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facture: { ...doc, lignes } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json().catch(() => ({}))
      if (data && data.ok) {
        await supabase.from('lode_factures').update({ statut: 'envoyée' }).eq('id', doc.id)
        alert(`Facture ${doc.numero} envoyée sur Peppol ✓`)
        load()
      } else {
        throw new Error(data?.error || 'Réponse inattendue de Billit')
      }
    } catch (e) {
      alert(`Échec de l'envoi Peppol : ${e.message}\n\nVérifie que le workflow n8n « LODE - Peppol Send » est actif et que la clé API Billit est renseignée.`)
    } finally { setBusy(null) }
  }

  const convertir = async (devisDoc) => {
    if (!confirm(`Convertir le devis ${devisDoc.numero} en facture ?`)) return
    const lignes = await getLignes('devis', devisDoc.id)
    const { data: num } = await supabase.rpc('next_lode_numero', { p_type: 'facture' })
    const { data: fact, error } = await supabase.from('lode_factures').insert({
      numero: num, devis_id: devisDoc.id, statut: 'brouillon',
      client_nom: devisDoc.client_nom, client_adresse: devisDoc.client_adresse, client_cp: devisDoc.client_cp,
      client_ville: devisDoc.client_ville, client_email: devisDoc.client_email, client_telephone: devisDoc.client_telephone,
      client_tva: devisDoc.client_tva, objet: devisDoc.objet, notes: devisDoc.notes, remise_pct: devisDoc.remise_pct,
      total_ht: devisDoc.total_ht, total_tva: devisDoc.total_tva, total_ttc: devisDoc.total_ttc,
      langue: devisDoc.langue || 'fr',
      date_facture: todayISO(), date_echeance: addDays(todayISO(), DELAI_PAIEMENT_JOURS),
    }).select('id').single()
    if (error) { alert('Erreur : ' + error.message); return }
    if (lignes.length) {
      await supabase.from('lode_factures_lignes').insert(lignes.map((l, i) => ({
        facture_id: fact.id, position: i, description: l.description, quantite: l.quantite,
        prix_unitaire: l.prix_unitaire, remise_pct: l.remise_pct, tva_pct: l.tva_pct, total_ht: l.total_ht,
      })))
    }
    setTab('factures'); load()
  }

  const supprimer = async (type, id) => {
    if (!confirm('Supprimer définitivement ?')) return
    await supabase.from(type === 'devis' ? 'lode_devis' : 'lode_factures').delete().eq('id', id)
    load()
  }

  const liste = tab === 'devis' ? devis : factures
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
            <i className="ti ti-plus" /> Nouveau {tab === 'factures' ? 'facture' : 'devis'}
          </PrimaryButton>}
        />

        <TabsBar color={C} active={tab} onChange={setTab}
          tabs={[{ key: 'devis', label: 'Devis', count: devis.length }, { key: 'factures', label: 'Factures', count: factures.length }]} />

        {loading ? <p style={{ color: '#94a3b8' }}>Chargement…</p> :
          liste.length === 0 ? (
            <DataCard style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>Aucun {tab === 'devis' ? 'devis' : 'facture'} pour le moment.</p>
            </DataCard>
          ) : mob ? (
            /* === Vue mobile : cartes empilées === */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {liste.map((doc) => {
                const s = STAT[doc.statut] || STAT.brouillon
                const t = tab === 'devis' ? 'devis' : 'facture'
                return (
                  <DataCard key={doc.id} style={{ padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: C, fontSize: 13 }}>{doc.numero}</div>
                        <div style={{ color: '#1e293b', fontWeight: 700, fontSize: 15, marginTop: 2 }}>{doc.client_nom}</div>
                        {doc.objet && <div style={{ color: '#64748b', fontSize: 12.5, marginTop: 2 }}>{doc.objet}</div>}
                      </div>
                      <StatusBadge bg={s.bg} col={s.col} label={s.label} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>{fmtDate(tab === 'devis' ? doc.date_devis : doc.date_facture)}</span>
                      <span style={{ fontWeight: 800, color: NAVY, fontSize: 16 }}>{eur(doc.total_ttc)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      <ActionButton tone="grey" onClick={() => setEditing({ type: t, doc })}>Modifier</ActionButton>
                      {tab === 'devis' && <ActionButton tone="accent" color={C} onClick={() => setSuivi(doc)}>📊 Suivi</ActionButton>}
                      <ActionButton tone="pdf" disabled={busy === doc.id + 'pdf'} onClick={() => doExport('pdf', t, doc)}>{busy === doc.id + 'pdf' ? '…' : 'PDF'}</ActionButton>
                      <ActionButton tone="excel" disabled={busy === doc.id + 'excel'} onClick={() => doExport('excel', t, doc)}>{busy === doc.id + 'excel' ? '…' : 'Excel'}</ActionButton>
                      {tab === 'factures' && doc.client_tva && doc.statut !== 'payée' && doc.statut !== 'annulée' && (
                        <ActionButton tone="peppol" disabled={busy === doc.id + 'peppol'} onClick={() => envoyerPeppol(doc)}>{busy === doc.id + 'peppol' ? '…' : '📨 Peppol'}</ActionButton>
                      )}
                      {tab === 'devis' && doc.statut === 'accepté' && <ActionButton tone="accent" color={C} onClick={() => convertir(doc)}>→ Facture</ActionButton>}
                      <ActionButton tone="danger" onClick={() => supprimer(t, doc.id)}>Supprimer</ActionButton>
                    </div>
                  </DataCard>
                )
              })}
            </div>
          ) : (
            /* === Vue desktop : tableau === */
            <DataCard style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>{['N°', 'Client', 'Objet', 'Date', 'Total TTC', 'Statut', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: h === 'Total TTC' ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {liste.map((doc) => {
                    const s = STAT[doc.statut] || STAT.brouillon
                    return (
                      <tr key={doc.id} style={{ borderTop: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                        <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700, color: C }}>{doc.numero}</td>
                        <td style={{ padding: '11px 14px', color: '#1e293b', fontWeight: 600 }}>{doc.client_nom}</td>
                        <td style={{ padding: '11px 14px', color: '#64748b' }}>{doc.objet || '—'}</td>
                        <td style={{ padding: '11px 14px', color: '#64748b' }}>{fmtDate(tab === 'devis' ? doc.date_devis : doc.date_facture)}</td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: NAVY }}>{eur(doc.total_ttc)}</td>
                        <td style={{ padding: '11px 14px' }}><StatusBadge bg={s.bg} col={s.col} label={s.label} /></td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <ActionButton tone="grey" onClick={() => setEditing({ type: tab === 'devis' ? 'devis' : 'facture', doc })}>Modifier</ActionButton>
                            {tab === 'devis' && <ActionButton tone="accent" color={C} onClick={() => setSuivi(doc)}>📊 Suivi</ActionButton>}
                            <ActionButton tone="pdf" disabled={busy === doc.id + 'pdf'} onClick={() => doExport('pdf', tab === 'devis' ? 'devis' : 'facture', doc)}>{busy === doc.id + 'pdf' ? '…' : 'PDF'}</ActionButton>
                            <ActionButton tone="excel" disabled={busy === doc.id + 'excel'} onClick={() => doExport('excel', tab === 'devis' ? 'devis' : 'facture', doc)}>{busy === doc.id + 'excel' ? '…' : 'Excel'}</ActionButton>
                            {tab === 'factures' && doc.client_tva && doc.statut !== 'payée' && doc.statut !== 'annulée' && (
                              <ActionButton tone="peppol" disabled={busy === doc.id + 'peppol'} onClick={() => envoyerPeppol(doc)}>{busy === doc.id + 'peppol' ? '…' : '📨 Peppol'}</ActionButton>
                            )}
                            {tab === 'devis' && doc.statut === 'accepté' && <ActionButton tone="accent" color={C} onClick={() => convertir(doc)}>→ Facture</ActionButton>}
                            <ActionButton tone="danger" onClick={() => supprimer(tab === 'devis' ? 'devis' : 'facture', doc.id)}>×</ActionButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </DataCard>)}
      </div>

      {editing && <Editeur type={editing.type} doc={editing.doc} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {suivi && <SuiviModal doc={suivi} color={C} onClose={() => setSuivi(null)} onChanged={() => { load() }} />}
    </Layout>
  )
}
