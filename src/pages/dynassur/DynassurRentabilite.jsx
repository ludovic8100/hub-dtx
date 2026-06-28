import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

const BLUE = '#0080BD'
const NAVY = '#0D2F5E'

// Noms lisibles (repris de la Production) — fallback sur nom_sa_data puis code
const AGENT_NOMS = {
  GGO: 'Gregory Godfroid', TJA: 'Thibault Japsenne', PFQ: 'Priscilla Fernandez',
  MTE: 'Michelangelo Terrana', NGI: 'Nadine Ginis', LDE: 'Ludovic Detilloux',
  JFS: 'J-F. Simonis', FMZ: 'Fabrice Mammo', ICE: 'Ingrid Cezar',
  RCA: 'Raphael Carrea', MVM: 'Michael Van Muylder', VPE: 'Vincent Pesser',
  LGM: 'Luisa Gaen Munoz', OBA: 'Olivier Baudelet', RDE: 'Renaud Desclez',
  DCO: 'Didier Coco', HML: 'Homelinks', FBL: 'F. Bleret', BHU: 'B. Hubert',
}

const fmtE = v => v == null ? '—' : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
const fmtP = v => v == null ? '—' : `${Math.round(v)} %`

// Lecture paginée (contourne le plafond PostgREST de 1000 lignes)
async function loadAll(table, select, filterFn) {
  let out = [], from = 0
  while (true) {
    let q = supabase.from(table).select(select)
    if (filterFn) q = filterFn(q)
    const { data, error } = await q.range(from, from + 999)
    if (error || !data || !data.length) break
    out = out.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

const CAT_BADGE = {
  SA: { label: 'Sous-agent', col: '#9333ea' },
  Apporteur: { label: 'Apporteur', col: '#f97316' },
  HQ: { label: 'Employé / HQ', col: '#0ea5e9' },
}

function Kpi({ label, value, col, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${col}`, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const th = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#334155' }
const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

function Section({ titre, children, note }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 22 }}>
      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{titre}</div>
        {note && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{note}</div>}
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  )
}

export default function DynassurRentabilite() {
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [m, setM] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      const y = annee

      // Collaborateurs → mapping nom→code + catégorie + bureau
      const collabs = await loadAll('collaborateurs', 'code,nom_sa_data,noms_repris,bureau,est_sous_agent,est_apporteur')
      const nameToCode = {}, info = {}
      collabs.forEach(c => {
        const cat = c.est_apporteur ? 'Apporteur' : c.est_sous_agent ? 'SA' : 'HQ'
        info[c.code] = { cat, bureau: c.bureau || '—', nom: AGENT_NOMS[c.code] || c.nom_sa_data || c.code }
        if (c.nom_sa_data) nameToCode[String(c.nom_sa_data).trim()] = c.code
        ;(c.noms_repris || []).forEach(n => n && (nameToCode[String(n).trim()] = c.code))
      })

      // Taux de rétention Dynassur (part de commission gardée)
      const obj = await loadAll('objectifs_2026', 'collaborateur_code,taux_retention_dynassur')
      const TAUX = {}
      obj.forEach(o => { if (o.taux_retention_dynassur != null) TAUX[o.collaborateur_code] = Number(o.taux_retention_dynassur) })

      // Commissions de l'année par producteur
      const q = await loadAll('quittances', 'sous_agent,commission',
        qb => qb.gte('date_comptable', `${y}-01-01`).lte('date_comptable', `${y}-12-31`))
      const commByCode = {}
      q.forEach(r => {
        const raw = (r.sous_agent || '').trim()
        const code = nameToCode[raw] || ('?' + (raw || 'inconnu'))
        commByCode[code] = (commByCode[code] || 0) + (Number(r.commission) || 0)
      })

      // Producteurs : commission, rétrocession (= coût), marge Dynassur
      const producers = Object.entries(commByCode).map(([code, commission]) => {
        const meta = info[code] || { cat: 'SA', bureau: '—', nom: code.startsWith('?') ? code.slice(1) : code }
        const taux = TAUX[code]
        const tauxManquant = meta.cat !== 'HQ' && taux == null
        const retro = meta.cat === 'HQ' ? 0 : (taux != null ? commission * (1 - taux / 100) : 0)
        const marge = commission - retro
        return { code, nom: meta.nom, bureau: meta.bureau, cat: meta.cat, commission, taux: taux ?? null, retro, marge, tauxManquant }
      }).sort((a, b) => b.commission - a.commission)

      const sousAgents = producers.filter(p => p.cat === 'SA' || p.cat === 'Apporteur')
      const employes = producers.filter(p => p.cat === 'HQ')

      // Agrégat par bureau
      const bMap = {}
      producers.forEach(p => {
        const b = p.bureau || '—'
        if (!bMap[b]) bMap[b] = { bureau: b, commission: 0, retro: 0, marge: 0, n: 0 }
        bMap[b].commission += p.commission; bMap[b].retro += p.retro; bMap[b].marge += p.marge; bMap[b].n++
      })
      const bureaux = Object.values(bMap).sort((a, b) => b.marge - a.marge)

      // Frais de structure : dépenses bancaires de l'année (montant < 0)
      const tx = await loadAll('transactions', 'montant,categorie_id,date_execution',
        tb => tb.lt('montant', 0).gte('date_execution', `${y}-01-01`).lte('date_execution', `${y}-12-31`))
      const cats = await loadAll('categories', 'id,nom')
      const catName = {}; cats.forEach(c => { catName[c.id] = c.nom })
      let structureTotal = 0; const parCat = {}
      tx.forEach(t => {
        const v = Math.abs(Number(t.montant) || 0)
        structureTotal += v
        const k = catName[t.categorie_id] || 'Non catégorisé'
        parCat[k] = (parCat[k] || 0) + v
      })
      const structure = Object.entries(parCat).map(([nom, montant]) => ({ nom, montant })).sort((a, b) => b.montant - a.montant)

      const commTot = producers.reduce((s, p) => s + p.commission, 0)
      const retroTot = producers.reduce((s, p) => s + p.retro, 0)
      const margeBrute = commTot - retroTot
      const kpis = { commTot, retroTot, margeBrute, structure: structureTotal, resultat: margeBrute - structureTotal }

      if (alive) { setM({ sousAgents, employes, bureaux, structure, kpis }); setLoading(false) }
    })()
    return () => { alive = false }
  }, [annee])

  return (
    <Layout currentPage="Rentabilité">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner
          color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo}
          title="Rentabilité"
          subtitle="Dynassur SRL — marge par sous-agent, bureau et frais de structure"
        />

        <div style={{ display: 'flex', gap: 8, margin: '0 0 20px' }}>
          {[annee - 2, annee - 1, new Date().getFullYear()].filter((v, i, a) => a.indexOf(v) === i).map(a => (
            <button key={a} onClick={() => setAnnee(a)} style={{
              padding: '6px 16px', borderRadius: 20, border: `2px solid ${annee === a ? BLUE : '#e2e8f0'}`,
              background: annee === a ? BLUE : '#fff', color: annee === a ? '#fff' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{a}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Calcul de la rentabilité…</div>
        ) : !m ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Aucune donnée.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 24 }}>
              <Kpi label="Commissions" value={fmtE(m.kpis.commTot)} col={BLUE} sub="encaissées sur l'année" />
              <Kpi label="Rétrocessions sous-agents" value={fmtE(m.kpis.retroTot)} col="#9333ea" sub="= ce que coûtent les SA" />
              <Kpi label="Marge après rétrocessions" value={fmtE(m.kpis.margeBrute)} col="#16a34a" sub="avant structure & employés" />
              <Kpi label="Frais de structure" value={fmtE(m.kpis.structure)} col="#dc2626" sub="dépenses bancaires" />
              <Kpi label="Résultat indicatif" value={fmtE(m.kpis.resultat)} col={NAVY} sub="hors coûts employés (à importer)" />
            </div>

            <Section titre="Sous-agents & apporteurs" note="Commission générée − rétrocession versée = marge Dynassur. « taux ? » = taux de rétention non défini dans objectifs_2026 (rétrocession non déduite).">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Producteur</th><th style={th}>Bureau</th><th style={th}>Cat.</th>
                  <th style={thR}>Commission</th><th style={thR}>Taux rét.</th><th style={thR}>Rétrocession (coût)</th><th style={thR}>Marge Dynassur</th>
                </tr></thead>
                <tbody>
                  {m.sousAgents.map(p => (
                    <tr key={p.code}>
                      <td style={td}><span style={{ fontWeight: 600, color: NAVY }}>{p.nom}</span> <span style={{ fontSize: 10, color: '#94a3b8' }}>{p.code}</span></td>
                      <td style={td}>{p.bureau}</td>
                      <td style={td}><span style={{ fontSize: 10, fontWeight: 700, color: CAT_BADGE[p.cat].col }}>{CAT_BADGE[p.cat].label}</span></td>
                      <td style={tdR}>{fmtE(p.commission)}</td>
                      <td style={tdR}>{p.tauxManquant ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>taux ?</span> : fmtP(p.taux)}</td>
                      <td style={tdR}>{p.tauxManquant ? '—' : fmtE(p.retro)}</td>
                      <td style={{ ...tdR, fontWeight: 700, color: '#16a34a' }}>{p.tauxManquant ? '—' : fmtE(p.marge)}</td>
                    </tr>
                  ))}
                  {!m.sousAgents.length && <tr><td style={td} colSpan={7}>Aucun sous-agent avec commission sur {annee}.</td></tr>}
                </tbody>
              </table>
            </Section>

            <Section titre="Par bureau" note="Agrégation de tous les producteurs rattachés au bureau.">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Bureau</th><th style={thR}>Producteurs</th><th style={thR}>Commission</th><th style={thR}>Rétrocessions</th><th style={thR}>Marge</th>
                </tr></thead>
                <tbody>
                  {m.bureaux.map(b => (
                    <tr key={b.bureau}>
                      <td style={{ ...td, fontWeight: 600, color: NAVY }}>{b.bureau}</td>
                      <td style={tdR}>{b.n}</td>
                      <td style={tdR}>{fmtE(b.commission)}</td>
                      <td style={tdR}>{fmtE(b.retro)}</td>
                      <td style={{ ...tdR, fontWeight: 700, color: '#16a34a' }}>{fmtE(b.marge)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section titre="Employés (HQ)" note="Commission générée sous leur code. Le COÛT par employé (Partena + DKV + cartes essence) viendra du bouton « Importer » — pas encore branché.">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Employé</th><th style={th}>Bureau</th><th style={thR}>Commission générée</th><th style={thR}>Coût employeur</th><th style={thR}>Rentabilité</th>
                </tr></thead>
                <tbody>
                  {m.employes.map(p => (
                    <tr key={p.code}>
                      <td style={td}><span style={{ fontWeight: 600, color: NAVY }}>{p.nom}</span> <span style={{ fontSize: 10, color: '#94a3b8' }}>{p.code}</span></td>
                      <td style={td}>{p.bureau}</td>
                      <td style={tdR}>{fmtE(p.commission)}</td>
                      <td style={{ ...tdR, color: '#94a3b8' }}>à importer</td>
                      <td style={{ ...tdR, color: '#94a3b8' }}>—</td>
                    </tr>
                  ))}
                  {!m.employes.length && <tr><td style={td} colSpan={5}>Aucun employé avec commission sur {annee}.</td></tr>}
                </tbody>
              </table>
            </Section>

            <Section titre="Frais de structure" note="Dépenses bancaires de l'année (Ponto), par catégorie. C'est le seuil que l'ensemble des marges doit couvrir.">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Catégorie</th><th style={thR}>Montant</th></tr></thead>
                <tbody>
                  {m.structure.map(s => (
                    <tr key={s.nom}>
                      <td style={td}>{s.nom}</td>
                      <td style={tdR}>{fmtE(s.montant)}</td>
                    </tr>
                  ))}
                  <tr><td style={{ ...td, fontWeight: 800, color: NAVY }}>TOTAL structure</td><td style={{ ...tdR, fontWeight: 800, color: '#dc2626' }}>{fmtE(m.kpis.structure)}</td></tr>
                </tbody>
              </table>
            </Section>
          </>
        )}
      </div>
    </Layout>
  )
}
