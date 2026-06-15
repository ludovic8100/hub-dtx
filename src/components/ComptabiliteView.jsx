import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (v) => v === null || v === undefined ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'
const fmtSync = d => d ? new Date(d).toLocaleString('fr-BE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'Non synchronisé'

function Badge({ children, color, bg }) {
  return (
    <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'4px', color, background: bg, letterSpacing:'0.04em' }}>
      {children}
    </span>
  )
}

// Carte compte dans la liste gauche
function CompteCard({ compte, active, onClick, color }) {
  const solde = parseFloat(compte.solde_actuel || 0)
  return (
    <div onClick={onClick} style={{
      padding:'12px 14px', cursor:'pointer',
      borderBottom:'1px solid #f1f5f9',
      borderLeft: active ? `3px solid ${color}` : '3px solid transparent',
      background: active ? `${color}12` : '#fff',
      transition:'all 0.1s'
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? `${color}12` : '#fff' }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'4px' }}>
        <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', flex:1, marginRight:'8px' }}>{compte.banque}</div>
        {!compte.ponto_account_id && <Badge color="#92400e" bg="#fef3c7">Non Ponto</Badge>}
      </div>
      <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'6px', fontFamily:'monospace' }}>
        {compte.iban ? compte.iban.replace(/(.{4})/g,'$1 ').trim() : '—'}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:'17px', fontWeight:'800', color: solde >= 0 ? '#16a34a' : '#dc2626' }}>
          {fmt(solde)}
        </div>
      </div>
      <div style={{ fontSize:'10px', color:'#cbd5e1', marginTop:'4px' }}>
        {fmtSync(compte.date_synchro)}
      </div>
    </div>
  )
}

