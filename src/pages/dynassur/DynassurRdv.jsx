import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

const E = ENTITES.dynassur
const NAVY = '#0D2F5E'
const MOIS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function fmtDateHeure(iso, journee) {
  if (!iso) return '—'
  const d = new Date(iso.length <= 19 ? iso + 'Z' : iso)
  if (isNaN(d)) return iso.slice(0, 16)
  const jour = `${d.getUTCDate()} ${MOIS[d.getUTCMonth() + 1]}`
  if (journee) return `${jour} · journée`
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${jour} · ${hh}:${mm}`
}
function tsOf(iso) { const d = new Date((iso || '').length <= 19 ? iso + 'Z' : iso); return isNaN(d) ? 0 : d.getTime() }

// Mots à ignorer pour deviner le nom du client dans l'objet
const STOP = new Set(['RDV','RDVS','PH','PRET','PRÊT','HYPO','HYPOTHEQUE','HYPOTHÉCAIRE','HYPOTHECAIRE','SIGN','SIGNATURE','CARDIF',
  'DOSSIER','DOSSIERS','CREDIT','CRÉDIT','SRDU','DEUX','AVEC','ATTENTION','SORTIR','BNB','CAR','FAILLITE','FAILLI','REUNION','RÉUNION',
  'EXPERTISE','MME','MMME','MR','MONSIEUR','MADAME','LES','DES','POUR','RESTO','EQUIPE','ÉQUIPE','DYNASSUR','FORMATION','PROVIDIS',
  'MICROSOFT','POWER','DAYS','FOUNDRY','LIEGE','LIÈGE','JUPRELLE','VISIO','TEAMS','APPEL','CALL','TEL','TÉL','VIE','IARD','AUTO',
  'CONTRAT','CLIENT','NOUVEAU','NEW','SUIVI','POINT','DEBRIEF','DÉBRIEF','MEETING','LUNCH','MIDI','SS','QG','OK','URGENT','SUITE'])

function guessNom(objet) {
  const toks = (objet || '').split(/[^A-Za-zÀ-ÿ]+/).filter(t => t.length >= 3 && !STOP.has(t.toUpperCase()))
  // privilégie un token tout en majuscules (souvent le nom de famille), sinon le plus long
  const caps = toks.find(t => t === t.toUpperCase())
  if (caps) return caps
  return toks.sort((a, b) => b.length - a.length)[0] || ''
}

function KpiCard({ label, value, col, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${col}`, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function CatBadge({ code, cats }) {
  const c = cats[code]
  const col = (c && c.couleur) || '#64748b'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: col + '20', color: col, whiteSpace: 'nowrap' }}>
      {code}{c && c.libelle ? ` · ${c.libelle}` : ''}
    </span>
  )
}

