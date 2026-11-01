import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Les soldes et transactions Ponto sont rafraîchis automatiquement chaque nuit à 00:11
// (fonction Edge `sync-ponto-comptes` + pg_cron). Le bouton ci-dessous relance la même
// synchro à la demande, via la fonction `lancer_sync_ponto()` : le secret reste en base,
// jamais dans le navigateur. Une synchro toutes les 5 minutes au plus.

const fmt = v => v==null?'—':new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '—'

// Logos banques connues
const BANK_COLORS = {
  belfius: '#CC0033', ing: '#FF6200', cbc: '#006B3E', wise: '#9FE870',
  bnp: '#009966', bpost: '#FFBE00', argenta: '#009B77', crelan: '#005B9A',
  nagelmackers: '#1E3A5F',
}
function bankColor(name) {
  if (!name) return '#94a3b8'
  const n = name.toLowerCase()
  for (const [k,v] of Object.entries(BANK_COLORS)) if (n.includes(k)) return v
  return '#94a3b8'
}
function bankInitial(name) {
  if (!name) return '?'
  return name.trim().slice(0,2).toUpperCase()
}


// Pastille de synchronisation aux couleurs de Ponto. Dessinée à la main plutôt
// que d'embarquer leur logo : le relief vient d'un dégradé diagonal, d'un reflet
// en haut et d'une ombre portée douce.
const IconeSyncPonto = ({ taille = 18, anime = false }) => (
  <svg width={taille} height={taille} viewBox="0 0 48 48" aria-hidden
       style={{ flexShrink: 0, animation: anime ? 'spin 1.1s linear infinite' : 'none' }}>
    <defs>
      <linearGradient id="pontoCorps" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="#FFE873" />
        <stop offset="45%"  stopColor="#FFCE1F" />
        <stop offset="100%" stopColor="#E09B00" />
      </linearGradient>
      <linearGradient id="pontoReflet" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#fff" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <filter id="pontoOmbre" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" floodColor="#8A5B00" floodOpacity="0.38" />
      </filter>
    </defs>

    <g filter="url(#pontoOmbre)">
      <circle cx="24" cy="23" r="20" fill="url(#pontoCorps)" />
      {/* reflet : moitié haute seulement, c'est lui qui donne le volume */}
      <ellipse cx="24" cy="14" rx="15" ry="9" fill="url(#pontoReflet)" />
      {/* deux flèches de synchronisation, creusées dans la pastille */}
      <path d="M15 21a9 9 0 0 1 15.2-4.4l2.6-2.6v8.2h-8.2l3.1-3.1A6 6 0 0 0 18 21z"
            fill="#6B4300" fillOpacity="0.92" />
      <path d="M33 25a9 9 0 0 1-15.2 4.4l-2.6 2.6v-8.2h8.2l-3.1 3.1A6 6 0 0 0 30 25z"
            fill="#6B4300" fillOpacity="0.92" />
    </g>
  </svg>
)

