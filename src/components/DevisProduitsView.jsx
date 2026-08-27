import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { extraireDevis } from '../lib/devisExtraction'

const C = { navy: '#1e293b', or: '#ea580c', orD: '#c2410c', bg: '#F4F6F9', border: '#e2e8f0', textM: '#64748b', textL: '#94a3b8', ok: '#16a34a' }
const PREFIXES = { lode: 'LODE', dtx: 'DTX', dynassur: 'DYN', hexagroup: 'HEX', prive: 'PRIVE', groupe: 'GRP' }

const S = {
  btnO: { padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,#f97316,${C.or})`, color: '#fff' },
  btnG: { padding: '9px 15px', borderRadius: 8, border: `1px solid ${C.or}`, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: '#fff', color: C.or },
  input: { padding: '7px 9px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, boxSizing: 'border-box' },
  inpS: { width: 62, padding: '4px 6px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12.5, textAlign: 'right' },
  label: { fontSize: 10, textTransform: 'uppercase', color: C.textL, fontWeight: 700 },
  badge: (bg, fg) => ({ display: 'inline-block', padding: '2px 7px', borderRadius: 9, fontSize: 10, fontWeight: 700, background: bg, color: fg }),
}
const eur = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const badgeFourn = f => f === 'SDA' ? S.badge('#DBEAFE', '#1E40AF') : f === 'Marquise' ? S.badge('#FCE7F3', '#9D174D') : S.badge('#F1F5F9', '#64748b')

// Calcul d'une ligne
function calcLigne(l) {
  const htva = (Number(l.prix_public) || 0) * (1 - (Number(l.remise_pct) || 0) / 100) * (Number(l.quantite) || 1)
  const base = l.type_ligne === 'libre' ? (Number(l.prix_htva) || 0) : htva
  const taux = l.cocontractant ? 0 : (Number(l.taux_tva) || 0)
  const tva = base * taux / 100
  return { htva: base, tva, tvac: base + tva }
}

export default function DevisProduitsView({ entiteKey }) {
  const { perms } = useAuth()
  const myCode = (perms?.collab_code || perms?.code || '').toUpperCase()
  const [vue, setVue] = useState('liste')   // liste / edition
  const [devisList, setDevisList] = useState([])
  const [loading, setLoading] = useState(true)
  const [devisCourant, setDevisCourant] = useState(null)

  const charger = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('devis_produits').select('*').eq('entite', entiteKey).order('created_at', { ascending: false })
    setDevisList(data || [])
    setLoading(false)
  }, [entiteKey])
  useEffect(() => { charger() }, [charger])

  // Génère le prochain numéro : PREFIXE + AAAA + MM + NNN (compteur mensuel)
  const prochainNumero = useCallback(async () => {
    const pfx = PREFIXES[entiteKey] || entiteKey.toUpperCase()
    const now = new Date()
    const aaaamm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const debut = `${pfx}${aaaamm}`
    const { data } = await supabase.from('devis_produits').select('numero').eq('entite', entiteKey).like('numero', `${debut}%`)
    let max = 0
    for (const d of (data || [])) {
      const suffixe = (d.numero || '').slice(debut.length)
      const n = parseInt(suffixe, 10)
      if (!isNaN(n) && n > max) max = n
    }
    return `${debut}${String(max + 1).padStart(3, '0')}`
  }, [entiteKey])

  const nouveauDevis = async () => {
    const numero = await prochainNumero()
    setDevisCourant({
      entite: entiteKey, numero, client_nom: '', client_ref: '', date_devis: new Date().toISOString().slice(0, 10),
      validite: '30 jours', statut: 'brouillon', notes: '', lignes: [], _nouveau: true,
    })
    setVue('edition')
  }

  const ouvrirDevis = async (d) => {
    const { data: lignes } = await supabase.from('devis_produits_lignes').select('*').eq('devis_id', d.id).order('ordre', { ascending: true })
    setDevisCourant({ ...d, lignes: (lignes || []).map(l => ({ ...l, _key: l.id })) })
    setVue('edition')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textL }}>Chargement…</div>

  if (vue === 'edition' && devisCourant) {
    return <EditionDevis entiteKey={entiteKey} devis={devisCourant} myCode={myCode}
      onRetour={() => { setVue('liste'); setDevisCourant(null); charger() }} />
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ flex: 1 }} />
        <button style={S.btnO} onClick={nouveauDevis}>+ Nouveau devis</button>
      </div>
      {devisList.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: C.textL }}>
          Aucun devis. Cliquez sur « + Nouveau devis » pour importer vos PDF fournisseurs.
        </div>
      ) : (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: C.bg, color: C.textM }}>
              {['Numéro', 'Client', 'Date', 'Total TVAC', 'Statut'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {devisList.map(d => (
                <tr key={d.id} onClick={() => ouvrirDevis(d)} style={{ borderTop: `1px solid #f1f5f9`, cursor: 'pointer' }}>
                  <td style={{ padding: '11px 14px', fontFamily: 'monospace', fontWeight: 700, color: C.or }}>{d.numero}</td>
                  <td style={{ padding: '11px 14px' }}>{d.client_nom || '—'}</td>
                  <td style={{ padding: '11px 14px', color: C.textM }}>{d.date_devis ? new Date(d.date_devis).toLocaleDateString('fr-BE') : '—'}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 700 }}>{eur(d.total_tvac)}</td>
                  <td style={{ padding: '11px 14px' }}><span style={S.badge('#F1F5F9', '#64748b')}>{d.statut}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EditionDevis({ entiteKey, devis, myCode, onRetour }) {
  const [d, setD] = useState(devis)
  const [lignes, setLignes] = useState(devis.lignes || [])
  const [importing, setImporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef()

  const setField = (k, v) => setD(x => ({ ...x, [k]: v }))
  const nk = () => 'k' + Math.random().toString(36).slice(2, 9)

  // Import d'un ou plusieurs PDF
  const onFiles = async (files) => {
    setImporting(true); setMsg('')
    const nouvelles = []
    for (const f of files) {
      try {
        const ext = await extraireDevis(f)
        if (ext.fournisseur === 'Inconnu') { setMsg(`⚠ ${f.name} : fournisseur non reconnu`); continue }
        // pré-remplir client si vide
        if (!d.client_ref && ext.meta.ref_client) setField('client_ref', ext.meta.ref_client)
        for (const l of ext.lignes) {
          nouvelles.push({ _key: nk(), type_ligne: 'produit', ...l, photos: [] })
        }
      } catch (e) { setMsg(`Erreur sur ${f.name}: ${e.message}`) }
    }
    setLignes(prev => [...prev, ...nouvelles])
    setImporting(false)
    if (nouvelles.length) setMsg(`✓ ${nouvelles.length} ligne(s) importée(s)`)
  }

  const updLigne = (key, patch) => setLignes(ls => ls.map(l => l._key === key ? { ...l, ...patch } : l))
  const supprLigne = (key) => setLignes(ls => ls.filter(l => l._key !== key))
  const ajouterLibre = () => setLignes(ls => [...ls, { _key: nk(), type_ligne: 'libre', designation: '', description: '', prix_htva: 0, quantite: 1, taux_tva: 21, cocontractant: false, photos: [] }])

  // Totaux
  const calcs = lignes.map(l => ({ l, c: calcLigne(l) }))
  const totHTVA = calcs.reduce((s, x) => s + x.c.htva, 0)
  const totTVA = calcs.reduce((s, x) => s + x.c.tva, 0)
  const totTVAC = totHTVA + totTVA
  const coutAchat = lignes.reduce((s, l) => s + (Number(l.prix_achat) || 0) * (Number(l.quantite) || 1), 0)
  const marge = totHTVA - coutAchat
  // groupement TVA par taux
  const parTaux = {}
  calcs.forEach(({ l, c }) => {
    const key = l.cocontractant ? 'CoC' : String(Number(l.taux_tva) || 0)
    if (!parTaux[key]) parTaux[key] = { base: 0, tva: 0 }
    parTaux[key].base += c.htva; parTaux[key].tva += c.tva
  })

  const enregistrer = async () => {
    setSaving(true); setMsg('')
    try {
      const entete = {
        entite: entiteKey, numero: d.numero, client_nom: d.client_nom, client_ref: d.client_ref,
        client_adresse: d.client_adresse, client_email: d.client_email, client_tel: d.client_tel,
        date_devis: d.date_devis, validite: d.validite, statut: d.statut, notes: d.notes,
        total_htva: totHTVA, total_tva: totTVA, total_tvac: totTVAC, cout_achat: coutAchat, marge,
        cree_par: myCode, updated_at: new Date().toISOString(),
      }
      let devisId = d.id
      if (d._nouveau || !d.id) {
        const { data, error } = await supabase.from('devis_produits').insert(entete).select().single()
        if (error) throw error
        devisId = data.id
      } else {
        const { error } = await supabase.from('devis_produits').update(entete).eq('id', d.id)
        if (error) throw error
        // supprimer anciennes lignes puis réinsérer (simple et fiable)
        await supabase.from('devis_produits_lignes').delete().eq('devis_id', d.id)
      }
      // insérer les lignes
      const rows = lignes.map((l, i) => ({
        devis_id: devisId, ordre: i, type_ligne: l.type_ligne, fournisseur: l.fournisseur || null,
        designation: l.designation, description: l.description,
        prix_public: Number(l.prix_public) || 0, remise_pct: Number(l.remise_pct) || 0,
        quantite: Number(l.quantite) || 1, prix_htva: calcLigne(l).htva,
        taux_tva: l.cocontractant ? 0 : (Number(l.taux_tva) || 0), cocontractant: !!l.cocontractant,
        prix_achat: Number(l.prix_achat) || 0, photos: l.photos || [],
      }))
      if (rows.length) { const { error } = await supabase.from('devis_produits_lignes').insert(rows); if (error) throw error }
      setMsg('✓ Devis enregistré')
      setD(x => ({ ...x, id: devisId, _nouveau: false }))
    } catch (e) { setMsg('Erreur : ' + (e.message || '')) }
    setSaving(false)
  }

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button style={S.btnG} onClick={onRetour}>← Retour</button>
        <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: C.or }}>{d.numero}</div>
        <div style={{ flex: 1 }} />
        {msg && <span style={{ fontSize: 13, color: msg.startsWith('✓') ? C.ok : msg.startsWith('⚠') ? '#b45309' : '#dc2626' }}>{msg}</span>}
      </div>

      <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {/* En-tête devis */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={S.label}>N° devis</span><input style={{ ...S.input, width: 150, fontFamily: 'monospace' }} value={d.numero} onChange={e => setField('numero', e.target.value)} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={S.label}>Client</span><input style={{ ...S.input, width: 180 }} value={d.client_nom || ''} onChange={e => setField('client_nom', e.target.value)} placeholder="Nom du client" /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={S.label}>Référence</span><input style={{ ...S.input, width: 160 }} value={d.client_ref || ''} onChange={e => setField('client_ref', e.target.value)} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={S.label}>Date</span><input type="date" style={{ ...S.input, width: 140 }} value={d.date_devis || ''} onChange={e => setField('date_devis', e.target.value)} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={S.label}>Validité</span><input style={{ ...S.input, width: 100 }} value={d.validite || ''} onChange={e => setField('validite', e.target.value)} /></div>
        </div>

        {/* Import PDF */}
        <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, background: '#FFF7ED' }}>
          <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }} onChange={e => onFiles([...e.target.files])} />
          <button style={S.btnG} onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Lecture…' : '📄 Importer PDF fournisseur (SDA / Marquise)'}</button>
          <span style={{ fontSize: 12, color: C.textL, marginLeft: 10 }}>Le fournisseur est détecté automatiquement · plusieurs PDF possibles</span>
        </div>

        {/* Lignes */}
        {lignes.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: C.textL }}>Aucune ligne. Importez un PDF ou ajoutez une ligne libre.</div>
        ) : lignes.map(l => {
          const c = calcLigne(l)
          const libre = l.type_ligne === 'libre'
          return (
            <div key={l._key} style={{ borderBottom: `1px solid #eef2f7`, padding: '12px 16px', background: libre ? '#FFFBEB' : '#fff' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {l.fournisseur && <span style={badgeFourn(l.fournisseur)}>{l.fournisseur}</span>}
                    {libre && <span style={{ color: '#f59e0b', fontSize: 12 }}>✎ ligne libre</span>}
                  </div>
                  <input style={{ ...S.input, width: '100%', fontWeight: 600 }} value={l.designation || ''} onChange={e => updLigne(l._key, { designation: e.target.value })} placeholder="Désignation" />
                  <textarea style={{ ...S.input, width: '100%', marginTop: 5, minHeight: 34, fontSize: 12, color: C.textM, resize: 'vertical' }} value={l.description || ''} onChange={e => updLigne(l._key, { description: e.target.value })} placeholder="Description (optionnel)" />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  {!libre && <Champ label="Prix public"><input style={S.inpS} value={l.prix_public ?? ''} onChange={e => updLigne(l._key, { prix_public: e.target.value })} /></Champ>}
                  {!libre && <Champ label="Rem %"><input style={{ ...S.inpS, width: 46 }} value={l.remise_pct ?? ''} onChange={e => updLigne(l._key, { remise_pct: e.target.value })} /></Champ>}
                  {libre && <Champ label="Prix HTVA"><input style={{ ...S.inpS, width: 78 }} value={l.prix_htva ?? ''} onChange={e => updLigne(l._key, { prix_htva: e.target.value })} /></Champ>}
                  <Champ label="Qté"><input style={{ ...S.inpS, width: 40 }} value={l.quantite ?? ''} onChange={e => updLigne(l._key, { quantite: e.target.value })} /></Champ>
                  <Champ label="HTVA"><b style={{ fontSize: 13 }}>{eur(c.htva)}</b></Champ>
                  <Champ label="TVA">
                    <select style={{ padding: 4, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }} value={l.cocontractant ? 'CoC' : String(l.taux_tva)} onChange={e => { const v = e.target.value; if (v === 'CoC') updLigne(l._key, { cocontractant: true }); else updLigne(l._key, { cocontractant: false, taux_tva: Number(v) }) }}>
                      <option value="21">21%</option><option value="6">6%</option><option value="CoC">CoC</option>
                    </select>
                  </Champ>
                  <Champ label="TVAC"><b style={{ fontSize: 13, color: C.or }}>{eur(c.tvac)}</b></Champ>
                  <button onClick={() => supprLigne(l._key)} style={{ border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer', fontSize: 16, alignSelf: 'center' }}>✕</button>
                </div>
              </div>
              {/* Photos de la ligne (placeholder pour l'instant - upload au bloc suivant) */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {(l.photos || []).map((p, i) => (
                  <div key={i} style={{ width: 90, height: 68, borderRadius: 8, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748b', position: 'relative' }}>
                    🖼<span onClick={() => updLigne(l._key, { photos: l.photos.filter((_, j) => j !== i) })} style={{ position: 'absolute', top: 2, right: 4, cursor: 'pointer', color: '#dc2626' }}>✕</span>
                  </div>
                ))}
                <div style={{ width: 90, height: 68, borderRadius: 8, border: `1px dashed ${C.or}`, background: '#FFF7ED', color: C.or, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 11, cursor: 'pointer' }} title="Ajout de photos disponible prochainement">
                  <span style={{ fontSize: 18 }}>＋</span>photo
                </div>
              </div>
            </div>
          )
        })}

        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={S.btnG} onClick={ajouterLibre}>+ Ligne libre (main d'œuvre…)</button>
        </div>

        {/* Totaux */}
        <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, width: 340, maxWidth: '100%' }}>
            <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div style={{ ...S.label, marginBottom: 6 }}>Résumé TVA</div>
              {Object.entries(parTaux).map(([taux, v]) => (
                <div key={taux}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textM, paddingLeft: 10 }}><span>Base {taux === 'CoC' ? 'cocontractant' : taux + '%'}</span><span>{eur(v.base)}</span></div>
                  {taux !== 'CoC' && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textM, paddingLeft: 10 }}><span>TVA {taux}%</span><span>{eur(v.tva)}</span></div>}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 5 }}><span>Total HTVA</span><b>{eur(totHTVA)}</b></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>Total TVA</span><b>{eur(totTVA)}</b></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: C.or, borderTop: `2px solid ${C.border}`, paddingTop: 8 }}><span>TOTAL TVAC</span><span>{eur(totTVAC)}</span></div>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#065F46', marginTop: 10 }}>💰 Marge (vous seul) : <b>{eur(marge)}</b></div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btnG} onClick={enregistrer} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

function Champ({ label, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}><span style={S.label}>{label}</span>{children}</div>
}
