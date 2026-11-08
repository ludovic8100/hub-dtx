import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { COUL } from '../../lib/theme'

// Les dossiers LODE — un par intervention.
//
// LE PROBLÈME, DIT PAR LUDOVIC
//
// « Il commande, je paie, je ne sais pas pourquoi, il va installer et me dit
// quoi facturer, quand il n'oublie pas. L'achat tombe et on ne sait plus
// l'attribuer. »
//
// Mesuré sur un seul dossier (MONDY, octobre 2026) : coût Winsol 1 824,96 €
// facture impayée, prix annoncé au client 2 841,96 € TTC, encaissé 840,00 €,
// facture de vente AUCUNE. 2 001,96 € que personne ne réclame.
//
// L'INVARIANT
//
// Dépannage ou installation, il y a toujours UN dossier par intervention.
// C'est la seule chose qui ne varie pas, donc c'est la colonne vertébrale.
//
// LE NUMÉRO DE DOSSIER EST LA RÉFÉRENCE FOURNISSEUR
//
// JCL tape déjà quelque chose dans « Votre référence » chez Winsol — mesuré :
// « SCREENS EXACTE », « KINÉ », « 81222 ». Il tapera le numéro du dossier.
// Même geste, même champ. Mais ce que le fournisseur réimprime sur sa facture
// devient alors un identifiant que la base reconnaît, que la commande soit
// partie par mail ou depuis le site web — les deux canaux existent.
//
// ET ÇA NE DÉPEND PAS DE SA DISCIPLINE
//
// Règle du Hub : aucun maillon ne doit dépendre d'un geste que quelqu'un doit
// penser à faire. Sans numéro, la facture tombe dans « Achats à attribuer » et
// réclame le jour où elle arrive. Le geste est un raccourci, pas une condition.

const FONT = "'Source Sans Pro', sans-serif"
const OR = COUL.orange
const eur = v => v == null ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)
const fmtDate = d => {
  if (!d) return '—'
  const p = String(d).substring(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

const card = { background: COUL.surface, border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16 }
const th = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: COUL.texteSombre }
const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: FONT, background: COUL.surface, boxSizing: 'border-box' }
const btn = { padding: '9px 14px', borderRadius: 8, border: 'none', background: OR, color: COUL.blanc, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }

