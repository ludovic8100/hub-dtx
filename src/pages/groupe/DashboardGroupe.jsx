import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner, PrimaryButton } from '../../components/ui/AccountableUI'
import { SYNCS, SyncCard, WebhookStatus } from '../../components/SyncCards'

// ── Constantes ──
const SOCIETES = {
  dynassur:  { label:'Dynassur SRL',   color:'#0080BD', colorDark:'#0D2F5E', short:'DYN' },
  dtx:       { label:'DTX SRL',        color:'#94a3b8', colorDark:'#334155', short:'DTX' },
  lode:      { label:'LODE SRL',       color:'#ea580c', colorDark:'#7c2d12', short:'LODE' },
  hexagroup: { label:'Hexagroup ASBL', color:'#dc2626', colorDark:'#7f1d1d', short:'HEX' },
  prive:     { label:'Privé',          color:'#0d9488', colorDark:'#134e4a', short:'PRV' },
}

const SOC_ROUTES = {
  DYNASSUR: '/dynassur', DTX: '/dtx', LODE: '/lode', HEXAGROUP: '/hexagroup', PRIVE: '/prive'
}

const fmt = v => v == null ? '—' : new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
const fmtN = v => v == null ? '—' : new Intl.NumberFormat('fr-BE').format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'}) : '—'

// ── Barre de progression ──
function Bar({ pct, col }) {
  const p = Math.min(pct||0, 100)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, background:'#e2e8f0', borderRadius:4, height:6, overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', borderRadius:4, transition:'width 0.4s',
          background: p>=100?'#16a34a':p>=70?(col||'#0080BD'):'#f59e0b' }} />
      </div>
      <span style={{ fontSize:11, fontWeight:700, minWidth:32, color:p>=100?'#16a34a':p>=70?(col||'#0080BD'):'#f59e0b' }}>
        {Math.round(p)}%
      </span>
    </div>
  )
}

// ── KPI Card — cliquable si onClick fourni ──
function KpiCard({ label, value, sub, col, icon, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:'#fff', borderRadius:10,
        border: hov ? `1px solid ${col||'#0080BD'}50` : '1px solid #e2e8f0',
        borderTop:`3px solid ${col||'#0080BD'}`, padding:'16px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition:'box-shadow 0.15s, transform 0.1s, border-color 0.15s',
        boxShadow: hov ? `0 4px 16px ${col||'#0080BD'}22` : '0 1px 3px rgba(0,0,0,0.04)',
        transform: hov ? 'translateY(-1px)' : 'none',
        position:'relative',
      }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
        {icon && <i className={`ti ${icon}`} style={{ fontSize:18, color:col+'60' }} />}
      </div>
      <div style={{ fontSize:24, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{sub}</div>}
      {onClick && (
        <div style={{
          marginTop:8, fontSize:11, color:col||'#0080BD', fontWeight:600,
          display:'flex', alignItems:'center', gap:4,
          opacity: hov ? 1 : 0.45, transition:'opacity 0.15s'
        }}>
          Voir le détail <i className="ti ti-arrow-right" style={{ fontSize:12 }} />
        </div>
      )}
    </div>
  )
}

// ── Petit lien inline "Voir tout →" ──
function VoirTout({ label, to, col }) {
  const navigate = useNavigate()
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={() => navigate(to)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (col||'#0080BD')+'12' : 'transparent',
        border:`1px solid ${hov?(col||'#0080BD'):'#e2e8f0'}`,
        borderRadius:6, padding:'3px 9px', cursor:'pointer',
        fontSize:11, color: col||'#0080BD', fontWeight:600,
        display:'flex', alignItems:'center', gap:4,
        transition:'all 0.15s',
      }}>
      {label} <i className="ti ti-arrow-right" style={{ fontSize:11 }} />
    </button>
  )
}

