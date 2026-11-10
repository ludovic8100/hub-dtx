import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { COUL } from '../lib/theme'
import { usePetitEcran } from '../lib/ecran'
import { voile } from '../lib/voile'

/**
 * BORDEREAUX ET QUITTANCES — ce que la compagnie nous a envoyé, et ce qu'il y a dedans.
 *
 * Demandé par Ludovic le 10/11 : « je dois pouvoir voir la liste des quittances
 * du RCP et lorsque je clique sur la quittance, il m'ouvre le bordereau. Idem
 * pour les BQT. Je dois pouvoir voir le rapprochement, pour voir la liste des
 * quittances impayées. »
 *
 * ⚠️ LES DEUX DOCUMENTS NE SE LISENT PAS PAREIL, et l'écran doit le dire :
 *
 *   RCP  relevé de compte producteur — CE QU'ON REÇOIT. Il porte un solde, et
 *        ce solde se rapproche d'un virement. Un RCP sans paiement est une
 *        anomalie réelle.
 *   BQT  bordereau de quittancement — CE QUE LES CLIENTS DOIVENT. Il ne règle
 *        rien, donc il n'a ni solde ni paiement : afficher « sans paiement »
 *        sur un BQT serait une fausse alerte permanente.
 */

const fmt = n => n === null || n === undefined || n === ''
  ? '—'
  : (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'

const MOIS = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Un état de quittance se lit sur trois valeurs, pas sur une chaîne libre. */
const ETAT = {
  'encaissée': { label: 'Encaissée', fond: COUL.succesFond || COUL.tealFond, trait: COUL.succes },
  'impayée':   { label: 'Impayée',   fond: COUL.dangerFond, trait: COUL.danger },
  'extournée': { label: 'Extournée', fond: COUL.alerteFondDoux, trait: COUL.alerte },
}
const etatDe = e => ETAT[(e || '').toLowerCase()] || { label: e || 'inconnu', fond: COUL.fondDoux, trait: COUL.texteDoux }

function Pastille({ texte, fond, trait, titre }) {
  return (
    <span title={titre} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: fond, color: trait, whiteSpace: 'nowrap' }}>{texte}</span>
  )
}