function Kpi({ label, value, c, sub }) {
  return (
    <div style={{ flex: '1 1 160px', background: COUL.surface, border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COUL.texteFaible, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function LodeDossiers() {
  const [onglet, setOnglet] = useState('dossiers')
  const [dossiers, setDossiers] = useState([])
  const [achats, setAchats] = useState([])
  const [ventes, setVentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [nouveau, setNouveau] = useState(null)   // dossier fraîchement créé, à montrer en grand
  const [aAttribuer, setAAttribuer] = useState(null) // facture d'achat en cours d'attribution
  const [erreur, setErreur] = useState('')

  async function charger() {
    setLoading(true)
    const [d, a, v] = await Promise.all([
      supabase.from('dossiers')
        .select('id,numero,titre,client_nom,statut,montant_a_facturer,date_debut,created_at')
        .eq('societe', 'LODE').order('created_at', { ascending: false }),
      supabase.from('factures_achat')
        .select('id,fichier_id,nom,fournisseur,montant,date_facture,url,destination_type,destination_id,destination_nom,transaction_id')
        .eq('societe', 'LODE').eq('sens', 'achat').order('date_facture', { ascending: false }),
      supabase.from('lode_factures')
        .select('id,numero,client_nom,total_ttc,montant_paye,dossier_id,statut'),
    ])
    setDossiers(d.data || []); setAchats(a.data || []); setVentes(v.data || [])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  // Les quatre chiffres d'un dossier. « coûté » ne compte que les achats
  // RÉELLEMENT affectés : un dossier sans achat affecté affiche 0, pas une
  // estimation — un zéro mesuré vaut mieux qu'un chiffre inventé.
  const parDossier = useMemo(() => {
    const m = {}
    for (const d of dossiers) m[d.id] = { coute: 0, nbAchats: 0, facture: 0, encaisse: 0, nbVentes: 0 }
    for (const a of achats) {
      if (a.destination_type === 'dossier' && m[a.destination_id]) {
        m[a.destination_id].coute += Number(a.montant) || 0
        m[a.destination_id].nbAchats += 1
      }
    }
    for (const f of ventes) {
      if (f.dossier_id && m[f.dossier_id]) {
        m[f.dossier_id].facture += Number(f.total_ttc) || 0
        m[f.dossier_id].encaisse += Number(f.montant_paye) || 0
        m[f.dossier_id].nbVentes += 1
      }
    }
    return m
  }, [dossiers, achats, ventes])

  const nonAffectes = useMemo(
    () => achats.filter(a => !a.destination_type),
    [achats])

  // Le chiffre qui justifie l'écran : ce qui a été annoncé au client et
  // jamais facturé. Null quand aucun prix n'a été saisi — on ne déduit pas
  // un manque d'une absence de donnée.
  const manquantTotal = useMemo(() => dossiers.reduce((s, d) => {
    if (d.montant_a_facturer == null) return s
    const c = parDossier[d.id] || {}
    return s + Math.max(0, (Number(d.montant_a_facturer) || 0) - (c.facture || 0))
  }, 0), [dossiers, parDossier])

  async function creerDossier(titre, client, montant) {
    setErreur('')
    const { data: numero, error: e1 } = await supabase.rpc('prochain_numero', {
      p_type: 'dossier', p_societe: 'LODE', p_prefixe: 'DOS',
    })
    if (e1) { setErreur(e1.message); return }
    const { data, error } = await supabase.from('dossiers').insert({
      societe: 'LODE', numero, titre: titre || 'Sans titre',
      client_nom: client || null, type: 'intervention',
      montant_a_facturer: montant === '' || montant == null ? null : Number(montant),
      date_debut: new Date().toISOString().slice(0, 10),
    }).select('id,numero,titre,client_nom,statut,montant_a_facturer,date_debut,created_at').single()
    if (error) { setErreur(error.message); return }
    setDossiers(p => [data, ...p])
    setNouveau(data)
  }

  async function affecter(facture, dossier) {
    setErreur('')
    const patch = {
      destination_type: 'dossier',
      destination_id: dossier.id,
      destination_nom: `${dossier.numero ? dossier.numero + ' · ' : ''}${dossier.titre}`,
    }
    const { error } = await supabase.from('factures_achat').update(patch).eq('id', facture.id)
    if (error) { setErreur(error.message); return }
    setAchats(p => p.map(a => a.id === facture.id ? { ...a, ...patch } : a))
    setAAttribuer(null)
  }

  return (
    <Layout>
      <div style={{ fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: COUL.texteFort, margin: 0 }}>Dossiers LODE</h1>
          <span style={{ fontSize: 13, color: COUL.texteFaible }}>Un dossier par intervention — dépannage comme installation</span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Kpi label="Dossiers ouverts" value={dossiers.filter(d => d.statut !== 'clos').length} c={OR} />
          <Kpi label="Achats à attribuer" value={nonAffectes.length} c={nonAffectes.length ? COUL.danger : COUL.succes}
               sub={nonAffectes.length ? eur(nonAffectes.reduce((s, a) => s + (Number(a.montant) || 0), 0)) : 'tout est affecté'} />
          <Kpi label="Annoncé, pas facturé" value={manquantTotal > 0 ? eur(manquantTotal) : '—'} c={manquantTotal > 0 ? COUL.danger : COUL.texteFaible}
               sub={dossiers.some(d => d.montant_a_facturer != null) ? 'sur les dossiers chiffrés' : 'aucun prix client saisi'} />
        </div>

        <div style={{ display: 'flex', gap: 0, marginTop: 18, borderBottom: '2px solid #e2e8f0' }}>
          {[['dossiers', 'Dossiers'], ['attribuer', `Achats à attribuer${nonAffectes.length ? ` (${nonAffectes.length})` : ''}`]].map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)} style={{
              background: 'none', border: 'none', padding: '9px 16px', fontFamily: FONT, fontSize: 13.5,
              cursor: 'pointer', marginBottom: -2,
              color: onglet === k ? OR : COUL.texteFaible, fontWeight: onglet === k ? 700 : 500,
              borderBottom: `2px solid ${onglet === k ? OR : 'transparent'}`,
            }}>{l}</button>
          ))}
        </div>

        {erreur && <div style={{ ...card, background: COUL.dangerFondDoux, color: COUL.dangerFonce, fontSize: 13 }}>{erreur}</div>}
        {loading && <div style={{ ...card, textAlign: 'center', color: COUL.texteFaible }}>Chargement…</div>}

        {!loading && onglet === 'dossiers' && (
          <>
            <FormNouveau onCreer={creerDossier} />
            <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead><tr>
                  <th style={th}>N°</th><th style={th}>Intervention</th><th style={th}>Client</th>
                  <th style={thR}>Coûté</th><th style={thR}>À facturer</th><th style={thR}>Facturé</th>
                  <th style={thR}>Encaissé</th><th style={thR}>Manquant</th>
                </tr></thead>
                <tbody>
                  {dossiers.length === 0 && <tr><td style={{ ...td, textAlign: 'center', padding: 36, color: COUL.texteFaible }} colSpan={8}>
                    Aucun dossier. Crée le premier ci-dessus — son numéro est la référence à taper chez le fournisseur.
                  </td></tr>}
                  {dossiers.map(d => {
                    const c = parDossier[d.id] || {}
                    const aFact = d.montant_a_facturer == null ? null : Number(d.montant_a_facturer)
                    const manque = aFact == null ? null : Math.max(0, aFact - (c.facture || 0))
                    return (
                      <tr key={d.id}>
                        <td style={{ ...td, fontWeight: 700, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 }}>{d.numero || '—'}</td>
                        <td style={td}>{d.titre}</td>
                        <td style={{ ...td, color: COUL.texteDoux }}>{d.client_nom || '—'}</td>
                        <td style={tdR}>{c.nbAchats ? eur(c.coute) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                        <td style={tdR}>{aFact == null ? <span style={{ color: '#cbd5e1' }}>—</span> : eur(aFact)}</td>
                        <td style={tdR}>{c.nbVentes ? eur(c.facture) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                        <td style={tdR}>{c.nbVentes ? eur(c.encaisse) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                        <td style={{ ...tdR, fontWeight: 700, color: manque > 0 ? COUL.danger : COUL.texteFaible }}>
                          {manque == null ? '—' : manque > 0 ? eur(manque) : '✓'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && onglet === 'attribuer' && (
          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead><tr>
                <th style={th}>Date</th><th style={th}>Fournisseur</th><th style={th}>Facture</th>
                <th style={thR}>Montant</th><th style={th}>Payée</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {nonAffectes.length === 0 && <tr><td style={{ ...td, textAlign: 'center', padding: 36, color: COUL.succes }} colSpan={6}>
                  Tous les achats LODE sont affectés.
                </td></tr>}
                {nonAffectes.map(a => (
                  <tr key={a.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDate(a.date_facture)}</td>
                    <td style={td}>{a.fournisseur || <span style={{ color: COUL.texteFaible }}>inconnu</span>}</td>
                    <td style={{ ...td, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.url
                        ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: OR, textDecoration: 'none' }}>{(a.nom || '').replace(/\.pdf$/i, '')}</a>
                        : (a.nom || '').replace(/\.pdf$/i, '')}
                    </td>
                    <td style={tdR}>{eur(a.montant)}</td>
                    <td style={td}>{a.transaction_id
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: COUL.succes }}>payée</span>
                      : <span style={{ fontSize: 11, fontWeight: 700, color: COUL.danger }}>non payée</span>}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => setAAttribuer(a)} style={{ ...btn, padding: '6px 11px', fontSize: 12.5 }}>Attribuer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nouveau && <PanneauNumero dossier={nouveau} onClose={() => setNouveau(null)} />}
      {aAttribuer && (
        <PanneauAttribuer facture={aAttribuer} dossiers={dossiers}
          onClose={() => setAAttribuer(null)} onChoisir={d => affecter(aAttribuer, d)} />
      )}
    </Layout>
  )
}

function FormNouveau({ onCreer }) {
  const [titre, setTitre] = useState('')
  const [client, setClient] = useState('')
  const [montant, setMontant] = useState('')
  const [occupe, setOccupe] = useState(false)
  async function go() {
    if (!titre.trim() && !client.trim()) return
    setOccupe(true)
    await onCreer(titre.trim(), client.trim(), montant)
    setTitre(''); setClient(''); setMontant(''); setOccupe(false)
  }
  return (
    <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ flex: '2 1 200px' }}>
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Intervention</label>
        <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Remplacement moteur, pose porte…" style={{ ...inp, width: '100%' }} />
      </div>
      <div style={{ flex: '2 1 180px' }}>
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Client</label>
        <input value={client} onChange={e => setClient(e.target.value)} placeholder="Nom du client" style={{ ...inp, width: '100%' }} />
      </div>
      <div style={{ flex: '1 1 150px' }}>
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Prix annoncé (TTC)</label>
        <input value={montant} onChange={e => setMontant(e.target.value)} inputMode="decimal" placeholder="facultatif" style={{ ...inp, width: '100%' }} />
      </div>
      <button onClick={go} disabled={occupe} style={{ ...btn, opacity: occupe ? 0.6 : 1 }}>
        <i className="ti ti-plus" style={{ marginRight: 6 }} />Nouveau dossier
      </button>
    </div>
  )
}

// Après création, le numéro est montré en grand : c'est la seule chose que la
// personne doit emporter pour la taper chez le fournisseur.
function PanneauNumero({ dossier, onClose }) {
  const [copie, setCopie] = useState(false)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: 'min(420px, 94vw)', padding: '26px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 13.5, color: COUL.texteDoux, marginBottom: 6 }}>Dossier créé</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: COUL.texteFort, marginBottom: 16 }}>{dossier.titre}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Référence à taper chez le fournisseur
        </div>
        <div style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 28, fontWeight: 800, color: OR, margin: '8px 0 4px', letterSpacing: '.02em' }}>
          {dossier.numero}
        </div>
        <div style={{ fontSize: 12, color: COUL.texteFaible, lineHeight: 1.5, margin: '10px 0 18px' }}>
          À recopier dans « Votre référence » chez Winsol ou SDA.<br />
          La facture se rangera toute seule dans ce dossier.
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(dossier.numero); setCopie(true); setTimeout(() => setCopie(false), 2000) }}
          style={{ ...btn, width: '100%' }}>{copie ? '✓ Copié' : 'Copier le numéro'}</button>
        <button onClick={onClose} style={{ marginTop: 8, width: '100%', padding: '9px', borderRadius: 8, border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.texteDoux, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Fermer</button>
      </div>
    </div>
  )
}

function PanneauAttribuer({ facture, dossiers, onClose, onChoisir }) {
  const [q, setQ] = useState('')
  const ouverts = dossiers.filter(d => d.statut !== 'clos')
  const liste = !q.trim() ? ouverts : ouverts.filter(d =>
    `${d.numero || ''} ${d.titre || ''} ${d.client_nom || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: COUL.surface, borderRadius: 14, width: 'min(520px, 96vw)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: COUL.texteFort }}>Cet achat, c&apos;est pour quel dossier&nbsp;?</div>
          <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 3 }}>
            {facture.fournisseur || 'fournisseur inconnu'} — <strong>{eur(facture.montant)}</strong> — {fmtDate(facture.date_facture)}
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus placeholder="Numéro, intervention, client…" style={{ ...inp, width: '100%' }} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {liste.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: COUL.texteFaible, fontSize: 13 }}>
            Aucun dossier ouvert ne correspond. Crée-le d&apos;abord dans l&apos;onglet Dossiers.
          </div>}
          {liste.map(d => (
            <div key={d.id} onClick={() => onChoisir(d)} style={{ padding: '11px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = COUL.fond }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COUL.texteFort }}>
                <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12, color: OR, marginRight: 8 }}>{d.numero}</span>
                {d.titre}
              </div>
              <div style={{ fontSize: 11.5, color: COUL.texteFaible }}>{d.client_nom || 'sans client'}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.texteDoux, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>Fermer</button>
        </div>
      </div>
    </div>
  )
}
