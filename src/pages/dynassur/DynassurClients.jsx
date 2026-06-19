import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const BLUE = '#0080BD'
const NAVY = '#0D2F5E'
const PER_PAGE = 40

const fmt = v => v == null ? '—' : new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const fmtMois = v => v ? new Date(v).toLocaleDateString('fr-BE',{month:'short',year:'numeric'}) : '—'

// ── Objets de risques extraits des contrats actifs ──
const DOMAINE_MAP = [
  { keys:['AUTO','MOTO','CAMION','VÉHICULE','VEHICLE'], icon:'🚗', label:'Auto' },
  { keys:['HABITATION','INCENDIE','MAISON','IMMO','RÉSIDENCE'], icon:'🏠', label:'Habitation' },
  { keys:['VIE','DÉCÈS','PENSION','ÉPARGNE'], icon:'💙', label:'Vie' },
  { keys:['CRÉDIT','CREDIT','PRÊT','PRET','SOLDE RESTANT','SRDU'], icon:'💳', label:'Crédit' },
  { keys:['RC','RESPONSABILIT'], icon:'⚖️', label:'RC' },
  { keys:['ACCIDENT','CORPO'], icon:'🩹', label:'Accidents' },
  { keys:['VOYAGE','ASSIST'], icon:'✈️', label:'Voyage' },
  { keys:['PROTECTION JURIDIQUE','LEGAL','JURIDIQUE'], icon:'🛡️', label:'Protection juri.' },
  { keys:['ANIMAUX','ANIMAL'], icon:'🐾', label:'Animaux' },
]

function getDomaineIcon(domaine) {
  const d = (domaine || '').toUpperCase()
  const found = DOMAINE_MAP.find(m => m.keys.some(k => d.includes(k)))
  return found || { icon:'📋', label: domaine || 'Autre' }
}

// ── Section pliable ──
function Section({ icon, title, count, children, defaultOpen = true, col = BLUE }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border:`1px solid #e2e8f0`, borderRadius:10, overflow:'hidden', marginBottom:10 }}>
      <div onClick={() => setOpen(o => !o)} style={{
        padding:'11px 16px', display:'flex', alignItems:'center', gap:8,
        cursor:'pointer', background:'#f8fafc', userSelect:'none',
        transition:'background 0.1s',
      }}
        onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'}
        onMouseLeave={e => e.currentTarget.style.background='#f8fafc'}
      >
        <i className={`ti ${icon}`} style={{ fontSize:14, color:col }} />
        <span style={{ fontSize:13, fontWeight:700, color:NAVY, flex:1 }}>{title}</span>
        {count !== undefined && count > 0 && (
          <span style={{ fontSize:10, background: col+'20', color:col, padding:'1px 7px', borderRadius:10, fontWeight:700 }}>{count}</span>
        )}
        <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize:12, color:'#94a3b8' }} />
      </div>
      {open && <div style={{ padding:'14px 16px' }}>{children}</div>}
    </div>
  )
}

