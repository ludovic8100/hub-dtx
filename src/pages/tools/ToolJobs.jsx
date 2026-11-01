// Supervision des synchronisations automatiques.
//
// Motif : la synchro Ponto a tourné 11 jours avec une clé invalide sans que
// personne le voie. Un job qui échoue en silence est indiscernable d'un job
// qui n'a rien à faire. Cet écran rend la différence visible : chaque job
// déclare ce qu'il a écrit, et passe au rouge quand il n'a plus rien écrit
// depuis plus longtemps que sa fréquence ne l'autorise.
//
// Lecture seule : les tables jobs_attendus et jobs_log ne sont écrites que par
// les jobs eux-mêmes (service_role).

import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const NAVY = '#0D2F5E'

const ETATS = {
  ok:        { label: 'À jour',      couleur: '#16a34a', fond: '#f0fdf4', bord: '#bbf7d0', icone: 'ti-circle-check' },
  en_retard: { label: 'En retard',   couleur: '#dc2626', fond: '#fef2f2', bord: '#fecaca', icone: 'ti-alert-circle' },
  echec:     { label: 'En échec',    couleur: '#dc2626', fond: '#fef2f2', bord: '#fecaca', icone: 'ti-x' },
  bloque:    { label: 'Bloqué',      couleur: '#b45309', fond: '#fffbeb', bord: '#fde68a', icone: 'ti-hourglass' },
  jamais:    { label: 'Jamais vu',   couleur: '#64748b', fond: '#f8fafc', bord: '#e2e8f0', icone: 'ti-help-circle' },
  inactif:   { label: 'Désactivé',   couleur: '#94a3b8', fond: '#f8fafc', bord: '#e2e8f0', icone: 'ti-player-pause' },
}

const PLATEFORMES = {
  supabase: { label: 'Supabase', couleur: '#3ecf8e' },
  vercel:   { label: 'Vercel',   couleur: '#0f172a' },
  github:   { label: 'GitHub',   couleur: '#6e40c9' },
  n8n:      { label: 'n8n',      couleur: '#ea4b71' },
}

const fmtDate = v => v
  ? new Date(v).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')
  : '—'

