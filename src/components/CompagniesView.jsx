import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Détecte la "meilleure" colonne correspondant à une liste de mots-clés
function trouverColonne(cols, motsClefs) {
  for (const mc of motsClefs) {
    const exact = cols.find(c => c.toLowerCase() === mc)
    if (exact) return exact
  }
  for (const mc of motsClefs) {
    const partiel = cols.find(c => c.toLowerCase().includes(mc))
    if (partiel) return partiel
  }
  return null
}

export default function CompagniesView({ color = '#0080BD', colorDark = '#0D2F5E' }) {
  const [rows, setRows] = useState([])
  const [cols, setCols] = useState([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [filtreOuvert, setFiltreOuvert] = useState('tous') // tous | ouverts | fermes
  const [selection, setSelection] = useState(null)

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setLoading(true)
    supabase.from('compagnies').select('*').limit(500).then(({ data, error }) => {
      if (error) console.error('Erreur compagnies:', error)
      const list = data || []
      setRows(list)
      setCols(list.length ? Object.keys(list[0]) : [])
      setLoading(false)
    })
  }, [])

  // Colonnes détectées
  const colNom = trouverColonne(cols, ['nom', 'compagnie', 'name', 'libelle'])
  const colProd = trouverColonne(cols, ['numero_producteur', 'num_producteur', 'producteur', 'numero', 'code_producteur', 'num_prod', 'code'])
  const colBranche = trouverColonne(cols, ['branche', 'type', 'categorie'])

  const aProducteur = (r) => {
    if (!colProd) return true
    const v = r[colProd]
    return v !== null && v !== undefined && String(v).trim() !== ''
  }

  // Filtrage
  const filtrees = rows.filter(r => {
    if (filtreOuvert === 'ouverts' && !aProducteur(r)) return false
    if (filtreOuvert === 'fermes' && aProducteur(r)) return false
    if (recherche) {
      const q = recherche.toLowerCase()
      const dansNom = colNom && String(r[colNom] || '').toLowerCase().includes(q)
      const dansProd = colProd && String(r[colProd] || '').toLowerCase().includes(q)
      if (!dansNom && !dansProd) return false
    }
    return true
  })

  // Tri par nom
  filtrees.sort((a, b) => String(a[colNom] || '').localeCompare(String(b[colNom] || '')))

  const nbOuverts = rows.filter(aProducteur).length
  const nbFermes = rows.length - nbOuverts

  const Pill = ({ children, c }) => (
    <span style={{ fontSize:'12px', fontWeight:'700', padding:'3px 10px', borderRadius:'12px', background:`${c}18`, color:c }}>{children}</span>
  )

  if (loading) return <div style={{ padding:'60px', textAlign:'center', color:'#94a3b8', fontFamily:"'Source Sans Pro', sans-serif" }}>Chargement des compagnies…</div>

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'20px' }}>
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', borderTop:`3px solid ${color}`, padding:'14px 16px' }}>
          <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Compagnies</div>
          <div style={{ fontSize:'22px', fontWeight:'800', color:color }}>{rows.length}</div>
        </div>
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', borderTop:'3px solid #16a34a', padding:'14px 16px' }}>
          <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Ouvertes</div>
          <div style={{ fontSize:'22px', fontWeight:'800', color:'#16a34a' }}>{nbOuverts}</div>
        </div>
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', borderTop:'3px solid #dc2626', padding:'14px 16px' }}>
          <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Sans n° producteur</div>
          <div style={{ fontSize:'22px', fontWeight:'800', color:'#dc2626' }}>{nbFermes}</div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', padding:'14px 16px', marginBottom:'14px', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:'4px' }}>
          {[['tous','Toutes'],['ouverts','Ouvertes'],['fermes','Fermées']].map(([val,lab]) => (
            <button key={val} onClick={()=>setFiltreOuvert(val)} style={{
              padding:'7px 14px', borderRadius:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer', border:'none',
              background: filtreOuvert===val ? `${color}18` : '#f1f5f9',
              color: filtreOuvert===val ? color : '#64748b'
            }}>{lab}</button>
          ))}
        </div>
        <input type="text" placeholder="Rechercher une compagnie, un n°…" value={recherche}
          onChange={e=>setRecherche(e.target.value)}
          style={{ flex:1, minWidth:'180px', padding:'8px 12px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif" }}
        />
      </div>

      {/* Tableau */}
      <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
        {!isMobile && (
          <div style={{ display:'grid', gridTemplateColumns: colBranche ? '1fr 180px 160px' : '1fr 200px', padding:'9px 16px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>
            <div>Compagnie</div>
            {colBranche && <div>Branche</div>}
            <div style={{ textAlign:'right' }}>N° producteur</div>
          </div>
        )}

        {filtrees.length === 0 ? (
          <div style={{ padding:'60px', textAlign:'center' }}>
            <div style={{ fontSize:'36px', marginBottom:'10px' }}>🏢</div>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#64748b' }}>{rows.length === 0 ? 'Aucune compagnie en base.' : 'Aucun résultat.'}</div>
          </div>
        ) : filtrees.map((r, i) => {
          const ouvert = aProducteur(r)
          const nom = colNom ? r[colNom] : '—'
          const prod = colProd ? r[colProd] : ''
          const branche = colBranche ? r[colBranche] : ''
          if (isMobile) {
            return (
              <div key={r.id || i} onClick={()=>setSelection(r)} style={{ padding:'12px 14px', cursor:'pointer', borderBottom: i<filtrees.length-1?'1px solid #f1f5f9':'none', background: ouvert?'#fff':'#fef2f2' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'14px', fontWeight:'600', color: ouvert?'#1e293b':'#dc2626', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nom || '—'}</span>
                  {ouvert
                    ? <span style={{ fontSize:'13px', fontWeight:'700', color:color, flexShrink:0 }}>{prod}</span>
                    : <span style={{ fontSize:'11px', fontWeight:'700', color:'#dc2626', flexShrink:0 }}>NON OUVERT</span>}
                </div>
                {branche ? <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>{branche}</div> : null}
              </div>
            )
          }
          return (
            <div key={r.id || i} onClick={()=>setSelection(r)} style={{
              display:'grid', gridTemplateColumns: colBranche ? '1fr 180px 160px' : '1fr 200px',
              padding:'10px 16px', alignItems:'center', cursor:'pointer',
              borderBottom: i<filtrees.length-1?'1px solid #f8fafc':'none',
              background: ouvert ? (i%2===0?'#fff':'#fafafa') : '#fef2f2'
            }}>
              <div style={{ fontSize:'14px', fontWeight:'600', color: ouvert?'#1e293b':'#dc2626', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'12px' }}>{nom || '—'}</div>
              {colBranche && <div style={{ fontSize:'13px', color:'#64748b' }}>{branche || '—'}</div>}
              <div style={{ textAlign:'right' }}>
                {ouvert
                  ? <span style={{ fontSize:'14px', fontWeight:'700', color:color }}>{prod}</span>
                  : <Pill c="#dc2626">NON OUVERT</Pill>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal détail : toutes les colonnes */}
      {selection && (
        <div onClick={()=>setSelection(null)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'16px', maxWidth:'520px', width:'100%', maxHeight:'85vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding:'20px 24px', background:`linear-gradient(135deg, ${color}, ${colorDark})`, borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ fontSize:'22px', fontWeight:'800', color:'#fff' }}>{colNom ? selection[colNom] : 'Compagnie'}</div>
              <button onClick={()=>setSelection(null)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'8px', width:'32px', height:'32px', color:'#fff', fontSize:'18px', cursor:'pointer' }}>×</button>
            </div>
            <div style={{ padding:'20px 24px' }}>
              {cols.filter(c => c !== 'id' && c !== 'created_at').map(c => (
                <div key={c} style={{ display:'flex', padding:'9px 0', borderBottom:'1px solid #f1f5f9' }}>
                  <div style={{ width:'160px', flexShrink:0, fontSize:'12px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.03em' }}>{c.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize:'14px', color:'#1e293b', wordBreak:'break-word' }}>{selection[c] !== null && selection[c] !== undefined && selection[c] !== '' ? String(selection[c]) : '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