// ══════════════════════════
// BLOC 1 — Comptes bancaires
// ══════════════════════════
// ── Header de bloc — fond noir, texte blanc ──
function BlocHeader({ icon, title, right }) {
  return (
    <div style={{ background:'#0f172a', padding:'11px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {icon && <i className={`ti ${icon}`} style={{ fontSize:15, color:'rgba(255,255,255,0.7)' }} />}
        <span style={{ fontSize:13, fontWeight:700, color:'#fff', textTransform:'uppercase', letterSpacing:'.06em' }}>{title}</span>
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}

function BlocBanque({ comptes, loading }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState({})
  const [revealed, setRevealed] = useState({})

  const SOC_COLOR = { DYNASSUR:'#0080BD', DTX:'#94a3b8', LODE:'#ea580c', HEXAGROUP:'#dc2626', PRIVE:'#0d9488' }

  const parSociete = {}
  comptes.forEach(c => {
    const code = (c.societes?.code || 'AUTRE').toUpperCase()
    if (!parSociete[code]) parSociete[code] = { comptes:[], total:0, nom:c.societes?.nom || code, color: SOC_COLOR[code]||'#94a3b8' }
    parSociete[code].comptes.push(c)
    parSociete[code].total += parseFloat(c.solde_actuel || 0)
  })

  const totalGroupe = comptes.reduce((s,c) => s + parseFloat(c.solde_actuel||0), 0)
  const allRevealed = comptes.length > 0
    && comptes.every(c => revealed[c.id])
    && Object.keys(parSociete).every(code => revealed[`soc_${code}`])
    && !!revealed['__total__']

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      <BlocHeader icon="ti-credit-card" title="Comptes bancaires"
        right={comptes.length > 0 && (
          <button onClick={() => {
            const next = !allRevealed
            const all = { '__total__': next }
            comptes.forEach(c => { all[c.id] = next })
            Object.keys(parSociete).forEach(code => { all[`soc_${code}`] = next })
            setRevealed(all)
          }} style={{ fontSize:11, color:'rgba(255,255,255,0.8)', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontWeight:600 }}>
            {allRevealed ? '🔒 Tout masquer' : '👁 Tout révéler'}
          </button>
        )}
      />

      {loading ? (
        <div style={{ padding:30, textAlign:'center', color:'#94a3b8' }}>Chargement…</div>
      ) : comptes.length === 0 ? (
        <div style={{ padding:30, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
          <i className="ti ti-plug-off" style={{ fontSize:28, display:'block', marginBottom:8 }} />
          Aucun compte — synchronisation Ponto requise
        </div>
      ) : (
        <div>
          {/* Blocs par société */}
          <div style={{ padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12 }}>
            {Object.entries(parSociete).map(([code, soc]) => {
              const isOpen = open[code]
              const socRevealed = revealed[`soc_${code}`]
              const route = SOC_ROUTES[code]
              return (
                <div key={code} style={{ border:`1px solid #e2e8f0`, borderTop:`3px solid ${soc.color}`, borderRadius:10, overflow:'hidden', background:'#fff' }}>
                  {/* En-tête société */}
                  <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:8, cursor:'pointer', background:isOpen?soc.color+'08':'#fff' }}
                    onClick={() => setOpen(o => ({ ...o, [code]: !o[code] }))}>
                    <div style={{ width:9, height:9, borderRadius:'50%', background:soc.color, flexShrink:0 }} />
                    <span onClick={e => { e.stopPropagation(); route && navigate(route) }}
                      style={{ fontSize:13, fontWeight:700, color:'#1e293b', flex:1, cursor:route?'pointer':'default' }}>
                      {soc.nom}
                    </span>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>{soc.comptes.length} cpt{soc.comptes.length>1?'s':''}</span>
                    <span style={{ fontSize:14, fontWeight:800, color:socRevealed?(soc.total<0?'#dc2626':soc.color):'#cbd5e1', letterSpacing:socRevealed?'.01em':'.1em', marginRight:4 }}>
                      {socRevealed ? fmt(soc.total) : '● ● ●'}
                    </span>
                    <button onClick={e => { e.stopPropagation(); setRevealed(r => ({ ...r, [`soc_${code}`]: !r[`soc_${code}`] })) }}
                      style={{ background:socRevealed?'#f0fdf4':'#f8fafc', border:`1px solid ${socRevealed?'#bbf7d0':'#e2e8f0'}`, borderRadius:5, padding:'3px 6px', cursor:'pointer', color:socRevealed?'#16a34a':'#94a3b8', fontSize:12 }}>
                      <i className={`ti ${socRevealed?'ti-eye-off':'ti-eye'}`} />
                    </button>
                    <i className={`ti ti-chevron-down`} style={{ fontSize:11, color:'#94a3b8', transform:isOpen?'rotate(180deg)':'none', transition:'transform 0.2s' }} />
                  </div>
                  {/* Comptes individuels */}
                  {isOpen && (
                    <div style={{ borderTop:`1px solid ${soc.color}20`, background:'#fafafe' }}>
                      {soc.comptes.map((c, i) => {
                        const show = revealed[c.id]
                        const bal = parseFloat(c.solde_actuel || 0)
                        return (
                          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderBottom:i<soc.comptes.length-1?'1px solid #f1f5f9':'none' }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:12, fontWeight:500, color:'#374151' }}>{c.banque}</div>
                              <div style={{ fontSize:10, color:'#94a3b8', fontFamily:'monospace' }}>
                                {c.iban ? `${c.iban.slice(0,4)} •• ${c.iban.slice(-4)}` : '—'}
                              </div>
                            </div>
                            <span style={{ fontSize:13, fontWeight:700, color:show?(bal<0?'#dc2626':soc.color):'#cbd5e1', letterSpacing:show?'.01em':'.1em' }}>
                              {show ? fmt(bal) : '● ●'}
                            </span>
                            <button onClick={() => setRevealed(r => ({ ...r, [c.id]: !r[c.id] }))}
                              style={{ background:show?'#f0fdf4':'#fff', border:`1px solid ${show?'#bbf7d0':'#e2e8f0'}`, borderRadius:5, padding:'3px 6px', cursor:'pointer', color:show?'#16a34a':'#94a3b8', fontSize:11 }}>
                              <i className={`ti ${show?'ti-eye-off':'ti-eye'}`} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* Total groupe */}
          <div style={{ margin:'0 16px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'#0f172a', borderRadius:9 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'.05em' }}>Total Groupe</span>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:16, fontWeight:800, color:revealed['__total__']?(totalGroupe<0?'#f87171':'#86efac'):'#374151' }}>
                {revealed['__total__'] ? fmt(totalGroupe) : '● ● ● ● ●'}
              </span>
              <button onClick={() => setRevealed(r => ({ ...r, '__total__': !r['__total__'] }))}
                style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, padding:'3px 7px', cursor:'pointer', color:'rgba(255,255,255,0.5)', fontSize:12 }}>
                <i className={`ti ${revealed['__total__']?'ti-eye-off':'ti-eye'}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function BlocTaches({ taches, bordereaux, loading }) {
  const navigate = useNavigate()
  const now = new Date()
  const STATUT_STYLE = {
    en_retard:  { bg:'#fee2e2', color:'#dc2626', label:'⚠ Retard' },
    urgent:     { bg:'#fff7ed', color:'#ea580c', label:'🔥 Urgent' },
    en_cours:   { bg:'#dbeafe', color:'#1d4ed8', label:'En cours' },
    en_attente: { bg:'#f1f5f9', color:'#64748b', label:'En attente' },
  }

  const enriched = taches.map(t => ({
    ...t,
    isRetard: t.echeance && new Date(t.echeance) < now && t.statut !== 'terminee'
  })).sort((a,b) => (b.isRetard?1:0)-(a.isRetard?1:0))

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      <BlocHeader icon="ti-checkbox" title="Tâches & Alertes"
        right={<VoirTout label="Toutes les tâches" to="/dynassur/taches" col="rgba(255,255,255,0.7)" />}
      />
      {loading ? (
        <div style={{ padding:30, textAlign:'center', color:'#94a3b8' }}>Chargement…</div>
      ) : taches.length === 0 ? (
        <div style={{ padding:30, textAlign:'center', color:'#16a34a', fontSize:13 }}>
          <i className="ti ti-circle-check" style={{ fontSize:28, display:'block', marginBottom:8 }} />
          Aucune tâche en cours — tout est à jour ✓
        </div>
      ) : (
        <div style={{ maxHeight:320, overflowY:'auto' }}>
          {enriched.slice(0,20).map((t, i) => {
            const s = t.isRetard ? STATUT_STYLE.en_retard : (STATUT_STYLE[t.statut] || STATUT_STYLE.en_cours)
            const socCfg = t.societe ? SOCIETES[t.societe.toLowerCase()] : null
            return (
              <div
                key={t.id}
                onClick={() => navigate('/dynassur/taches')}
                style={{
                  display:'grid', gridTemplateColumns:'1fr auto auto',
                  alignItems:'center', gap:10,
                  padding:'9px 18px',
                  borderBottom: i < Math.min(enriched.length,20)-1 ? '1px solid #f8fafc' : 'none',
                  background: t.isRetard ? '#fff5f5' : i%2===0?'#fff':'#fafafa',
                  cursor:'pointer', transition:'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = t.isRetard ? '#fee2e2' : '#f0f9ff'}
                onMouseLeave={e => e.currentTarget.style.background = t.isRetard ? '#fff5f5' : i%2===0?'#fff':'#fafafa'}
                title="Ouvrir les tâches"
              >
                <div>
                  <div style={{ fontSize:13, fontWeight:t.isRetard?700:500, color:'#1e293b' }}>
                    {t.titre || '—'}
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, display:'flex', gap:8 }}>
                    {socCfg && <span style={{ background:socCfg.color+'18', color:socCfg.color, fontWeight:700, padding:'1px 5px', borderRadius:3, fontSize:10 }}>{socCfg.short}</span>}
                    {t.gestionnaire && <span>{t.gestionnaire}</span>}
                    {t.code_type && <span>• {t.code_type}</span>}
                  </div>
                </div>
                <div style={{ fontSize:11, color: t.isRetard?'#dc2626':'#64748b', fontWeight:t.isRetard?700:400, textAlign:'right' }}>
                  {fmtDate(t.echeance)}
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:4, background:s.bg, color:s.color, whiteSpace:'nowrap' }}>
                  {s.label}
                </span>
              </div>
            )
          })}
          {enriched.length > 20 && (
            <div
              onClick={() => navigate('/dynassur/taches')}
              style={{ padding:'10px 18px', textAlign:'center', fontSize:12, color:'#0080BD', fontWeight:600, cursor:'pointer', background:'#f8fafc' }}>
              + {enriched.length-20} tâches supplémentaires — voir tout →
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════
// BLOC 3 — Trésorerie consolidée
// ══════════════════════════
function BlocTresorerie({ comptes, transactions, loading }) {
  const navigate = useNavigate()
  const MOIS = ['Jan','Fév','Mar','Apr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const now = new Date()
  const [revealed, setRevealed] = useState({})

  const soldesParSoc = Object.entries(SOCIETES).map(([key, cfg]) => {
    const total = comptes.filter(c=>(c.societes?.code||'').toUpperCase()===key.toUpperCase()).reduce((s,c)=>s+parseFloat(c.solde_actuel||0),0)
    return { key, ...cfg, total }
  }).filter(s => s.total !== 0)

  const totalGroupe = soldesParSoc.reduce((s,r)=>s+r.total,0)
  const allRevealed = soldesParSoc.length > 0 && soldesParSoc.every(s => revealed[s.key])

  const sixMois = Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1)
    return { month: d.getMonth(), year: d.getFullYear(), label: MOIS[d.getMonth()] }
  })

  const flowData = sixMois.map(m => {
    const txs = transactions.filter(t => {
      const d = new Date(t.date || t.date_valeur)
      return d.getMonth()===m.month && d.getFullYear()===m.year
    })
    const entrees = txs.filter(t=>t.montant>0).reduce((s,t)=>s+t.montant,0)
    const sorties = txs.filter(t=>t.montant<0).reduce((s,t)=>s+Math.abs(t.montant),0)
    return { ...m, entrees, sorties }
  })

  const maxFlow = Math.max(...flowData.map(f=>Math.max(f.entrees,f.sorties)), 1)

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:8 }}>
        <i className="ti ti-chart-line" style={{ fontSize:16, color:'#0d9488' }} />
        <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Trésorerie consolidée</span>
      </div>

      <div style={{ padding:18 }}>
        {/* Total groupe */}
        <div style={{ marginBottom:18, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Solde total groupe</div>
            <div style={{ fontSize:32, fontWeight:900,
              color: allRevealed?(totalGroupe<0?'#dc2626':'#0f172a'):'#cbd5e1',
              letterSpacing: allRevealed?'normal':'.1em' }}>
              {allRevealed ? fmt(totalGroupe) : '● ● ● ● ●'}
            </div>
          </div>
          <button onClick={() => { const all={}; soldesParSoc.forEach(s=>{all[s.key]=!allRevealed}); setRevealed(all) }}
            style={{ fontSize:11, color:'#0d9488', background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontWeight:600 }}>
            {allRevealed ? '🔒 Masquer' : '👁 Révéler'}
          </button>
        </div>

        {/* Par société — cliquable → dashboard */}
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:18 }}>
          {soldesParSoc.map(s => {
            const show = revealed[s.key]
            const route = SOC_ROUTES[s.key.toUpperCase()]
            return (
              <div key={s.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:8, background:'#f8fafc',
                cursor: route?'pointer':'default', transition:'background 0.12s' }}
                onClick={() => route && navigate(route)}
                onMouseEnter={e => { if(route) e.currentTarget.style.background = s.color+'12' }}
                onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                title={route ? `Voir ${s.label}` : ''}
              >
                <div style={{ width:10, height:10, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                <span style={{ fontSize:12, color:'#64748b', flex:1, display:'flex', alignItems:'center', gap:4 }}>
                  {s.label}
                  {route && <i className="ti ti-arrow-up-right" style={{ fontSize:10, opacity:0.4 }} />}
                </span>
                <span style={{ fontSize:13, fontWeight:700, minWidth:90, textAlign:'right',
                  color: show?(s.total<0?'#dc2626':s.color):'#cbd5e1',
                  letterSpacing: show?'normal':'.1em' }}>
                  {show ? fmt(s.total) : '● ● ●'}
                </span>
                <div style={{ width:70 }}>
                  <div style={{ background:'#e2e8f0', borderRadius:3, height:5, overflow:'hidden' }}>
                    <div style={{ width: show?`${Math.abs(s.total)/Math.max(Math.abs(totalGroupe),1)*100}%`:'0%', height:'100%', background:s.color, borderRadius:3, transition:'width 0.4s' }} />
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); setRevealed(r => ({ ...r, [s.key]: !r[s.key] })) }}
                  style={{ background:show?'#f0fdf4':'#fff', border:`1px solid ${show?'#bbf7d0':'#e2e8f0'}`,
                    borderRadius:6, padding:'3px 6px', cursor:'pointer', color:show?'#16a34a':'#94a3b8', fontSize:12 }}>
                  <i className={`ti ${show?'ti-eye-off':'ti-eye'}`} />
                </button>
              </div>
            )
          })}
          {soldesParSoc.length === 0 && (
            <div style={{ fontSize:12, color:'#94a3b8', padding:'12px 0' }}>Synchronisation Ponto requise pour afficher les soldes</div>
          )}
        </div>

        {/* Mini graphe flux 6 mois */}
        {flowData.some(f=>f.entrees>0||f.sorties>0) && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Flux 6 derniers mois</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:60 }}>
              {flowData.map((f,i) => (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:50 }}>
                    <div style={{ flex:1, background:'#bbf7d0', borderRadius:'3px 3px 0 0', height:`${f.entrees/maxFlow*100}%`, minHeight: f.entrees>0?3:0, transition:'height 0.3s' }} title={`Entrées: ${fmt(f.entrees)}`} />
                    <div style={{ flex:1, background:'#fecaca', borderRadius:'3px 3px 0 0', height:`${f.sorties/maxFlow*100}%`, minHeight: f.sorties>0?3:0, transition:'height 0.3s' }} title={`Sorties: ${fmt(f.sorties)}`} />
                  </div>
                  <span style={{ fontSize:9, color:'#94a3b8' }}>{f.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:6 }}>
              <span style={{ fontSize:10, color:'#16a34a' }}>■ Entrées</span>
              <span style={{ fontSize:10, color:'#dc2626' }}>■ Sorties</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════
// BLOC SYNC — cartes complètes du centre de synchro
// ══════════════════════════
function BlocSync() {
  const [syncingAll, setSyncingAll] = useState(false)

  const syncAll = async () => {
    setSyncingAll(true)
    await Promise.all(SYNCS.map(s => triggerWorkflow(s.webhook, s.workflowId)))
    setSyncingAll(false)
  }

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      <BlocHeader icon="ti-refresh" title="Synchronisations"
        right={
          <button onClick={syncAll} disabled={syncingAll}
            style={{ display:'flex', alignItems:'center', gap:6, background:syncingAll?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.15)', color:'#fff', border:'1px solid rgba(255,255,255,0.25)', borderRadius:7, padding:'6px 14px', cursor:syncingAll?'wait':'pointer', fontSize:12, fontWeight:700, transition:'background 0.15s' }}>
            <i className={`ti ${syncingAll?'ti-loader-2':'ti-refresh'}`} style={syncingAll?{animation:'spin 1s linear infinite'}:{}} />
            {syncingAll ? 'En cours…' : 'Tout synchroniser'}
          </button>
        }
      />
      <div style={{ padding:14 }}>
        <WebhookStatus />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
          {SYNCS.map(s => <SyncCard key={s.key} sync={s} />)}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════
// BLOC 4 — Production Dynassur (entièrement cliquable)
// ══════════════════════════
function BlocProduction({ loading: loadingExt }) {
  const navigate = useNavigate()
  const [prod, setProd] = useState([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const annee = now.getFullYear()
  const mois = String(now.getMonth() + 1).padStart(2, '0')

  const TYPES = {
    'N.A.':                    { label:'Nouvelles Affaires',  col:'#16a34a', sign:+1 },
    'Mandat faveur':            { label:'Mandats faveur',      col:'#0080BD', sign:+1 },
    'Mandat défaveur':          { label:'Mandats défaveur',    col:'#f59e0b', sign:-1 },
    'Renon':                    { label:'Résiliations',        col:'#dc2626', sign:-1 },
    'Résiliation Non paiement': { label:'Résil. non-paiement', col:'#dc2626', sign:-1 },
    'Avenant':                  { label:'Avenants',            col:'#94a3b8', sign:0  },
  }

  useEffect(() => {
    supabase.from('mouvements_production')
      .select('type_prod, agent_code, annee, mois')
      .eq('annee', annee)
      .then(({ data }) => { setProd(data || []); setLoading(false) })
  }, [])

  const byType = {}
  Object.keys(TYPES).forEach(t => { byType[t] = { mois: 0, annee: 0 } })
  prod.forEach(p => {
    if (!byType[p.type_prod]) return
    byType[p.type_prod].annee++
    if (p.mois === mois) byType[p.type_prod].mois++
  })

  const naAnnee = byType['N.A.']?.annee || 0
  const renonAnnee = (byType['Renon']?.annee || 0) + (byType['Résiliation Non paiement']?.annee || 0) + (byType['Mandat défaveur']?.annee || 0)
  const soldeNet = naAnnee - renonAnnee

  const agentsMois = {}
  prod.filter(p => p.mois === mois && p.type_prod === 'N.A.').forEach(p => {
    agentsMois[p.agent_code] = (agentsMois[p.agent_code] || 0) + 1
  })
  const topAgents = Object.entries(agentsMois).sort((a,b) => b[1]-a[1]).slice(0,5)
  const AGENT_NOMS = { GGO:'G. Godfroid', TJA:'T. Japsenne', PFQ:'P. Fernandez', MTE:'M. Terrana', NGI:'N. Ginis', LDE:'L. Detilloux' }

  return (
    <div
      style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}
    >
      {/* Header */}
      <BlocHeader icon="ti-chart-line" title="Production 2026"
        right={<span style={{ fontSize:11, fontWeight:700, color:'#0080BD', background:'#eff6ff', padding:'3px 10px', borderRadius:6, cursor:'pointer' }}
          onClick={() => navigate('/dynassur/production')}>DYNASSUR →</span>}
      />
      {loadingExt ? (
        <div style={{ padding:30, textAlign:'center', color:'#94a3b8' }}>Chargement…</div>
      ) : (
        <div style={{ padding:16 }}>
      {/* Solde net + NA ce mois — cliquables */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div
              onClick={() => navigate('/dynassur/production')}
              style={{
                background: soldeNet>=0?'#f0fdf4':'#fff5f5',
                borderRadius:8, padding:'12px 14px',
                border:`1px solid ${soldeNet>=0?'#bbf7d0':'#fecaca'}`,
                cursor:'pointer', transition:'box-shadow 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 3px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform='translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform='' }}
              title="Voir la production"
            >
              <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Solde net {annee}</div>
              <div style={{ fontSize:26, fontWeight:900, color: soldeNet>=0?'#16a34a':'#dc2626' }}>{soldeNet>0?'+':''}{fmtN(soldeNet)}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>{fmtN(naAnnee)} NA − {fmtN(renonAnnee)} résil.</div>
              <div style={{ fontSize:10, color:'#0080BD', marginTop:6, fontWeight:600 }}>Voir détail →</div>
            </div>
            <div
              onClick={() => navigate('/dynassur/production')}
              style={{
                background:'#eff6ff', borderRadius:8, padding:'12px 14px',
                border:'1px solid #bfdbfe', cursor:'pointer',
                transition:'box-shadow 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 3px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform='translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform='' }}
              title="Voir la production"
            >
              <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>NA ce mois</div>
              <div style={{ fontSize:26, fontWeight:900, color:'#0080BD' }}>{fmtN(byType['N.A.']?.mois||0)}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>Mois {mois}/{annee}</div>
              <div style={{ fontSize:10, color:'#0080BD', marginTop:6, fontWeight:600 }}>Voir détail →</div>
            </div>
          </div>

          {/* Tableau types */}
          <div style={{ marginBottom:14 }}>
            {Object.entries(TYPES).filter(([,v])=>v.sign!==0).map(([type, cfg]) => {
              const d = byType[type] || { mois:0, annee:0 }
              if (d.annee === 0 && d.mois === 0) return null
              return (
                <div
                  key={type}
                  onClick={() => navigate('/dynassur/production')}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 4px', borderBottom:'1px solid #f8fafc',
                    cursor:'pointer', borderRadius:4, transition:'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background=''}
                >
                  <div style={{ width:6, height:6, borderRadius:'50%', background:cfg.col, flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'#64748b', flex:1 }}>{cfg.label}</span>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>ce mois : <strong style={{ color:cfg.col }}>{d.mois}</strong></span>
                  <span style={{ fontSize:12, fontWeight:700, color:cfg.col, minWidth:30, textAlign:'right' }}>{d.annee}</span>
                </div>
              )
            })}
          </div>

          {/* Top agents NA ce mois */}
          {topAgents.length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Top NA — mois en cours</div>
              {topAgents.map(([code, nb]) => (
                <div key={code} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                  <span style={{ fontSize:11, color:'#64748b', flex:1 }}>{AGENT_NOMS[code]||code}</span>
                  <div style={{ flex:2, background:'#f1f5f9', borderRadius:3, height:6, overflow:'hidden' }}>
                    <div style={{ width:`${nb/Math.max(...topAgents.map(a=>a[1]))*100}%`, height:'100%', background:'#0080BD', borderRadius:3 }} />
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:'#0080BD', minWidth:20, textAlign:'right' }}>{nb}</span>
                </div>
              ))}
            </div>
          )}

          {/* Lien bas de bloc */}
          <div style={{ marginTop:14, textAlign:'center' }}>
            <VoirTout label="Production complète" to="/dynassur/production" col="#0080BD" />
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════
export default function DashboardGroupe() {
  const navigate = useNavigate()
  const [comptes, setComptes]           = useState([])
  const [bordereaux, setBordereaux]     = useState([])
  const [transactions, setTransactions] = useState([])
  const [taches, setTaches]             = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [
          { data: cpts },
          { data: bord },
          { data: txs },
          { data: tsk },
        ] = await Promise.all([
          supabase.from('comptes_bancaires').select('*, societes(code,nom)').eq('actif', true).order('banque'),
          supabase.from('v_bordereaux_reconciliation').select('annee,mois,type,compagnie,statut_reconciliation').in('statut_reconciliation',['fichier_ok_non_encaisse','fichier_sans_chiffres','commission_sans_fichier','manquant']),
          supabase.from('transactions').select('id,date,date_valeur,montant,societe_id').gte('date', new Date(new Date().setMonth(new Date().getMonth()-6)).toISOString().slice(0,10)).limit(2000),
          supabase.from('taches').select('*').in('statut',['en_cours','en_attente','retard','urgent']).order('echeance',{ascending:true}).limit(100),
        ])
        setComptes(cpts || [])
        setBordereaux(bord || [])
        setTransactions(txs || [])
        setTaches(tsk || [])
      } catch(e) { console.error('DashboardGroupe load error:', e) }
      setLoading(false)
    }
    load()
  }, [])

  const [nbObjectifs, setNbObjectifs] = useState(null)
  useEffect(() => {
    supabase.from('objectives_global').select('*', { count:'exact', head:true })
      .then(({ count }) => setNbObjectifs(count || 0))
  }, [])

  const now = new Date()
  const nbRetard  = taches.filter(t => t.echeance && new Date(t.echeance) < now).length
  const nbEnCours = taches.filter(t => t.statut==='en_cours').length

  return (
    <Layout currentPage="Tableau de bord général">
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", width:'100%' }}>

        <StatBanner
          color={ENTITES.groupe.color} colorDark={ENTITES.groupe.colorDark}
          title="Tableau de bord général"
          subtitle="Vue consolidée — Groupe DTX · Dynassur · LODE · Hexagroup · Privé"

        />

        {/* 1 — Synchronisations tout en haut */}
        <div style={{ marginBottom:24 }}>
          <BlocSync />
        </div>

        {/* 2 — KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
          <KpiCard label="Tâches en cours"   value={nbEnCours} col="#f59e0b" icon="ti-checkbox"       sub={`dont ${nbRetard} en retard`}             onClick={() => navigate('/dynassur/taches')} />
          <KpiCard label="Tâches en retard"  value={nbRetard}  col={nbRetard>0?"#dc2626":"#16a34a"} icon="ti-alert-triangle" sub={nbRetard>0?'⚠ action requise':'✓ aucun retard'} onClick={() => navigate('/dynassur/taches')} />
          <KpiCard label="Comptes connectés" value={comptes.length} col="#7c3aed" icon="ti-credit-card" sub="via Ponto / ING" onClick={() => navigate('/dynassur')} />
          <KpiCard label="Objectifs 2026"    value={nbObjectifs != null ? nbObjectifs : '…'} col="#0080BD" icon="ti-target" sub={nbObjectifs ? `${nbObjectifs} objectif${nbObjectifs>1?'s':''} configuré${nbObjectifs>1?'s':''}` : 'Aucun objectif — configurer'} onClick={() => navigate('/dynassur/objectifs')} />
        </div>

        {/* 3 — Comptes bancaires pleine largeur */}
        <div style={{ marginBottom:24 }}>
          <BlocBanque comptes={comptes} loading={loading} />
        </div>

        {/* 4 — Tâches pleine largeur */}
        <div style={{ marginBottom:24 }}>
          <BlocTaches taches={taches} bordereaux={bordereaux} loading={loading} />
        </div>

        {/* 5 — Production */}
        <BlocProduction />

      </div>
    </Layout>
  )
}
