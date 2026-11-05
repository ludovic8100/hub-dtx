// Les trois détections demandées au départ du chantier des dépenses :
// doublons de facture, paiements en double, factures restées impayées.
//
// LE PIÈGE DE CES TROIS-LÀ, C'EST LE BRUIT.
//
// Un premier jet signalait 322 paiements « en double » pour 178 000 € :
// c'étaient des loyers et des abonnements mensuels. Un autre annonçait
// 91 doublons de facture : DKV sous le même numéro de police, trois primes
// du même montant. Signaler à tort, c'est apprendre à ignorer les
// signalements — et alors les vraies anomalies passent aussi.
//
// Les règles sont donc volontairement serrées, et chaque liste dit ce
// qu'elle sait ET ce qu'elle ne sait pas. Les « impayées » sont séparées en
// deux, parce qu'une facture dont aucun paiement du montant n'existe nulle
// part n'est pas la même chose qu'une facture simplement pas rapprochée.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-BE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
}))
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-BE', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}) : '—')

// Le lien SharePoint porte « ?web=1 » : la visionneuse en ligne, jamais un
// téléchargement sur le disque.
const lienEnLigne = (u) => (!u ? null : (u.includes('?') ? u : u + '?web=1'))

// ── Aperçu au survol ─────────────────────────────────────────────────────
//
// Il n'y a plus une seule vignette en base (zéro sur 7 612 factures) : le
// workflow n8n qui les fabriquait est archivé. Plutôt que de promettre une
// image qui ne viendra pas, le survol montre ce qu'on sait réellement de la
// facture, et le clic ouvre le vrai PDF.
function Apercu({ f }) {
  if (!f) return null
  return (
    <div style={{
      position: 'absolute', zIndex: 60, right: 0, top: 'calc(100% + 6px)',
      minWidth: 260, maxWidth: 360, background: '#fff', border: '1px solid #cbd5e1',
      borderRadius: 9, boxShadow: '0 10px 30px rgba(15,24,38,.18)', padding: '10px 12px',
      textAlign: 'left', fontWeight: 400, cursor: 'default',
    }}>
      {f.thumb_url && (
        <img src={f.thumb_url} alt=""
          style={{ width: '100%', borderRadius: 6, marginBottom: 8, border: '1px solid #eef2f7' }} />
      )}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f1826', marginBottom: 4 }}>
        {f.fournisseur || '(fournisseur inconnu)'}
      </div>
      <Ligne cle="Montant" valeur={fmt(f.montant)} />
      <Ligne cle="Date" valeur={fmtDate(f.date_facture)} />
      {f.numero && <Ligne cle="N°" valeur={f.numero} />}
      {f.societe && <Ligne cle="Société" valeur={f.societe} />}
      <div style={{ fontSize: 10.5, color: '#8c9cb0', marginTop: 7, wordBreak: 'break-word' }}>
        {f.nom}
      </div>
      {lienEnLigne(f.url) && (
        <div style={{ fontSize: 11, color: '#0080BD', marginTop: 6, fontWeight: 600 }}>
          Cliquer pour ouvrir le PDF
        </div>
      )}
    </div>
  )
}

const Ligne = ({ cle, valeur }) => (
  <div style={{ display: 'flex', gap: 8, fontSize: 11.5, lineHeight: 1.6 }}>
    <span style={{ color: '#8c9cb0', width: 62, flexShrink: 0 }}>{cle}</span>
    <span style={{ color: '#0f1826', fontWeight: 600, minWidth: 0, wordBreak: 'break-word' }}>{valeur}</span>
  </div>
)

