import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const fmt = (v, devise = 'EUR') => v === null || v === undefined ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: devise, maximumFractionDigits: 2 }).format(v)

const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'
const fmtDateTime = d => d ? new Date(d).toLocaleString('fr-BE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'jamais'

function StatCard({ label, value, sub, color = '#0080BD' }) {
  return (
    <div style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e2e8f0', borderTop:`3px solid ${color}`, padding:'16px 20px' }}>
      <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{label}</div>
      <div style={{ fontSize:'24px', fontWeight:'700', color:'#0f172a', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>{sub}</div>}
    </div>
  )
}

export default function DynassurComptabilite() {
  const [comptes, setComptes] = useState([])
  const [transactions, setTransactions] = useState([])
  const [compteActif, setCompteActif] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingTx, setLoadingTx] = useState(false)
  const [filtre, setFiltre] = useState({ search: '', type: 'tous', mois: '' })

  useEffect(() => {
    supabase
      .from('comptes_bancaires')
      .select('*, societes!inner(code)')
      .eq('societes.code', 'DYNASSUR')
      .eq('actif', true)
      .order('banque')
      .then(({ data }) => {
        setComptes(data || [])
        if (data?.length) setCompteActif(data[0])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!compteActif) return
    setLoadingTx(true)
    supabase
      .from('transactions')
      .select('*')
      .eq('compte_id', compteActif.id)
      .order('date_valeur', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setTransactions(data || [])
        setLoadingTx(false)
      })
  }, [compteActif])

  const soldeTotal = comptes.reduce((s, c) => s + parseFloat(c.solde_actuel || 0), 0)

  const txFiltrees = transactions.filter(t => {
    if (filtre.type === 'entrees' && t.montant <= 0) return false
    if (filtre.type === 'sorties' && t.montant >= 0) return false
    if (filtre.search && !t.libelle?.toLowerCase().includes(filtre.search.toLowerCase()) &&
        !t.contrepartie_nom?.toLowerCase().includes(filtre.search.toLowerCase())) return false
    if (filtre.mois && !t.date_valeur?.startsWith(filtre.mois)) return false
    return true
  })

  const totalEntrees = txFiltrees.filter(t => t.montant > 0).reduce((s, t) => s + parseFloat(t.montant), 0)
  const totalSorties = txFiltrees.filter(t => t.montant < 0).reduce((s, t) => s + parseFloat(t.montant), 0)

  const s = { fontFamily: "'Source Sans Pro', sans-serif" }

  return (
    <Layout currentPage="Comptabilité">
      <div style={{ ...s, maxWidth: '1300px' }}>

        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#0D2F5E', margin:'0 0 4px' }}>Comptabilité — Dynassur SRL</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Comptes bancaires synchronisés via Ponto</p>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
          <StatCard label="Trésorerie totale" value={fmt(soldeTotal)} color="#0080BD" />
          <StatCard label="Comptes actifs" value={comptes.length} color="#0080BD" sub="Dynassur SRL" />
          <StatCard label="Entrées filtrées" value={fmt(totalEntrees)} color="#16a34a" />
          <StatCard label="Sorties filtrées" value={fmt(totalSorties)} color="#dc2626" />
        </div>

        <div style={{ display:'flex', gap:'20px', alignItems:'flex-start' }}>

          {/* Colonne gauche : liste comptes */}
          <div style={{ width:'260px', flexShrink:0 }}>
            <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', background:'#0D2F5E', color:'#fff', fontSize:'12px', fontWeight:'700', letterSpacing:'0.05em', textTransform:'uppercase' }}>
                Comptes
              </div>
              {loading ? (
                <div style={{ padding:'24px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>Chargement…</div>
              ) : comptes.map(c => (
                <div
                  key={c.id}
                  onClick={() => setCompteActif(c)}
                  style={{
                    padding:'12px 16px', cursor:'pointer',
                    borderBottom:'1px solid #f1f5f9',
                    borderLeft: compteActif?.id === c.id ? '3px solid #0080BD' : '3px solid transparent',
                    background: compteActif?.id === c.id ? '#eff6ff' : '#fff',
                    transition:'all 0.1s'
                  }}
                >
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'#0f172a', marginBottom:'2px' }}>{c.banque}</div>
                  <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'4px' }}>
                    {c.iban ? c.iban.replace(/(.{4})/g,'$1 ').trim() : '—'}
                  </div>
                  <div style={{ fontSize:'15px', fontWeight:'700', color: parseFloat(c.solde_actuel) >= 0 ? '#16a34a' : '#dc2626' }}>
                    {fmt(c.solde_actuel)}
                  </div>
                  <div style={{ fontSize:'10px', color:'#cbd5e1', marginTop:'2px' }}>
                    Synchro : {fmtDateTime(c.date_synchro)}
                    {!c.ponto_account_id && <span style={{ color:'#f59e0b', marginLeft:'4px' }}>⚠ Non Ponto</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Colonne droite : transactions */}
          <div style={{ flex:1 }}>
            {compteActif && (
              <>
                {/* Header compte actif + filtres */}
                <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', marginBottom:'14px', overflow:'hidden' }}>
                  <div style={{ padding:'12px 16px', background:'#0080BD', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ color:'#fff', fontWeight:'700', fontSize:'14px' }}>{compteActif.banque}</div>
                      <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'12px' }}>{compteActif.iban}</div>
                    </div>
                    <div style={{ color:'#fff', fontWeight:'800', fontSize:'20px' }}>{fmt(compteActif.solde_actuel)}</div>
                  </div>

                  {/* Filtres */}
                  <div style={{ padding:'12px 16px', display:'flex', gap:'10px', flexWrap:'wrap', borderBottom:'1px solid #f1f5f9' }}>
                    <input
                      type="text"
                      placeholder="Rechercher libellé, nom..."
                      value={filtre.search}
                      onChange={e => setFiltre(f => ({...f, search: e.target.value}))}
                      style={{ flex:1, minWidth:'180px', padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif" }}
                    />
                    <input
                      type="month"
                      value={filtre.mois}
                      onChange={e => setFiltre(f => ({...f, mois: e.target.value}))}
                      style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif" }}
                    />
                    {['tous','entrees','sorties'].map(t => (
                      <button key={t} onClick={() => setFiltre(f => ({...f, type:t}))} style={{
                        padding:'7px 12px', borderRadius:'6px', fontSize:'12px', fontWeight:'600',
                        border: filtre.type === t ? 'none' : '1px solid #e2e8f0',
                        background: filtre.type === t ? (t==='entrees'?'#dcfce7':t==='sorties'?'#fee2e2':'#dbeafe') : '#f8fafc',
                        color: filtre.type === t ? (t==='entrees'?'#16a34a':t==='sorties'?'#dc2626':'#1d4ed8') : '#64748b',
                        cursor:'pointer'
                      }}>
                        {t==='tous'?'Tout':t==='entrees'?'Entrées':'Sorties'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Liste transactions */}
                <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
                  {/* En-tête */}
                  <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 160px 110px', padding:'9px 16px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    <div>Date</div>
                    <div>Libellé</div>
                    <div>Contrepartie</div>
                    <div style={{ textAlign:'right' }}>Montant</div>
                  </div>

                  {loadingTx ? (
                    <div style={{ padding:'40px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>Chargement des transactions…</div>
                  ) : txFiltrees.length === 0 ? (
                    <div style={{ padding:'40px', textAlign:'center' }}>
                      <div style={{ fontSize:'32px', marginBottom:'8px' }}>📭</div>
                      <div style={{ fontSize:'14px', color:'#94a3b8', fontWeight:'600' }}>Aucune transaction</div>
                      <div style={{ fontSize:'12px', color:'#cbd5e1', marginTop:'4px' }}>
                        {transactions.length === 0
                          ? 'La synchronisation Ponto n\'a pas encore importé les transactions pour ce compte.'
                          : 'Aucun résultat pour ces filtres.'}
                      </div>
                    </div>
                  ) : (
                    txFiltrees.map((t, i) => (
                      <div key={t.id} style={{
                        display:'grid', gridTemplateColumns:'100px 1fr 160px 110px',
                        padding:'9px 16px', alignItems:'center',
                        borderBottom: i < txFiltrees.length-1 ? '1px solid #f8fafc' : 'none',
                        background: i % 2 === 0 ? '#fff' : '#fafafa'
                      }}>
                        <div style={{ fontSize:'12px', color:'#64748b' }}>{fmtDate(t.date_valeur)}</div>
                        <div>
                          <div style={{ fontSize:'13px', color:'#1e293b', fontWeight:'500', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'340px' }}>
                            {t.libelle || '—'}
                          </div>
                          {t.contrepartie_iban && (
                            <div style={{ fontSize:'11px', color:'#94a3b8' }}>{t.contrepartie_iban}</div>
                          )}
                        </div>
                        <div style={{ fontSize:'12px', color:'#64748b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {t.contrepartie_nom || '—'}
                        </div>
                        <div style={{ textAlign:'right', fontSize:'14px', fontWeight:'700', color: parseFloat(t.montant) >= 0 ? '#16a34a' : '#dc2626' }}>
                          {parseFloat(t.montant) >= 0 ? '+' : ''}{fmt(t.montant)}
                        </div>
                      </div>
                    ))
                  )}

                  {txFiltrees.length > 0 && (
                    <div style={{ padding:'10px 16px', background:'#f8fafc', borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#64748b' }}>
                      <span>{txFiltrees.length} transaction{txFiltrees.length > 1 ? 's' : ''}</span>
                      <div style={{ display:'flex', gap:'16px' }}>
                        <span style={{ color:'#16a34a', fontWeight:'600' }}>+{fmt(totalEntrees)}</span>
                        <span style={{ color:'#dc2626', fontWeight:'600' }}>{fmt(totalSorties)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
