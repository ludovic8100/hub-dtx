import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { traduitGarantie } from '../../lib/garantieFr'
import { buildDevoirInfoPdf, genererMotivation } from '../../lib/devoirInfoPdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// Devoir d'information non-vie (IARD) : client + contrat (Supabase) + PDF des conditions
// particulières → document pré-rempli, vérifié, signé sur tablette, archivé (bucket devoir-info).

const NAVY = '#1A3A6B'
const card = { border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', background: '#fff', marginBottom: 14 }
const h2 = { fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 10 }
const lab = { fontSize: 12, color: '#64748b', margin: '10px 0 4px', display: 'block' }
const inp = { width: '100%', padding: '9px 12px', fontSize: 14, border: '1px solid #cbd5e1', borderRadius: 8, boxSizing: 'border-box', fontFamily: 'inherit' }
const btn = { background: NAVY, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
const btn2 = { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const DOCS = ['Fiche produit', 'Conditions générales', 'Conditions particulières']

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
// Libellé « cœur » d'une garantie, pour la recherche dans le texte du PDF
const coeur = g => norm(g).replace(/\(.*?\)/g, '').replace(/[,&]/g, ' ').replace(/\s+/g, ' ').trim()
const ALIAS = {
  'rc familiale': ['responsabilite civile familiale', 'rc vie privee', 'responsabilite civile vie privee', 'rc familiale'],
  'protection juridique': ['protection juridique', 'defense en justice'],
  'degats des eaux': ['degats des eaux', 'degat des eaux'],
  'bris de vitrage': ['bris de vitrage', 'bris de vitres'],
  'catastrophes naturelles': ['catastrophes naturelles', 'catastrophe naturelle'],
  'tempete': ['tempete'],
  'omnium': ['omnium', 'degats materiels', 'degats propres'],
  'vol': [' vol ', ' vol,', ' vol.'],
}
function trouveDansTexte(garantie, texte) {
  const k = coeur(garantie)
  if (k.length > 4 && texte.includes(k)) return true
  for (const [cle, al] of Object.entries(ALIAS)) {
    if (k.startsWith(cle) && al.some(a => texte.includes(a))) return true
  }
  return false
}
async function textePdf(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  let t = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const c = await (await pdf.getPage(i)).getTextContent()
    t += ' ' + c.items.map(x => x.str).join(' ')
  }
  return ' ' + norm(t) + ' '
}

// ── Zone de signature tactile ──
function SignaturePad({ label, onChange }) {
  const ref = useRef(null)
  const drawing = useRef(false)
  const vide = useRef(true)
  useEffect(() => {
    const cv = ref.current, r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
    cv.width = r.width * dpr; cv.height = r.height * dpr
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a'
  }, [])
  const pos = e => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const down = e => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); drawing.current = true; const ctx = ref.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(...pos(e)) }
  const move = e => { if (!drawing.current) return; const ctx = ref.current.getContext('2d'); ctx.lineTo(...pos(e)); ctx.stroke(); vide.current = false }
  const up = () => { if (!drawing.current) return; drawing.current = false; onChange(vide.current ? null : ref.current.toDataURL('image/png')) }
  const effacer = () => { const cv = ref.current; cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); vide.current = true; onChange(null) }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={lab}>{label}</span>
        <button type="button" onClick={effacer} style={{ ...btn2, padding: '3px 10px', fontSize: 12 }}>Effacer</button>
      </div>
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        style={{ width: '100%', height: 140, border: '1px dashed #94a3b8', borderRadius: 8, background: '#f8fafc', touchAction: 'none' }} />
    </div>
  )
}

