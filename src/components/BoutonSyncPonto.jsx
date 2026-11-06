// Bouton « Sync PONTO » — relance la récupération des soldes et des mouvements.
//
// Ponto lit les banques 4 fois par jour (vers 2h, 8h, 14h, 20h) et le Hub le relit
// à 3h15, 9h15, 15h15 et 21h15. Ce bouton sert à ne pas attendre la lecture suivante,
// typiquement en fin de journée avant de travailler sur la comptabilité.
//
// Le déclenchement passe par la fonction `lancer_sync_ponto()` : le secret reste en
// base, jamais dans le navigateur. Comme pg_net n'attend pas la réponse, on suit le
// résultat dans `jobs_log` — le journal du garde-fou — jusqu'à ce que l'exécution se
// termine. Le bouton annonce alors combien d'opérations sont réellement arrivées,
// plutôt que de dire « lancée » et de se taire.

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { COUL } from '../lib/theme'

// Pastille aux couleurs de Ponto, dessinée ici : on n'embarque pas leur logo, qui ne
// nous appartient pas. Le relief vient d'un dégradé diagonal, d'un reflet sur la
// moitié haute et d'une ombre portée.
export const IconeSyncPonto = ({ taille = 18, anime = false }) => (
  <svg width={taille} height={taille} viewBox="0 0 48 48" aria-hidden
       style={{ flexShrink: 0, animation: anime ? 'spin 1.1s linear infinite' : 'none' }}>
    <defs>
      <linearGradient id="pontoCorps" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="#FFE873" />
        <stop offset="45%"  stopColor="#FFCE1F" />
        <stop offset="100%" stopColor="#E09B00" />
      </linearGradient>
      <linearGradient id="pontoReflet" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor={COUL.blanc} stopOpacity="0.75" />
        <stop offset="100%" stopColor={COUL.blanc} stopOpacity="0" />
      </linearGradient>
      <filter id="pontoOmbre" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" floodColor="#8A5B00" floodOpacity="0.38" />
      </filter>
    </defs>
    <g filter="url(#pontoOmbre)">
      <circle cx="24" cy="23" r="20" fill="url(#pontoCorps)" />
      <ellipse cx="24" cy="14" rx="15" ry="9" fill="url(#pontoReflet)" />
      <path d="M15 21a9 9 0 0 1 15.2-4.4l2.6-2.6v8.2h-8.2l3.1-3.1A6 6 0 0 0 18 21z"
            fill="#6B4300" fillOpacity="0.92" />
      <path d="M33 25a9 9 0 0 1-15.2 4.4l-2.6 2.6v-8.2h8.2l-3.1 3.1A6 6 0 0 0 30 25z"
            fill="#6B4300" fillOpacity="0.92" />
    </g>
  </svg>
)

// `surFonce` : le bouton vit aussi dans l'en-tête sombre du tableau de bord général,
// où un message gris ardoise devient illisible.
export default function BoutonSyncPonto({ onTermine, style, surFonce = false }) {
  const [etat, setEtat] = useState('idle')   // idle | running | ok | error
  const [message, setMessage] = useState(null)

  async function lancer() {
    if (etat === 'running') return
    setEtat('running'); setMessage('Lancement…')
    const debut = new Date(Date.now() - 2000).toISOString()   // petite marge d'horloge

    try {
      const { data, error } = await supabase.rpc('lancer_sync_ponto')
      if (error) throw error
      if (!data?.ok) {
        setEtat('error')
        setMessage(data?.message || 'Synchronisation refusée.')
        setTimeout(() => { setEtat('idle'); setMessage(null) }, 7000)
        return
      }

      setMessage('Synchronisation en cours…')
      // Jusqu'à ~60 s : une lecture complète des 13 comptes prend une vingtaine de
      // secondes, davantage quand Ponto remonte plusieurs pages d'historique.
      for (let essai = 0; essai < 30; essai++) {
        await new Promise(r => setTimeout(r, 2000))
        const { data: journal } = await supabase
          .from('jobs_log')
          .select('statut,message,lignes_ecrites')
          .eq('job', 'sync-ponto-comptes')
          .gte('demarre_a', debut)
          .order('demarre_a', { ascending: false })
          .limit(1)

        const execution = journal?.[0]
        if (!execution || execution.statut === 'en_cours') continue

        if (onTermine) await onTermine()
        if (execution.statut === 'echec') {
          setEtat('error')
          setMessage(execution.message || 'La synchronisation a échoué.')
        } else {
          const n = execution.lignes_ecrites ?? 0
          setEtat('ok')
          setMessage(n > 0
            ? `${n} nouvelle${n > 1 ? 's' : ''} opération${n > 1 ? 's' : ''}`
            : 'Aucune nouvelle opération')
        }
        setTimeout(() => { setEtat('idle'); setMessage(null) }, 10000)
        return
      }

      // Le journal n'a rien conclu : on ne prétend pas que c'est fini.
      setEtat('error')
      setMessage('Toujours en cours — voir Outils → Synchronisations.')
      setTimeout(() => { setEtat('idle'); setMessage(null) }, 10000)
    } catch (e) {
      setEtat('error'); setMessage('Échec : ' + (e.message || e))
      setTimeout(() => { setEtat('idle'); setMessage(null) }, 7000)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
      {message && (
        <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
          color: etat === 'error'
            ? (surFonce ? '#fca5a5' : COUL.danger)
            : etat === 'ok'
              ? (surFonce ? '#86efac' : COUL.succes)
              : (surFonce ? 'rgba(255,255,255,0.85)' : COUL.texteDoux) }}>
          {message}
        </span>
      )}
      <button
        onClick={lancer}
        disabled={etat === 'running'}
        title="Relancer la synchronisation Ponto maintenant (sinon automatique à 3h, 9h, 15h et 21h)"
        style={{ fontSize: 11.5, color: COUL.texteSombre, background: etat === 'running' ? '#f8fafc' : COUL.blanc,
          border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 11px 4px 7px',
          cursor: etat === 'running' ? 'default' : 'pointer', fontWeight: 700,
          fontFamily: 'inherit', letterSpacing: '.01em', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: etat === 'running' ? 'none' : '0 1px 2px rgba(15,23,42,0.06)' }}>
        <IconeSyncPonto anime={etat === 'running'} />
        <span>Sync <span style={{ fontWeight: 800 }}>PONTO</span></span>
      </button>
    </div>
  )
}
