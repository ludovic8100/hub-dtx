import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const BLUE = '#0080BD'
const NAVY = '#0D2F5E'
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'

// ── Badge situation contrat ──
function SituationBadge({ v }) {
  const MAP = {
    'En cours':     { bg:'#dcfce7', col:'#16a34a' },
    'Résilié':      { bg:'#fee2e2', col:'#dc2626' },
    'Suspendu':     { bg:'#fef3c7', col:'#92400e' },
    'En attente':   { bg:'#dbeafe', col:'#1d4ed8' },
  }
  const s = MAP[v] || { bg:'#f1f5f9', col:'#64748b' }
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, background:s.bg, color:s.col, whiteSpace:'nowrap' }}>{v||'—'}</span>
}

// ══════════════════════════
// FICHE CLIENT
// ══════════════════════════
function FicheClient({ client, onBack }) {
  const [onglet, setOnglet]       = useState('contrats')
  const [contrats, setContrats]   = useState([])
  const [taches, setTaches]       = useState([])
  const [prod, setProd]           = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const dossier = client.dossier
      const [{ data: c }, { data: t }, { data: p }] = await Promise.all([
        supabase.from('contrats').select('*').eq('dossier', dossier).order('date_creation', { ascending: false }),
        supabase.from('taches').select('*').eq('dossier_client', dossier).order('echeance', { ascending: true }).limit(20),
        supabase.from('mouvements_production').select('*').eq('dossier', dossier).order('annee', { ascending: false }).order('mois', { ascending: false }).limit(50),
      ])
      setContrats(c || [])
      setTaches(t || [])
      setProd(p || [])
      setLoading(false)
    }
    load()
  }, [client.dossier])

  const ONGLETS = [
    { key:'contrats', label:'Contrats',   icon:'ti-file-text',   count: contrats.length },
    { key:'prod',     label:'Production', icon:'ti-trending-up', count: prod.length },
    { key:'taches',   label:'Tâches',     icon:'ti-checkbox',    count: taches.length },
  ]

  const contrats_actifs = contrats.filter(c => c.situation === 'En cours').length

  return (
    <div>
      {/* Bouton retour */}
      <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'transparent', border:'none', cursor:'pointer', color:'#64748b', fontSize:13, marginBottom:20, padding:0 }}>
        <i className="ti ti-arrow-left" style={{ fontSize:15 }} /> Retour à la liste
      </button>

      {/* Header fiche */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'20px 24px', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:20, flexWrap:'wrap' }}>

          {/* Avatar initiales */}
          <div style={{ width:56, height:56, borderRadius:12, background:BLUE, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ fontSize:20, fontWeight:800, color:'#fff' }}>
              {(client.prenom||'?')[0]}{(client.nom||'?')[0]}
            </span>
          </div>

          {/* Infos principales */}
          <div style={{ flex:1, minWidth:200 }}>
            <h2 style={{ fontSize:20, fontWeight:800, color:NAVY, margin:'0 0 4px' }}>
              {client.prenom} {client.nom}
            </h2>
            <div style={{ fontSize:12, color:'#64748b', display:'flex', gap:16, flexWrap:'wrap' }}>
              {client.dossier && <span><i className="ti ti-hash" style={{ marginRight:4 }} />{client.dossier}</span>}
              {client.localite && <span><i className="ti ti-map-pin" style={{ marginRight:4 }} />{client.cp} {client.localite}</span>}
              {client.dn && <span><i className="ti ti-cake" style={{ marginRight:4 }} />{fmtDate(client.dn)}</span>}
            </div>
          </div>

          {/* KPIs rapides */}
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ textAlign:'center', background:'#f0f9ff', borderRadius:8, padding:'10px 16px' }}>
              <div style={{ fontSize:22, fontWeight:800, color:BLUE }}>{contrats_actifs}</div>
              <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>Contrats actifs</div>
            </div>
            <div style={{ textAlign:'center', background:'#f0fdf4', borderRadius:8, padding:'10px 16px' }}>
              <div style={{ fontSize:22, fontWeight:800, color:'#16a34a' }}>{contrats.length}</div>
              <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>Total contrats</div>
            </div>
          </div>
        </div>

        {/* Coordonnées */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12, marginTop:16, paddingTop:16, borderTop:'1px solid #f1f5f9' }}>
          {[
            { icon:'ti-map-pin', label:'Adresse', val: [client.rue, client.num_maison, client.boite].filter(Boolean).join(' ') || '—' },
            { icon:'ti-phone',   label:'GSM',     val: client.gsm || '—' },
            { icon:'ti-phone',   label:'Fixe',    val: client.tel_fixe || '—' },
            { icon:'ti-mail',    label:'Email',   val: client.email || '—' },
            { icon:'ti-user',    label:'Gestionnaire', val: client.gestionnaire || '—' },
            { icon:'ti-user',    label:'Sous-agent', val: client.sa || '—' },
          ].map(row => (
            <div key={row.label} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
              <i className={`ti ${row.icon}`} style={{ fontSize:14, color:'#94a3b8', marginTop:1, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{row.label}</div>
                <div style={{ fontSize:13, color:'#1e293b' }}>{row.val}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0', marginBottom:16, background:'#fff', borderRadius:'10px 10px 0 0', padding:'0 16px' }}>
        {ONGLETS.map(o => (
          <button key={o.key} onClick={()=>setOnglet(o.key)} style={{
            padding:'10px 16px', border:'none', cursor:'pointer', fontSize:13, background:'transparent',
            borderBottom: onglet===o.key?`2px solid ${BLUE}`:'2px solid transparent',
            fontWeight: onglet===o.key?700:400, color: onglet===o.key?NAVY:'#94a3b8',
            display:'flex', alignItems:'center', gap:6, transition:'all 0.15s'
          }}>
            <i className={`ti ${o.icon}`} style={{ fontSize:14 }} />
            {o.label}
            {o.count > 0 && <span style={{ fontSize:10, background: onglet===o.key?BLUE:'#e2e8f0', color: onglet===o.key?'#fff':'#64748b', padding:'1px 6px', borderRadius:10, fontWeight:700 }}>{o.count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Chargement…</div>
      ) : (
        <>
          {/* CONTRATS */}
          {onglet === 'contrats' && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
              {contrats.length === 0
                ? <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Aucun contrat</div>
                : <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:'#f8fafc' }}>
                          {['Police','Compagnie','Domaine','Situation','Date création','Type','Garantie'].map(h=>(
                            <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#94a3b8', fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {contrats.map((c,i) => (
                          <tr key={i} style={{ background:i%2===0?'#fff':'#fafafe' }}
                            onMouseEnter={e=>e.currentTarget.style.background='#f0f9ff'}
                            onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafe'}>
                            <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', fontSize:12, fontWeight:600, color:NAVY }}>{c.police||'—'}</td>
                            <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#1e293b', fontWeight:500 }}>{c.compagnie||'—'}</td>
                            <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{c.domaine||'—'}</td>
                            <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9' }}><SituationBadge v={c.situation} /></td>
                            <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b', whiteSpace:'nowrap' }}>{fmtDate(c.date_creation)}</td>
                            <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{c.type_production||'—'}</td>
                            <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{c.garantie||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          )}

          {/* PRODUCTION */}
          {onglet === 'prod' && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
              {prod.length === 0
                ? <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Aucun mouvement de production</div>
                : <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:'#f8fafc' }}>
                          {['Période','Type','Agent','Police','Branche','Compagnie'].map(h=>(
                            <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#94a3b8', fontSize:10, textTransform:'uppercase', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {prod.map((p,i) => {
                          const TYPES = { 'N.A.':'#16a34a','Mandat faveur':'#0080BD','Renon':'#dc2626','Résiliation Non paiement':'#dc2626','Mandat défaveur':'#f59e0b' }
                          const col = TYPES[p.type_prod] || '#94a3b8'
                          return (
                            <tr key={i} style={{ background:i%2===0?'#fff':'#fafafe' }}>
                              <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{p.mois}/{p.annee}</td>
                              <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9' }}>
                                <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4, background:col+'20', color:col }}>{p.type_prod||'—'}</span>
                              </td>
                              <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{p.agent_code||'—'}</td>
                              <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', fontSize:12 }}>{p.num_contrat||'—'}</td>
                              <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{p.branche||'—'}</td>
                              <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{p.compagnie||'—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          )}

          {/* TACHES */}
          {onglet === 'taches' && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
              {taches.length === 0
                ? <div style={{ padding:40, textAlign:'center', color:'#16a34a', fontSize:13 }}>✓ Aucune tâche en cours</div>
                : taches.map((t,i) => {
                    const retard = t.echeance && new Date(t.echeance) < new Date()
                    return (
                      <div key={t.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', alignItems:'center', gap:12,
                        padding:'12px 18px', borderBottom:i<taches.length-1?'1px solid #f1f5f9':'none',
                        background:retard?'#fff5f5':'#fff' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:500, color:'#1e293b' }}>{t.titre||'—'}</div>
                          <div style={{ fontSize:11, color:'#94a3b8' }}>{t.gestionnaire} {t.code_type?`· ${t.code_type}`:''}</div>
                        </div>
                        <span style={{ fontSize:11, color:retard?'#dc2626':'#64748b', fontWeight:retard?700:400 }}>{fmtDate(t.echeance)}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4,
                          background:retard?'#fee2e2':'#dbeafe', color:retard?'#dc2626':'#1d4ed8' }}>{t.statut}</span>
                      </div>
                    )
                  })
              }
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════
// LISTE CLIENTS
// ══════════════════════════
function ListeClients({ onSelect }) {
  const [recherche, setRecherche]   = useState('')
  const [clients, setClients]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(0)
  const [filtreAgent, setFiltreAgent] = useState('all')
  const [agents, setAgents]         = useState([])
  const PER_PAGE = 50

  // Charger la liste des agents une seule fois
  useEffect(() => {
    supabase.from('clients').select('gestionnaire').neq('gestionnaire', null)
      .then(({ data }) => {
        const uniq = [...new Set((data||[]).map(d=>d.gestionnaire).filter(Boolean))].sort()
        setAgents(uniq)
      })
  }, [])

  const load = useCallback(async (search, agent, p) => {
    setLoading(true)
    let q = supabase.from('clients').select('dossier,nom,prenom,cp,localite,gsm,email,gestionnaire,sa,dn,actif', { count:'exact' })

    if (search.length >= 2) {
      // Recherche sur nom, prénom ou dossier
      q = q.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,dossier.ilike.%${search}%`)
    }
    if (agent !== 'all') q = q.eq('gestionnaire', agent)

    const from = p * PER_PAGE
    const { data, count } = await q.order('nom').range(from, from + PER_PAGE - 1)

    setClients(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [])

  // Debounce recherche
  useEffect(() => {
    const t = setTimeout(() => { load(recherche, filtreAgent, 0); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [recherche, filtreAgent])

  useEffect(() => { load(recherche, filtreAgent, page) }, [page])

  const nbPages = Math.ceil(total / PER_PAGE)

  return (
    <div>
      {/* Barre de recherche + filtres */}
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <i className="ti ti-search" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', fontSize:16 }} />
          <input
            value={recherche}
            onChange={e=>setRecherche(e.target.value)}
            placeholder="Rechercher par nom, prénom, n° dossier…"
            style={{ width:'100%', padding:'9px 12px 9px 36px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, fontFamily:"'Source Sans Pro', sans-serif", outline:'none', boxSizing:'border-box' }}
          />
          {recherche && (
            <button onClick={()=>setRecherche('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16 }}>✕</button>
          )}
        </div>
        <select value={filtreAgent} onChange={e=>setFiltreAgent(e.target.value)}
          style={{ padding:'9px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, color:'#374151', background:'#fff', cursor:'pointer' }}>
          <option value="all">Tous les gestionnaires</option>
          {agents.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize:12, color:'#94a3b8', whiteSpace:'nowrap' }}>
          {loading ? 'Chargement…' : `${total.toLocaleString('fr-BE')} client${total>1?'s':''}`}
        </span>
      </div>

      {/* Tableau */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['N° Dossier','Nom','Prénom','Localité','Gestionnaire','Sous-agent','Actions'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#94a3b8', fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && clients.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Chargement…</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Aucun client trouvé</td></tr>
              ) : clients.map((c,i) => (
                <tr key={c.dossier||i}
                  onClick={()=>onSelect(c)}
                  style={{ cursor:'pointer', background:i%2===0?'#fff':'#fafafe', transition:'background 0.1s' }}
                  onMouseEnter={e=>e.currentTarget.style.background='#f0f9ff'}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafe'}
                >
                  <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', fontSize:12, color:NAVY, fontWeight:600 }}>{c.dossier||'—'}</td>
                  <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', fontWeight:600, color:'#1e293b' }}>{c.nom||'—'}</td>
                  <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#374151' }}>{c.prenom||'—'}</td>
                  <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{c.cp} {c.localite||'—'}</td>
                  <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b', fontSize:12 }}>{c.gestionnaire||'—'}</td>
                  <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b', fontSize:12 }}>{c.sa||'—'}</td>
                  <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9' }}>
                    <button onClick={e=>{e.stopPropagation();onSelect(c)}} style={{ fontSize:11, color:BLUE, background:'#e0f2fe', border:'none', borderRadius:5, padding:'3px 8px', cursor:'pointer', fontWeight:600 }}>
                      Fiche →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {nbPages > 1 && (
          <div style={{ padding:'12px 18px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fafafe' }}>
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
              style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #e2e8f0', background:page===0?'#f8fafc':'#fff', cursor:page===0?'not-allowed':'pointer', fontSize:12, color:page===0?'#94a3b8':'#374151' }}>
              ← Précédent
            </button>
            <span style={{ fontSize:12, color:'#64748b' }}>Page {page+1} / {nbPages} — {total.toLocaleString('fr-BE')} clients</span>
            <button onClick={()=>setPage(p=>Math.min(nbPages-1,p+1))} disabled={page===nbPages-1}
              style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #e2e8f0', background:page===nbPages-1?'#f8fafc':'#fff', cursor:page===nbPages-1?'not-allowed':'pointer', fontSize:12, color:page===nbPages-1?'#94a3b8':'#374151' }}>
              Suivant →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════
export default function DynassurClients() {
  const [selected, setSelected] = useState(null)

  return (
    <Layout currentPage="Clients">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:1300 }}>
        {!selected && (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <i className="ti ti-users" style={{ fontSize:20, color:BLUE }} />
              <h1 style={{ fontSize:20, fontWeight:800, color:NAVY, margin:0 }}>Clients</h1>
            </div>
            <p style={{ fontSize:13, color:'#64748b', margin:0 }}>Base clients Dynassur — {new Date().getFullYear()}</p>
          </div>
        )}
        {selected
          ? <FicheClient client={selected} onBack={()=>setSelected(null)} />
          : <ListeClients onSelect={setSelected} />
        }
      </div>
    </Layout>
  )
}