export default function ToolDevoirInfo() {
  const { user, perms } = useAuth() || {}
  const [q, setQ] = useState('')
  const [clients, setClients] = useState([])
  const [client, setClient] = useState(null)
  const [contrats, setContrats] = useState([])
  const [contrat, setContrat] = useState(null)
  const [catalogue, setCatalogue] = useState([])
  const [etat, setEtat] = useState({})            // garantie → 'S' (souscrite) | 'R' (refusée) | ''
  const [risque, setRisque] = useState('')
  const [produit, setProduit] = useState('')
  const [pdfNom, setPdfNom] = useState('')
  const [pdfInfo, setPdfInfo] = useState('')
  const [conseil, setConseil] = useState('A')
  const [suit, setSuit] = useState(true)
  const [produitAlt, setProduitAlt] = useState('')
  const [raison, setRaison] = useState('')
  const [motivation, setMotivation] = useState('')
  const [motivManuelle, setMotivManuelle] = useState(false)
  const [consentEmail, setConsentEmail] = useState(false)
  const [docs, setDocs] = useState([...DOCS])
  const [ficheClient, setFicheClient] = useState(true)
  const [lieu, setLieu] = useState('Juprelle')
  const [sigC, setSigC] = useState(null)
  const [sigG, setSigG] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  // Recherche client
  useEffect(() => {
    const t = q.trim()
    if (t.length < 2 || client) { setClients([]); return }
    const h = setTimeout(async () => {
      const s = t.replace(/[%,()]/g, ' ')
      const { data } = await supabase.from('clients')
        .select('id,dossier,nom,prenom,rue,num_maison,boite,cp,localite,date_naissance,email')
        .or(`nom.ilike.%${s}%,prenom.ilike.%${s}%,dossier.ilike.%${s}%`).limit(15)
      setClients(data || [])
    }, 300)
    return () => clearTimeout(h)
  }, [q, client])

  async function choisirClient(c) {
    setClient(c); setClients([]); setContrat(null); setEtat({})
    const { data } = await supabase.from('contrats')
      .select('id,police,compagnie,domaine,type_production,situation,etat_contrat,date_creation')
      .eq('dossier', c.dossier).order('date_creation', { ascending: false })
    setContrats((data || []).filter(x => !/vie et placements/i.test(x.domaine || '')))
  }

  async function choisirContrat(k) {
    setContrat(k); setPdfNom(''); setPdfInfo('')
    setProduit([k.compagnie, k.type_production].filter(Boolean).join(' — '))
    const [{ data: obj }, { data: cat }] = await Promise.all([
      supabase.from('objets_risque').select('garantie,description,type_risque').eq('police', k.police),
      supabase.from('v_garanties_catalogue').select('garantie,n').eq('domaine', k.domaine).order('n', { ascending: false }),
    ])
    const fr = g => traduitGarantie(g) || g
    const souscrites = [...new Set((obj || []).map(o => fr(o.garantie)).filter(Boolean))]
    const cata = [...new Set([...souscrites, ...(cat || []).map(c => fr(c.garantie))])]
    setCatalogue(cata)
    setEtat(Object.fromEntries(cata.map(g => [g, souscrites.includes(g) ? 'S' : ''])))
    const desc = [...new Set((obj || []).map(o => o.description).filter(Boolean))].join(' ; ')
    setRisque([k.domaine, desc].filter(Boolean).join(' — '))
  }

  async function importerPdf(file) {
    if (!file) return
    setPdfNom(file.name); setPdfInfo('Lecture du PDF…')
    try {
      const txt = await textePdf(file)
      const ajout = catalogue.filter(g => etat[g] !== 'S' && trouveDansTexte(g, txt))
      setEtat(prev => ({ ...prev, ...Object.fromEntries(ajout.map(g => [g, 'S'])) }))
      setPdfInfo(ajout.length ? `${ajout.length} garantie(s) ajoutée(s) depuis le PDF — à vérifier : ${ajout.join(', ')}.` : 'Aucune garantie supplémentaire détectée dans le PDF.')
    } catch (e) { setPdfInfo('PDF illisible (scan ?). Cochez les garanties manuellement.') }
  }

  const souscrites = catalogue.filter(g => etat[g] === 'S')
  const refusees = catalogue.filter(g => etat[g] === 'R')
  const motivAuto = useMemo(() => genererMotivation({
    produit, compagnie: null, domaine: contrat?.domaine, risque, souscrites, refusees, raison,
  }), [produit, contrat, risque, souscrites.join('|'), refusees.join('|'), raison])
  useEffect(() => { if (!motivManuelle) setMotivation(motivAuto) }, [motivAuto, motivManuelle])

  const gestionnaire = perms?.nom || perms?.collab_code || user?.email || ''
  const donnees = () => ({
    client, risque, souscrites, refusees, produit, conseil, suitConseil: suit, produitAlternatif: produitAlt,
    motivation, consentEmail, documents: docs, ficheClient, lieu, date: new Date().toISOString(),
    sigClient: sigC, sigGestionnaire: sigG, gestionnaire,
  })

  function apercu() {
    const doc = buildDevoirInfoPdf(donnees())
    window.open(URL.createObjectURL(doc.output('blob')), '_blank')
  }

  async function signerEtArchiver() {
    setMsg(null)
    if (!sigC || !sigG) return setMsg({ err: true, t: 'Les deux signatures (client et gestionnaire) sont requises.' })
    if (!produit.trim()) return setMsg({ err: true, t: 'Indiquez le produit.' })
    if (conseil === 'A' && !suit && !produitAlt.trim()) return setMsg({ err: true, t: 'Indiquez le produit choisi par le client.' })
    setBusy(true)
    try {
      const d = donnees()
      const blob = buildDevoirInfoPdf(d).output('blob')
      const dos = (client.dossier || 'sans-dossier').replace(/\//g, '-')
      const path = `${dos}/DI_${contrat?.police || 'contrat'}_${Date.now()}.pdf`
      const up = await supabase.storage.from('devoir-info').upload(path, blob, { contentType: 'application/pdf' })
      if (up.error) throw up.error
      const { sigClient, sigGestionnaire, client: _c, ...reste } = d
      const ins = await supabase.from('dyn_devoir_info').insert({
        client_id: client.id, dossier: client.dossier, police: contrat?.police, compagnie: contrat?.compagnie,
        domaine: contrat?.domaine, produit, conseil, suit_conseil: conseil === 'A' ? suit : null,
        garanties_souscrites: souscrites, garanties_refusees: refusees, motivation, data: reste,
        pdf_path: path, lieu, collaborateur_code: perms?.collab_code || null,
      })
      if (ins.error) throw ins.error
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = `Devoir_information_${client.nom || ''}_${contrat?.police || ''}.pdf`; a.click()
      setMsg({ err: false, t: 'Document signé, archivé et téléchargé.' })
    } catch (e) { setMsg({ err: true, t: `Échec de l'archivage : ${e.message || e}` }) }
    setBusy(false)
  }

  const reset = () => { setClient(null); setQ(''); setContrats([]); setContrat(null); setEtat({}); setCatalogue([]); setSigC(null); setSigG(null); setMsg(null); setRaison(''); setMotivManuelle(false) }
  const etatBtn = (g, v, txt, coul) => (
    <button type="button" onClick={() => setEtat(p => ({ ...p, [g]: p[g] === v ? '' : v }))}
      style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: `1px solid ${etat[g] === v ? coul : '#e2e8f0'}`, background: etat[g] === v ? coul : '#fff', color: etat[g] === v ? '#fff' : '#475569', fontWeight: 600 }}>{txt}</button>
  )

  return (
    <Layout currentPage="Devoir d'information">
      <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%', maxWidth: 780 }}>
        <Link to="/tools" style={{ fontSize: 12.5, color: '#64748b', textDecoration: 'none' }}>← Outils</Link>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: '6px 0 2px' }}>Devoir d'information — non-vie</h1>
        <div style={{ fontSize: 14, color: '#8A9BBE', marginBottom: 18 }}>Client, contrat, conditions particulières, vérification, signature</div>

        <div style={card}>
          <div style={h2}>1. Client et contrat</div>
          {!client ? (
            <>
              <input style={inp} placeholder="Nom, prénom ou n° de dossier" value={q} onChange={e => setQ(e.target.value)} />
              {clients.map(c => (
                <div key={c.id} onClick={() => choisirClient(c)} style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 14 }}>
                  <b>{c.nom} {c.prenom}</b> <span style={{ color: '#64748b' }}>— {c.dossier} — {c.localite}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14 }}><b>{client.nom} {client.prenom}</b> — dossier {client.dossier}</div>
                <button style={{ ...btn2, padding: '4px 12px', fontSize: 12 }} onClick={reset}>Changer</button>
              </div>
              <span style={lab}>Contrat non-vie</span>
              <select style={inp} value={contrat?.id || ''} onChange={e => { const k = contrats.find(x => String(x.id) === e.target.value); if (k) choisirContrat(k) }}>
                <option value="">— Choisir un contrat ({contrats.length}) —</option>
                {contrats.map(k => <option key={k.id} value={k.id}>{k.compagnie} — {k.type_production || k.domaine} — police {k.police} ({k.situation || k.etat_contrat || ''})</option>)}
              </select>
            </>
          )}
        </div>

        {contrat && (<>
          <div style={card}>
            <div style={h2}>2. Conditions particulières (PDF)</div>
            <input type="file" accept=".pdf" onChange={e => importerPdf(e.target.files?.[0])} />
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 6 }}>
              {pdfNom ? pdfInfo : 'Facultatif : les garanties connues de Brio sont déjà cochées. Le PDF complète la liste (contrat récent pas encore synchronisé).'}
            </div>
          </div>

          <div style={card}>
            <div style={h2}>3. Vérification</div>
            <span style={lab}>Risque à assurer</span>
            <input style={inp} value={risque} onChange={e => setRisque(e.target.value)} />
            <span style={lab}>Produit recommandé / souscrit</span>
            <input style={inp} value={produit} onChange={e => setProduit(e.target.value)} />

            <span style={lab}>Garanties — souscrite ou refusée par le client</span>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
              {catalogue.length === 0 && <div style={{ padding: 10, fontSize: 13, color: '#64748b' }}>Aucune garantie connue pour cette branche.</div>}
              {catalogue.map(g => (
                <div key={g} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #f1f5f9', gap: 8 }}>
                  <span style={{ fontSize: 13.5 }}>{g}</span>
                  <span style={{ display: 'flex', gap: 6 }}>{etatBtn(g, 'S', 'Souscrite', '#16a34a')}{etatBtn(g, 'R', 'Refusée', '#dc2626')}</span>
                </div>
              ))}
            </div>

            <span style={lab}>Type de conseil</span>
            <label style={{ display: 'block', fontSize: 14, margin: '4px 0' }}><input type="radio" checked={conseil === 'A'} onChange={() => setConseil('A')} /> II.A — Notre bureau fournit un conseil (analyse impartiale)</label>
            <label style={{ display: 'block', fontSize: 14, margin: '4px 0' }}><input type="radio" checked={conseil === 'B'} onChange={() => setConseil('B')} /> II.B — Pas de conseil</label>

            {conseil === 'A' && (<>
              <label style={{ display: 'block', fontSize: 14, margin: '8px 0 4px' }}><input type="checkbox" checked={!suit} onChange={e => setSuit(!e.target.checked)} /> Le client ne suit pas le conseil</label>
              {!suit && <input style={inp} placeholder="Produit choisi par le client" value={produitAlt} onChange={e => setProduitAlt(e.target.value)} />}
              <span style={lab}>Raison du choix de ce produit (conseillé)</span>
              <input style={inp} placeholder="Franchise plus basse, prime, service sinistres…" value={raison} onChange={e => setRaison(e.target.value)} />
              <span style={lab}>Conseil personnalisé (généré depuis les garanties, modifiable)</span>
              <textarea style={{ ...inp, minHeight: 130 }} value={motivation} onChange={e => { setMotivation(e.target.value); setMotivManuelle(true) }} />
              {motivManuelle && <button style={{ ...btn2, padding: '4px 12px', fontSize: 12, marginTop: 6 }} onClick={() => setMotivManuelle(false)}>Régénérer depuis les garanties</button>}
            </>)}

            <span style={lab}>Information</span>
            <label style={{ display: 'block', fontSize: 14, margin: '4px 0' }}><input type="checkbox" checked={consentEmail} onChange={e => setConsentEmail(e.target.checked)} /> Le client accepte les informations par voie électronique ({client.email || 'pas d\'e-mail en base'})</label>
            {DOCS.map(x => (
              <label key={x} style={{ display: 'block', fontSize: 14, margin: '4px 0' }}><input type="checkbox" checked={docs.includes(x)} onChange={e => setDocs(p => e.target.checked ? [...p, x] : p.filter(y => y !== x))} /> {x} remis(es)</label>
            ))}
            <label style={{ display: 'block', fontSize: 14, margin: '4px 0' }}><input type="checkbox" checked={ficheClient} onChange={e => setFicheClient(e.target.checked)} /> Fiche client parcourue avec le client</label>
            <span style={lab}>Fait à</span>
            <input style={inp} value={lieu} onChange={e => setLieu(e.target.value)} />
          </div>

          <div style={card}>
            <div style={h2}>4. Signatures</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <SignaturePad label={`Client — ${client.prenom || ''} ${client.nom || ''}`} onChange={setSigC} />
              <SignaturePad label={`Dynassur — ${gestionnaire}`} onChange={setSigG} />
            </div>
            {msg && <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, background: msg.err ? '#fef2f2' : '#f0fdf4', color: msg.err ? '#991b1b' : '#166534' }}>{msg.t}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button style={btn2} onClick={apercu}>Aperçu PDF</button>
              <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={signerEtArchiver}>{busy ? 'Archivage…' : 'Signer et archiver'}</button>
            </div>
          </div>
        </>)}
      </div>
    </Layout>
  )
}