// Un montant qui révèle la facture au survol et l'ouvre au clic.
function Montant({ f, valeur, couleur }) {
  const [vu, setVu] = useState(false)
  const u = lienEnLigne(f?.url)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setVu(true)} onMouseLeave={() => setVu(false)}>
      <a href={u || undefined} target="_blank" rel="noopener noreferrer"
        style={{
          fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 13,
          color: couleur || '#0f1826', textDecoration: u ? 'underline dotted' : 'none',
          textUnderlineOffset: 3, cursor: u ? 'pointer' : 'default',
        }}>
        {valeur ?? fmt(f?.montant)}
      </a>
      {vu && <Apercu f={f} />}
    </span>
  )
}

// ── Cadre d'une section ──────────────────────────────────────────────────
function Section({ titre, compte, total, explication, prudence, children }) {
  const [ouvert, setOuvert] = useState(true)
  return (
    <section style={{ border: '1px solid #dce4ec', borderRadius: 12, background: '#fff',
                      overflow: 'hidden', marginBottom: 14 }}>
      <button onClick={() => setOuvert(!ouvert)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px',
        background: '#f7fafc', border: 'none', borderBottom: ouvert ? '1px solid #dce4ec' : 'none',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}>
        <i className={`ti ti-chevron-${ouvert ? 'down' : 'right'}`} style={{ color: '#8c9cb0', fontSize: 15 }} />
        <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0f1826', flex: 1 }}>{titre}</span>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 700, color: '#56677c' }}>
          {compte} {compte > 1 ? 'cas' : 'cas'}{total != null ? ` · ${fmt(total)}` : ''}
        </span>
      </button>
      {ouvert && (
        <div style={{ padding: '10px 15px 14px' }}>
          <p style={{ fontSize: 12, color: '#56677c', lineHeight: 1.5, margin: '0 0 4px' }}>{explication}</p>
          {prudence && (
            <p style={{ fontSize: 11.5, color: '#b45309', lineHeight: 1.5, margin: '0 0 10px',
                        background: '#fffaf0', border: '1px solid #f0c478', borderRadius: 7, padding: '7px 9px' }}>
              {prudence}
            </p>
          )}
          {children}
        </div>
      )}
    </section>
  )
}

const TH = ({ children, align }) => (
  <th style={{ textAlign: align || 'left', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
               letterSpacing: '.05em', color: '#8c9cb0', padding: '6px 8px',
               borderBottom: '1px solid #dce4ec', whiteSpace: 'nowrap' }}>{children}</th>
)
const TD = ({ children, align, style }) => (
  <td style={{ textAlign: align || 'left', fontSize: 12.5, color: '#0f1826', padding: '7px 8px',
               borderBottom: '1px solid #f1f5f9', ...style }}>{children}</td>
)
const Etiquette = ({ texte, ton }) => {
  const tons = {
    rouge: ['#fef2f2', '#b91c1c', '#fecaca'],
    orange: ['#fffaf0', '#b45309', '#f0c478'],
    vert: ['#e2f6ea', '#157a44', '#bbf7d0'],
    gris: ['#f1f5f9', '#56677c', '#e2e8f0'],
  }
  const [fond, texteCouleur, bord] = tons[ton] || tons.gris
  return (
    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 6px',
                   background: fond, color: texteCouleur, border: `1px solid ${bord}`,
                   whiteSpace: 'nowrap' }}>{texte}</span>
  )
}

