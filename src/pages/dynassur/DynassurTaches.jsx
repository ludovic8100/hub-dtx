import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'
import { useAuth } from '../../lib/auth'

const NAVY = '#0D2F5E'
const OUVERT = ['todo', 'en_cours', 'en_attente', 'retard']
const fmtD = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'
const fmtDT = d => d ? new Date(d).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

async function loadAll(table, select, fn) {
  let out = [], from = 0
  while (true) {
    let q = supabase.from(table).select(select)
    if (fn) q = fn(q)
    const { data, error } = await q.range(from, from + 999)
    if (error || !data || !data.length) break
    out = out.concat(data); if (data.length < 1000) break; from += 1000
  }
  return out
}

const th = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#334155' }

function Card({ titre, sous, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 22 }}>
      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{titre}</div>
        {sous && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{sous}</div>}
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  )
}
function Kpi({ label, value, col }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${col}`, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
    </div>
  )
}
function Badge({ ok, txt }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ok ? '#dcfce7' : '#fef9c3', color: ok ? '#15803d' : '#a16207' }}>{txt}</span>
}

export default function DynassurTaches() {
  const { perms, isAdmin } = useAuth()
  const myCode = (perms?.code || (perms?.user_email || '').split('@')[0] || '').toUpperCase()
  const [loading, setLoading] = useState(true)
  const [taches, setTaches] = useState([])
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [filtreT, setFiltreT] = useState('ouvertes')
  const [scope, setScope] = useState('mine')   // 'mine' | 'all' (toggle admin)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const t = await loadAll('taches', 'id,titre,categorie,statut,echeance,date_cloture,user_email,source,gestionnaire', q => q.order('echeance', { ascending: true, nullsFirst: false }))
      let u = [], l = []
      if (isAdmin) {
        u = await loadAll('user_permissions', 'nom,user_email,actif,date_envoi_acces,premiere_connexion,derniere_connexion', q => q.order('nom', { nullsFirst: false }))
        try { const { data } = await supabase.from('connexions_log').select('user_email,connecte_a').order('connecte_a', { ascending: false }).limit(25); l = data || [] } catch (e) { l = [] }
      }
      if (alive) { setTaches(t); setUsers(u); setLogs(l); setLoading(false) }
    })()
    return () => { alive = false }
  }, [isAdmin])

  const mesTaches = (isAdmin && scope === 'all')
    ? taches
    : taches.filter(t => (t.gestionnaire || '').toUpperCase() === myCode)
  const ouvertes = mesTaches.filter(t => OUVERT.includes(t.statut))
  const cloturees = mesTaches.filter(t => t.statut === 'terminee')
  const tachesVues = filtreT === 'ouvertes' ? ouvertes : filtreT === 'cloturees' ? cloturees : mesTaches
  const usersAcces = users.filter(u => u.date_envoi_acces || u.premiere_connexion)
  const jamais = usersAcces.filter(u => !u.premiere_connexion).length

  return (
    <Layout currentPage="Tâches">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo}
          title="Tâches" subtitle={isAdmin ? 'Suivi des tâches et des connexions utilisateurs' : `Tes tâches${myCode ? ` — ${myCode}` : ''}`} />

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Chargement…</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
              <Kpi label="Tâches ouvertes" value={ouvertes.length} col="#f59e0b" />
              <Kpi label="Tâches clôturées" value={cloturees.length} col="#16a34a" />
              {isAdmin && <Kpi label="Accès envoyés" value={usersAcces.length} col="#0080BD" />}
              {isAdmin && <Kpi label="Pas encore connectés" value={jamais} col="#dc2626" />}
            </div>

            <Card titre="Tâches" sous={`${ouvertes.length} ouverte(s) · ${cloturees.length} clôturée(s)`}>
              <div style={{ display: 'flex', gap: 8, padding: '10px 16px', flexWrap: 'wrap', alignItems: 'center' }}>
                {[['ouvertes', 'Ouvertes'], ['cloturees', 'Clôturées'], ['toutes', 'Toutes']].map(([k, l]) => (
                  <button key={k} onClick={() => setFiltreT(k)} style={{ padding: '5px 14px', borderRadius: 20, border: `2px solid ${filtreT === k ? '#0080BD' : '#e2e8f0'}`, background: filtreT === k ? '#0080BD' : '#fff', color: filtreT === k ? '#fff' : '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{l}</button>
                ))}
                {isAdmin && (
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Portée :</span>
                    {[['mine', 'Mes tâches'], ['all', 'Toutes']].map(([k, l]) => (
                      <button key={k} onClick={() => setScope(k)} style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${scope === k ? NAVY : '#e2e8f0'}`, background: scope === k ? NAVY : '#fff', color: scope === k ? '#fff' : '#64748b', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{l}</button>
                    ))}
                  </span>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Tâche</th>{(isAdmin && scope === 'all') && <th style={th}>Gestionnaire</th>}<th style={th}>Catégorie</th><th style={th}>Statut</th><th style={th}>Échéance</th><th style={th}>Clôturée le</th>
                </tr></thead>
                <tbody>
                  {tachesVues.map(t => (
                    <tr key={t.id}>
                      <td style={td}>{t.titre}</td>
                      {(isAdmin && scope === 'all') && <td style={td}>{t.gestionnaire || '—'}</td>}
                      <td style={td}>{t.categorie || '—'}</td>
                      <td style={td}><Badge ok={t.statut === 'terminee'} txt={t.statut === 'terminee' ? 'Clôturée' : t.statut} /></td>
                      <td style={td}>{fmtD(t.echeance)}</td>
                      <td style={td}>{fmtD(t.date_cloture)}</td>
                    </tr>
                  ))}
                  {!tachesVues.length && <tr><td style={td} colSpan={6}>Aucune tâche{!isAdmin && myCode ? ` pour ${myCode}` : ''}.</td></tr>}
                </tbody>
              </table>
            </Card>

            {isAdmin && (
              <Card titre="Suivi des accès & connexions" sous="À l'envoi des accès, une tâche se crée ; elle se clôture automatiquement à la première connexion de l'utilisateur.">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>Utilisateur</th><th style={th}>Accès envoyés</th><th style={th}>1ʳᵉ connexion</th><th style={th}>Dernière connexion</th><th style={th}>Statut</th>
                  </tr></thead>
                  <tbody>
                    {usersAcces.map(u => (
                      <tr key={u.user_email}>
                        <td style={td}><span style={{ fontWeight: 600, color: NAVY }}>{u.nom || u.user_email}</span><div style={{ fontSize: 11, color: '#94a3b8' }}>{u.user_email}</div></td>
                        <td style={td}>{fmtD(u.date_envoi_acces)}</td>
                        <td style={td}>{fmtD(u.premiere_connexion)}</td>
                        <td style={td}>{fmtD(u.derniere_connexion)}</td>
                        <td style={td}><Badge ok={!!u.premiere_connexion} txt={u.premiere_connexion ? 'Connecté' : 'En attente'} /></td>
                      </tr>
                    ))}
                    {!usersAcces.length && <tr><td style={td} colSpan={5}>Aucun accès envoyé pour l'instant — bouton « Envoyer les accès » dans Paramètres → Utilisateurs.</td></tr>}
                  </tbody>
                </table>
              </Card>
            )}

            {isAdmin && (
              <Card titre="Dernières connexions" sous="Journal des 25 dernières connexions au Hub.">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Utilisateur</th><th style={th}>Connexion</th></tr></thead>
                  <tbody>
                    {logs.map((l, i) => (<tr key={i}><td style={td}>{l.user_email}</td><td style={td}>{fmtDT(l.connecte_a)}</td></tr>))}
                    {!logs.length && <tr><td style={td} colSpan={2}>Aucune connexion enregistrée pour l'instant (le journal se remplit aux prochaines connexions).</td></tr>}
                  </tbody>
                </table>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