export default function ComptabiliteView({ societeCodes, color, colorDark, titre }) {
  const [comptes, setComptes] = useState([])
  const [compteActif, setCompteActif] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingTx, setLoadingTx] = useState(false)
  const [filtre, setFiltre] = useState({ search: '', type: 'tous', mois: '' })
  // Vue consolidée : affiche tous les comptes sans transactions
  const isConsolide = societeCodes.length > 1

  useEffect(() => {
    async function load() {
      // Récupérer les societes_id pour les codes fournis
      const { data: socs } = await supabase.from('societes').select('id, code').in('code', societeCodes)
      if (!socs?.length) { setLoading(false); return }
      const ids = socs.map(s => s.id)

      const { data } = await supabase
        .from('comptes_bancaires')
        .select('*, societes(code, nom)')
        .in('societe_id', ids)
        .eq('actif', true)
        .order('societe_id')
        .order('banque')

      setComptes(data || [])
      if (!isConsolide && data?.length) setCompteActif(data[0])
      setLoading(false)
    }
    load()
  }, [societeCodes.join(',')])

  useEffect(() => {
    if (!compteActif || isConsolide) return
    setLoadingTx(true)
    supabase.from('transactions').select('*')
      .eq('compte_id', compteActif.id)
      .order('date_valeur', { ascending: false })
      .limit(300)
      .then(({ data }) => { setTransactions(data || []); setLoadingTx(false) })
  }, [compteActif?.id])

  const soldeTotal = comptes.reduce((s, c) => s + parseFloat(c.solde_actuel || 0), 0)

  const txFiltrees = transactions.filter(t => {
    if (filtre.type === 'entrees' && parseFloat(t.montant) <= 0) return false
    if (filtre.type === 'sorties' && parseFloat(t.montant) >= 0) return false
    if (filtre.search) {
      const q = filtre.search.toLowerCase()
      if (!t.libelle?.toLowerCase().includes(q) && !t.contrepartie_nom?.toLowerCase().includes(q)) return false
    }
    if (filtre.mois && !t.date_valeur?.startsWith(filtre.mois)) return false
    return true
  })

  const totalEntrees = txFiltrees.filter(t => parseFloat(t.montant) > 0).reduce((s, t) => s + parseFloat(t.montant), 0)
  const totalSorties = txFiltrees.filter(t => parseFloat(t.montant) < 0).reduce((s, t) => s + parseFloat(t.montant), 0)

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#94a3b8', fontFamily:"'Source Sans Pro', sans-serif" }}>
      Chargement des comptes…
    </div>
  )

  // ── VUE CONSOLIDÉE (Groupe) ──
  if (isConsolide) {
    // Grouper par société
    const parSociete = {}
    comptes.forEach(c => {
      const code = c.societes?.code || '?'
      if (!parSociete[code]) parSociete[code] = { comptes: [], total: 0, nom: c.societes?.nom }
      parSociete[code].comptes.push(c)
      parSociete[code].total += parseFloat(c.solde_actuel || 0)
    })

    const COLORS = { DYNASSUR:'#0080BD', DTX:'#94a3b8', LODE:'#ea580c', HEXAGROUP:'#7c3aed' }
    const LOGOS  = { DYNASSUR:'/logo_dynassur.png', DTX:'/logo_dtx.png', LODE:'/logo_lode.png' }

    return (
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>
        {/* KPI total */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'24px' }}>
          <div style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e2e8f0', borderTop:`3px solid ${color}`, padding:'16px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Trésorerie groupe</div>
            <div style={{ fontSize:'26px', fontWeight:'800', color:'#0f172a' }}>{fmt(soldeTotal)}</div>
          </div>
          <div style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e2e8f0', borderTop:'3px solid #0080BD', padding:'16px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Comptes synchronisés</div>
            <div style={{ fontSize:'26px', fontWeight:'800', color:'#0f172a' }}>
              {comptes.filter(c => c.ponto_account_id).length} <span style={{ fontSize:'14px', color:'#94a3b8' }}>/ {comptes.length}</span>
            </div>
          </div>
          <div style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e2e8f0', borderTop:'3px solid #16a34a', padding:'16px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Sociétés</div>
            <div style={{ fontSize:'26px', fontWeight:'800', color:'#0f172a' }}>{Object.keys(parSociete).length}</div>
          </div>
        </div>

        {/* Grille par société */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'16px' }}>
          {Object.entries(parSociete).map(([code, data]) => {
            const col = COLORS[code] || '#64748b'
            const logo = LOGOS[code]
            return (
              <div key={code} style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
                {/* Header société */}
                <div style={{ background: col, padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
                  {logo && <img src={logo} alt={code} style={{ width:26, height:26, objectFit:'contain' }} />}
                  <div style={{ flex:1 }}>
                    <div style={{ color:'#fff', fontWeight:'700', fontSize:'13px' }}>{data.nom || code}</div>
                  </div>
                  <div style={{ color:'#fff', fontWeight:'800', fontSize:'18px' }}>{fmt(data.total)}</div>
                </div>
                {/* Comptes */}
                {data.comptes.map((c, i) => (
                  <div key={c.id} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'10px 16px',
                    borderBottom: i < data.comptes.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'500', color:'#1e293b' }}>{c.banque}</div>
                      <div style={{ fontSize:'11px', color:'#94a3b8', fontFamily:'monospace' }}>
                        {c.iban ? c.iban.replace(/(.{4})/g,'$1 ').trim() : '—'}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'15px', fontWeight:'700', color: parseFloat(c.solde_actuel) >= 0 ? '#16a34a' : '#dc2626' }}>
                        {fmt(c.solde_actuel)}
                      </div>
                      {!c.ponto_account_id && <Badge color="#92400e" bg="#fef3c7">Non Ponto</Badge>}
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
  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
        {[
          { label:'Trésorerie totale', value: fmt(soldeTotal), c: color },
          { label:'Comptes actifs', value: comptes.length, sub: `${comptes.filter(c=>c.ponto_account_id).length} Ponto`, c: color },
          { label:'Entrées filtrées', value: fmt(totalEntrees), c:'#16a34a' },
          { label:'Sorties filtrées', value: fmt(totalSorties), c:'#dc2626' },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e2e8f0', borderTop:`3px solid ${k.c}`, padding:'16px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{k.label}</div>
            <div style={{ fontSize:'22px', fontWeight:'800', color:'#0f172a', lineHeight:1 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'18px', alignItems:'flex-start' }}>
        {/* Sidebar comptes */}
        <div style={{ width:'250px', flexShrink:0, background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
          <div style={{ padding:'11px 14px', background: colorDark || color, color:'#fff', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            {comptes.length} compte{comptes.length > 1 ? 's' : ''}
          </div>
          {comptes.map(c => (
            <CompteCard key={c.id} compte={c} active={compteActif?.id === c.id} onClick={() => setCompteActif(c)} color={color} />
          ))}
        </div>

        {/* Transactions */}
        <div style={{ flex:1 }}>
          {compteActif && (
            <>
              {/* Header + filtres */}
              <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', marginBottom:'12px', overflow:'hidden' }}>
                <div style={{ padding:'11px 16px', background: color, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ color:'#fff', fontWeight:'700', fontSize:'14px' }}>{compteActif.banque}</div>
                    <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'11px', fontFamily:'monospace' }}>{compteActif.iban}</div>
                  </div>
                  <div style={{ color:'#fff', fontWeight:'800', fontSize:'20px' }}>{fmt(compteActif.solde_actuel)}</div>
                </div>
                <div style={{ padding:'10px 14px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  <input type="text" placeholder="Libellé, contrepartie…" value={filtre.search}
                    onChange={e => setFiltre(f => ({...f, search:e.target.value}))}
                    style={{ flex:1, minWidth:'160px', padding:'6px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif" }}
                  />
                  <input type="month" value={filtre.mois}
                    onChange={e => setFiltre(f => ({...f, mois:e.target.value}))}
                    style={{ padding:'6px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif" }}
                  />
                  {['tous','entrees','sorties'].map(t => (
                    <button key={t} onClick={() => setFiltre(f => ({...f, type:t}))} style={{
                      padding:'6px 12px', borderRadius:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer', border:'none',
                      background: filtre.type === t ? (t==='entrees'?'#dcfce7':t==='sorties'?'#fee2e2':`${color}20`) : '#f1f5f9',
                      color: filtre.type === t ? (t==='entrees'?'#16a34a':t==='sorties'?'#dc2626':color) : '#64748b',
                    }}>
                      {t==='tous'?'Tout':t==='entrees'?'▲ Entrées':'▼ Sorties'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Liste transactions */}
              <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:'95px 1fr 150px 105px', padding:'8px 16px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  <div>Date</div><div>Libellé</div><div>Contrepartie</div><div style={{textAlign:'right'}}>Montant</div>
                </div>

                {loadingTx ? (
                  <div style={{ padding:'40px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>Chargement…</div>
                ) : txFiltrees.length === 0 ? (
                  <div style={{ padding:'48px 32px', textAlign:'center' }}>
                    <div style={{ fontSize:'36px', marginBottom:'10px' }}>📭</div>
                    <div style={{ fontSize:'14px', fontWeight:'600', color:'#64748b', marginBottom:'4px' }}>Aucune transaction</div>
                    <div style={{ fontSize:'12px', color:'#94a3b8' }}>
                      {transactions.length === 0 ? 'Synchronisation Ponto en attente pour ce compte.' : 'Aucun résultat pour ces filtres.'}
                    </div>
                  </div>
                ) : txFiltrees.map((t, i) => (
                  <div key={t.id} style={{
                    display:'grid', gridTemplateColumns:'95px 1fr 150px 105px',
                    padding:'9px 16px', alignItems:'center',
                    borderBottom: i < txFiltrees.length-1 ? '1px solid #f8fafc' : 'none',
                    background: i%2===0 ? '#fff' : '#fafafa'
                  }}>
                    <div style={{ fontSize:'12px', color:'#64748b' }}>{fmtDate(t.date_valeur)}</div>
                    <div>
                      <div style={{ fontSize:'13px', color:'#1e293b', fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'320px' }}>
                        {t.libelle || '—'}
                      </div>
                      {t.contrepartie_iban && <div style={{ fontSize:'10px', color:'#94a3b8', fontFamily:'monospace' }}>{t.contrepartie_iban}</div>}
                    </div>
                    <div style={{ fontSize:'12px', color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {t.contrepartie_nom || '—'}
                    </div>
                    <div style={{ textAlign:'right', fontSize:'14px', fontWeight:'700', color: parseFloat(t.montant)>=0?'#16a34a':'#dc2626' }}>
                      {parseFloat(t.montant)>=0?'+':''}{fmt(t.montant)}
                    </div>
                  </div>
                ))}

                {txFiltrees.length > 0 && (
                  <div style={{ padding:'9px 16px', background:'#f8fafc', borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#64748b' }}>
                    <span>{txFiltrees.length} transaction{txFiltrees.length>1?'s':''}</span>
                    <div style={{ display:'flex', gap:'16px' }}>
                      <span style={{ color:'#16a34a', fontWeight:'700' }}>+{fmt(totalEntrees)}</span>
                      <span style={{ color:'#dc2626', fontWeight:'700' }}>{fmt(totalSorties)}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
