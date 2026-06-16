import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (v) => v === null || v === undefined || v === ''
  ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

const MOIS = ['', 'Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const moisLabel = (m) => MOIS[parseInt(m)] || m || '—'

export default function BordereauxView({ color = '#0080BD', colorDark = '#0D2F5E', titre = 'Dynassur SRL' }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState({ type: 'tous', annee: '', compagnie: 'toutes', recherche: '' })
  const [tri, setTri] = useState({ col: 'periode', sens: 'desc' })
  const [page, setPage] = useState(1)
  const [selection, setSelection] = useState(null)
  const PAR_PAGE = 100

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Charger les bordereaux
  useEffect(() => {
    setLoading(true)
    supabase.from('bordereaux').select('*').limit(5000).then(({ data, error }) => {
      if (error) console.error('Erreur bordereaux:', error)
      const enriched = (data || []).map(b => ({
        ...b,
        _annee: parseInt(b.annee) || 0,
        _mois: parseInt(b.mois) || 0,
        _periode: `${b.annee || '0000'}-${String(b.mois || '00').padStart(2,'0')}`,
        _montant: parseFloat(b.montant) || 0,
        _commission: parseFloat(b.commission) || 0,
        _net: parseFloat(b.net) || 0,
      }))
      setRows(enriched)
      setLoading(false)
    })
  }, [])

  useEffect(() => { setPage(1) }, [filtre.type, filtre.annee, filtre.compagnie, filtre.recherche])

  // Filtrage
  const filtrees = rows.filter(b => {
    if (filtre.type !== 'tous' && (b.type || '').toUpperCase() !== filtre.type) return false
    if (filtre.annee && String(b.annee) !== filtre.annee) return false
    if (filtre.compagnie !== 'toutes' && (b.compagnie || '') !== filtre.compagnie) return false
    if (filtre.recherche) {
      const q = filtre.recherche.toLowerCase()
      if (!(b.compagnie || '').toLowerCase().includes(q) && !(b.nom_fichier || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // Tri
  filtrees.sort((a, b) => {
    let va, vb
    if (tri.col === 'montant') { va = a._montant; vb = b._montant }
    else if (tri.col === 'commission') { va = a._commission; vb = b._commission }
    else if (tri.col === 'compagnie') { va = (a.compagnie||'zzz').toLowerCase(); vb = (b.compagnie||'zzz').toLowerCase() }
    else { va = a._periode; vb = b._periode }
    if (va < vb) return tri.sens === 'asc' ? -1 : 1
    if (va > vb) return tri.sens === 'asc' ? 1 : -1
    return 0
  })

  // KPIs
  const totalBQT = filtrees.filter(b => (b.type||'').toUpperCase()==='BQT').reduce((s,b)=>s+b._montant,0)
  const totalRCP = filtrees.filter(b => (b.type||'').toUpperCase()==='RCP').reduce((s,b)=>s+b._montant,0)
  const totalCommission = filtrees.reduce((s,b)=>s+b._commission,0)
  const sansMontant = filtrees.filter(b => !b._montant).length

  // Listes pour filtres
  const anneesDispo = [...new Set(rows.map(b => String(b.annee)).filter(a=>a && a!=='null'))].sort((a,b)=>b-a)
  const compagniesDispo = [...new Set(rows.map(b => b.compagnie).filter(Boolean))].sort()

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtrees.length / PAR_PAGE))
  const pageActuelle = Math.min(page, totalPages)
  const rowsPage = filtrees.slice((pageActuelle-1)*PAR_PAGE, pageActuelle*PAR_PAGE)

  const KPI = ({ label, value, c }) => (
    <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', borderTop:`3px solid ${c}`, padding:'14px 16px' }}>
      <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{label}</div>
      <div style={{ fontSize:'20px', fontWeight:'800', color:c }}>{value}</div>
    </div>
  )

  const TypeBadge = ({ type }) => {
    const t = (type||'').toUpperCase()
    const isBQT = t === 'BQT'
    return <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'6px', background: isBQT?'#dbeafe':'#dcfce7', color: isBQT?'#1d4ed8':'#16a34a' }}>{t || '—'}</span>
  }

  if (loading) return <div style={{ padding:'60px', textAlign:'center', color:'#94a3b8', fontFamily:"'Source Sans Pro', sans-serif" }}>Chargement des bordereaux…</div>

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
        <KPI label="Total BQT (primes appelées)" value={fmt(totalBQT)} c="#1d4ed8" />
        <KPI label="Total RCP (encaissé)" value={fmt(totalRCP)} c="#16a34a" />
        <KPI label="Commissions" value={fmt(totalCommission)} c={color} />
        <KPI label="Bordereaux" value={`${filtrees.length}${sansMontant>0?` (${sansMontant} vides)`:''}`} c="#7c3aed" />
      </div>

      {/* Barre de filtres */}
      <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', padding:'14px 16px', marginBottom:'14px', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
        {/* Type */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Type</label>
          <div style={{ display:'flex', gap:'4px' }}>
            {[['tous','Tout'],['BQT','BQT'],['RCP','RCP']].map(([val,lab]) => (
              <button key={val} onClick={()=>setFiltre(f=>({...f,type:val}))} style={{
                padding:'7px 14px', borderRadius:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer', border:'none',
                background: filtre.type===val ? `${color}18` : '#f1f5f9',
                color: filtre.type===val ? color : '#64748b'
              }}>{lab}</button>
            ))}
          </div>
        </div>

        {/* Compagnie */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px', flex:1, minWidth:'160px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Compagnie</label>
          <select value={filtre.compagnie} onChange={e=>setFiltre(f=>({...f,compagnie:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif", cursor:'pointer' }}>
            <option value="toutes">Toutes</option>
            {compagniesDispo.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Recherche */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px', flex:1, minWidth:'160px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Recherche</label>
          <input type="text" placeholder="Compagnie, fichier…" value={filtre.recherche}
            onChange={e=>setFiltre(f=>({...f,recherche:e.target.value}))}
            style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif" }}
          />
        </div>

        {/* Année */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Année</label>
          <select value={filtre.annee} onChange={e=>setFiltre(f=>({...f,annee:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif", cursor:'pointer' }}>
            <option value="">Toutes</option>
            {anneesDispo.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Reset */}
        {(filtre.type!=='tous'||filtre.annee||filtre.compagnie!=='toutes'||filtre.recherche) && (
          <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
            <label style={{ fontSize:'10px', color:'transparent' }}>.</label>
            <button onClick={()=>setFiltre({type:'tous',annee:'',compagnie:'toutes',recherche:''})} style={{ padding:'7px 12px', borderRadius:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer', border:'1px solid #e2e8f0', background:'#fff', color:'#64748b' }}>
              ✕ Reset
            </button>
          </div>
        )}
      </div>

      {/* Tableau */}
      <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
        {/* En-tête desktop */}
        {!isMobile && (
          <div style={{ display:'grid', gridTemplateColumns:'80px 140px 1fr 150px 150px', padding:'9px 16px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>
            {(() => {
              const trier = (col) => setTri(t => ({ col, sens: t.col === col && t.sens === 'desc' ? 'asc' : 'desc' }))
              const fleche = (col) => tri.col === col ? (tri.sens === 'desc' ? ' ↓' : ' ↑') : ''
              const Th = ({ col, children, align }) => (
                <div onClick={()=>trier(col)} style={{ cursor:'pointer', textAlign:align||'left', color: tri.col===col?color:'#94a3b8', userSelect:'none' }}>{children}{fleche(col)}</div>
              )
              return <>
                <div>Type</div>
                <Th col="periode">Période</Th>
                <Th col="compagnie">Compagnie</Th>
                <Th col="montant" align="right">Montant</Th>
                <Th col="commission" align="right">Commission</Th>
              </>
            })()}
          </div>
        )}
        {/* Tri compact mobile */}
        {isMobile && (
          <div style={{ display:'flex', gap:'6px', padding:'10px 12px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', overflowX:'auto' }}>
            {[['periode','Période'],['montant','Montant'],['commission','Commission'],['compagnie','Compagnie']].map(([col,lab]) => (
              <button key={col} onClick={()=>setTri(t => ({ col, sens: t.col===col && t.sens==='desc' ? 'asc' : 'desc' }))} style={{ flexShrink:0, padding:'5px 10px', borderRadius:'6px', fontSize:'12px', fontWeight:'600', border:'1px solid #e2e8f0', background: tri.col===col?`${color}14`:'#fff', color: tri.col===col?color:'#64748b', cursor:'pointer' }}>
                {lab}{tri.col===col?(tri.sens==='desc'?' ↓':' ↑'):''}
              </button>
            ))}
          </div>
        )}

        {filtrees.length === 0 ? (
          <div style={{ padding:'60px', textAlign:'center' }}>
            <div style={{ fontSize:'36px', marginBottom:'10px' }}>📋</div>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#64748b', marginBottom:'4px' }}>Aucun bordereau</div>
            <div style={{ fontSize:'12px', color:'#94a3b8' }}>{rows.length === 0 ? 'Aucune donnée importée.' : 'Aucun résultat pour ces filtres.'}</div>
          </div>
        ) : (
          <>
            {rowsPage.map((b, i) => {
              if (isMobile) {
                return (
                  <div key={b.id || i} onClick={()=>setSelection(b)} style={{ padding:'12px 14px', cursor:'pointer', borderBottom: i<rowsPage.length-1?'1px solid #f1f5f9':'none' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'10px' }}>
                      <div style={{ minWidth:0, flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'3px' }}>
                          <TypeBadge type={b.type} />
                          <span style={{ fontSize:'14px', fontWeight:'600', color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.compagnie || '—'}</span>
                        </div>
                        <div style={{ fontSize:'12px', color:'#94a3b8' }}>{moisLabel(b.mois)} {b.annee}</div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:'15px', fontWeight:'700', color: b._montant?'#1e293b':'#cbd5e1' }}>{fmt(b._montant)}</div>
                        {b._commission ? <div style={{ fontSize:'12px', color:color, fontWeight:'600' }}>comm. {fmt(b._commission)}</div> : null}
                      </div>
                    </div>
                  </div>
                )
              }
              return (
                <div key={b.id || i} onClick={()=>setSelection(b)} style={{
                  display:'grid', gridTemplateColumns:'80px 140px 1fr 150px 150px',
                  padding:'10px 16px', alignItems:'center', cursor:'pointer',
                  borderBottom: i<rowsPage.length-1?'1px solid #f8fafc':'none',
                  background: i%2===0?'#fff':'#fafafa'
                }}>
                  <div><TypeBadge type={b.type} /></div>
                  <div style={{ fontSize:'13px', color:'#475569' }}>{moisLabel(b.mois)} {b.annee}</div>
                  <div style={{ fontSize:'13px', color:'#1e293b', fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'12px' }}>{b.compagnie || '—'}</div>
                  <div style={{ textAlign:'right', fontSize:'14px', fontWeight:'700', color: b._montant?'#1e293b':'#cbd5e1' }}>{fmt(b._montant)}</div>
                  <div style={{ textAlign:'right', fontSize:'14px', fontWeight:'600', color: b._commission?color:'#cbd5e1' }}>{fmt(b._commission)}</div>
                </div>
              )
            })}
            {/* Footer */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'10px 16px', background:'#f8fafc', borderTop:'2px solid #e2e8f0', fontSize:'12px', fontWeight:'700' }}>
              <div style={{ color:'#64748b' }}>{filtrees.length} bordereau{filtrees.length>1?'x':''}</div>
              <div style={{ color:'#1e293b' }}>{fmt(filtrees.reduce((s,b)=>s+b._montant,0))}</div>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'8px', padding:'14px 16px', borderTop:'1px solid #f1f5f9' }}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={pageActuelle<=1} style={{ padding:'6px 14px', borderRadius:'6px', fontSize:'13px', fontWeight:'600', border:'1px solid #e2e8f0', background: pageActuelle<=1?'#f1f5f9':'#fff', color: pageActuelle<=1?'#cbd5e1':color, cursor: pageActuelle<=1?'default':'pointer' }}>← Précédent</button>
                <span style={{ fontSize:'13px', color:'#64748b', fontWeight:'600', minWidth:'110px', textAlign:'center' }}>Page {pageActuelle} / {totalPages}</span>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={pageActuelle>=totalPages} style={{ padding:'6px 14px', borderRadius:'6px', fontSize:'13px', fontWeight:'600', border:'1px solid #e2e8f0', background: pageActuelle>=totalPages?'#f1f5f9':'#fff', color: pageActuelle>=totalPages?'#cbd5e1':color, cursor: pageActuelle>=totalPages?'default':'pointer' }}>Suivant →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal détail */}
      {selection && (() => {
        const b = selection
        const Row = ({ label, value }) => (
          <div style={{ display:'flex', padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
            <div style={{ width:'150px', flexShrink:0, fontSize:'12px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</div>
            <div style={{ fontSize:'14px', color:'#1e293b', wordBreak:'break-word' }}>{value || '—'}</div>
          </div>
        )
        return (
          <div onClick={()=>setSelection(null)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px' }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'16px', maxWidth:'520px', width:'100%', maxHeight:'85vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ padding:'20px 24px', background:`linear-gradient(135deg, ${color}, ${colorDark})`, borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                    <TypeBadge type={b.type} />
                    <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.8)', fontWeight:'600' }}>{moisLabel(b.mois)} {b.annee}</span>
                  </div>
                  <div style={{ fontSize:'22px', fontWeight:'800', color:'#fff' }}>{b.compagnie || '—'}</div>
                </div>
                <button onClick={()=>setSelection(null)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'8px', width:'32px', height:'32px', color:'#fff', fontSize:'18px', cursor:'pointer' }}>×</button>
              </div>
              <div style={{ padding:'20px 24px' }}>
                <Row label="Montant" value={fmt(b._montant)} />
                <Row label="Commission" value={fmt(b._commission)} />
                <Row label="Net" value={fmt(b._net)} />
                <Row label="Compte" value={b.compte} />
                <Row label="Fichier" value={b.nom_fichier} />
                {b.url_sharepoint && (
                  <div style={{ marginTop:'16px' }}>
                    <a href={b.url_sharepoint} target="_blank" rel="noreferrer" style={{ display:'inline-block', padding:'10px 16px', borderRadius:'8px', background:color, color:'#fff', fontSize:'13px', fontWeight:'600', textDecoration:'none' }}>📄 Ouvrir le PDF sur SharePoint</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