export default function BlocComptes({ societeCode, color }) {
  const [comptes, setComptes] = useState([])
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState({})
  const [syncEtat, setSyncEtat] = useState('idle')   // idle | running | ok | error
  const [syncMsg, setSyncMsg] = useState(null)

  async function chargerComptes() {
    const { data: soc } = await supabase.from('societes').select('id').eq('code', societeCode).single()
    if (!soc) { setLoading(false); return }
    const { data } = await supabase.from('comptes_bancaires').select('*').eq('societe_id', soc.id).eq('actif', true).order('banque')
    setComptes(data || [])
    setLoading(false)
  }

  useEffect(() => { chargerComptes() }, [societeCode])

  // Le déclenchement est asynchrone (pg_net n'attend pas la réponse) : on suit donc le
  // résultat dans jobs_log, le journal du garde-fou. Le bouton ne dit pas « lancée » puis
  // se tait — il annonce combien d'opérations sont réellement arrivées, ou qu'il n'y en a
  // aucune, sans que personne ait à rafraîchir la page.
  async function lancerSynchro() {
    if (syncEtat === 'running') return
    setSyncEtat('running'); setSyncMsg('Lancement…')
    const debut = new Date(Date.now() - 2000).toISOString()   // petite marge d'horloge

    try {
      const { data, error } = await supabase.rpc('lancer_sync_ponto')
      if (error) throw error
      if (!data?.ok) {
        setSyncEtat('error')
        setSyncMsg(data?.message || 'Synchronisation refusée.')
        setTimeout(() => { setSyncEtat('idle'); setSyncMsg(null) }, 7000)
        return
      }

      setSyncMsg('Synchronisation en cours…')
      // Jusqu'à ~60 s d'attente : une synchro complète des 13 comptes prend ~7 s,
      // davantage si Ponto remonte plusieurs pages d'historique.
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

        await chargerComptes()
        if (execution.statut === 'echec') {
          setSyncEtat('error')
          setSyncMsg(execution.message || 'La synchronisation a échoué.')
          setTimeout(() => { setSyncEtat('idle'); setSyncMsg(null) }, 10000)
        } else {
          const n = execution.lignes_ecrites ?? 0
          setSyncEtat('ok')
          setSyncMsg(n > 0
            ? `${n} nouvelle${n > 1 ? 's' : ''} opération${n > 1 ? 's' : ''}`
            : 'Aucune nouvelle opération')
          setTimeout(() => { setSyncEtat('idle'); setSyncMsg(null) }, 10000)
        }
        return
      }

      // Le journal n'a rien conclu : on ne prétend pas que c'est fini.
      setSyncEtat('error')
      setSyncMsg("Toujours en cours — regarde Outils → Synchronisations.")
      setTimeout(() => { setSyncEtat('idle'); setSyncMsg(null) }, 10000)
    } catch (e) {
      setSyncEtat('error'); setSyncMsg('Échec : ' + (e.message || e))
      setTimeout(() => { setSyncEtat('idle'); setSyncMsg(null) }, 7000)
    }
  }

  const totalSolde = comptes.reduce((s,c) => s + parseFloat(c.solde_actuel||0), 0)
  const allRevealed = comptes.length > 0 && comptes.every(c => revealed[c.id])

  if (loading) return (
    <div style={{ padding:'20px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Chargement comptes…</div>
  )

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <i className="ti ti-credit-card" style={{ fontSize:15, color }} />
          <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Comptes bancaires</span>
          <span style={{ fontSize:11, background:'#f1f5f9', color:'#64748b', padding:'2px 7px', borderRadius:10, fontWeight:600 }}>
            {comptes.length} compte{comptes.length>1?'s':''}
          </span>
        </div>
        {comptes.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {syncMsg && (
              <span style={{ fontSize:11, fontWeight:600, color: syncEtat==='error' ? '#dc2626' : '#16a34a' }}>{syncMsg}</span>
            )}
            <button
              onClick={lancerSynchro}
              disabled={syncEtat === 'running'}
              title="Relancer la synchronisation Ponto maintenant (sinon automatique à 3h, 9h, 15h et 21h)"
              style={{ fontSize:11.5, color:'#334155', background: syncEtat==='running' ? '#f8fafc' : '#fff',
                border:'1px solid #e2e8f0', borderRadius:7, padding:'4px 11px 4px 7px',
                cursor: syncEtat==='running' ? 'default' : 'pointer', fontWeight:700,
                fontFamily:'inherit', letterSpacing:'.01em',
                display:'flex', alignItems:'center', gap:6,
                boxShadow: syncEtat==='running' ? 'none' : '0 1px 2px rgba(15,23,42,0.06)' }}>
              <IconeSyncPonto anime={syncEtat === 'running'} />
              <span>Sync <span style={{ fontWeight:800 }}>PONTO</span></span>
            </button>
            <button
              onClick={() => { const all={}; comptes.forEach(c=>{all[c.id]=!allRevealed}); setRevealed(all) }}
              style={{ fontSize:11, color, background:color+'15', border:`1px solid ${color}40`,
                borderRadius:6, padding:'3px 10px', cursor:'pointer', fontWeight:600 }}>
              {allRevealed ? '🔒 Masquer' : '👁 Révéler tout'}
            </button>
          </div>
        )}
      </div>

      {comptes.length === 0 ? (
        <div style={{ padding:'30px', textAlign:'center', color:'#94a3b8', fontSize:13,
          background:'#fff', borderRadius:10, border:'1px solid #e2e8f0' }}>
          <i className="ti ti-plug-off" style={{ fontSize:28, display:'block', marginBottom:8 }} />
          Aucun compte connecté — synchronisation Ponto requise
        </div>
      ) : (
        <>
          {/* Grille de cartes */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:12 }}>
            {comptes.map(c => {
              const show = revealed[c.id]
              const bal = parseFloat(c.solde_actuel || 0)
              const bcolor = bankColor(c.banque)
              const isNeg = bal < 0

              return (
                <div key={c.id} style={{
                  background:'#fff', borderRadius:10,
                  border:'1px solid #e2e8f0',
                  borderTop:`3px solid ${bcolor}`,
                  padding:'16px',
                  boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
                  transition:'box-shadow 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'}
                >
                  {/* Logo banque + nom */}
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:bcolor,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:12, fontWeight:800, color:'#fff', flexShrink:0 }}>
                      {bankInitial(c.banque)}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>{c.banque}</div>
                      <div style={{ fontSize:10, color:'#94a3b8', fontFamily:'monospace' }}>
                        {c.iban ? `${c.iban.slice(0,4)} •• ${c.iban.slice(-4)}` : 'Compte courant'}
                      </div>
                    </div>
                  </div>

                  {/* Solde */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Solde</div>
                    <div style={{ fontSize:22, fontWeight:900, letterSpacing: show?'normal':'.1em',
                      color: show ? (isNeg?'#dc2626':bcolor) : '#e2e8f0' }}>
                      {show ? fmt(bal) : '● ● ● ●'}
                    </div>
                  </div>

                  {/* Footer : sync date + bouton œil */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ fontSize:10, color:'#94a3b8' }}>
                      {c.ponto_account_id
                        ? <span><i className="ti ti-refresh" style={{ fontSize:10, marginRight:3 }} />Sync {fmtDate(c.updated_at)}</span>
                        : <span style={{ background:'#fef3c7', color:'#92400e', padding:'1px 5px', borderRadius:3, fontSize:9, fontWeight:700 }}>Non Ponto</span>
                      }
                    </div>
                    <button onClick={() => setRevealed(r => ({...r, [c.id]: !r[c.id]}))}
                      style={{ background:show?'#f0fdf4':'#f8fafc', border:`1px solid ${show?'#bbf7d0':'#e2e8f0'}`,
                        borderRadius:6, padding:'4px 8px', cursor:'pointer', color:show?'#16a34a':'#94a3b8',
                        fontSize:13, transition:'all 0.15s' }}>
                      <i className={`ti ${show?'ti-eye-off':'ti-eye'}`} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'10px 16px', background:'#0f172a', borderRadius:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.05em' }}>
              Total {comptes.length} compte{comptes.length>1?'s':''}
            </span>
            <span style={{ fontSize:16, fontWeight:800,
              color: allRevealed ? (totalSolde<0?'#f87171':'#86efac') : '#374151' }}>
              {allRevealed ? fmt(totalSolde) : '● ● ● ● ●'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
