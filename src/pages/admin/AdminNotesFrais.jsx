import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'
import { genererPdfNote } from '../../lib/notesFraisPdf'

const NAVY = '#0D2F5E'
const CAT_KM = 'Kilométrique'
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n }
const eur = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtD = d => { try { return d ? new Date(d).toLocaleDateString('fr-BE') : '—' } catch { return '—' } }
const isKm = l => l.categorie === CAT_KM
function calcLigne(l) {
  if (isKm(l)) { const ttc = Math.round(num(l.km_distance) * num(l.km_taux) * 100) / 100; return { montant_ttc: ttc, taux_tva: 0, montant_tva: 0, montant_ht: ttc } }
  const ttc = num(l.montant_ttc), t = num(l.taux_tva)
  const tva = Math.round(ttc * t / (100 + t) * 100) / 100
  return { montant_ttc: ttc, taux_tva: t, montant_tva: tva, montant_ht: Math.round((ttc - tva) * 100) / 100 }
}
const btn = (bg, col = '#fff', border = 'none') => ({ padding: '9px 16px', borderRadius: 9, border, background: bg, color: col, fontSize: 14, fontWeight: 700, cursor: 'pointer' })
const ENT = k => ENTITES[k] || ENTITES.dynassur

export default function AdminNotesFrais() {
  const { user, perms } = useAuth()
  const myNom = perms?.nom || user?.email || ''
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)
  const [lignes, setLignes] = useState([])
  const [busy, setBusy] = useState(false)
  const [motif, setMotif] = useState('')
  const [showRefus, setShowRefus] = useState(false)
  const [flash, setFlash] = useState(null)

  async function load() {
    setLoading(true)
    let all = [], from = 0
    for (; ;) {
      const { data, error } = await supabase.from('notes_frais').select('*').eq('statut', 'soumise').order('soumise_at', { ascending: true }).range(from, from + 999)
      if (error || !data) break
      all = all.concat(data)
      if (data.length < 1000) break
      from += 1000
    }
    setRows(all); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function notify(ok, msg) { setFlash({ ok, msg }); setTimeout(() => setFlash(null), 4500) }

  async function examiner(n) {
    setSel(n); setShowRefus(false); setMotif('')
    const { data } = await supabase.from('notes_frais_lignes').select('*').eq('note_id', n.id).order('ordre')
    setLignes((data || []).map(l => ({ ...l, ...calcLigne(l) })))
  }

  async function approuver() {
    if (!sel || busy) return
    setBusy(true)
    try {
      const { data: v, error: ev } = await supabase.rpc('nf_valider', { p_note_id: sel.id })
      if (ev) throw ev
      const nowIso = new Date().toISOString()
      try {
        const blob = await genererPdfNote({
          entiteKey: sel.societe,
          note: { ...sel, numero: v?.numero, total: v?.total, validee_at: nowIso },
          lignes,
          benefNom: v?.benef_nom, benefIban: v?.benef_iban,
          sigImage: sel.sig_image, sigNom: sel.sig_nom, sigAt: sel.sig_at,
          valideParNom: myNom, valideAt: nowIso,
        })
        const path = `${sel.societe}/pieces/${sel.id}.pdf`
        const up = await supabase.storage.from('notes-frais').upload(path, blob, { upsert: true, contentType: 'application/pdf' })
        if (!up.error) {
          const { data: su } = await supabase.storage.from('notes-frais').createSignedUrl(path, 60 * 60 * 24 * 365)
          await supabase.rpc('nf_set_piece', { p_note_id: sel.id, p_path: path, p_url: su?.signedUrl || null })
        }
      } catch (e) { console.error('Pièce PDF :', e) }
      notify(true, `Note ${v?.numero || ''} approuvée — pièce et dépense générées.`)
      setSel(null); setLignes([]); load()
    } catch (e) { notify(false, 'Échec de la validation : ' + (e.message || e)) }
    setBusy(false)
  }

  async function refuser() {
    if (!sel || busy) return
    if (!motif.trim()) { notify(false, 'Indiquez un motif de renvoi.'); return }
    setBusy(true)
    const { error } = await supabase.rpc('nf_refuser', { p_note_id: sel.id, p_motif: motif.trim() })
    setBusy(false)
    if (error) { notify(false, 'Échec : ' + error.message); return }
    notify(true, 'Note renvoyée au collaborateur.')
    setSel(null); setLignes([]); setShowRefus(false); setMotif(''); load()
  }

  const totTTC = lignes.reduce((s, l) => s + (Number(l.montant_ttc) || 0), 0)

  return (
    <Layout>
      <StatBanner color={NAVY} colorDark="#081d3d" title="Validation des notes de frais" subtitle="Administration" />
      <div style={{ padding: '0 4px' }}>
        {flash && <div style={{ margin: '12px 0', padding: '10px 14px', borderRadius: 10, fontSize: 13.5, background: flash.ok ? '#f0fdf4' : '#fef2f2', color: flash.ok ? '#166534' : '#b91c1c', border: `1px solid ${flash.ok ? '#bbf7d0' : '#fecaca'}` }}>{flash.msg}</div>}

        {!sel && (
          <div style={{ marginTop: 14 }}>
            {loading ? <div style={{ color: '#64748b', fontSize: 14 }}>Chargement…</div>
              : rows.length === 0 ? <div style={{ color: '#64748b', fontSize: 14, padding: '30px 0', textAlign: 'center' }}>Aucune note en attente de validation.</div>
                : <div style={{ display: 'grid', gap: 10 }}>
                  {rows.map(n => { const e = ENT(n.societe); return (
                    <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{n.titre || 'Note de frais'} <span style={{ color: '#94a3b8', fontWeight: 500 }}>· {e.label}</span></div>
                        <div style={{ fontSize: 12.5, color: '#64748b' }}>{n.auteur_nom || n.auteur_email} · {n.periode || '—'} · soumise le {fmtD(n.soumise_at)}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: NAVY, fontSize: 15 }}>{eur(n.total)}</div>
                      <button onClick={() => examiner(n)} style={{ ...btn('#fff', NAVY, '1px solid #cbd5e1'), padding: '7px 14px', fontSize: 13 }}>Examiner</button>
                    </div>
                  ) })}
                </div>}
          </div>
        )}

        {sel && (
          <div style={{ maxWidth: 900, margin: '16px auto 40px' }}>
            <button onClick={() => { setSel(null); setLignes([]) }} style={{ ...btn('#fff', '#475569', '1px solid #e2e8f0'), marginBottom: 14 }}>← Retour à la liste</button>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>{sel.titre || 'Note de frais'}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>{ENT(sel.societe).label} · {sel.auteur_nom || sel.auteur_email} · {sel.periode || '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Total à rembourser</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: ENT(sel.societe).color }}>{eur(sel.total || totTTC)}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
                <thead><tr>
                  {['Date', 'Catégorie', 'Description', 'HT', 'TVA', 'TTC', 'Justif.'].map((h, i) => <th key={i} style={{ padding: '8px 8px', textAlign: (i > 2 && i < 6) ? 'right' : (i === 6 ? 'center' : 'left'), fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i}>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9' }}>{fmtD(l.date)}</td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9' }}>{l.categorie || '—'}</td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9' }}>{l.description || (isKm(l) ? 'Indemnité kilométrique' : '—')}</td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{eur(l.montant_ht)}</td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{isKm(l) ? '—' : eur(l.montant_tva)}</td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 700 }}>{eur(l.montant_ttc)}</td>
                      <td style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>{isKm(l) ? '—' : (l.justificatif_path ? '✓' : '⚠')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Signature du collaborateur</div>
                {sel.sig_image ? <img src={sel.sig_image} alt="Signature" style={{ maxWidth: 240, maxHeight: 90, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }} />
                  : <div style={{ fontSize: 13, color: '#b45309' }}>Aucune signature enregistrée.</div>}
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{sel.sig_nom || sel.auteur_nom} · signé le {fmtD(sel.sig_at)}</div>
              </div>

              {sel.note && <div style={{ marginTop: 14, fontSize: 13, color: '#475569', background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}><b>Commentaire :</b> {sel.note}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                <button onClick={() => setShowRefus(v => !v)} disabled={busy} style={btn('#fff', '#b91c1c', '1px solid #fecaca')}>Renvoyer au brouillon</button>
                <button onClick={approuver} disabled={busy} style={{ ...btn('#16a34a'), opacity: busy ? .5 : 1 }}>{busy ? 'Traitement…' : 'Approuver et générer la pièce'}</button>
              </div>

              {showRefus && (
                <div style={{ marginTop: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c', marginBottom: 8 }}>Motif du renvoi (visible par le collaborateur)</div>
                  <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Ex. : justificatif illisible pour la ligne restaurant du 12/06…" />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button onClick={refuser} disabled={busy} style={{ ...btn('#dc2626'), opacity: busy ? .5 : 1 }}>Confirmer le renvoi</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