export default function BordereauxView({ societeCodes = ['DYNASSUR'], color }) {
  const petit = usePetitEcran()
  const [onglet, setOnglet] = useState('bordereaux')   // 'bordereaux' | 'impayees'
  const [bordereaux, setBordereaux] = useState([])
  const [impayees, setImpayees] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  const [annee, setAnnee] = useState('toutes')
  const [type, setType] = useState('tous')
  const [compagnie, setCompagnie] = useState('toutes')
  const [sansPaiement, setSansPaiement] = useState(false)

  const [ouvert, setOuvert] = useState(null)
  const [lignes, setLignes] = useState(null)

  useEffect(() => {
    let vivant = true
    setChargement(true)
    Promise.all([
      supabase.from('bordereaux')
        .select('id,compagnie,mois,annee,type,montant,commission,net,compte_producteur,nb_polices,' +
                'nom_fichier,url_sharepoint,transaction_id,communication,date_cloture,solde_releve')
        .order('annee', { ascending: false }).order('mois', { ascending: false }).limit(500),
      // Les impayées : on veut le client ET le bordereau d'origine, pour
      // pouvoir ouvrir le document sans quitter l'écran.
      supabase.from('quittances')
        .select('id,client_nom,client_prenom,dossier,police,compagnie,prime_totale,commission,' +
                'date_comptable,etat,type_quittance,bordereau_id,' +
                'bordereaux(id,nom_fichier,url_sharepoint,type,mois,annee)')
        .neq('etat', 'encaissée').order('date_comptable', { ascending: false }).limit(500),
    ]).then(([b, q]) => {
      if (!vivant) return
      if (b.error) setErreur(b.error.message)
      setBordereaux(b.data || [])
      setImpayees(q.data || [])
      setChargement(false)
    })
    return () => { vivant = false }
  }, [societeCodes.join(',')])

  const annees = useMemo(
    () => [...new Set(bordereaux.map(b => b.annee).filter(Boolean))].sort((a, b) => b - a), [bordereaux])
  const compagnies = useMemo(
    () => [...new Set(bordereaux.map(b => b.compagnie).filter(Boolean))].sort(), [bordereaux])

  const vus = useMemo(() => bordereaux.filter(b =>
    (annee === 'toutes' || String(b.annee) === String(annee)) &&
    (type === 'tous' || b.type === type) &&
    (compagnie === 'toutes' || b.compagnie === compagnie) &&
    // Un BQT ne se règle pas : il ne peut donc pas être « sans paiement ».
    (!sansPaiement || (b.type === 'RCP' && !b.transaction_id))
  ), [bordereaux, annee, type, compagnie, sansPaiement])

  const ouvrir = async (b) => {
    setOuvert(b); setLignes(null)
    const { data } = await supabase.from('quittances')
      .select('id,client_nom,client_prenom,dossier,police,type_quittance,prime_totale,commission,commission_sa,date_comptable,etat,sous_agent')
      .eq('bordereau_id', b.id).order('client_nom')
    setLignes(data || [])
  }

  const totaux = useMemo(() => ({
    nb: vus.length,
    primes: vus.reduce((s, b) => s + Number(b.montant || 0), 0),
    commissions: vus.reduce((s, b) => s + Number(b.commission || 0), 0),
    rcpSansPaiement: vus.filter(b => b.type === 'RCP' && !b.transaction_id).length,
  }), [vus])

  if (chargement) return <div style={{ padding: 40, textAlign: 'center', color: COUL.texteDoux }}>Chargement…</div>
  if (erreur) return (
    <div style={{ padding: 20, borderRadius: 10, background: COUL.dangerFond, color: COUL.danger, fontSize: 14 }}>
      Lecture impossible : {erreur}
    </div>
  )

  return (
    <div style={{ fontFamily: "'Source Sans Pro', sans-serif" }}>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['bordereaux', `Bordereaux (${bordereaux.length})`], ['impayees', `Quittances impayées (${impayees.length})`]].map(([k, lab]) => (
          <button key={k} onClick={() => setOnglet(k)} style={{
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13.5, fontWeight: 700,
            border: onglet === k ? 'none' : `1px solid ${COUL.bord}`,
            background: onglet === k ? (color || COUL.marine) : COUL.surface,
            color: onglet === k ? COUL.blanc : COUL.texteDoux }}>{lab}</button>
        ))}
      </div>

      {onglet === 'bordereaux' ? (<>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <select value={annee} onChange={e => setAnnee(e.target.value)} style={selectStyle}>
            <option value="toutes">Toutes les années</option>
            {annees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} style={selectStyle}>
            <option value="tous">BQT et RCP</option>
            <option value="RCP">RCP — relevés (ce qu'on reçoit)</option>
            <option value="BQT">BQT — quittancements (ce que les clients doivent)</option>
          </select>
          <select value={compagnie} onChange={e => setCompagnie(e.target.value)} style={selectStyle}>
            <option value="toutes">Toutes les compagnies</option>
            {compagnies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer',
            color: sansPaiement ? COUL.danger : COUL.texteDoux, fontWeight: sansPaiement ? 700 : 400 }}>
            <input type="checkbox" checked={sansPaiement} onChange={e => setSansPaiement(e.target.checked)} />
            Relevés sans paiement ({totaux.rcpSansPaiement})
          </label>
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: COUL.texteDoux }}>
            {totaux.nb} document(s) · primes {fmt(totaux.primes)} · commissions {fmt(totaux.commissions)}
          </span>
        </div>

        {vus.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: COUL.texteDoux, background: COUL.surface,
            border: `1px dashed ${COUL.bord}`, borderRadius: 10 }}>Aucun bordereau pour ce filtre.</div>
        ) : (
          <div style={{ background: COUL.surface, border: `1px solid ${COUL.bord}`, borderRadius: 10, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: petit ? 720 : 0 }}>
              <thead>
                <tr style={{ background: COUL.fondDoux }}>
                  {['Période', 'Type', 'Compagnie', 'Compte', 'Primes', 'Commission', 'Solde', 'Paiement', ''].map((h, i) => (
                    <th key={h + i} style={{ ...thStyle, textAlign: i >= 4 && i <= 6 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vus.map(b => (
                  <tr key={b.id} onClick={() => ouvrir(b)} style={{ cursor: 'pointer', borderBottom: `1px solid ${COUL.bord}` }}
                    onMouseEnter={e => e.currentTarget.style.background = COUL.fondDoux}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: COUL.texteFort }}>{MOIS[parseInt(b.mois, 10)] || b.mois} {b.annee}</div>
                      <div style={{ fontSize: 11.5, color: COUL.texteDoux }}>clôture {fmtDate(b.date_cloture)}</div>
                    </td>
                    <td style={tdStyle}>
                      <Pastille texte={b.type}
                        titre={b.type === 'RCP' ? 'Relevé de compte producteur — ce que Dynassur reçoit'
                                                : 'Bordereau de quittancement — ce que les clients doivent'}
                        fond={b.type === 'RCP' ? COUL.infoFond : COUL.tealFond}
                        trait={b.type === 'RCP' ? COUL.info : COUL.teal} />
                    </td>
                    <td style={tdStyle}>{b.compagnie}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12.5 }}>{b.compte_producteur || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(b.montant)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(b.commission)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {b.type === 'RCP' ? fmt(b.net) : <span style={{ color: COUL.texteDoux, fontWeight: 400 }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      {/* UN BQT NE SE RÈGLE PAS. Afficher « sans paiement » dessus
                          serait une fausse alerte permanente, et une fausse alerte
                          permanente finit par éteindre les vraies. */}
                      {b.type !== 'RCP'
                        ? <span style={{ fontSize: 11.5, color: COUL.texteDoux }}>sans objet</span>
                        : b.transaction_id
                          ? <Pastille texte="reçu" fond={COUL.succes} trait={COUL.blanc} titre="Relevé rapproché d'un virement" />
                          : <Pastille texte="sans paiement" fond={COUL.dangerFond} trait={COUL.danger}
                              titre="Aucun virement rapproché de ce relevé" />}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {b.url_sharepoint && (
                        <a href={b.url_sharepoint} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          title={`Ouvrir ${b.nom_fichier}`}
                          style={{ color: COUL.info, fontSize: 16 }}><i className="ti ti-file-description" /></a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>) : (
        /* ── Quittances impayées ─────────────────────────────────────── */
        impayees.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: COUL.succes, background: COUL.surface,
            border: `1px dashed ${COUL.bord}`, borderRadius: 10, fontWeight: 600 }}>
            Aucune quittance impayée.
          </div>
        ) : (
          <div style={{ background: COUL.surface, border: `1px solid ${COUL.bord}`, borderRadius: 10, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: petit ? 700 : 0 }}>
              <thead>
                <tr style={{ background: COUL.fondDoux }}>
                  {['Échéance', 'Client', 'Police', 'Compagnie', 'Prime', 'État', 'Bordereau'].map((h, i) => (
                    <th key={h} style={{ ...thStyle, textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {impayees.map(q => {
                  const e = etatDe(q.etat)
                  return (
                    <tr key={q.id} style={{ borderBottom: `1px solid ${COUL.bord}` }}>
                      <td style={tdStyle}>{fmtDate(q.date_comptable)}</td>
                      <td style={tdStyle}>
                        {/* Un vrai lien : Ctrl+clic doit ouvrir la fiche dans un onglet. */}
                        {q.dossier
                          ? <a href={`/dynassur/clients?dossier=${encodeURIComponent(q.dossier)}`}
                              title="Ouvrir la fiche client — Ctrl+clic pour un nouvel onglet"
                              style={{ fontWeight: 700, color: COUL.info, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                              {q.client_nom} {q.client_prenom}
                            </a>
                          : <span style={{ fontWeight: 700 }}>{q.client_nom} {q.client_prenom}</span>}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12.5 }}>{q.police || '—'}</td>
                      <td style={tdStyle}>{q.compagnie || '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(q.prime_totale)}</td>
                      <td style={tdStyle}><Pastille texte={e.label} fond={e.fond} trait={e.trait} /></td>
                      <td style={tdStyle}>
                        {q.bordereaux
                          ? <a href={q.bordereaux.url_sharepoint || '#'} target="_blank" rel="noreferrer"
                              onClick={ev => { if (!q.bordereaux.url_sharepoint) ev.preventDefault() }}
                              title={q.bordereaux.nom_fichier}
                              style={{ color: COUL.info, fontWeight: 700, fontSize: 12.5, textDecoration: 'none' }}>
                              <i className="ti ti-file-description" /> {q.bordereaux.type} {q.bordereaux.mois}/{q.bordereaux.annee}
                            </a>
                          : <span title="Aucun bordereau rattaché" style={{ color: COUL.alerte, fontSize: 12.5, fontWeight: 700 }}>
                              <i className="ti ti-file-alert" /> sans bordereau
                            </span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Le détail d'un bordereau : ses quittances ────────────────── */}
      {ouvert && (
        <div {...voile(() => { setOuvert(null); setLignes(null) })}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,24,38,.45)', zIndex: 200,
            display: 'flex', alignItems: petit ? 'flex-end' : 'center', justifyContent: 'center', padding: petit ? 0 : 20 }}>
          <div style={{ background: COUL.surface, borderRadius: petit ? '14px 14px 0 0' : 14, width: '100%',
            maxWidth: 940, maxHeight: petit ? '90vh' : '88vh', overflow: 'auto' }}>

            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${COUL.bord}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: COUL.texteFort }}>
                  {ouvert.type} · {MOIS[parseInt(ouvert.mois, 10)] || ouvert.mois} {ouvert.annee} · {ouvert.compagnie}
                </div>
                <div style={{ fontSize: 13, color: COUL.texteDoux, marginTop: 2 }}>
                  compte {ouvert.compte_producteur}
                  {ouvert.communication && <> · communication {ouvert.communication}</>}
                </div>
              </div>
              {ouvert.url_sharepoint && (
                <a href={ouvert.url_sharepoint} target="_blank" rel="noreferrer"
                  style={{ padding: '8px 14px', borderRadius: 8, background: COUL.info, color: COUL.blanc,
                    fontSize: 13.5, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  <i className="ti ti-file-description" /> Ouvrir le document
                </a>
              )}
            </div>

            <div style={{ display: 'flex', gap: 22, padding: '10px 18px', flexWrap: 'wrap',
              borderBottom: `1px solid ${COUL.bord}`, background: COUL.fondDoux }}>
              {[['Primes', fmt(ouvert.montant)], ['Commission', fmt(ouvert.commission)],
                ...(ouvert.type === 'RCP' ? [['Solde', fmt(ouvert.net)]] : []),
                ['Lignes', String(ouvert.nb_polices ?? (lignes ? lignes.length : '—'))]].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.04em', color: COUL.texteDoux }}>{l}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                </div>
              ))}
            </div>

            {!lignes ? (
              <div style={{ padding: 30, textAlign: 'center', color: COUL.texteDoux }}>Chargement des quittances…</div>
            ) : lignes.length === 0 ? (
              <div style={{ padding: 26, textAlign: 'center', color: COUL.texteDoux, lineHeight: 1.5 }}>
                Aucune quittance rattachée à ce bordereau.<br />
                <span style={{ fontSize: 12.5 }}>
                  Le document existe et ses totaux sont lus, mais son détail ligne à ligne n'a pas encore été extrait.
                </span>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: COUL.surface }}>
                    {['Client', 'Police', 'Type', 'Prime', 'Commission', 'État', ''].map((h, i) => (
                      <th key={h + i} style={{ ...thStyle, textAlign: i === 3 || i === 4 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map(q => {
                    const e = etatDe(q.etat)
                    return (
                      <tr key={q.id} style={{ borderBottom: `1px solid ${COUL.bord}` }}>
                        <td style={tdStyle}>
                          {q.dossier
                            ? <a href={`/dynassur/clients?dossier=${encodeURIComponent(q.dossier)}`}
                                title="Ouvrir la fiche client — Ctrl+clic pour un nouvel onglet"
                                style={{ fontWeight: 700, color: COUL.info, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                                {q.client_nom} {q.client_prenom}
                              </a>
                            : <span style={{ fontWeight: 700 }}>{q.client_nom} {q.client_prenom}</span>}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12.5 }}>{q.police || '—'}</td>
                        <td style={{ ...tdStyle, color: COUL.texteDoux }}>{q.type_quittance || '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(q.prime_totale)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(q.commission)}
                          {Number(q.commission_sa) > 0 && (
                            <div style={{ fontSize: 11.5, color: COUL.texteDoux }}>dont SA {fmt(q.commission_sa)}</div>
                          )}
                        </td>
                        <td style={tdStyle}><Pastille texte={e.label} fond={e.fond} trait={e.trait} /></td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {ouvert.url_sharepoint && (
                            <a href={ouvert.url_sharepoint} target="_blank" rel="noreferrer"
                              title={`Ouvrir ${ouvert.nom_fichier}`}
                              style={{ color: COUL.info, fontSize: 15 }}><i className="ti ti-file-description" /></a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            <div style={{ padding: '12px 18px', borderTop: `1px solid ${COUL.bord}`, textAlign: 'right' }}>
              <button onClick={() => { setOuvert(null); setLignes(null) }} style={{
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

const selectStyle = {
  padding: '7px 10px', borderRadius: 8, border: `1px solid ${COUL.bord}`,
  fontSize: 13, fontFamily: 'inherit', background: COUL.surface, color: COUL.texte,
}
const thStyle = {
  padding: '9px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.04em', color: COUL.texteDoux, borderBottom: `1px solid ${COUL.bord}`, whiteSpace: 'nowrap',
}
const tdStyle = { padding: '9px 12px', verticalAlign: 'top' }
