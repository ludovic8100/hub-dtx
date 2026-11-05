// Réattribuer le portefeuille d'un collaborateur avant de le supprimer.
//
// LE GESTE, TEL QUE DEMANDÉ : on supprime quelqu'un, la fenêtre s'ouvre avec
// la liste complète de ses clients. On coche — ou on prend tout — on choisit
// à qui, on attribue. S'il reste des clients, on recommence avec un autre
// destinataire : un portefeuille se partage à deux. Quand il ne reste rien,
// la suppression devient possible.
//
// POURQUOI UNE TABLE À PART, ET PAS UNE SIMPLE MISE À JOUR DE `clients`
//
// scripts/qlik_clients.py recalcule `gestionnaire_code` et `sa_code` à CHAQUE
// synchronisation quotidienne, à partir des noms venus de Brio. Une
// réattribution écrite seulement dans `clients` serait effacée le lendemain
// matin, sans que personne ne comprenne pourquoi le portefeuille est revenu
// à quelqu'un qui est parti.
//
// On écrit donc aux DEUX endroits :
//   - `clients_attribution` : la décision, avec son auteur et sa date. La
//     synchro la lit et laisse ces dossiers tranquilles.
//   - `clients` : pour que l'effet soit visible tout de suite, sans attendre
//     le prochain passage.
//
// Retirer une ligne de `clients_attribution` rend le dossier à Brio.

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  bord: '#e2e8f0', texte: '#0f172a', gris: '#64748b', grisClair: '#94a3b8',
  marine: '#1e293b', orange: '#b45309', orangeFond: '#fffaf0', orangeBord: '#f0c478',
  vert: '#15803d', vertFond: '#f0fdf4', vertBord: '#86efac',
  rouge: '#b91c1c', rougeFond: '#fef2f2', rougeBord: '#fecaca',
}

const ROLES = [
  { cle: 'gestionnaire', colonne: 'gestionnaire_code', libelle: 'Gestionnaire', drapeau: 'est_gestionnaire' },
  { cle: 'sous_agent',   colonne: 'sa_code',           libelle: 'Sous-agent',   drapeau: 'est_sous_agent' },
]

const PAGE = 100