// ---- Modale de sélection d'un client -------------------------------------
function ClientPicker({ rdv, onClose, onPick }) {
  const collab = (rdv.user_email || '').split('@')[0].toUpperCase()
  const [q, setQ] = useState(() => guessNom(rdv.objet))
  const [res, setRes] = useState([])
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  async function run(term) {
    if (!term || term.trim().length < 2) { setRes([]); return }
    setLoading(true)
    const t = term.trim()
    const { data } = await supabase.from('clients')
      .select('id,nom,prenom,dossier,localite,cp,sa_code,gestionnaire_code,sa_nom,gestionnaire_nom')
      .or(`nom.ilike.%${t}%,prenom.ilike.%${t}%,dossier.ilike.%${t}%`)
      .limit(40)
    // portefeuille du collaborateur en premier
    const sorted = (data || []).sort((a, b) => {
      const pa = (a.sa_code === collab || a.gestionnaire_code === collab) ? 0 : 1
      const pb = (b.sa_code === collab || b.gestionnaire_code === collab) ? 0 : 1
      return pa - pb || (a.nom || '').localeCompare(b.nom || '')
    })
    setRes(sorted)
    setLoading(false)
  }
  useEffect(() => { run(q) /* recherche initiale */ }, [])
  function onChange(v) {
    setQ(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => run(v), 300)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 620, maxHeight: '78vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Lier au client</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{rdv.objet} · {fmtDateHeure(rdv.debut, rdv.journee_entiere)} · agenda {collab}</div>
          <input autoFocus value={q} onChange={e => onChange(e.target.value)} placeholder="Nom, prénom ou n° de dossier…"
            style={{ marginTop: 12, width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: `2px solid ${E.color}`, fontSize: 14, color: NAVY, fontFamily: "'Source Sans Pro', sans-serif" }} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}><i className="ti ti-loader-2" style={{ fontSize: 24, animation: 'spin 1s linear infinite' }} /></div>
          ) : res.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Aucun client trouvé. Affine la recherche.</div>
          ) : res.map(c => {
            const inPf = c.sa_code === collab || c.gestionnaire_code === collab
            return (
              <div key={c.id} onClick={() => onPick(c)} style={{ padding: '10px 20px', borderTop: '1px solid #f8fafc', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>
                    {c.nom} {c.prenom}
                    {inPf && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: E.color + '18', color: E.color }}>SON CLIENT</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {c.dossier ? `Dossier ${c.dossier} · ` : ''}{c.cp || ''} {c.localite || ''}
                    {c.sa_code ? ` · com. ${c.sa_code}` : ''}{c.gestionnaire_code ? ` · gest. ${c.gestionnaire_code}` : ''}
                  </div>
                </div>
                <i className="ti ti-link" style={{ color: E.color, fontSize: 18 }} />
              </div>
            )
          })}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

