import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { COUL } from '../lib/theme'
import { trierLignes } from '../lib/tri'

/**
 * PROSPECTION — les leads à appeler, et ce qu'il en est sorti.
 *
 * Demandé par Ludovic le 13/11/2026 : un fichier de leads reçu par mail,
 * réparti entre trois commerciaux avec une date d'appel par lead. Ils
 * appellent par 3CX ; l'écran suit ce qui est appelé, ce qui est en retard,
 * et l'issue.
 *
 * ⚠️ L'ÉTAT « APPELÉ » NE SE DÉCLARE PAS, IL SE CONSTATE.
 * La vue `v_leads_travail` le déduit d'un appel SORTANT de `appels`, qui est
 * alimentée par 3CX — donc par le central téléphonique. Personne ne peut
 * cocher « appelé » sans avoir appelé, et c'est tout l'intérêt : une liste
 * de prospection où l'on coche soi-même se remplit de cases cochées.
 *
 * ⚠️ ET SEULS LES APPELS POSTÉRIEURS À LA DATE PRÉVUE COMPTENT.
 * Règle de Ludovic. Sans elle, les 58 leads déjà clients du premier fichier
 * seraient apparus traités dès l'import, parce qu'on les a appelés il y a
 * six mois pour un sinistre.
 */

const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' }) : '—'
const fmtHeure = d => d ? new Date(d).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDuree = s => {
  if (s == null) return '—'
  const m = Math.floor(s / 60), r = s % 60
  return m ? `${m} min ${String(r).padStart(2, '0')}` : `${r} s`
}
const eur = n => n == null ? '—'
  : Number(n).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

// Les états que la vue calcule. L'ordre est celui dans lequel on veut les
// traiter : le retard d'abord, parce qu'un lead en retard le reste.
const ETATS = {
  en_retard:         { label: 'En retard',       fond: '#fee2e2', trait: '#b91c1c', rang: 1 },
  du_jour:           { label: "Aujourd'hui",     fond: '#dbeafe', trait: '#1d4ed8', rang: 2 },
  appele_sans_issue: { label: 'Appelé, issue à donner', fond: '#fef3c7', trait: '#b45309', rang: 3 },
  a_venir:           { label: 'À venir',         fond: '#f1f5f9', trait: '#64748b', rang: 4 },
  traite:            { label: 'Traité',          fond: '#dcfce7', trait: '#15803d', rang: 5 },
  injoignable:       { label: 'Sans téléphone',  fond: '#f1f5f9', trait: '#64748b', rang: 6 },
}

