// Bouton « Traiter maintenant » de la comptabilité.
//
// Une facture déposée dans SharePoint n'existait dans le Hub qu'au scan de
// 5h37 le lendemain — et n'allait pas plus loin sans qu'on lance à la main la
// lecture, le renommage et le rapprochement. Ce bouton enchaîne les quatre.
//
// Le clic appelle /api/traiter-factures, qui déclenche la GitHub Action
// `factures-entrantes.yml`. Pas de passage par n8n. Le traitement tourne
// aussi tout seul toutes les heures : le bouton sert à ne pas attendre.
//
// Le travail prend environ deux minutes. On ne fait donc PAS patienter devant
// un sablier : on confirme le lancement, et on affiche l'heure du dernier
// passage réussi, lue dans le journal des synchronisations.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { COUL } from '../lib/theme'

const messageErreur = (res) => {
  if (res?.status === 401) return 'Session expirée. Reconnecte-toi au hub, puis réessaie.'
  if (res?.status === 500) return 'Variable GITHUB_DISPATCH_TOKEN manquante dans Vercel (Settings → Environment Variables).'
  if (res?.status === 502) return 'GitHub a refusé le déclenchement : le token GITHUB_DISPATCH_TOKEN est invalide ou insuffisant.'
  return 'Échec du lancement. Réessaie.'
}

export default function TraiterFactures({ color = COUL.bleu }) {
  const [etat, setEtat] = useState('idle')      // idle | running | ok | error
  const [erreur, setErreur] = useState(null)
  const [dernier, setDernier] = useState(null)

  const chargerDernier = async () => {
    try {
      const { data } = await supabase.from('jobs_log')
        .select('termine_a,lignes_ecrites')
        .eq('job', 'factures-entrantes').eq('statut', 'succes')
        .not('termine_a', 'is', null)
        .order('termine_a', { ascending: false }).limit(1)
      if (data && data[0]) setDernier(data[0])
    } catch { /* le bouton doit marcher même sans journal */ }
  }
  useEffect(() => { chargerDernier() }, [])

  const lancer = async () => {
    if (etat === 'running') return
    setEtat('running'); setErreur(null)
    let res = { ok: false }
    try {
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token || ''
      const r = await fetch('/api/declencher?workflow=factures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      const body = await r.json().catch(() => ({}))
      res = { ok: r.ok, status: r.status, error: body.error }
    } catch { res = { ok: false } }

    if (res.ok) {
      setEtat('ok')
      // Le traitement dure ~2 minutes : on revient chercher le résultat.
      setTimeout(() => { chargerDernier() }, 90000)
      setTimeout(() => { chargerDernier(); setEtat('idle') }, 180000)
    } else {
      setEtat('error'); setErreur(messageErreur(res))
    }
  }

  const running = etat === 'running'
  const fond = running ? '#f1f5f9' : etat === 'ok' ? '#f0fdf4' : etat === 'error' ? '#fef2f2' : COUL.blanc
  const bordure = etat === 'error' ? '1px solid #fecaca' : etat === 'ok' ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
  const couleurIcone = running ? '#94a3b8' : etat === 'ok' ? '#16a34a' : etat === 'error' ? '#dc2626' : color
  const quand = dernier?.termine_a
    ? new Date(dernier.termine_a).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')
    : null

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={lancer} disabled={running}
        title="Scanne SharePoint, lit les nouveaux PDF, renomme les fichiers et rapproche les paiements. Environ deux minutes. Tourne aussi tout seul toutes les heures."
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8,
          border: bordure, background: fond, cursor: running ? 'wait' : 'pointer',
          fontSize: 12, fontWeight: 600, fontFamily: "'Source Sans Pro', sans-serif",
          color: COUL.texteSombre, whiteSpace: 'nowrap',
        }}>
        <i className={`ti ${running ? 'ti-loader-2' : etat === 'ok' ? 'ti-check' : etat === 'error' ? 'ti-x' : 'ti-file-import'}`}
          style={{ color: couleurIcone, fontSize: 15, animation: running ? 'spin 1s linear infinite' : 'none' }} />
        <span>{etat === 'ok' ? 'Lancé — environ 2 min' : 'Traiter les factures'}</span>
        {quand && etat !== 'ok' && (
          <span title="Dernier passage réussi (heure belge)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingLeft: 6, borderLeft: '1px solid #e2e8f0', color: COUL.texteSombre, fontSize: 11, fontWeight: 600 }}>
            <i className="ti ti-clock" style={{ fontSize: 12, color: COUL.texteDoux }} />
            {quand}
          </span>
        )}
      </button>
      {erreur && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, minWidth: 240, maxWidth: 340, background: COUL.surface, border: '1px solid #fecaca', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <i className="ti ti-alert-triangle" style={{ color: COUL.danger, fontSize: 16, marginTop: 1 }} />
            <div style={{ flex: 1, fontSize: 12, color: COUL.texteSombre, lineHeight: 1.45 }}>{erreur}</div>
            <button onClick={(e) => { e.stopPropagation(); setErreur(null) }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: COUL.texteFaible, fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
          </div>
        </div>
      )}
    </div>
  )
}
