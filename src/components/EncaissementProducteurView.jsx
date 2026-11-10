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

const champ = {
  flex: 1, minWidth: 0, padding: '7px 9px', borderRadius: 7,
  border: `1px solid ${COUL.bord}`, background: COUL.surface, color: COUL.texte,
  fontSize: 13.5, fontFamily: "'Source Sans Pro', sans-serif",
}

const boutonDoux = {
  padding: '6px 13px', borderRadius: 7, border: `1px solid ${COUL.bord}`,
  background: COUL.surface, color: COUL.texte, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: "'Source Sans Pro', sans-serif",
}

const petitBouton = (couleur) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
  border: `1px solid ${couleur}44`, background: 'transparent', color: couleur, fontSize: 14,
})

export default function EncaissementProducteurView({ societeCodes = ['DYNASSUR'], color }) {
  const petit = usePetitEcran()
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [ouvert, setOuvert] = useState(null)   // le compte dont on regarde le détail
  const [detail, setDetail] = useState(null)

  // Saisie. La maquette ne sert à rien si on ne peut pas y jouer : c'est en
  // encodant de vrais cas qu'on voit ce que le modèle ne sait pas dire.
  const [saisie, setSaisie] = useState(null)        // le formulaire ouvert
  const [enregistre, setEnregistre] = useState(false)
  const [aRelier, setARelier] = useState(null)      // le versement qu'on relie
  const [candidats, setCandidats] = useState([])
  const [messageErreur, setMessageErreur] = useState(null)

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
    setSaisie(null); setARelier(null); setMessageErreur(null)
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

  // Après chaque écriture on relit LES DEUX : le détail et la ligne de solde.
  // Ne relire que le détail laisserait le solde du tableau à sa valeur
  // d'avant — un chiffre faux, affiché à côté du bon.
  const recharger = async (compte) => {
    const [vue, q, v] = await Promise.all([
      supabase.from('v_encaissement_solde').select('*').in('societe', societeCodes),
      supabase.from('quittances')
        .select('id,police,type_quittance,prime_totale,commission,date_comptable,etat')
        .eq('client_id', compte.client_id).order('date_comptable'),
      supabase.from('encaissement_versements')
        .select('id,date_versement,montant,mode,quittance_numero,transaction_id,recu_par,notes')
        .eq('compte_id', compte.compte_id).order('date_versement'),
    ])
    if (vue.data) {
      setLignes(vue.data)
      const frais = vue.data.find(x => x.compte_id === compte.compte_id)
      if (frais) setOuvert(frais)
    }
    setDetail({ quittances: q.data || [], versements: v.data || [] })
  }

  const nouveauVersement = () => {
    setMessageErreur(null)
    setSaisie({
      date_versement: new Date().toISOString().slice(0, 10),
      montant: '',
      mode: 'virement',
      quittance_numero: '',
      recu_par: '',
      notes: '',
    })
  }

  const enregistrerVersement = async () => {
    setMessageErreur(null)
    const montant = Number(String(saisie.montant).replace(',', '.'))
    if (!(montant > 0)) { setMessageErreur('Le montant doit être supérieur à zéro.'); return }
    if (!saisie.date_versement) { setMessageErreur('Il faut une date.'); return }
    setEnregistre(true)
    const { error } = await supabase.from('encaissement_versements').insert({
      compte_id: ouvert.compte_id,
      societe: ouvert.societe,
      date_versement: saisie.date_versement,
      montant,
      mode: saisie.mode,
      quittance_numero: saisie.quittance_numero || null,
      recu_par: saisie.recu_par || null,
      notes: saisie.notes || null,
    })
    setEnregistre(false)
    if (error) { setMessageErreur(error.message); return }
    setSaisie(null)
    await recharger(ouvert)
  }

  const supprimerVersement = async (id) => {
    const { error } = await supabase.from('encaissement_versements').delete().eq('id', id)
    if (error) { setMessageErreur(error.message); return }
    await recharger(ouvert)
  }

  // LES CANDIDATS SONT PROPOSÉS, PAS CHOISIS. Le montant exact remonte en
  // tête, mais rien n'est relié tout seul : une liaison fausse est invisible
  // une fois faite, et c'est la leçon du rapprochement des factures.
  const ouvrirLiaison = async (versement) => {
    setARelier(versement); setCandidats([])
    const { data } = await supabase.from('transactions')
      .select('id,date_valeur,montant,contrepartie_nom,information_paiement,description')
      .gt('montant', 0)
      .order('date_valeur', { ascending: false })
      .limit(60)
    const m = Number(versement.montant)
    const tri = (data || []).sort((x, y) => {
      const dx = Math.abs(Number(x.montant) - m), dy = Math.abs(Number(y.montant) - m)
      return dx - dy
    })
    setCandidats(tri)
  }

  const relier = async (versementId, transactionId) => {
    const { error } = await supabase.from('encaissement_versements')
      .update({ transaction_id: transactionId }).eq('id', versementId)
    if (error) { setMessageErreur(error.message); return }
    setARelier(null); setCandidats([])
    await recharger(ouvert)
  }

  const delier = async (versementId) => {
    await supabase.from('encaissement_versements').update({ transaction_id: null }).eq('id', versementId)
    await recharger(ouvert)
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                      color: COUL.texteDoux }}>Ce qu'il a versé</div>
                    {!saisie && (
                      <button onClick={nouveauVersement} style={{
                        padding: '5px 11px', borderRadius: 7, border: 'none', background: COUL.succes,
                        color: COUL.blanc, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Versement
                      </button>
                    )}
                  </div>

                  {saisie && (
                    <div style={{ padding: '11px 12px', marginBottom: 10, borderRadius: 9,
                      background: COUL.fondDoux, border: `1px solid ${COUL.bord}` }}>
                      <div style={{ display: 'flex', gap: 7, marginBottom: 8 }}>
                        {Object.entries(MODES).filter(([k]) => k !== 'autre').map(([k, m]) => (
                          <button key={k} onClick={() => setSaisie(s => ({ ...s, mode: k }))} style={{
                            flex: 1, padding: '6px 4px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: 12.5, fontWeight: 700,
                            border: saisie.mode === k ? `2px solid ${m.trait}` : `1px solid ${COUL.bord}`,
                            background: saisie.mode === k ? m.fond : COUL.surface,
                            color: saisie.mode === k ? m.trait : COUL.texteDoux }}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 7, marginBottom: 7 }}>
                        <input type="date" value={saisie.date_versement}
                          onChange={e => setSaisie(s => ({ ...s, date_versement: e.target.value }))}
                          style={champ} />
                        <input type="text" inputMode="decimal" placeholder="Montant €" value={saisie.montant}
                          onChange={e => setSaisie(s => ({ ...s, montant: e.target.value }))}
                          style={{ ...champ, textAlign: 'right' }} />
                      </div>
                      {/* LA QUITTANCE N'EST DEMANDÉE QUE POUR LES ESPÈCES, parce
                          que c'est le seul mode où elle est la seule preuve. */}
                      {saisie.mode === 'especes' && (
                        <div style={{ display: 'flex', gap: 7, marginBottom: 7 }}>
                          <input type="text" placeholder="N° de quittance remise" value={saisie.quittance_numero}
                            onChange={e => setSaisie(s => ({ ...s, quittance_numero: e.target.value }))}
                            style={champ} />
                          <input type="text" placeholder="Reçu par" value={saisie.recu_par}
                            onChange={e => setSaisie(s => ({ ...s, recu_par: e.target.value }))}
                            style={{ ...champ, maxWidth: 110 }} />
                        </div>
                      )}
                      <input type="text" placeholder="Note (facultatif)" value={saisie.notes}
                        onChange={e => setSaisie(s => ({ ...s, notes: e.target.value }))}
                        style={{ ...champ, width: '100%', marginBottom: 8 }} />
                      {messageErreur && (
                        <div style={{ fontSize: 12.5, color: COUL.danger, marginBottom: 7 }}>{messageErreur}</div>
                      )}
                      <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setSaisie(null); setMessageErreur(null) }} style={boutonDoux}>Annuler</button>
                        <button onClick={enregistrerVersement} disabled={enregistre} style={{
                          ...boutonDoux, background: COUL.succes, color: COUL.blanc, border: 'none',
                          opacity: enregistre ? .6 : 1 }}>
                          {enregistre ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                      </div>
                    </div>
                  )}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(v.montant)}
                          </span>
                          {v.mode === 'virement' && (
                            v.transaction_id
                              ? <button onClick={() => delier(v.id)} title="Détacher le mouvement bancaire"
                                  style={petitBouton(COUL.succes)}><i className="ti ti-link" /></button>
                              : <button onClick={() => ouvrirLiaison(v)} title="Relier à un mouvement bancaire"
                                  style={petitBouton(COUL.alerte)}><i className="ti ti-link-off" /></button>
                          )}
                          <button onClick={() => supprimerVersement(v.id)} title="Supprimer ce versement"
                            style={petitBouton(COUL.danger)}><i className="ti ti-trash" /></button>
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

            {/* RELIER UN VERSEMENT À UN MOUVEMENT BANCAIRE.
                Les candidats sont triés par écart de montant, le plus proche
                en tête — mais rien n'est relié tout seul. Une liaison fausse
                est invisible une fois faite : c'est la leçon du rapprochement
                des factures, où relever les garde-fous aurait rapproché plus
                de lignes et des lignes fausses. */}
            {aRelier && (
              <div style={{ margin: '0 18px 14px', border: `1px solid ${COUL.info}55`, borderRadius: 9,
                background: COUL.infoFond, overflow: 'hidden' }}>
                <div style={{ padding: '9px 12px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: 10, borderBottom: `1px solid ${COUL.info}33` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COUL.texte }}>
                    Relier le versement du {fmtDate(aRelier.date_versement)} — {fmt(aRelier.montant)}
                  </span>
                  <button onClick={() => { setARelier(null); setCandidats([]) }} style={boutonDoux}>Fermer</button>
                </div>
                <div style={{ maxHeight: 230, overflow: 'auto' }}>
                  {candidats.length === 0 && (
                    <div style={{ padding: 14, fontSize: 13, color: COUL.texteDoux }}>
                      Aucun mouvement entrant à proposer.
                    </div>
                  )}
                  {candidats.slice(0, 20).map(t => {
                    const exact = Math.abs(Number(t.montant) - Number(aRelier.montant)) < 0.005
                    return (
                      <button key={t.id} onClick={() => relier(aRelier.id, t.id)} style={{
                        display: 'flex', width: '100%', gap: 10, alignItems: 'center', textAlign: 'left',
                        padding: '8px 12px', border: 'none', borderBottom: `1px solid ${COUL.info}22`,
                        background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 13.5, color: COUL.texte, fontWeight: exact ? 700 : 400 }}>
                            {t.contrepartie_nom || '(sans contrepartie)'}
                          </span>
                          <span style={{ display: 'block', fontSize: 11.5, color: COUL.texteDoux,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fmtDate(t.date_valeur)} · {t.information_paiement || t.description || ''}
                          </span>
                        </span>
                        {exact && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 9,
                            background: COUL.succes, color: COUL.blanc }}>montant exact</span>
                        )}
                        <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap' }}>{fmt(t.montant)}</span>
                      </button>
                    )
                  })}
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
