import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { COUL } from '../lib/theme'
import { usePetitEcran } from '../lib/ecran'
import { voile } from '../lib/voile'

/**
 * ENCAISSEMENT PRODUCTEUR — un compte courant par client, pas un rapprochement.
 *
 * Ce que l'écran montre, et pourquoi dans cet ordre : le SOLDE d'abord. Ce
 * n'est pas « quel versement correspond à quelle quittance » — cette question
 * n'a pas de réponse quand le client paie des montants ronds et qu'une
 * régularisation vient plus tard. C'est « combien ce client doit-il encore ».
 *
 * ⚠️ Les montants ne sont PAS du chiffre d'affaires. Le client paie une prime
 * que Dynassur doit à la compagnie : l'argent entre et ressort par le débit du
 * relevé. L'écran le dit en toutes lettres, parce qu'un tableau de montants
 * sans cette phrase sera lu comme un tableau de revenus.
 */

const fmt = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'

const MODES = {
  virement:      { label: 'Virement',      icone: 'ti-arrow-bar-to-down', fond: COUL.infoFond,   trait: COUL.info },
  especes:       { label: 'Espèces',       icone: 'ti-coins',             fond: COUL.alerteFondDoux, trait: COUL.alerte },
  domiciliation: { label: 'Domiciliation', icone: 'ti-repeat',            fond: COUL.tealFond,   trait: COUL.teal },
  autre:         { label: 'Autre',         icone: 'ti-dots',              fond: COUL.fondDoux,   trait: COUL.texteDoux },
}

/** Le solde, avec sa lecture en clair. Un nombre seul se lit à l'envers une
 *  fois sur deux : +655,95 veut dire « il doit », pas « on a reçu ». */
function Solde({ valeur, gros = false }) {
  const v = Number(valeur) || 0
  const nul = Math.abs(v) < 0.005
  const coul = nul ? COUL.succes : v > 0 ? COUL.danger : COUL.info
  const mot = nul ? 'à jour' : v > 0 ? 'doit encore' : "payé d'avance"
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: gros ? 22 : 15, fontWeight: 800, color: coul, fontVariantNumeric: 'tabular-nums' }}>
        {nul ? fmt(0) : fmt(Math.abs(v))}
      </div>
      <div style={{ fontSize: 11.5, color: COUL.texteDoux, fontWeight: 600 }}>{mot}</div>
    </div>
  )
}

