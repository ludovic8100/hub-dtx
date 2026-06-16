import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (v) => v === null || v === undefined ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'
const fmtSync = d => d ? new Date(d).toLocaleString('fr-BE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'Non synchronisé'

// ── VUE CONSOLIDÉE GROUPE ──
function VueConsolidee({ comptes }) {
  const COLORS = { DYNASSUR:'#0080BD', DTX:'#94a3b8', LODE:'#ea580c', HEXAGROUP:'#dc2626', PRIVE:'#0d9488' }
  const LOGOS  = { DYNASSUR:'/logo_dynassur.png', DTX:'/logo_dtx.png', LODE:'/logo_lode.png', HEXAGROUP:'/logo_hexagroup.svg', PRIVE:'/logo_prive.svg' }

  const parSociete = {}
  comptes.forEach(c => {
    const code = c.societes?.code || '?'
    if (!parSociete[code]) parSociete[code] = { comptes:[], total:0, nom:c.societes?.nom }
    parSociete[code].comptes.push(c)
    parSociete[code].total += parseFloat(c.solde_actuel || 0)
  })

  const soldeTotal = comptes.reduce((s,c) => s + parseFloat(c.solde_actuel||0), 0)

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'24px' }}>
        {[
          { label:'Trésorerie groupe', value: fmt(soldeTotal), color:'#7c3aed' },
          { label:'Comptes synchronisés', value: `${comptes.filter(c=>c.ponto_account_id).length} / ${comptes.length}`, color:'#0080BD' },
          { label:'Entités', value: Object.keys(parSociete).length, color:'#16a34a' },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e2e8f0', borderTop:`3px solid ${k.color}`, padding:'16px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{k.label}</div>
            <div style={{ fontSize:'24px', fontWeight:'800', color:'#0f172a' }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px,1fr))', gap:'16px' }}>
        {Object.entries(parSociete).map(([code, data]) => {
          const col = COLORS[code] || '#64748b'
          const logo = LOGOS[code]
          return (
            <div key={code} style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
              <div style={{ background:col, padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
                {logo && <img src={logo} alt={code} style={{ width:26, height:26, objectFit:'contain' }} />}
                <div style={{ flex:1, color:'#fff', fontWeight:'700', fontSize:'13px' }}>{data.nom || code}</div>
                <div style={{ color:'#fff', fontWeight:'800', fontSize:'18px' }}>{fmt(data.total)}</div>
              </div>
              {data.comptes.map((c,i) => (
                <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom: i<data.comptes.length-1?'1px solid #f1f5f9':'none' }}>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'500', color:'#1e293b' }}>{c.banque}</div>
                    <div style={{ fontSize:'11px', color:'#94a3b8', fontFamily:'monospace' }}>{c.iban?.replace(/(.{4})/g,'$1 ').trim()}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'15px', fontWeight:'700', color: parseFloat(c.solde_actuel)>=0?'#16a34a':'#dc2626' }}>{fmt(c.solde_actuel)}</div>
                    {!c.ponto_account_id && <span style={{ fontSize:'10px', background:'#fef3c7', color:'#92400e', padding:'1px 6px', borderRadius:'3px', fontWeight:'700' }}>Non Ponto</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── VUE MONO-SOCIÉTÉ ──
export default function ComptabiliteView({ societeCodes, color, colorDark, titre }) {
  const [comptes, setComptes] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingTx, setLoadingTx] = useState(false)
  const [filtre, setFiltre] = useState({ compte: 'tous', type: 'tous', libelle: '', annee: '' })

  const isConsolide = societeCodes.length > 1

  useEffect(() => {
    async function load() {
      const { data: socs } = await supabase.from('societes').select('id,code').in('code', societeCodes)
      if (!socs?.length) { setLoading(false); return }
      const { data } = await supabase
        .from('comptes_bancaires')
        .select('*, societes(code,nom)')
        .in('societe_id', socs.map(s=>s.id))
        .eq('actif', true)
        .order('banque')
      setComptes(data || [])
      setLoading(false)
    }
    load()
  }, [societeCodes.join(',')])

  // Charger toutes les transactions des comptes accessibles
  useEffect(() => {
    if (isConsolide || !comptes.length) return
    setLoadingTx(true)
    const ids = comptes.map(c => c.id)
    supabase.from('transactions').select('*, comptes_bancaires(banque, iban)')
      .in('compte_id', ids)
      .order('date_valeur', { ascending: false })
      .limit(500)
      .then(({ data }) => { setTransactions(data || []); setLoadingTx(false) })
  }, [comptes.map(c=>c.id).join(',')])

  if (loading) return <div style={{ padding:'60px', textAlign:'center', color:'#94a3b8', fontFamily:"'Source Sans Pro', sans-serif" }}>Chargement…</div>
  if (isConsolide) return <VueConsolidee comptes={comptes} />

  // KPIs
  const soldeTotal = comptes.reduce((s,c) => s + parseFloat(c.solde_actuel||0), 0)
  const txFiltrees = transactions.filter(t => {
    if (filtre.compte !== 'tous' && t.compte_id !== filtre.compte) return false
    if (filtre.type === 'entrees' && parseFloat(t.montant) <= 0) return false
    if (filtre.type === 'sorties' && parseFloat(t.montant) >= 0) return false
    if (filtre.libelle) {
      const q = filtre.libelle.toLowerCase()
      if (!t.information_paiement?.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q) && !t.contrepartie_nom?.toLowerCase().includes(q)) return false
    }
    if (filtre.annee && !t.date_valeur?.startsWith(filtre.annee)) return false
    return true
  })
  const totalEntrees = txFiltrees.filter(t=>parseFloat(t.montant)>0).reduce((s,t)=>s+parseFloat(t.montant),0)
  const totalSorties = txFiltrees.filter(t=>parseFloat(t.montant)<0).reduce((s,t)=>s+parseFloat(t.montant),0)

  // Années disponibles
  const anneesDispo = [...new Set(transactions.map(t => t.date_valeur?.substring(0,4)).filter(Boolean))].sort((a,b)=>b-a)

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
        {[
          { label:'Trésorerie totale', value: fmt(soldeTotal), color },
          { label:'Comptes actifs', value: `${comptes.length} (${comptes.filter(c=>c.ponto_account_id).length} Ponto)`, color },
          { label:'Entrées', value: fmt(totalEntrees), color:'#16a34a' },
          { label:'Sorties', value: fmt(totalSorties), color:'#dc2626' },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e2e8f0', borderTop:`3px solid ${k.color}`, padding:'16px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{k.label}</div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:'#0f172a', lineHeight:1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Barre de filtres */}
      <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', padding:'14px 16px', marginBottom:'14px', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>

        {/* Filtre compte */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Compte</label>
          <select value={filtre.compte} onChange={e=>setFiltre(f=>({...f,compte:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif", minWidth:'200px', cursor:'pointer' }}>
            <option value="tous">Tous les comptes</option>
            {comptes.map(c => <option key={c.id} value={c.id}>{c.banque} — {c.iban?.slice(-4)}</option>)}
          </select>
        </div>

        {/* Filtre type */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Type</label>
          <div style={{ display:'flex', gap:'4px' }}>
            {[['tous','Tout'],['entrees','▲ Entrées'],['sorties','▼ Sorties']].map(([val,lab]) => (
              <button key={val} onClick={()=>setFiltre(f=>({...f,type:val}))} style={{
                padding:'7px 12px', borderRadius:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer', border:'none',
                background: filtre.type===val ? (val==='entrees'?'#dcfce7':val==='sorties'?'#fee2e2':`${color}18`) : '#f1f5f9',
                color: filtre.type===val ? (val==='entrees'?'#16a34a':val==='sorties'?'#dc2626':color) : '#64748b',
                transition:'all 0.15s'
              }}>{lab}</button>
            ))}
          </div>
        </div>

        {/* Filtre libellé */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px', flex:1, minWidth:'200px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Libellé / Contrepartie</label>
          <input type="text" placeholder="Rechercher…" value={filtre.libelle}
            onChange={e=>setFiltre(f=>({...f,libelle:e.target.value}))}
            style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif" }}
          />
        </div>

        {/* Filtre année */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Année</label>
          <select value={filtre.annee} onChange={e=>setFiltre(f=>({...f,annee:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif", cursor:'pointer' }}>
            <option value="">Toutes</option>
            {anneesDispo.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Reset */}
        {(filtre.compte!=='tous'||filtre.type!=='tous'||filtre.libelle||filtre.annee) && (
          <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
            <label style={{ fontSize:'10px', color:'transparent' }}>.</label>
            <button onClick={()=>setFiltre({compte:'tous',type:'tous',libelle:'',annee:''})} style={{ padding:'7px 12px', borderRadius:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer', border:'1px solid #e2e8f0', background:'#fff', color:'#64748b' }}>
              ✕ Reset
            </button>
          </div>
        )}
      </div>

      {/* Tableau transactions pleine largeur */}
      <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
        {/* En-tête */}
        <div style={{ display:'grid', gridTemplateColumns:'110px 120px 1fr 200px 120px', padding:'9px 16px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          <div>Date</div>
          <div>Compte</div>
          <div>Libellé</div>
          <div>Contrepartie</div>
          <div style={{ textAlign:'right' }}>Montant</div>
        </div>

        {loadingTx ? (
          <div style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>Chargement des transactions…</div>
        ) : txFiltrees.length === 0 ? (
          <div style={{ padding:'60px', textAlign:'center' }}>
            <div style={{ fontSize:'36px', marginBottom:'10px' }}>📭</div>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#64748b', marginBottom:'4px' }}>Aucune transaction</div>
            <div style={{ fontSize:'12px', color:'#94a3b8' }}>
              {transactions.length === 0 ? 'Synchronisation Ponto en attente.' : 'Aucun résultat pour ces filtres.'}
            </div>
          </div>
        ) : (
          <>
            {txFiltrees.map((t, i) => (
              <div key={t.id} style={{
                display:'grid', gridTemplateColumns:'110px 120px 1fr 200px 120px',
                padding:'9px 16px', alignItems:'center',
                borderBottom: i < txFiltrees.length-1 ? '1px solid #f8fafc' : 'none',
                background: i%2===0 ? '#fff' : '#fafafa'
              }}>
                <div style={{ fontSize:'12px', color:'#64748b' }}>{fmtDate(t.date_valeur)}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {t.comptes_bancaires?.banque || '—'}
                </div>
                <div style={{ fontSize:'13px', color:'#1e293b', fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'12px' }}>
                  {t.information_paiement || t.description || '—'}
                </div>
                <div style={{ fontSize:'12px', color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {t.contrepartie_nom || '—'}
                </div>
                <div style={{ textAlign:'right', fontSize:'14px', fontWeight:'700', color: parseFloat(t.montant)>=0?'#16a34a':'#dc2626' }}>
                  {parseFloat(t.montant)>=0?'+':''}{fmt(t.montant)}
                </div>
              </div>
            ))}
            {/* Footer totaux */}
            <div style={{ display:'grid', gridTemplateColumns:'110px 120px 1fr 200px 120px', padding:'10px 16px', background:'#f8fafc', borderTop:'2px solid #e2e8f0', fontSize:'12px', fontWeight:'700' }}>
              <div style={{ color:'#64748b', gridColumn:'1/5' }}>{txFiltrees.length} transaction{txFiltrees.length>1?'s':''}</div>
              <div style={{ textAlign:'right' }}>
                <span style={{ color:'#16a34a' }}>+{fmt(totalEntrees)}</span>
                <span style={{ color:'#94a3b8', margin:'0 4px' }}>·</span>
                <span style={{ color:'#dc2626' }}>{fmt(totalSorties)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
