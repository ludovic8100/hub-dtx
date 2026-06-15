import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'

const fmt = (v) => v === null || v === undefined ? '—'
  : new Intl.NumberFormat('fr-BE', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(v)

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e2e8f0', borderTop:`3px solid ${color}`, padding:'16px 20px' }}>
      <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{label}</div>
      <div style={{ fontSize:'24px', fontWeight:'800', color:'#0f172a', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'4px' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardGroupe() {
  const [taches, setTaches] = useState([])
  const [loading, setLoading] = useState(true)
  const [onglet, setOnglet] = useState('comptes') // 'comptes' | 'taches'

  useEffect(() => {
    supabase.from('taches').select('*').in('statut', ['en_cours','en_attente','retard']).order('echeance', { ascending:true }).limit(50)
      .then(({ data }) => { setTaches(data || []); setLoading(false) })
  }, [])

  const now = new Date()
  const retard = taches.filter(t => t.echeance && new Date(t.echeance) < now)
  const enCours = taches.filter(t => !t.echeance || new Date(t.echeance) >= now)

  return (
    <Layout currentPage="Tableau de bord général">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:'1300px' }}>

        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#0f172a', margin:'0 0 4px' }}>Tableau de bord général</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Vue consolidée — Groupe DTX</p>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'24px' }}>
          <StatCard label="Tâches en cours" value={enCours.length} color="#f59e0b" />
          <StatCard label="Tâches en retard" value={retard.length} color="#dc2626" sub={retard.length > 0 ? '⚠ action requise' : '✓ aucun retard'} />
          <StatCard label="Toutes entités" value="3" color="#7c3aed" sub="Dynassur · DTX · LODE" />
        </div>

        {/* Onglets */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'20px', background:'#f1f5f9', borderRadius:'8px', padding:'4px', width:'fit-content' }}>
          {[['comptes','Comptes bancaires'],['taches','Tâches']].map(([k,l]) => (
            <button key={k} onClick={() => setOnglet(k)} style={{
              padding:'7px 18px', borderRadius:'6px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'600',
              background: onglet === k ? '#fff' : 'transparent',
              color: onglet === k ? '#0f172a' : '#64748b',
              boxShadow: onglet === k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition:'all 0.15s', fontFamily:"'Source Sans Pro', sans-serif"
            }}>{l}</button>
          ))}
        </div>

        {/* Contenu onglet */}
        {onglet === 'comptes' && (
          <ComptabiliteView societeCodes={['DYNASSUR','DTX','LODE']} color="#7c3aed" colorDark="#3b1f6e" titre="Groupe" />
        )}

        {onglet === 'taches' && (
          <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 120px 90px', padding:'9px 16px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              <div>Tâche</div><div>Assigné à</div><div>Échéance</div><div>Statut</div>
            </div>
            {loading ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>Chargement…</div>
            ) : taches.length === 0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#94a3b8', fontSize:'14px' }}>✓ Aucune tâche en cours</div>
            ) : taches.map((t, i) => {
              const est = t.echeance && new Date(t.echeance) < now
              return (
                <div key={t.id} style={{
                  display:'grid', gridTemplateColumns:'1fr 120px 120px 90px',
                  padding:'10px 16px', alignItems:'center',
                  borderBottom: i < taches.length-1 ? '1px solid #f8fafc' : 'none',
                  background: est ? '#fff5f5' : i%2===0?'#fff':'#fafafa'
                }}>
                  <div style={{ fontSize:'13px', fontWeight:'500', color:'#1e293b' }}>{t.titre || '—'}</div>
                  <div style={{ fontSize:'12px', color:'#64748b' }}>{t.gestionnaire || '—'}</div>
                  <div style={{ fontSize:'12px', color: est?'#dc2626':'#64748b', fontWeight: est?'700':'400' }}>
                    {t.echeance ? new Date(t.echeance).toLocaleDateString('fr-BE') : '—'}
                  </div>
                  <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 8px', borderRadius:'4px', background: est?'#fee2e2':'#dbeafe', color: est?'#dc2626':'#1d4ed8' }}>
                    {est ? '⚠ Retard' : 'En cours'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