export default function EncaissementProducteurView({ societeCodes = ['DYNASSUR'], color }) {
  const petit = usePetitEcran()
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [ouvert, setOuvert] = useState(null)   // le compte dont on regarde le détail
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let vivant = true
    setChargement(true)
    supabase.from('v_encaissement_solde')
      .select('*')
      .in('societe', societeCodes)
      .then(({ data, error }) => {
        if (!vivant) return
        if (error) setErreur(error.message)
        else setLignes(data || [])
        setChargement(false)
      })
    return () => { vivant = false }
  }, [societeCodes.join(',')])

  // Le détail n'est chargé qu'à l'ouverture : les quittances d'un client
  // peuvent être nombreuses, et on n'en montre qu'un à la fois.
  const ouvrir = async (ligne) => {
    setOuvert(ligne); setDetail(null)
    const [q, v] = await Promise.all([
      supabase.from('quittances')
        .select('id,police,type_quittance,prime_totale,commission,date_comptable,etat')
        .eq('client_id', ligne.client_id).order('date_comptable'),
      supabase.from('encaissement_versements')
        .select('id,date_versement,montant,mode,quittance_numero,transaction_id,recu_par,notes')
        .eq('compte_id', ligne.compte_id).order('date_versement'),
    ])
    setDetail({ quittances: q.data || [], versements: v.data || [] })
  }

  const totalDu     = lignes.reduce((s, l) => s + Number(l.total_du || 0), 0)
  const totalVerse  = lignes.reduce((s, l) => s + Number(l.total_verse || 0), 0)
  const enRetard    = lignes.filter(l => Number(l.solde) > 0.005)
  const aRapprocher = lignes.reduce((s, l) => s + Number(l.virements_sans_mouvement || 0), 0)

  if (chargement) return <div style={{ padding: 40, textAlign: 'center', color: COUL.texteDoux }}>Chargement…</div>
  if (erreur) return (
    <div style={{ padding: 20, borderRadius: 10, background: COUL.dangerFond, color: COUL.danger, fontSize: 14 }}>
      Lecture impossible : {erreur}
    </div>
  )

  return (
    <div style={{ fontFamily: "'Source Sans Pro', sans-serif" }}>

      {/* LA PHRASE QUI EMPÊCHE LA MAUVAISE LECTURE. Sans elle, ce tableau de
          montants passe pour un tableau de revenus. */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 14px', marginBottom: 12,
        borderRadius: 10, background: COUL.infoFond, border: `1px solid ${COUL.info}33`, fontSize: 13.5, lineHeight: 1.45 }}>
        <i className="ti ti-info-circle" style={{ color: COUL.info, fontSize: 17, flexShrink: 0, marginTop: 1 }} />
        <span style={{ color: COUL.texte }}>
          Ces clients paient leur prime <b>au courtier</b> et non à la compagnie, qui retire le montant
          du compte producteur. <b>Ce n'est pas du chiffre d'affaires</b> : l'argent entre et ressort,
          seule la commission reste.
        </span>
      </div>

      {/* Les quatre chiffres. « À rapprocher » est un état de saisie, pas une
          anomalie métier — il est donc neutre et non rouge. */}
      <div style={{ display: 'grid', gridTemplateColumns: petit ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { l: 'Dû par les clients', v: fmt(totalDu), c: COUL.texteFort },
          { l: 'Versé', v: fmt(totalVerse), c: COUL.succes },
          { l: 'En retard', v: `${enRetard.length} client${enRetard.length > 1 ? 's' : ''}`, c: enRetard.length ? COUL.danger : COUL.succes,
            sous: enRetard.length ? fmt(enRetard.reduce((s, l) => s + Number(l.solde), 0)) : 'aucun' },
          { l: 'À rapprocher', v: String(aRapprocher), c: COUL.texteDoux, sous: 'virements sans mouvement bancaire' },
        ].map(k => (
          <div key={k.l} style={{ background: COUL.surface, border: `1px solid ${COUL.bord}`, borderRadius: 10, padding: '11px 13px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: COUL.texteDoux }}>{k.l}</div>
            <div style={{ fontSize: petit ? 17 : 20, fontWeight: 800, color: k.c, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
            {k.sous && <div style={{ fontSize: 11.5, color: COUL.texteDoux, marginTop: 2 }}>{k.sous}</div>}
          </div>
        ))}
      </div>

      {lignes.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: COUL.texteDoux, background: COUL.surface,
          border: `1px dashed ${COUL.bord}`, borderRadius: 10 }}>
          Aucun client en encaissement producteur.
        </div>
      ) : petit ? (
        /* Sur téléphone, des cartes : un tableau à sept colonnes sur 390 px
           est illisible — la leçon de l'éditeur de devis. */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lignes.map(l => (
            <button key={l.compte_id} onClick={() => ouvrir(l)} style={{
              textAlign: 'left', background: COUL.surface, border: `1px solid ${COUL.bord}`, borderRadius: 10,
              padding: '11px 13px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COUL.texteFort }}>{l.client}</div>
                  <div style={{ fontSize: 12, color: COUL.texteDoux, marginTop: 2 }}>
                    {l.compagnie} · compte {l.numero_producteur}
                  </div>
                </div>
                <Solde valeur={l.solde} />
              </div>
              <div style={{ fontSize: 12, color: COUL.texteDoux, marginTop: 7 }}>
                dû {fmt(l.total_du)} · versé {fmt(l.total_verse)}
                {Number(l.dont_especes) > 0 && <> · dont {fmt(l.dont_especes)} en espèces</>}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ background: COUL.surface, border: `1px solid ${COUL.bord}`, borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: COUL.fondDoux }}>
                {['Client', 'Compte producteur', 'Dû', 'Versé', 'Dernier versement', 'Solde', ''].map((h, i) => (
                  <th key={h + i} style={{ padding: '9px 12px', textAlign: i >= 2 && i <= 3 ? 'right' : i === 5 ? 'right' : 'left',
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                    color: COUL.texteDoux, borderBottom: `1px solid ${COUL.bord}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map(l => (
                <tr key={l.compte_id} onClick={() => ouvrir(l)}
                  style={{ cursor: 'pointer', borderBottom: `1px solid ${COUL.bord}` }}
                  onMouseEnter={e => e.currentTarget.style.background = COUL.fondDoux}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700, color: COUL.texteFort }}>{l.client}</div>
                    <div style={{ fontSize: 12, color: COUL.texteDoux }}>{l.dossier}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div>{l.compagnie}</div>
                    <div style={{ fontSize: 12, color: COUL.texteDoux }}>
                      n° {l.numero_producteur}{l.code_releve && <> · code {l.code_releve}</>}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(l.total_du)}
                    <div style={{ fontSize: 11.5, color: COUL.texteDoux }}>{l.nb_quittances} quittance{l.nb_quittances > 1 ? 's' : ''}</div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(l.total_verse)}
                    {Number(l.dont_especes) > 0 && (
                      <div style={{ fontSize: 11.5, color: COUL.alerte }}>dont {fmt(l.dont_especes)} espèces</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: COUL.texteDoux }}>{fmtDate(l.dernier_versement)}</td>
                  <td style={{ padding: '10px 12px' }}><Solde valeur={l.solde} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {Number(l.virements_sans_mouvement) > 0 && (
                      <span title={`${l.virements_sans_mouvement} virement(s) saisi(s) mais pas encore vus par la banque`}
                        style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                          background: COUL.fondDoux, color: COUL.texteDoux, whiteSpace: 'nowrap' }}>
                        à rapprocher
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ouvert && (
        <div {...voile(() => { setOuvert(null); setDetail(null) })}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,24,38,.45)', zIndex: 200,
            display: 'flex', alignItems: petit ? 'flex-end' : 'center', justifyContent: 'center', padding: petit ? 0 : 20 }}>
          <div style={{ background: COUL.surface, borderRadius: petit ? '14px 14px 0 0' : 14, width: '100%',
            maxWidth: 760, maxHeight: petit ? '88vh' : '86vh', overflow: 'auto' }}>

            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${COUL.bord}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: COUL.texteFort }}>{ouvert.client}</div>
                <div style={{ fontSize: 13, color: COUL.texteDoux, marginTop: 2 }}>
                  {ouvert.compagnie} · compte producteur {ouvert.numero_producteur}
                  {ouvert.code_releve && <> · code relevé {ouvert.code_releve}</>}
                </div>
              </div>
              <Solde valeur={ouvert.solde} gros />
            </div>

            {!detail ? (
              <div style={{ padding: 30, textAlign: 'center', color: COUL.texteDoux }}>Chargement du détail…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: petit ? '1fr' : '1fr 1fr', gap: 0 }}>

                <div style={{ padding: '12px 18px', borderRight: petit ? 'none' : `1px solid ${COUL.bord}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                    color: COUL.texteDoux, marginBottom: 8 }}>Ce qu'il doit — quittances</div>
                  {detail.quittances.length === 0 && <div style={{ fontSize: 13.5, color: COUL.texteDoux }}>Aucune quittance.</div>}
                  {detail.quittances.map(q => (
                    <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10,
                      padding: '7px 0', borderBottom: `1px solid ${COUL.bord}` }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: COUL.texte }}>{fmtDate(q.date_comptable)}</div>
                        <div style={{ fontSize: 11.5, color: COUL.texteDoux }}>{q.police} · {q.type_quittance}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {fmt(q.prime_totale)}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9, fontWeight: 800 }}>
                    <span>Total</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(ouvert.total_du)}</span>
                  </div>
                </div>

                <div style={{ padding: '12px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                    color: COUL.texteDoux, marginBottom: 8 }}>Ce qu'il a versé</div>
                  {detail.versements.length === 0 && (
                    <div style={{ fontSize: 13.5, color: COUL.danger, fontWeight: 600 }}>
                      Aucun versement — c'est la raison du solde.
                    </div>
                  )}
                  {detail.versements.map(v => {
                    const m = MODES[v.mode] || MODES.autre
                    return (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10,
                        padding: '7px 0', borderBottom: `1px solid ${COUL.bord}` }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, color: COUL.texte, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {fmtDate(v.date_versement)}
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 9,
                              background: m.fond, color: m.trait }}>{m.label}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: COUL.texteDoux }}>
                            {v.quittance_numero ? `Quittance ${v.quittance_numero}` : null}
                            {v.mode === 'virement' && !v.transaction_id && (
                              <span style={{ color: COUL.alerte }}>pas encore vu par la banque</span>
                            )}
                            {v.notes && <> · {v.notes}</>}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {fmt(v.montant)}
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 9, fontWeight: 800 }}>
                    <span>Total</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(ouvert.total_verse)}</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ padding: '12px 18px', borderTop: `1px solid ${COUL.bord}`, textAlign: 'right' }}>
              <button onClick={() => { setOuvert(null); setDetail(null) }} style={{
                padding: '8px 16px', borderRadius: 8, border: `1px solid ${COUL.bord}`, background: COUL.surface,
                color: COUL.texte, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