// « 3 j 4 h », « 45 min » — un âge lisible d'un coup d'œil
const fmtAge = v => {
  if (!v) return '—'
  const t = Date.now() - new Date(v).getTime()
  if (t < 0) return '—'
  const min = Math.floor(t / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h`
  const j = Math.floor(h / 24)
  return `${j} j ${h % 24} h`
}

const fmtNb = n => n == null ? '—' : Number(n).toLocaleString('fr-BE')

export default function ToolJobs() {
  const [jobs, setJobs] = useState(null)
  const [executions, setExecutions] = useState([])
  const [selection, setSelection] = useState(null)

  const charger = async () => {
    const [{ data: s }, { data: e }] = await Promise.all([
      supabase.from('v_jobs_sante').select('*').order('plateforme').order('job'),
      supabase.from('jobs_log').select('*').order('demarre_a', { ascending: false }).limit(100),
    ])
    setJobs(s || [])
    setExecutions(e || [])
  }
  useEffect(() => { charger() }, [])

  const enAlerte = (jobs || []).filter(j => ['en_retard', 'echec', 'bloque'].includes(j.sante))
  const lignes = selection ? executions.filter(e => e.job === selection) : executions

  return (
    <Layout currentPage="Outils">
      <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: 0 }}>Synchronisations</h1>
          <button onClick={charger}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#334155', fontFamily: 'inherit' }}>
            <i className="ti ti-reload" style={{ fontSize: 14 }} /> Rafraîchir
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 18px' }}>
          Ce qui doit tourner automatiquement, et ce qui a réellement tourné. Un job passe au rouge
          dès qu'il n'a plus rien écrit depuis plus longtemps que sa fréquence ne l'autorise.
        </p>

        {enAlerte.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <i className="ti ti-alert-triangle" style={{ color: '#dc2626', fontSize: 18, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: '#991b1b' }}>
              <b>{enAlerte.length} synchronisation{enAlerte.length > 1 ? 's' : ''} à vérifier</b> —{' '}
              {enAlerte.map(j => j.libelle).join(', ')}
            </div>
          </div>
        )}

        {jobs === null ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Chargement…</p>
        ) : !jobs.length ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Aucun job déclaré.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14, marginBottom: 26 }}>
            {jobs.map(j => {
              const e = ETATS[j.sante] || ETATS.jamais
              const p = PLATEFORMES[j.plateforme] || { label: j.plateforme, couleur: '#94a3b8' }
              const actif = selection === j.job
              return (
                <div key={j.job}
                  onClick={() => setSelection(actif ? null : j.job)}
                  style={{ background: '#fff', border: `1px solid ${actif ? NAVY : '#e2e8f0'}`, borderTop: `3px solid ${e.couleur}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', boxShadow: actif ? '0 2px 10px rgba(13,47,94,0.12)' : '0 1px 3px rgba(0,0,0,0.04)' }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: NAVY, flex: 1 }}>{j.libelle}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: p.couleur, border: `1px solid ${p.couleur}40`, borderRadius: 5, padding: '2px 6px' }}>{p.label}</span>
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: e.fond, border: `1px solid ${e.bord}`, borderRadius: 7, padding: '4px 10px', marginBottom: 12 }}>
                    <i className={`ti ${e.icone}`} style={{ color: e.couleur, fontSize: 14 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: e.couleur }}>{e.label}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>Dernier succès</div>
                      <div style={{ color: '#1e293b', fontWeight: 600 }}>{fmtDate(j.dernier_succes)}</div>
                      {j.dernier_succes && <div style={{ color: '#64748b', fontSize: 11 }}>il y a {fmtAge(j.dernier_succes)}</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>Lignes écrites</div>
                      <div style={{ color: '#1e293b', fontWeight: 600 }}>{fmtNb(j.succes_lignes)}</div>
                    </div>
                  </div>

                  {j.dernier_message && (
                    <div style={{ marginTop: 10, fontSize: 11, color: j.dernier_statut === 'echec' ? '#dc2626' : '#64748b', lineHeight: 1.4 }}>
                      {j.dernier_message}
                    </div>
                  )}
                  {j.commentaire && (
                    <div style={{ marginTop: 8, fontSize: 10.5, color: '#94a3b8', lineHeight: 1.4 }}>{j.commentaire}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: NAVY, margin: 0 }}>
            {selection ? `Exécutions — ${selection}` : 'Dernières exécutions'}
          </h2>
          {selection && (
            <button onClick={() => setSelection(null)}
              style={{ border: 'none', background: '#f1f5f9', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#64748b', fontFamily: 'inherit' }}>
              Tout voir
            </button>
          )}
        </div>

        {!lignes.length ? (
          <p style={{ color: '#94a3b8', fontSize: 13 }}>
            Aucune exécution enregistrée. Le journal se remplit au prochain passage de chaque job.
          </p>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Job', 'Démarré', 'Durée', 'Déclencheur', 'Écrites', 'Statut', 'Message'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map(l => {
                  const duree = l.termine_a
                    ? `${Math.max(1, Math.round((new Date(l.termine_a) - new Date(l.demarre_a)) / 1000))} s`
                    : '—'
                  const couleur = l.statut === 'succes' ? '#16a34a' : l.statut === 'echec' ? '#dc2626' : '#b45309'
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: NAVY, whiteSpace: 'nowrap' }}>{l.job}</td>
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{fmtDate(l.demarre_a)}</td>
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: '#64748b' }}>{duree}</td>
                      <td style={{ padding: '7px 10px', color: '#64748b' }}>{l.declencheur}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>{fmtNb(l.lignes_ecrites)}</td>
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: couleur }}>{l.statut}</span>
                      </td>
                      <td style={{ padding: '7px 10px', color: l.statut === 'echec' ? '#dc2626' : '#64748b', maxWidth: 340 }}>{l.message || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
