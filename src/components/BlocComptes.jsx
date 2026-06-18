import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

export default function BlocComptes({ societeCode, color }) {
  const [comptes, setComptes] = useState([])
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState({})

  useEffect(() => {
    async function load() {
      const { data: soc } = await supabase.from('societes').select('id').eq('code', societeCode).single()
      if (!soc) { setLoading(false); return }
      const { data } = await supabase.from('comptes_bancaires').select('*').eq('societe_id', soc.id).eq('actif', true).order('banque')
      setComptes(data || [])
      setLoading(false)
    }
    load()
  }, [societeCode])

  const totalSolde = comptes.reduce((s,c) => s + parseFloat(c.solde_actuel||0), 0)
  const allRevealed = comptes.length > 0 && comptes.every(c => revealed[c.id])

  if (loading) return (
    <div style={{ padding:'20px', textAlign:'center', color:'#94a3b8', fontSize:13 }}>Chargement comptes…</div>
  )

  return (
    <div>
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
          <button
            onClick={() => { const all={}; comptes.forEach(c=>{all[c.id]=!allRevealed}); setRevealed(all) }}
            style={{ fontSize:11, color, background:color+'15', border:`1px solid ${color}40`,
              borderRadius:6, padding:'3px 10px', cursor:'pointer', fontWeight:600 }}>
            {allRevealed ? '🔒 Masquer' : '👁 Révéler tout'}
          </button>
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