function Pastille({ etat }) {
  const e = ETATS[etat] || ETATS.a_venir
  return <span style={{ background: e.fond, color: e.trait, borderRadius: 5, padding: '2px 8px',
    fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{e.label}</span>
}

export default function ProspectionView() {
  const { perms, isAdmin } = useAuth()
  const monCode = perms?.code || null

  const [lignes, setLignes] = useState(null)
  const [issues, setIssues] = useState([])
  const [erreur, setErreur] = useState('')
  // Par défaut, un commercial ne voit QUE ses leads : une file qui contient
  // ceux des autres n'est plus une file de travail, c'est un tableau.
  const [qui, setQui] = useState('moi')
  const [vue, setVue] = useState('a_faire')
  const [ouvert, setOuvert] = useState(null)
  const [brouillon, setBrouillon] = useState({ issue: '', remarques: '' })
  const [enregistre, setEnregistre] = useState(false)

  const charger = useCallback(async () => {
    const [l, i] = await Promise.all([
      supabase.from('v_leads_travail').select('*').order('date_prevue'),
      supabase.from('lead_issues').select('*').eq('actif', true).order('ordre'),
    ])
    if (l.error) { setErreur(l.error.message); setLignes([]); return }
    setLignes(l.data || [])
    setIssues(i.data || [])
  }, [])

  useEffect(() => { charger() }, [charger])

  const codes = useMemo(
    () => [...new Set((lignes || []).map(x => x.attribue_code).filter(Boolean))].sort(),
    [lignes])

  const vus = useMemo(() => {
    let v = lignes || []
    if (qui === 'moi' && monCode) v = v.filter(x => x.attribue_code === monCode)
    else if (qui !== 'moi' && qui !== 'tous') v = v.filter(x => x.attribue_code === qui)

    if (vue === 'a_faire') v = v.filter(x => ['en_retard', 'du_jour', 'appele_sans_issue'].includes(x.etat))
    else if (vue === 'traite') v = v.filter(x => x.etat === 'traite')
    else if (vue === 'probleme') v = v.filter(x => x.attribution_inconnue || x.sans_telephone)

    // Le retard d'abord, puis le jour, puis le reste — et à état égal, le
    // plus ancien en tête. Un lead en retard de trois jours passe avant celui
    // d'hier, sinon la file se vide par la fin.
    return trierLignes(v, [
      { cle: 'etat', val: x => ETATS[x.etat]?.rang ?? 9, type: 'nombre' },
      { cle: 'date', val: x => x.date_prevue, type: 'date' },
    ], { col: 'etat', sens: 1 }, x => x.date_prevue)
  }, [lignes, qui, vue, monCode])

  const compte = useMemo(() => {
    const base = (lignes || []).filter(x => qui === 'tous' || x.attribue_code === (qui === 'moi' ? monCode : qui))
    return {
      retard: base.filter(x => x.etat === 'en_retard').length,
      jour: base.filter(x => x.etat === 'du_jour').length,
      sansIssue: base.filter(x => x.etat === 'appele_sans_issue').length,
      traite: base.filter(x => x.etat === 'traite').length,
      probleme: base.filter(x => x.attribution_inconnue || x.sans_telephone).length,
    }
  }, [lignes, qui, monCode])

  const ouvrir = (l) => {
    setOuvert(l)
    setBrouillon({ issue: l.issue || '', remarques: l.remarques || '' })
    setEnregistre(false)
  }

  const enregistrer = async () => {
    if (!ouvert) return
    setErreur('')
    // QUI donne l'issue est enregistré, et ce n'est pas forcément celui à qui
    // le lead est attribué : règle de Ludovic, « un appel passé par un autre
    // commercial compte, mais on doit savoir qui a pris le rendez-vous ».
    const { error } = await supabase.from('leads').update({
      issue: brouillon.issue || null,
      issue_le: brouillon.issue ? new Date().toISOString() : null,
      issue_par: brouillon.issue ? (perms?.id ?? null) : null,
      remarques: brouillon.remarques || null,
      updated_at: new Date().toISOString(),
    }).eq('id', ouvert.id)
    if (error) { setErreur(error.message); return }
    setEnregistre(true)
    await charger()
    setTimeout(() => { setOuvert(null); setEnregistre(false) }, 700)
  }

  if (lignes === null) return <div style={{ padding: 40, color: COUL.texteDoux }}>Chargement…</div>

  if (!lignes.length) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: COUL.texteDoux, background: COUL.surface,
        border: `1px dashed ${COUL.bord}`, borderRadius: 10 }}>
        <div style={{ fontWeight: 700, color: COUL.texte, marginBottom: 6 }}>Aucun lead pour le moment</div>
        Le fichier de prospection n'a pas encore été importé.
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Source Sans Pro', sans-serif" }}>
      {erreur && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '9px 12px',
        borderRadius: 8, marginBottom: 12, fontSize: 13.5 }}>{erreur}</div>}

      {/* Les compteurs. Le retard en rouge, et seulement lui : si tout est
          rouge, plus rien ne l'est. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          ['En retard', compte.retard, compte.retard > 0 ? '#b91c1c' : COUL.texteDoux],
          ["Aujourd'hui", compte.jour, '#1d4ed8'],
          ['Issue à donner', compte.sansIssue, '#b45309'],
          ['Traités', compte.traite, '#15803d'],
        ].map(([lab, n, c]) => (
          <div key={lab} style={{ background: COUL.surface, border: `1px solid ${COUL.bord}`,
            borderRadius: 10, padding: '10px 16px', minWidth: 118 }}>
            <div style={{ fontSize: 11.5, color: COUL.texteDoux, textTransform: 'uppercase',
              letterSpacing: '.04em', fontWeight: 700 }}>{lab}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {(isAdmin || codes.length > 1) && (
          <select value={qui} onChange={e => setQui(e.target.value)}
            style={{ padding: '7px 10px', border: `1px solid ${COUL.bord}`, borderRadius: 8, fontSize: 13.5 }}>
            <option value="moi">Mes leads{monCode ? ` (${monCode})` : ''}</option>
            {isAdmin && <option value="tous">Tous les commerciaux</option>}
            {isAdmin && codes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {[['a_faire', 'À faire'], ['traite', 'Traités'], ['probleme', `À vérifier (${compte.probleme})`], ['tout', 'Tout']].map(([k, lab]) => (
          <button key={k} onClick={() => setVue(k)} style={{
            padding: '7px 13px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${vue === k ? COUL.info : COUL.bord}`,
            background: vue === k ? COUL.info : COUL.surface, color: vue === k ? COUL.blanc : COUL.texteMoyen,
          }}>{lab}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: COUL.texteDoux }}>{vus.length} lead(s)</span>
      </div>

      {vus.length === 0 ? (
        <div style={{ padding: 36, textAlign: 'center', color: COUL.texteDoux, background: COUL.surface,
          border: `1px dashed ${COUL.bord}`, borderRadius: 10 }}>
          {vue === 'a_faire' ? 'Rien à appeler — la file est vide.' : 'Aucun lead dans cette vue.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 9 }}>
          {vus.map(l => (
            <div key={l.id} onClick={() => ouvrir(l)} style={{
              background: COUL.surface, border: `1px solid ${COUL.bord}`, borderRadius: 10,
              padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: 14,
              alignItems: 'flex-start', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: COUL.texteFort }}>
                  {l.denomination}
                  {l.est_client && <span style={{ marginLeft: 8, background: COUL.tealFond, color: COUL.teal,
                    borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>client</span>}
                </div>
                <div style={{ fontSize: 13, color: COUL.texteDoux, marginTop: 2 }}>
                  {[l.dirigeant, l.forme_legale, [l.code_postal, l.commune].filter(Boolean).join(' ')]
                    .filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 3 }}>
                  {l.criteres}
                  {l.resultat_exercice != null && ` · résultat ${eur(l.resultat_exercice)}`}
                </div>
              </div>

              <div style={{ textAlign: 'right', minWidth: 160 }}>
                <Pastille etat={l.etat} />
                <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 5 }}>
                  prévu le <b style={{ color: COUL.texte }}>{fmtDate(l.date_prevue)}</b>
                  {l.attribue_code && ` · ${l.attribue_code}`}
                </div>
                {/* UN LIEN tel: — le Hub ne lance pas l'appel, il ouvre le
                    softphone. Si 3CX gère tel: sur le poste, l'appel part par
                    3CX et 3CX le journalise. C'est ça qui ferme la boucle. */}
                {l.telephone_e164
                  ? <a href={`tel:${l.telephone_e164}`} onClick={e => e.stopPropagation()}
                      style={{ display: 'inline-block', marginTop: 6, background: COUL.info, color: COUL.blanc,
                        padding: '5px 12px', borderRadius: 7, fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>
                      {l.telephone_e164}
                    </a>
                  : <div style={{ marginTop: 6, fontSize: 12.5, color: '#b45309', fontWeight: 600 }}>sans téléphone</div>}
                {l.premier_appel_le && (
                  <div style={{ fontSize: 12, color: COUL.texteDoux, marginTop: 4 }}>
                    appelé le {fmtHeure(l.premier_appel_le)}
                    {l.nb_appels > 1 && ` · ${l.nb_appels} appels`}
                    {l.secondes_total != null && ` · ${fmtDuree(l.secondes_total)}`}
                  </div>
                )}
                {l.appele_par_un_autre && l.appele_par && (
                  <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>appelé par {l.appele_par_code}</div>
                )}
                {l.issue_libelle && (
                  <div style={{ fontSize: 12.5, color: COUL.texte, marginTop: 4, fontWeight: 600 }}>
                    {l.issue_libelle}{l.issue_par_nom ? ` — ${l.issue_par_nom}` : ''}
                  </div>
                )}
                {l.attribution_inconnue && (
                  <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4, fontWeight: 600 }}>
                    attribution inconnue : « {l.attribue_code} »
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {ouvert && (
        <div onClick={() => setOuvert(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 12,
            maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COUL.texteFort }}>{ouvert.denomination}</div>
            <div style={{ fontSize: 13.5, color: COUL.texteDoux, marginTop: 3, marginBottom: 14 }}>
              {[ouvert.dirigeant, ouvert.telephone_e164, ouvert.email].filter(Boolean).join(' · ')}
            </div>

            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
              color: COUL.texteDoux, display: 'block', marginBottom: 6 }}>Issue de l'appel</label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
              {issues.map(i => (
                <button key={i.code} onClick={() => setBrouillon(b => ({ ...b, issue: b.issue === i.code ? '' : i.code }))}
                  style={{ padding: '7px 13px', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${brouillon.issue === i.code ? COUL.info : COUL.bord}`,
                    background: brouillon.issue === i.code ? COUL.info : COUL.surface,
                    color: brouillon.issue === i.code ? COUL.blanc : COUL.texteMoyen }}>
                  {i.libelle}
                </button>
              ))}
            </div>

            {/* Champ libre demandé par Ludovic le 13/11. Il reste quoi qu'il
                arrive : un réimport du fichier ne touche jamais aux colonnes
                que le Hub possède. */}
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
              color: COUL.texteDoux, display: 'block', marginBottom: 6 }}>Remarques</label>
            <textarea value={brouillon.remarques} onChange={e => setBrouillon(b => ({ ...b, remarques: e.target.value }))}
              placeholder="Ce qui s'est dit, ce qu'il faut retenir…"
              style={{ width: '100%', minHeight: 90, padding: '9px 11px', borderRadius: 8,
                border: `1px solid ${COUL.bord}`, fontSize: 14.5, fontFamily: 'inherit', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              <button onClick={enregistrer} style={{ padding: '9px 18px', borderRadius: 8, border: 'none',
                background: COUL.succes, color: COUL.blanc, fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>
                Enregistrer
              </button>
              <button onClick={() => setOuvert(null)} style={{ padding: '9px 16px', borderRadius: 8,
                border: `1px solid ${COUL.bord}`, background: COUL.surface, color: COUL.texteMoyen,
                fontSize: 14.5, cursor: 'pointer' }}>Fermer</button>
              {enregistre && <span style={{ color: COUL.succes, fontSize: 13.5, fontWeight: 600 }}>Enregistré.</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