export default function ReattribuerPortefeuille({ collaborateur, collaborateurs, moi, onFerme, onVide }) {
  const code = (collaborateur?.code || '').toUpperCase()

  const [role, setRole] = useState('gestionnaire')
  const [clients, setClients] = useState(null)   // null = en cours de lecture
  const [coches, setCoches] = useState(new Set())
  const [vers, setVers] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [travail, setTravail] = useState(false)
  const [resultat, setResultat] = useState(null)

  const roleActif = ROLES.find(r => r.cle === role)

  // ── Lecture ───────────────────────────────────────────────────────────
  // On charge TOUS les dossiers d'un coup, pas page par page. « Tout
  // sélectionner » doit vouloir dire tout — pas « tout ce qui est affiché ».
  // Le plus gros portefeuille compte 3 411 clients : quatre colonnes courtes,
  // c'est tenable, et ça évite une sélection qui ment.
  async function charger() {
    setClients(null); setCoches(new Set()); setPage(0)
    const lot = []
    for (let debut = 0; ; debut += 1000) {
      const { data, error } = await supabase
        .from('clients')
        .select('dossier,nom,prenom,localite')
        .ilike(roleActif.colonne, code)
        .order('nom')
        .range(debut, debut + 999)
      if (error) { setResultat({ ok: false, message: error.message }); setClients([]); return }
      lot.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    setClients(lot)
  }

  useEffect(() => { if (code) charger() }, [code, role])   // eslint-disable-line

  // ── Destinataires possibles ───────────────────────────────────────────
  // Actifs, portant le rôle visé, et jamais la personne qu'on vide.
  const destinataires = useMemo(() => (collaborateurs || [])
    .filter(c => c.code && c.actif !== false && c.code.toUpperCase() !== code)
    .filter(c => c[roleActif.drapeau] || c.est_admin)
    .sort((a, b) => (a.nom_complet || a.code).localeCompare(b.nom_complet || b.code)),
  [collaborateurs, code, roleActif])

  const filtres = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return clients || []
    return (clients || []).filter(c =>
      [c.nom, c.prenom, c.dossier, c.localite].some(v => (v || '').toLowerCase().includes(t)))
  }, [clients, q])

  const visibles = filtres.slice(page * PAGE, page * PAGE + PAGE)
  const pages = Math.ceil(filtres.length / PAGE)

  function basculer(dossier) {
    setCoches(prev => { const n = new Set(prev); n.has(dossier) ? n.delete(dossier) : n.add(dossier); return n })
  }

  // ── L'attribution ─────────────────────────────────────────────────────
  async function attribuer() {
    if (!vers || !coches.size) return
    setTravail(true); setResultat(null)
    const dossiers = [...coches]
    try {
      // 1. La décision, que la synchro Qlik respectera.
      const lignes = dossiers.map(d => ({
        dossier: d,
        [roleActif.colonne]: vers,
        depuis: new Date().toISOString().slice(0, 10),
        par_qui: moi || null,
        motif: `Reprise du portefeuille de ${collaborateur.nom_complet || code}`,
      }))
      for (let i = 0; i < lignes.length; i += 500) {
        const { error } = await supabase.from('clients_attribution')
          .upsert(lignes.slice(i, i + 500), { onConflict: 'dossier' })
        if (error) throw new Error(error.message)
      }

      // 2. L'effet immédiat, pour ne pas attendre la prochaine synchro.
      for (let i = 0; i < dossiers.length; i += 500) {
        const { error } = await supabase.from('clients')
          .update({ [roleActif.colonne]: vers })
          .in('dossier', dossiers.slice(i, i + 500))
        if (error) throw new Error(error.message)
      }

      const restants = (clients || []).filter(c => !coches.has(c.dossier))
      setClients(restants); setCoches(new Set()); setPage(0)
      setResultat({ ok: true, message: `${dossiers.length} client(s) attribué(s) à ${vers}. Reste ${restants.length}.` })
      if (!restants.length) onVide?.(roleActif.cle)
    } catch (e) {
      setResultat({ ok: false, message: String(e?.message || e) })
    } finally { setTravail(false) }
  }

  if (!collaborateur) return null

  return (
    <div onClick={onFerme} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 80,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 820,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden',
      }}>
        {/* En-tête */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.bord}` }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.texte }}>
            Réattribuer le portefeuille de {collaborateur.nom_complet || code}
          </div>
          <div style={{ fontSize: 12.5, color: C.gris, marginTop: 3, lineHeight: 1.5 }}>
            Cochez les clients, choisissez à qui, attribuez. On peut partager en
            plusieurs fois : la liste se réduit à chaque passage. La suppression
            devient possible quand il ne reste rien.
          </div>
        </div>

        {/* Rôles */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px 0' }}>
          {ROLES.map(r => (
            <button key={r.cle} onClick={() => setRole(r.cle)} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${role === r.cle ? C.marine : C.bord}`,
              background: role === r.cle ? C.marine : '#fff',
              color: role === r.cle ? '#fff' : C.gris,
            }}>{r.libelle}</button>
          ))}
          <span style={{ flex: 1 }} />
          <button onClick={onFerme} style={{
            border: 'none', background: 'none', color: C.gris, fontSize: 20, cursor: 'pointer', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Corps */}
        <div style={{ padding: '14px 20px 18px' }}>
          {clients === null ? (
            <div style={{ padding: 28, textAlign: 'center', color: C.grisClair, fontSize: 13 }}>Lecture du portefeuille…</div>
          ) : !clients.length ? (
            <div style={{
              padding: '14px 16px', borderRadius: 10, background: C.vertFond,
              border: `1px solid ${C.vertBord}`, color: C.vert, fontSize: 13.5, fontWeight: 600,
            }}>
              ✓ Plus aucun client en {roleActif.libelle.toLowerCase()} pour {code}.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                <input value={q} onChange={e => { setQ(e.target.value); setPage(0) }}
                  autoComplete="off" placeholder="Filtrer (nom, dossier, localité)…"
                  style={{ flex: 1, minWidth: 180, padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.bord}`, fontSize: 13 }} />
                {/* « Tout » veut dire tout ce que le filtre laisse passer, pas
                    seulement la page affichée. Une selection qui ment sur son
                    etendue est pire que pas de bouton du tout. */}
                <button onClick={() => setCoches(new Set(filtres.map(c => c.dossier)))} style={btnSec}>
                  Tout sélectionner ({filtres.length})
                </button>
                <button onClick={() => setCoches(new Set())} style={btnSec}>Aucun</button>
              </div>

              <div style={{ border: `1px solid ${C.bord}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                {visibles.map(c => (
                  <label key={c.dossier} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 11px',
                    borderBottom: `1px solid #f1f5f9`, fontSize: 13, cursor: 'pointer',
                    background: coches.has(c.dossier) ? '#eff6ff' : '#fff',
                  }}>
                    <input type="checkbox" checked={coches.has(c.dossier)} onChange={() => basculer(c.dossier)}
                      style={{ width: 15, height: 15, cursor: 'pointer' }} />
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11.5, color: C.grisClair, minWidth: 62 }}>{c.dossier}</span>
                    <span style={{ fontWeight: 600, color: C.texte }}>{c.nom} {c.prenom || ''}</span>
                    {c.localite && <span style={{ color: C.grisClair, fontSize: 12 }}>· {c.localite}</span>}
                  </label>
                ))}
                {!visibles.length && (
                  <div style={{ padding: 16, textAlign: 'center', color: C.grisClair, fontSize: 13 }}>Aucun client ne correspond.</div>
                )}
              </div>

              {pages > 1 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 12.5, color: C.gris }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={!page} style={btnSec}>‹</button>
                  <span>page {page + 1} / {pages}</span>
                  <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} style={btnSec}>›</button>
                  <span style={{ color: C.grisClair }}>— la sélection vaut pour toutes les pages</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
                            borderTop: `1px solid ${C.bord}`, paddingTop: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.texte }}>
                  {coches.size} sélectionné(s)
                </span>
                <span style={{ fontSize: 13, color: C.gris }}>→ attribuer à</span>
                <select value={vers} onChange={e => setVers(e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.bord}`, fontSize: 13, minWidth: 200 }}>
                  <option value="">— choisir —</option>
                  {destinataires.map(d => (
                    <option key={d.code} value={d.code.toUpperCase()}>
                      {d.nom_complet || d.code} ({d.code})
                    </option>
                  ))}
                </select>
                <button onClick={attribuer} disabled={travail || !vers || !coches.size} style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700,
                  background: C.marine, color: '#fff',
                  cursor: (travail || !vers || !coches.size) ? 'not-allowed' : 'pointer',
                  opacity: (travail || !vers || !coches.size) ? .45 : 1,
                }}>{travail ? '…' : 'Attribuer'}</button>
              </div>
            </>
          )}

          {resultat && (
            <div style={{
              marginTop: 12, padding: '9px 13px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              border: `1px solid ${resultat.ok ? C.vertBord : C.rougeBord}`,
              background: resultat.ok ? C.vertFond : C.rougeFond,
              color: resultat.ok ? C.vert : C.rouge,
            }}>{resultat.ok ? '✓ ' : '✕ '}{resultat.message}</div>
          )}

          <div style={{
            marginTop: 12, padding: '9px 12px', borderRadius: 8, background: C.orangeFond,
            border: `1px solid ${C.orangeBord}`, fontSize: 11.5, color: C.orange, lineHeight: 1.5,
          }}>
            La décision est enregistrée dans le Hub et la synchronisation Qlik la
            respecte — elle ne reviendra pas à l'ancien titulaire demain matin.
            Pour rendre un dossier à Brio, il faut retirer sa ligne de
            <strong> clients_attribution</strong>.
          </div>
        </div>
      </div>
    </div>
  )
}

const btnSec = {
  padding: '6px 11px', borderRadius: 8, border: `1px solid ${C.bord}`,
  background: '#fff', color: C.gris, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
}
