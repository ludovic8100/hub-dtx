import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { LODE } from '../../lib/lodeConfig'
import { DTX } from '../../lib/dtxConfig'
import { DYN } from '../../lib/dynConfig'

// Le token est cherché dans chaque entité (tables cloisonnées) jusqu'à trouver le devis.
const ENTITES = [
  { rpc: 'lode_devis_public', dec: 'lode_devis_decision', cfg: LODE },
  { rpc: 'dtx_devis_public',  dec: 'dtx_devis_decision',  cfg: DTX },
  { rpc: 'dyn_devis_public',  dec: 'dyn_devis_decision',  cfg: DYN },
]

const eur = v => (Number(v) || 0).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' })
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

export default function LodeDevisAccept() {
  const { token } = useParams()
  const [devis, setDevis] = useState(null)
  const [lignes, setLignes] = useState([])
  const [ent, setEnt] = useState(null)          // entité reconnue { rpc, dec, cfg }
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      for (const e of ENTITES) {
        const { data, error } = await supabase.rpc(e.rpc, { p_token: token })
        if (!alive) return
        if (!error && data && data.devis) {
          setEnt(e); setDevis(data.devis); setLignes(data.lignes || [])
          if (data.devis.statut === 'accepté' || data.devis.statut === 'refusé') setDone(data.devis.statut)
          setLoading(false); return
        }
      }
      if (alive) { setErreur('Ce devis est introuvable ou le lien n\u2019est plus valide.'); setLoading(false) }
    })()
    return () => { alive = false }
  }, [token])

  async function decision(action) {
    if (busy || !ent) return
    if (action === 'refuse' && !confirm('Confirmer le refus de ce devis ?')) return
    setBusy(true); setErreur(null)
    const { data, error } = await supabase.rpc(ent.dec, { p_token: token, p_action: action })
    setBusy(false)
    if (error || !data?.ok) { setErreur('Une erreur est survenue. Merci de réessayer ou de nous contacter.'); return }
    setDone(action === 'accept' ? 'accepté' : 'refusé')
  }

  const cfg = ent?.cfg
  const ORANGE = cfg?.couleur || '#475569'
  const wrap = { minHeight: '100vh', background: '#f1f5f9', fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", padding: '24px 14px', display: 'flex', justifyContent: 'center' }
  const card = { width: '100%', maxWidth: 720, background: '#fff', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,.10)', overflow: 'hidden' }

  if (loading) return <div style={wrap}><div style={{ ...card, padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chargement…</div></div>

  if (erreur && !devis) return (
    <div style={wrap}><div style={{ ...card, padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>🔌</div>
      <h2 style={{ color: '#1e293b', margin: '12px 0 6px' }}>Lien indisponible</h2>
      <p style={{ color: '#64748b', margin: 0 }}>{erreur}</p>
    </div></div>
  )

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ background: `linear-gradient(135deg, ${ORANGE}, #1e293b)`, color: '#fff', padding: '22px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {cfg?.logo_url && <img src={cfg.logo_url} alt={cfg.raison_sociale} style={{ height: 40, background: '#fff', borderRadius: 8, padding: 4 }} />}
            <div>
              <div style={{ fontSize: 13, opacity: .9 }}>Devis</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{devis.numero}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 13, opacity: .95 }}>
            <div>Émis le {fmtDate(devis.date_devis)}</div>
            {devis.date_validite && <div>Valable jusqu'au {fmtDate(devis.date_validite)}</div>}
          </div>
        </div>

        <div style={{ padding: '24px 26px' }}>
          {done && (
            <div style={{ background: done === 'accepté' ? '#dcfce7' : '#fee2e2', color: done === 'accepté' ? '#15803d' : '#b91c1c', borderRadius: 12, padding: '16px 18px', textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 30 }}>{done === 'accepté' ? '✅' : '✋'}</div>
              <div style={{ fontWeight: 800, fontSize: 17, marginTop: 4 }}>{done === 'accepté' ? 'Devis accepté — merci !' : 'Devis refusé'}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{done === 'accepté' ? 'Nous avons bien enregistré votre acceptation et revenons vers vous rapidement.' : 'Votre réponse a bien été enregistrée. N\u2019hésitez pas à nous contacter pour en discuter.'}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Pour</div>
              <div style={{ fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{devis.client_nom}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{[devis.client_adresse, [devis.client_cp, devis.client_ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</div>
            </div>
            {devis.objet && <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Objet</div>
              <div style={{ color: '#1e293b', marginTop: 2 }}>{devis.objet}</div>
            </div>}
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                {['Description', 'Qté', 'P.U. HT', 'TVA', 'Total HT'].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '9px 12px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={l.id || i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 12px', color: '#1e293b' }}>{l.description}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748b' }}>{l.quantite}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748b' }}>{eur(l.prix_unitaire)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748b' }}>{l.tva_pct}%</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>{eur(l.total_ht)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <div style={{ minWidth: 240, fontSize: 14 }}>
              <Row l="Sous-total HTVA" v={eur(devis.total_ht)} />
              <Row l="TVA" v={eur(devis.total_tva)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '2px solid #e2e8f0', marginTop: 6, fontWeight: 800, fontSize: 17, color: ORANGE }}>
                <span>Total</span><span>{eur(devis.total_ttc)}</span>
              </div>
            </div>
          </div>

          {devis.notes && <div style={{ marginTop: 18, fontSize: 13, color: '#64748b', background: '#f8fafc', borderRadius: 8, padding: '12px 14px' }}>{devis.notes}</div>}
          {erreur && devis && <div style={{ marginTop: 16, color: '#b91c1c', fontSize: 13 }}>{erreur}</div>}

          {!done && (
            <div style={{ display: 'flex', gap: 12, marginTop: 26, flexWrap: 'wrap' }}>
              <button onClick={() => decision('accept')} disabled={busy}
                style={{ flex: 1, minWidth: 200, padding: '15px 20px', border: 'none', borderRadius: 12, background: '#16a34a', color: '#fff', fontSize: 16, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>
                {busy ? '…' : '✓ Accepter le devis'}
              </button>
              <button onClick={() => decision('refuse')} disabled={busy}
                style={{ flex: 1, minWidth: 200, padding: '15px 20px', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', color: '#64748b', fontSize: 15, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
                Refuser
              </button>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 26px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
          {cfg?.raison_sociale} · {cfg?.adresse} · {cfg?.email}
        </div>
      </div>
    </div>
  )
}

function Row({ l, v }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#64748b' }}><span>{l}</span><span>{v}</span></div>
}
