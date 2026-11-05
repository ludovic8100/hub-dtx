// Bouton de rechargement Qlik → Supabase.
//
// C'est la SEULE synchronisation externe qui subsiste dans le Hub : Qlik reste la source
// des clients, des contrats et du statut de production (N.A., Renon…) tant que les équipes
// y travaillent. Tout ce qui est financier (comptes, quittances, commissions, objectifs)
// ne vient plus de Qlik mais des comptes bancaires (Ponto) et des bordereaux.
//
// Le clic appelle la fonction serverless /api/reload-qlik, qui déclenche la GitHub Action
// `qlik-sync.yml`. Aucun passage par n8n.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const COULEUR = '#0080BD'

// Lance le reload et renvoie { ok, status, error }
export async function lancerSyncQlik() {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token || ''
    const r = await fetch('/api/declencher?workflow=qlik', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    const body = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, error: body.error }
  } catch { return { ok: false } }
}

const messageErreur = (res) => {
  if (res?.status === 401) return 'Session expirée. Reconnecte-toi au hub, puis réessaie.'
  if (res?.status === 500) return 'Variable GITHUB_DISPATCH_TOKEN manquante dans Vercel (Settings → Environment Variables).'
  if (res?.status === 502) return 'GitHub a refusé le déclenchement : le token GITHUB_DISPATCH_TOKEN est invalide ou insuffisant.'
  return 'Échec du rechargement Qlik. Réessaie.'
}

export function BoutonSyncQlik({ style, onDark, compact }) {
  const [etat, setEtat] = useState('idle')
  const [erreur, setErreur] = useState(null)
  const [dernier, setDernier] = useState(null)

  // Dernière donnée réellement écrite par la synchro : les contrats sont la table pivot.
  const chargerDernier = async () => {
    try {
      const { data } = await supabase.from('contrats')
        .select('updated_at').not('updated_at', 'is', null)
        .order('updated_at', { ascending: false }).limit(1)
      if (data && data[0]) setDernier(data[0].updated_at)
    } catch {}
  }
  useEffect(() => { chargerDernier() }, [])

  const lancer = async () => {
    if (etat === 'running') return
    setEtat('running'); setErreur(null)
    let fini = false
    const garde = setTimeout(() => {
      if (!fini) { setEtat('error'); setErreur("Délai dépassé — le service n'a pas répondu. Réessaie.") }
    }, 45000)
    const res = await lancerSyncQlik()
    fini = true; clearTimeout(garde)
    if (res.ok) {
      setEtat('ok')
      setTimeout(() => { chargerDernier(); setEtat('idle') }, 8000)
      setTimeout(() => { chargerDernier() }, 55000)
    } else {
      setEtat('error'); setErreur(messageErreur(res))
    }
  }

  const running = etat === 'running'
  const fond = onDark
    ? (running ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.92)')
    : (running ? '#f1f5f9' : etat === 'ok' ? '#f0fdf4' : etat === 'error' ? '#fef2f2' : '#fff')
  const bordure = onDark ? '1px solid rgba(255,255,255,0.3)' : (etat === 'error' ? '1px solid #fecaca' : '1px solid #e2e8f0')
  const couleurIcone = running ? '#94a3b8' : etat === 'ok' ? '#16a34a' : etat === 'error' ? '#dc2626' : COULEUR
  const dateSync = dernier
    ? new Date(dernier).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')
    : null

  return (
    <div style={{ position: 'relative', flexShrink: 0, ...style }}>
      <button onClick={lancer} disabled={running}
        title="Recharge depuis Qlik les clients, les contrats et le statut de production (quelques minutes en arrière-plan)"
        style={{
          display: 'flex', alignItems: 'center', gap: compact ? 5 : 7,
          padding: compact ? '4px 9px' : '7px 12px', borderRadius: compact ? 7 : 8,
          border: bordure, background: fond, cursor: running ? 'wait' : 'pointer',
          fontSize: compact ? 11.5 : 12, fontWeight: 600, fontFamily: "'Source Sans Pro', sans-serif",
          color: onDark ? '#1e293b' : '#334155', whiteSpace: 'nowrap',
        }}>
        <i className={`ti ${running ? 'ti-loader-2' : etat === 'ok' ? 'ti-check' : etat === 'error' ? 'ti-x' : 'ti-database-import'}`}
          style={{ color: couleurIcone, fontSize: compact ? 14 : 15, animation: running ? 'spin 1s linear infinite' : 'none' }} />
        <span>{compact ? 'Qlik' : 'Recharger depuis Qlik'}</span>
        {dateSync && (
          <span title="Dernière donnée reçue (heure belge)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingLeft: 6, borderLeft: '1px solid #e2e8f0', color: '#334155', fontSize: compact ? 10 : 11, fontWeight: 600 }}>
            <i className="ti ti-clock" style={{ fontSize: compact ? 11 : 12, color: '#64748b' }} />
            {dateSync}
          </span>
        )}
      </button>
      {erreur && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, minWidth: 240, maxWidth: 340, background: '#fff', border: '1px solid #fecaca', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <i className="ti ti-alert-triangle" style={{ color: '#dc2626', fontSize: 16, marginTop: 1 }} />
            <div style={{ flex: 1, fontSize: 12, color: '#334155', lineHeight: 1.45 }}>{erreur}</div>
            <button onClick={(e) => { e.stopPropagation(); setErreur(null) }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BoutonSyncQlik