export default function AnomaliesCompta({ societeCodes, color }) {
  const [doublons, setDoublons] = useState(null)
  const [paiements, setPaiements] = useState(null)
  const [impayees, setImpayees] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [tout, setTout] = useState(false)   // afficher aussi les non rapprochées

  const codes = societeCodes && societeCodes.length ? societeCodes : null

  useEffect(() => {
    let vivant = true
    const charger = async () => {
      try {
        let qd = supabase.from('v_factures_doublons').select('*').order('montant', { ascending: false })
        let qp = supabase.from('v_paiements_doubles').select('*').order('montant', { ascending: false })
        let qi = supabase.from('v_factures_impayees').select('*')
          .eq('aucun_paiement_de_ce_montant', true)
          .order('montant', { ascending: false }).limit(400)
        if (codes) { qd = qd.in('societe', codes); qp = qp.in('societe', codes); qi = qi.in('societe', codes) }
        const [d, p, i] = await Promise.all([qd, qp, qi])
        if (!vivant) return
        if (d.error || p.error || i.error) { setErreur(d.error || p.error || i.error); return }
        setDoublons(d.data || []); setPaiements(p.data || []); setImpayees(i.data || [])
      } catch (e) { if (vivant) setErreur(e) }
    }
    charger()
    return () => { vivant = false }
  }, [JSON.stringify(codes)])

  if (erreur) {
    return <div style={{ padding: 20, fontSize: 13, color: '#b91c1c' }}>
      Lecture impossible : {erreur.message || 'la base n’a pas répondu.'}
    </div>
  }
  if (!doublons || !paiements || !impayees) {
    return <div style={{ padding: 30, fontSize: 13, color: '#8c9cb0' }}>Chargement des anomalies…</div>
  }

  const payesPlusieursFois = doublons.filter(d => d.rapproches > 1)
  const doublonsVus = tout ? doublons : payesPlusieursFois
  const trop = doublons.reduce((s, d) => s + Number(d.montant) * (d.exemplaires - 1), 0)

  return (
    <div>
      {/* ── Doublons de facture ─────────────────────────────────────── */}
      <Section
        titre="Factures en double"
        compte={doublons.length}
        total={trop}
        explication="Même société, même fournisseur, même numéro, même montant et même date : c'est le même document deux fois."
        prudence={"La date est indispensable. Sans elle, trois primes mensuelles DKV sous le même numéro de police passaient pour un doublon — le « numéro » lu dans une facture est souvent un numéro de police ou de client, pas de facture."}
      >
        <div style={{ marginBottom: 8 }}>
          <button onClick={() => setTout(!tout)} style={{
            fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 7,
            border: '1px solid #c3cfdb', background: tout ? '#e2f1fa' : '#fff',
            color: '#56677c', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {tout ? `Ne montrer que les ${payesPlusieursFois.length} payées plusieurs fois`
                  : `Montrer les ${doublons.length} doublons (actuellement ${payesPlusieursFois.length} payés plusieurs fois)`}
          </button>
        </div>
        {doublonsVus.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#8c9cb0', margin: 0 }}>Aucun doublon payé plusieurs fois.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <TH>Société</TH><TH>Fournisseur</TH><TH>N°</TH><TH>Date</TH>
                <TH align="right">Montant</TH><TH align="center">Exemplaires</TH><TH></TH>
              </tr></thead>
              <tbody>
                {doublonsVus.map((d, i) => (
                  <tr key={`${d.numero}-${i}`}>
                    <TD><span style={{ fontSize: 11, color: '#8c9cb0' }}>{d.societe}</span></TD>
                    <TD style={{ fontWeight: 600 }}>{d.fournisseur}</TD>
                    <TD style={{ fontSize: 11.5, color: '#56677c' }}>{d.numero}</TD>
                    <TD style={{ fontSize: 11.5, color: '#56677c' }}>{fmtDate(d.date_facture)}</TD>
                    <TD align="right">
                      <Montant
                        f={{ ...d, nom: (d.noms || [])[0], url: (d.urls || [])[0] }}
                        valeur={fmt(d.montant)}
                        couleur={d.rapproches > 1 ? '#b91c1c' : '#0f1826'} />
                    </TD>
                    <TD align="center" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.exemplaires}</TD>
                    <TD>
                      {d.rapproches > 1
                        ? <Etiquette ton="rouge" texte={`payé ${d.rapproches} fois`} />
                        : d.rapproches === 1
                          ? <Etiquette ton="vert" texte="payé une fois" />
                          : <Etiquette ton="gris" texte="aucun paiement" />}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Paiements en double ─────────────────────────────────────── */}
      <Section
        titre="Paiements en double"
        compte={paiements.length}
        total={paiements.reduce((s, p) => s + Number(p.montant), 0)}
        explication="Deux sorties identiques — même compte, même contrepartie, même montant — à moins de dix jours d'écart."
        prudence={"Un premier jet à trente jours signalait 322 cas pour 178 000 € : c'étaient des loyers et des abonnements. Les couples qui reviennent plus de deux fois sont désormais écartés ; il reste ceux-ci."}
      >
        {paiements.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#8c9cb0', margin: 0 }}>Aucun paiement en double détecté.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <TH>Société</TH><TH>Contrepartie</TH><TH align="right">Montant</TH>
                <TH>1<sup>er</sup> paiement</TH><TH>2<sup>e</sup> paiement</TH><TH align="center">Écart</TH>
              </tr></thead>
              <tbody>
                {paiements.map((p, i) => (
                  <tr key={`${p.premier_id}-${i}`}>
                    <TD><span style={{ fontSize: 11, color: '#8c9cb0' }}>{p.societe}</span></TD>
                    <TD style={{ fontWeight: 600 }}>{p.contrepartie_nom}</TD>
                    <TD align="right" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#b45309' }}>
                      {fmt(p.montant)}
                    </TD>
                    <TD style={{ fontSize: 11.5, color: '#56677c' }}>{fmtDate(p.premiere_date)}</TD>
                    <TD style={{ fontSize: 11.5, color: '#56677c' }}>{fmtDate(p.seconde_date)}</TD>
                    <TD align="center">
                      <Etiquette ton={p.jours_ecart <= 3 ? 'rouge' : 'orange'}
                        texte={`${p.jours_ecart} j`} />
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Factures sans paiement ──────────────────────────────────── */}
      <Section
        titre="Factures probablement impayées"
        compte={impayees.length}
        total={impayees.reduce((s, f) => s + Number(f.montant), 0)}
        explication="Plus de 45 jours, et aucune sortie de ce montant n'existe sur les comptes de la société — jamais, pas seulement dans la fenêtre de rapprochement."
        prudence={"Une facture dont le montant vient du nom du fichier, et non du PDF, peut porter un montant faux : elle apparaîtra ici à tort. La colonne « source » le dit."}
      >
        {impayees.length === 0 ? (
          <p style={{ fontSize: 12.5, color: '#8c9cb0', margin: 0 }}>Aucune facture impayée détectée.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <TH>Société</TH><TH>Fournisseur</TH><TH>Date</TH>
                <TH align="right">Montant</TH><TH align="center">Âge</TH><TH>Source</TH>
              </tr></thead>
              <tbody>
                {impayees.map((f) => (
                  <tr key={f.id}>
                    <TD><span style={{ fontSize: 11, color: '#8c9cb0' }}>{f.societe}</span></TD>
                    <TD style={{ fontWeight: 600 }}>
                      {f.fournisseur || <span style={{ color: '#8c9cb0', fontWeight: 400 }}>{f.nom}</span>}
                    </TD>
                    <TD style={{ fontSize: 11.5, color: '#56677c' }}>{fmtDate(f.date_facture)}</TD>
                    <TD align="right"><Montant f={f} valeur={fmt(f.montant)} /></TD>
                    <TD align="center">
                      <Etiquette ton={f.jours > 365 ? 'rouge' : f.jours > 120 ? 'orange' : 'gris'}
                        texte={`${f.jours} j`} />
                    </TD>
                    <TD>
                      {f.lue_dans_le_pdf
                        ? <Etiquette ton="vert" texte="lue dans le PDF" />
                        : <Etiquette ton="orange" texte="nom de fichier" />}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
            {impayees.length >= 400 && (
              <p style={{ fontSize: 11.5, color: '#8c9cb0', marginTop: 8 }}>
                400 premières affichées, triées par montant décroissant.
              </p>
            )}
          </div>
        )}
      </Section>
    </div>
  )
}