export default function DynassurRdv() {
  const [rdv, setRdv] = useState([])
  const [cats, setCats] = useState({})
  const [clientsById, setClientsById] = useState({})   // id -> {nom,prenom,dossier}
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState('avenir')
  const [filtreCat, setFiltreCat] = useState('')
  const [recherche, setRecherche] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [flash, setFlash] = useState(null)
  const [picker, setPicker] = useState(null)            // rdv en cours de liaison

  async function chargerClients(rows) {
    const ids = [...new Set(rows.map(r => r.client_id).filter(Boolean))]
    if (ids.length === 0) { setClientsById({}); return }
    const { data } = await supabase.from('clients').select('id,nom,prenom,dossier').in('id', ids)
    const m = {}
    ;(data || []).forEach(c => { m[c.id] = c })
    setClientsById(m)
  }

  async function charger() {
    setLoading(true)
    const [{ data: cdata }, { data: rData }] = await Promise.all([
      supabase.from('rdv_categories').select('code,libelle,couleur,entite,ordre').order('ordre'),
      supabase.from('rdv').select('*').order('debut', { ascending: false }).range(0, 1999),
    ])
    const map = {}
    ;(cdata || []).forEach(c => { map[c.code] = c })
    setCats(map)
    setRdv(rData || [])
    await chargerClients(rData || [])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const codesDyn = useMemo(
    () => Object.values(cats).filter(c => (c.entite || '').toUpperCase() === 'DYNASSUR').map(c => c.code),
    [cats]
  )

  const now = Date.now()
  const liste = useMemo(() => {
    let l = rdv.filter(r => codesDyn.length === 0 || codesDyn.includes(r.categorie))
    if (filtreCat) l = l.filter(r => r.categorie === filtreCat)
    if (periode === 'avenir') l = l.filter(r => tsOf(r.debut) >= now - 86400000)
    if (periode === 'passes') l = l.filter(r => tsOf(r.debut) < now - 86400000)
    if (recherche.trim()) {
      const q = recherche.toLowerCase()
      l = l.filter(r => {
        const c = clientsById[r.client_id]
        return (r.objet || '').toLowerCase().includes(q)
          || (r.user_email || '').toLowerCase().includes(q)
          || (c && `${c.nom} ${c.prenom}`.toLowerCase().includes(q))
      })
    }
    return l.sort((a, b) => periode === 'passes' ? tsOf(b.debut) - tsOf(a.debut) : tsOf(a.debut) - tsOf(b.debut))
  }, [rdv, codesDyn, filtreCat, periode, recherche, now, clientsById])

  const totalDyn = useMemo(() => rdv.filter(r => codesDyn.includes(r.categorie)), [rdv, codesDyn])
  const avenir = totalDyn.filter(r => tsOf(r.debut) >= now - 86400000).length
  const lies = useMemo(() => totalDyn.filter(r => r.client_id).length, [totalDyn])
  const parCat = useMemo(() => {
    const c = {}
    totalDyn.forEach(r => { c[r.categorie] = (c[r.categorie] || 0) + 1 })
    return c
  }, [totalDyn])

  function notify(ok, msg) { setFlash({ ok, msg }); setTimeout(() => setFlash(null), 4000) }

  async function lierClient(client) {
    const r = picker
    setPicker(null)
    setBusyId(r.id)
    try {
      const { error } = await supabase.from('rdv').update({ client_id: client.id, dossier_client: client.dossier || null }).eq('id', r.id)
      if (error) throw error
      setRdv(prev => prev.map(x => x.id === r.id ? { ...x, client_id: client.id, dossier_client: client.dossier || null } : x))
      setClientsById(prev => ({ ...prev, [client.id]: client }))
      notify(true, `RDV lié à ${client.nom} ${client.prenom}.`)
    } catch (e) { notify(false, 'Erreur : ' + (e.message || e)) }
    finally { setBusyId(null) }
  }

  async function delier(r) {
    setBusyId(r.id)
    try {
      const { error } = await supabase.from('rdv').update({ client_id: null }).eq('id', r.id)
      if (error) throw error
      setRdv(prev => prev.map(x => x.id === r.id ? { ...x, client_id: null } : x))
      notify(true, 'Lien client retiré.')
    } catch (e) { notify(false, 'Erreur : ' + (e.message || e)) }
    finally { setBusyId(null) }
  }

  async function creerTacheSuivi(r) {
    setBusyId(r.id)
    try {
      const dateTxt = fmtDateHeure(r.debut, r.journee_entiere)
      const echeance = r.debut ? new Date((r.debut.length <= 19 ? r.debut + 'Z' : r.debut)).toISOString().slice(0, 10) : null
      const { error } = await supabase.from('taches').insert({
        titre: `Suivi RDV : ${r.objet || 'sans objet'}`,
        description: `RDV du ${dateTxt} — catégorie ${r.categorie}${r.lieu ? ` — ${r.lieu}` : ''}${r.user_email ? ` (agenda ${r.user_email})` : ''}`,
        statut: 'todo', priorite: 'moyenne', categorie: 'RDV', source: 'rdv',
        client_id: r.client_id || null, dossier_client: r.dossier_client || null,
        echeance, lien_url: r.web_link || null,
      })
      if (error) throw error
      notify(true, 'Tâche de suivi créée.')
    } catch (e) { notify(false, 'Échec création tâche : ' + (e.message || e)) }
    finally { setBusyId(null) }
  }

  const selStyle = { padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: NAVY, background: '#fff', fontFamily: "'Source Sans Pro', sans-serif" }

  return (
    <Layout>
      <StatBanner
        color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
        title="RDV / Agenda" subtitle="Rendez-vous synchronisés depuis Outlook — suivi commercial ↔ gestionnaire"
        action={
          <button onClick={charger} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <i className="ti ti-refresh" style={{ marginRight: 6 }} />Actualiser
          </button>
        }
      />

      {flash && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: flash.ok ? '#16a34a15' : '#dc262615', color: flash.ok ? '#16a34a' : '#dc2626',
          border: `1px solid ${flash.ok ? '#16a34a40' : '#dc262640'}` }}>
          <i className={`ti ${flash.ok ? 'ti-check' : 'ti-alert-circle'}`} style={{ marginRight: 6 }} />{flash.msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label="RDV 2026" value={totalDyn.length} col={E.color} />
        <KpiCard label="À venir" value={avenir} col="#16a34a" />
        <KpiCard label="Liés à un client" value={lies} col="#7c3aed" sub={`${totalDyn.length - lies} à lier`} />
        {Object.keys(parCat).sort().map(code => (
          <KpiCard key={code} label={(cats[code] && cats[code].libelle) || code} value={parCat[code]} col={(cats[code] && cats[code].couleur) || '#64748b'} />
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['avenir', 'À venir'], ['passes', 'Passés'], ['tous', 'Tous']].map(([k, lbl]) => (
            <button key={k} onClick={() => setPeriode(k)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `2px solid ${periode === k ? E.color : '#e2e8f0'}`, background: periode === k ? E.color : '#fff', color: periode === k ? '#fff' : '#64748b'
            }}>{lbl}</button>
          ))}
        </div>
        <select value={filtreCat} onChange={e => setFiltreCat(e.target.value)} style={selStyle}>
          <option value="">Toutes catégories</option>
          {codesDyn.map(code => <option key={code} value={code}>{code} — {cats[code] && cats[code].libelle}</option>)}
        </select>
        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher objet / client / agenda…"
          style={{ ...selStyle, flex: 1, minWidth: 200 }} />
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          <i className="ti ti-loader-2" style={{ fontSize: 32, display: 'block', marginBottom: 12, animation: 'spin 1s linear infinite' }} />
          Chargement des RDV…
          <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
        </div>
      ) : liste.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', color: '#94a3b8' }}>
          <i className="ti ti-calendar-off" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
          Aucun RDV pour ces filtres.<br />
          <span style={{ fontSize: 12 }}>Les RDV remontent automatiquement d'Outlook (catégories : {codesDyn.join(', ') || '—'}).</span>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  <th style={{ padding: '10px 14px' }}>Quand</th>
                  <th style={{ padding: '10px 14px' }}>Objet</th>
                  <th style={{ padding: '10px 14px' }}>Catégorie</th>
                  <th style={{ padding: '10px 14px' }}>Client</th>
                  <th style={{ padding: '10px 14px' }}>Agenda</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Suivi</th>
                </tr>
              </thead>
              <tbody>
                {liste.map(r => {
                  const c = clientsById[r.client_id]
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: NAVY, fontWeight: 600 }}>{fmtDateHeure(r.debut, r.journee_entiere)}</td>
                      <td style={{ padding: '10px 14px', maxWidth: 300 }}>
                        {r.web_link
                          ? <a href={r.web_link} target="_blank" rel="noreferrer" style={{ color: NAVY, textDecoration: 'none', fontWeight: 600 }}>{r.objet || '—'}</a>
                          : (r.objet || '—')}
                        {r.lieu && <div style={{ fontSize: 11, color: '#94a3b8' }}><i className="ti ti-map-pin" style={{ marginRight: 3 }} />{r.lieu}</div>}
                      </td>
                      <td style={{ padding: '10px 14px' }}><CatBadge code={r.categorie} cats={cats} /></td>
                      <td style={{ padding: '10px 14px' }}>
                        {c ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 700, color: NAVY }}>{c.nom} {c.prenom}</span>
                            <button onClick={() => delier(r)} disabled={busyId === r.id} title="Retirer le lien" style={{ border: 'none', background: 'none', color: '#cbd5e1', cursor: 'pointer', padding: 0, fontSize: 14 }}>
                              <i className="ti ti-x" />
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => setPicker(r)} disabled={busyId === r.id} style={{
                            padding: '4px 10px', borderRadius: 6, border: '1px dashed #cbd5e1', background: '#fff',
                            color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                          }}>
                            <i className="ti ti-link" style={{ marginRight: 4 }} />Lier
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{(r.user_email || '').replace('@dynassur.be', '')}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button onClick={() => creerTacheSuivi(r)} disabled={busyId === r.id} style={{
                          padding: '5px 10px', borderRadius: 6, border: `1px solid ${E.color}40`, background: E.color + '12',
                          color: E.color, fontSize: 12, fontWeight: 700, cursor: busyId === r.id ? 'wait' : 'pointer', whiteSpace: 'nowrap'
                        }}>
                          <i className="ti ti-checkbox" style={{ marginRight: 4 }} />Tâche
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {picker && <ClientPicker rdv={picker} onClose={() => setPicker(null)} onPick={lierClient} />}
    </Layout>
  )
}