// ── Section Primes (avec œil commissions) ──
function SectionPrimes({ dossier }) {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showComm, setShowComm] = useState(false)

  useEffect(() => {
    supabase.from('quittances')
      .select('compagnie,date_comptable,prime_totale,commission,commission_sa,sous_agent,compte_producteur')
      .eq('dossier', dossier)
      .order('date_comptable', { ascending: false })
      .limit(50)
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [dossier])

  if (loading) return <div style={{ color:'#94a3b8', fontSize:12 }}>Chargement…</div>
  if (!rows.length) return <div style={{ color:'#94a3b8', fontSize:12 }}>Aucune quittance trouvée</div>

  const totalPrimes = rows.reduce((s,r) => s + parseFloat(r.prime_totale || 0), 0)
  const totalComm   = rows.reduce((s,r) => s + parseFloat(r.commission || 0), 0)
  const totalCommSA = rows.reduce((s,r) => s + parseFloat(r.commission_sa || 0), 0)

  return (
    <div>
      {/* Totaux */}
      <div style={{ display:'flex', gap:12, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ background:'#f0f9ff', borderRadius:8, padding:'8px 14px', border:'1px solid #bfdbfe' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:2 }}>Primes TTC</div>
          <div style={{ fontSize:17, fontWeight:800, color:NAVY }}>{fmt(totalPrimes)}</div>
        </div>
        {showComm && (
          <>
            <div style={{ background:'#f0fdf4', borderRadius:8, padding:'8px 14px', border:'1px solid #bbf7d0' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:2 }}>Commission DYN</div>
              <div style={{ fontSize:17, fontWeight:800, color:'#16a34a' }}>{fmt(totalComm)}</div>
            </div>
            <div style={{ background:'#fdf4ff', borderRadius:8, padding:'8px 14px', border:'1px solid #e9d5ff' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', marginBottom:2 }}>Commission SA</div>
              <div style={{ fontSize:17, fontWeight:800, color:'#7c3aed' }}>{fmt(totalCommSA)}</div>
            </div>
          </>
        )}
        <button onClick={() => setShowComm(s => !s)} style={{
          marginLeft:'auto', display:'flex', alignItems:'center', gap:6, fontSize:12,
          color: showComm?'#16a34a':'#64748b',
          background: showComm?'#f0fdf4':'#f8fafc',
          border:`1px solid ${showComm?'#bbf7d0':'#e2e8f0'}`,
          borderRadius:7, padding:'5px 12px', cursor:'pointer', fontWeight:600,
          alignSelf:'flex-start',
        }}>
          <i className={`ti ${showComm?'ti-eye-off':'ti-eye'}`} />
          {showComm ? 'Masquer commissions' : 'Voir commissions'}
        </button>
      </div>

      {/* Tableau */}
      <div style={{ overflowX:'auto', maxHeight:220, overflowY:'auto', borderRadius:8, border:'1px solid #f1f5f9' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead style={{ position:'sticky', top:0, background:'#f8fafc', zIndex:1 }}>
            <tr>
              {['Période','Compagnie','Prime TTC', ...(showComm?['Comm. DYN','Comm. SA']:[])] .map(h=>(
                <th key={h} style={{ padding:'7px 12px', textAlign:'left', fontWeight:700, color:'#94a3b8', fontSize:10, textTransform:'uppercase', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => (
              <tr key={i} style={{ background:i%2===0?'#fff':'#fafafe' }}>
                <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', color:'#64748b', whiteSpace:'nowrap' }}>{fmtMois(r.date_comptable)}</td>
                <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', color:'#374151' }}>{r.compagnie||'—'}</td>
                <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', fontWeight:600, color:NAVY }}>{fmt(r.prime_totale)}</td>
                {showComm && <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', fontWeight:600, color:'#16a34a' }}>{fmt(r.commission)}</td>}
                {showComm && <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', fontWeight:600, color:'#7c3aed' }}>{fmt(r.commission_sa)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Objets de risques ──
function SectionRisques({ contrats }) {
  const actifs = contrats.filter(c => c.situation___libelle === 'En cours')
  const parDomaine = {}
  actifs.forEach(c => {
    const cfg = getDomaineIcon(c.domaine)
    const key = cfg.label
    if (!parDomaine[key]) parDomaine[key] = { ...cfg, count:0, polices:[] }
    parDomaine[key].count++
    if (c.police) parDomaine[key].polices.push(c.police)
  })
  const items = Object.values(parDomaine)
  if (!items.length) return <div style={{ fontSize:12, color:'#94a3b8' }}>Aucun contrat actif</div>
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:9, padding:'9px 14px', border:'1px solid #e2e8f0' }}>
          <span style={{ fontSize:22 }}>{item.icon}</span>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#1e293b' }}>{item.label}</div>
            <div style={{ fontSize:10, color:'#94a3b8' }}>{item.count} contrat{item.count>1?'s':''}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════
// FICHE CLIENT
// ══════════════════════════
function FicheClient({ client }) {
  const [contrats, setContrats] = useState([])
  const [taches, setTaches]     = useState([])
  const [loading, setLoading]   = useState(true)
  const ficheRef = useRef(null)

  useEffect(() => {
    if (!client) return
    ficheRef.current?.scrollIntoView({ behavior:'smooth', block:'start' })
    setLoading(true)
    Promise.all([
      supabase.from('contrats')
        .select('dossier,police,nom,situation___libelle,date_de_creation,domaine,type_production,garantie___valeur,sa,gestionnaire_nom')
        .eq('dossier', client.dossier)
        .order('date_de_creation', { ascending:false }),
      supabase.from('taches')
        .select('*')
        .eq('dossier_client', client.dossier)
        .order('echeance', { ascending:true })
        .limit(20),
    ]).then(([{data:c}, {data:t}]) => {
      setContrats(c || [])
      setTaches(t || [])
      setLoading(false)
    })
  }, [client?.dossier])

  if (!client) return null

  const initiales = `${(client.prenom||'?')[0]}${(client.nom||'?')[0]}`.toUpperCase()
  const actifs = contrats.filter(c => c.situation___libelle === 'En cours').length
  const adresse = [client.rue, client.num_maison, client.boite].filter(Boolean).join(' ')

  const SITUATION_COL = {
    'En cours': { bg:'#dcfce7', col:'#16a34a' },
    'Résilié':  { bg:'#fee2e2', col:'#dc2626' },
    'Suspendu': { bg:'#fef3c7', col:'#92400e' },
  }

  return (
    <div ref={ficheRef} style={{ marginTop:24, background:'#fff', borderRadius:12, border:`2px solid ${BLUE}30`, overflow:'hidden' }}>

      {/* Header fiche */}
      <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`, padding:'18px 22px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ width:52, height:52, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:18, fontWeight:800, color:'#fff' }}>{initiales}</span>
        </div>
        <div style={{ flex:1, minWidth:180 }}>
          <h2 style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 3px' }}>{client.prenom} {client.nom}</h2>
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', display:'flex', gap:14, flexWrap:'wrap' }}>
            <span>Dossier #{client.dossier}</span>
            {client.bureau && <span>{client.bureau}</span>}
            {client.classe && <span>Classe : {client.classe}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ textAlign:'center', background:'rgba(255,255,255,0.15)', borderRadius:8, padding:'8px 14px' }}>
            <div style={{ fontSize:20, fontWeight:800, color:'#fff' }}>{actifs}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)', fontWeight:600 }}>Actifs</div>
          </div>
          <div style={{ textAlign:'center', background:'rgba(255,255,255,0.15)', borderRadius:8, padding:'8px 14px' }}>
            <div style={{ fontSize:20, fontWeight:800, color:'#fff' }}>{contrats.length}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.7)', fontWeight:600 }}>Total</div>
          </div>
        </div>
      </div>

      <div style={{ padding:'18px 22px' }}>
        {client.alerte && (
          <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8, padding:'8px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#c2410c' }}>
            <i className="ti ti-alert-triangle" style={{ fontSize:16 }} />
            <strong>Alerte :</strong> {client.alerte}
          </div>
        )}

        {/* Section Coordonnées */}
        <Section icon="ti-user" title="Coordonnées" defaultOpen={true} col="#64748b">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:12 }}>
            {[
              { icon:'ti-map-pin',  label:'Adresse',     val: adresse ? `${adresse}, ${client.cp} ${client.localite}` : `${client.cp||''} ${client.localite||''}` },
              { icon:'ti-device-mobile', label:'GSM',    val: client.gsm || '—' },
              { icon:'ti-phone',    label:'Fixe',        val: client.tel_fixe || '—' },
              { icon:'ti-mail',     label:'Email',       val: client.email || '—' },
              { icon:'ti-calendar', label:'Naissance',   val: fmtDate(client.date_naissance) },
              { icon:'ti-user',     label:'Gestionnaire',val: client.gestionnaire_nom || '—' },
              { icon:'ti-user',     label:'Sous-agent',  val: client.sa_nom || '—' },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <i className={`ti ${r.icon}`} style={{ fontSize:14, color:'#94a3b8', marginTop:2, flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:10, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{r.label}</div>
                  <div style={{ fontSize:13, color:'#1e293b' }}>{r.val}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Section Objets de risques */}
        <Section icon="ti-shield" title="Objets assurés" count={contrats.filter(c=>c.situation___libelle==='En cours').length} defaultOpen={true} col="#7c3aed">
          {loading ? <div style={{ color:'#94a3b8', fontSize:12 }}>Chargement…</div> : <SectionRisques contrats={contrats} />}
        </Section>

        {/* Section Contrats */}
        <Section icon="ti-file-text" title="Contrats" count={contrats.length} defaultOpen={true} col={BLUE}>
          {loading ? (
            <div style={{ color:'#94a3b8', fontSize:12 }}>Chargement…</div>
          ) : !contrats.length ? (
            <div style={{ color:'#94a3b8', fontSize:12 }}>Aucun contrat</div>
          ) : (
            <div style={{ overflowX:'auto', maxHeight:260, overflowY:'auto', borderRadius:8, border:'1px solid #f1f5f9' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead style={{ position:'sticky', top:0, background:'#f8fafc', zIndex:1 }}>
                  <tr>
                    {['Police','Compagnie','Domaine','Situation','Type','Garantie'].map(h=>(
                      <th key={h} style={{ padding:'7px 12px', textAlign:'left', fontWeight:700, color:'#94a3b8', fontSize:10, textTransform:'uppercase', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contrats.map((c,i) => {
                    const s = SITUATION_COL[c.situation___libelle] || { bg:'#f1f5f9', col:'#64748b' }
                    return (
                      <tr key={i} style={{ background:i%2===0?'#fff':'#fafafe' }}>
                        <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', fontSize:11, fontWeight:600, color:NAVY }}>{c.police||'—'}</td>
                        <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', color:'#1e293b' }}>{c.nom||'—'}</td>
                        <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{c.domaine||'—'}</td>
                        <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9' }}>
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, background:s.bg, color:s.col }}>{c.situation___libelle||'—'}</span>
                        </td>
                        <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{c.type_production||'—'}</td>
                        <td style={{ padding:'7px 12px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{c.garantie___valeur||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Section Primes */}
        <Section icon="ti-cash" title="Primes & commissions" defaultOpen={true} col="#16a34a">
          <SectionPrimes dossier={client.dossier} />
        </Section>

        {/* Section Tâches */}
        <Section icon="ti-checkbox" title="Tâches" count={taches.length} defaultOpen={false} col="#f59e0b">
          {loading ? (
            <div style={{ color:'#94a3b8', fontSize:12 }}>Chargement…</div>
          ) : !taches.length ? (
            <div style={{ color:'#16a34a', fontSize:12 }}>✓ Aucune tâche en cours</div>
          ) : (
            taches.map((t,i) => {
              const retard = t.echeance && new Date(t.echeance) < new Date()
              return (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:i<taches.length-1?'1px solid #f8fafc':'none', background:retard?'#fff5f5':'transparent', borderRadius:4, paddingLeft:retard?6:0 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:'#1e293b' }}>{t.titre||'—'}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{t.gestionnaire} {t.code_type?`· ${t.code_type}`:''}</div>
                  </div>
                  <span style={{ fontSize:11, color:retard?'#dc2626':'#64748b', fontWeight:retard?700:400 }}>{fmtDate(t.echeance)}</span>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, background:retard?'#fee2e2':'#dbeafe', color:retard?'#dc2626':'#1d4ed8' }}>{t.statut}</span>
                </div>
              )
            })
          )}
        </Section>
      </div>
    </div>
  )
}

// ══════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════
export default function DynassurClients() {
  const [kpis, setKpis]           = useState(null)
  const [scope, setScope]         = useState('all')      // 'mine' | 'bureau' | 'all'
  const [recherche, setRecherche] = useState('')
  const [clients, setClients]     = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(0)
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState(null)
  const [myCode, setMyCode]       = useState(null)
  const [myBureau, setMyBureau]   = useState(null)

  // Récupérer l'utilisateur courant
  useEffect(() => {
    supabase.auth.getUser().then(({ data:{ user } }) => {
      if (!user) return
      const code = user.email?.split('@')[0]?.toUpperCase()
      setMyCode(code)
      supabase.from('clients').select('bureau').eq('gestionnaire_code', code).limit(1)
        .then(({ data }) => { if (data?.[0]?.bureau) setMyBureau(data[0].bureau) })
    })
    // Charger KPIs via RPC
    supabase.rpc('get_clients_kpis').then(({ data, error }) => {
      if (!error && data) setKpis(data)
    })
  }, [])

  const buildQuery = useCallback((search, sc, p) => {
    let q = supabase.from('clients')
      .select('dossier,nom,prenom,cp,localite,gsm,email,sa_nom,gestionnaire_code,gestionnaire_nom,bureau,classe,alerte', { count:'exact' })
    if (search.length >= 2)
      q = q.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,dossier.ilike.%${search}%,email.ilike.%${search}%`)
    if (sc === 'mine' && myCode) q = q.eq('gestionnaire_code', myCode)
    else if (sc === 'bureau' && myBureau) q = q.eq('bureau', myBureau)
    return q.order('nom').range(p * PER_PAGE, p * PER_PAGE + PER_PAGE - 1)
  }, [myCode, myBureau])

  const load = useCallback(async (search, sc, p) => {
    setLoading(true)
    const { data, count } = await buildQuery(search, sc, p)
    // Déduplication côté JS — garder 1 seule ligne par dossier
    const seen = new Set()
    const unique = (data || []).filter(c => {
      if (!c.dossier || seen.has(c.dossier)) return false
      seen.add(c.dossier); return true
    })
    setClients(unique)
    setTotal(count || 0)
    setLoading(false)
  }, [buildQuery])

  useEffect(() => {
    const t = setTimeout(() => { setPage(0); setSelected(null); load(recherche, scope, 0) }, 300)
    return () => clearTimeout(t)
  }, [recherche, scope])

  useEffect(() => { load(recherche, scope, page) }, [page])

  const nbPages = Math.ceil(total / PER_PAGE)

  // ── KPI Cards ──
  const KPI_DEF = [
    { key:'total_clients',    icon:'ti-users',         label:'Clients uniques', col:'#0080BD' },
    { key:'avec_alerte',      icon:'ti-alert-triangle', label:'Avec alerte',    col:'#f59e0b' },
    { key:'sans_contrat',     icon:'ti-file-off',       label:'Sans contrat',   col:'#dc2626' },
    { key:'sans_commissions', icon:'ti-cash-off',       label:'Sans comm. 2026',col:'#7c3aed' },
  ]

  return (
    <Layout currentPage="Clients">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:1300 }}>

        {/* Titre */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <i className="ti ti-users" style={{ fontSize:20, color:BLUE }} />
            <h1 style={{ fontSize:20, fontWeight:800, color:NAVY, margin:0 }}>Clients Dynassur</h1>
          </div>
          <p style={{ fontSize:13, color:'#64748b', margin:0 }}>Base clients — {new Date().getFullYear()}</p>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:22 }}>
          {KPI_DEF.map(k => (
            <div key={k.key} style={{ background:'#fff', borderRadius:9, border:'1px solid #e2e8f0', borderTop:`3px solid ${k.col}`, padding:'14px 18px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em' }}>{k.label}</div>
                <i className={`ti ${k.icon}`} style={{ fontSize:17, color:k.col+'80' }} />
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:'#0f172a' }}>
                {kpis ? (kpis[k.key] ?? '—').toLocaleString('fr-BE') : '…'}
              </div>
              {!kpis && <div style={{ fontSize:10, color:'#94a3b8', marginTop:2 }}>Vue SQL requise</div>}
            </div>
          ))}
        </div>

        {/* Filtre scope + recherche */}
        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          {/* Radio scope */}
          <div style={{ display:'flex', gap:2, background:'#f1f5f9', borderRadius:8, padding:3 }}>
            {[
              { val:'mine',   label:`Mes clients${myCode?` (${myCode})`:''}` },
              { val:'bureau', label:`Mon bureau${myBureau?` (${myBureau})`:''}` },
              { val:'all',    label:'Tous Dynassur' },
            ].map(o => (
              <button key={o.val} onClick={() => setScope(o.val)} style={{
                padding:'5px 12px', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight: scope===o.val?700:400,
                background: scope===o.val?'#fff':'transparent',
                color: scope===o.val?NAVY:'#64748b',
                boxShadow: scope===o.val?'0 1px 3px rgba(0,0,0,0.1)':'none',
                transition:'all 0.15s',
              }}>{o.label}</button>
            ))}
          </div>

          {/* Barre de recherche */}
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <i className="ti ti-search" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', fontSize:16 }} />
            <input
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              placeholder="Rechercher par nom, prénom, dossier, email…"
              style={{ width:'100%', padding:'9px 12px 9px 36px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, fontFamily:"'Source Sans Pro', sans-serif", outline:'none', boxSizing:'border-box' }}
            />
            {recherche && (
              <button onClick={() => setRecherche('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16 }}>✕</button>
            )}
          </div>

          <span style={{ fontSize:12, color:'#94a3b8', whiteSpace:'nowrap' }}>
            {loading ? 'Chargement…' : `≈ ${total.toLocaleString('fr-BE')} client${total>1?'s':''}`}
          </span>
        </div>

        {/* Tableau */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden', marginBottom:4 }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  {['N° Dossier','Nom & Prénom','Localité','Gestionnaire','Sous-agent',''].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#94a3b8', fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && !clients.length ? (
                  <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Chargement…</td></tr>
                ) : !clients.length ? (
                  <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Aucun client trouvé</td></tr>
                ) : clients.map((c,i) => {
                  const isSel = selected?.dossier === c.dossier
                  return (
                    <tr key={c.dossier||i}
                      onClick={() => setSelected(isSel ? null : c)}
                      style={{ cursor:'pointer', background: isSel?`${BLUE}10`:i%2===0?'#fff':'#fafafe', transition:'background 0.1s',
                        borderLeft: isSel?`3px solid ${BLUE}`:'3px solid transparent' }}
                      onMouseEnter={e => { if(!isSel) e.currentTarget.style.background='#f0f9ff' }}
                      onMouseLeave={e => e.currentTarget.style.background = isSel?`${BLUE}10`:i%2===0?'#fff':'#fafafe'}
                    >
                      <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', fontSize:11, color:NAVY, fontWeight:600 }}>{c.dossier}</td>
                      <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9' }}>
                        <div style={{ fontWeight:600, color:'#1e293b' }}>{c.nom} {c.prenom}</div>
                        {c.email && <div style={{ fontSize:11, color:'#94a3b8' }}>{c.email}</div>}
                      </td>
                      <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{c.cp} {c.localite||'—'}</td>
                      <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b', fontSize:12 }}>{c.gestionnaire_nom||'—'}</td>
                      <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9', color:'#64748b', fontSize:12 }}>{c.sa_nom||'—'}</td>
                      <td style={{ padding:'9px 14px', borderBottom:'1px solid #f1f5f9' }}>
                        <div style={{ display:'flex', gap:4, alignItems:'center', justifyContent:'flex-end' }}>
                          {c.alerte && <i className="ti ti-alert-triangle" style={{ fontSize:14, color:'#f59e0b' }} title={c.alerte} />}
                          {c.classe && <span style={{ fontSize:10, background:'#f1f5f9', color:'#64748b', padding:'1px 5px', borderRadius:4 }}>{c.classe}</span>}
                          <span style={{ fontSize:11, color: isSel?'#dc2626':BLUE, fontWeight:600 }}>{isSel?'▲ Fermer':'▼ Fiche'}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {nbPages > 1 && (
            <div style={{ padding:'10px 18px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fafafe' }}>
              <button onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0}
                style={{ padding:'5px 14px', borderRadius:6, border:'1px solid #e2e8f0', background:page===0?'#f8fafc':'#fff', cursor:page===0?'not-allowed':'pointer', fontSize:12, color:page===0?'#94a3b8':'#374151' }}>
                ← Précédent
              </button>
              <span style={{ fontSize:12, color:'#64748b' }}>Page {page+1} / {nbPages}</span>
              <button onClick={() => setPage(p=>Math.min(nbPages-1,p+1))} disabled={page===nbPages-1}
                style={{ padding:'5px 14px', borderRadius:6, border:'1px solid #e2e8f0', background:page===nbPages-1?'#f8fafc':'#fff', cursor:page===nbPages-1?'not-allowed':'pointer', fontSize:12, color:page===nbPages-1?'#94a3b8':'#374151' }}>
                Suivant →
              </button>
            </div>
          )}
        </div>

        {/* Fiche client — apparaît en dessous */}
        {selected && <FicheClient client={selected} />}

      </div>
    </Layout>
  )
}
