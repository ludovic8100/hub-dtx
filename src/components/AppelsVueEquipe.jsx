import { BarresGroupees, COULEURS } from './GraphAppels'

// Vue équipe et file des rappels.
//
// Mise en page et jetons de style repris de la maquette approuvée
// (HUB-DTX-suivi-appels-v1.html, SharePoint ADMINISTRATION/DOWNLOAD) : mêmes
// couleurs, rayons, graisses, hauteurs de ligne et proportions.
//
// Trois écarts assumés, tous pour la même raison — la donnée n'existe pas :
//   « Statut » (Disponible / En appel / Pause) est de la présence temps réel.
//     `appels` est un journal d'appels terminés. → « Activité », déduite du
//     dernier appel, même pastille à pastille colorée.
//   « Occupation » est temps parlé ÷ temps de présence ; le dénominateur
//     n'existe pas. → taux de décroché, même jauge.
//   « Appels en attente » et « Attente la plus longue » sont des compteurs
//     vivants qu'aucune colonne ne stocke. → remplacés par des chiffres réels.
// Le guide livré avec la maquette dit la même chose de l'occupation :
// « il faut la calculer à partir des états de présence de la téléphonie
// avant de la présenter comme une mesure ».

/* ── Jetons de la maquette ── */
const T = {
  navy: '#102c50', ink: '#102344', muted: '#637899',
  bleu: '#008fe8', bleuVif: '#00a2ee', cyan: '#00b7d9',
  vert: '#16a76b', rouge: '#ed4568', ambre: '#dc8a12',
  ligne: '#e0e8f2', ombre: '0 3px 13px #18396a07', rayon: 12,
}
const MONO = '"Cascadia Mono", Consolas, ui-monospace, monospace'

const fmtNb = n => Number(n || 0).toLocaleString('fr-BE')
const fmtPct = (n, d) => d ? `${Math.round((n / d) * 100)} %` : '—'
const fmtHM = s => s ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : '0 h 00'
const fmtMS = s => s == null ? '—' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' }) : '—'
const fmtDT = v => v ? new Date(v).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

// Les six fonds/encres d'avatar de la maquette, dans l'ordre
const AVATARS = [
  ['#c8f0ff', '#006e9d'], ['#e5d8ff', '#6840af'], ['#d1f2d8', '#187a3d'],
  ['#fff0ce', '#a96e12'], ['#cceeff', '#0073a8'], ['#e2e9f2', '#47607b'],
]
const initiales = nom => (nom || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map(m => m[0]).join('').toUpperCase()

const panneau = { background: '#fff', border: `1px solid ${T.ligne}`, borderRadius: T.rayon, boxShadow: T.ombre }

/* ── Carte de chiffre : bandeau coloré de 4 px, icône à l'accent ── */
function CarteKpi({ icone, label, valeur, accent, aide }) {
  return (
    <article title={aide} style={{
      position: 'relative', background: '#fff', border: `1px solid ${T.ligne}`, borderRadius: 9,
      boxShadow: T.ombre, display: 'flex', alignItems: 'center', gap: 15,
      minHeight: 103, padding: '20px 17px 15px', overflow: 'hidden',
    }}>
      <span style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent }} />
      <i className={`ti ${icone}`} style={{ color: accent, fontSize: 29, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <h2 style={{ fontSize: 12, lineHeight: 1.3, minHeight: 16, fontWeight: 600, margin: '0 0 5px', color: T.ink }}>{label}</h2>
        <div style={{ fontSize: 29, lineHeight: 1.1, fontWeight: 750, letterSpacing: '-.6px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{valeur}</div>
      </div>
    </article>
  )
}

/* ── Pastille d'activité, au gabarit des statuts de la maquette ── */
const PASTILLES = {
  aujourdhui: ['#e6f9ec', '#118444'],
  hier:       ['#e3f2ff', '#007ad9'],
  semaine:    ['#fff1d4', '#b77410'],
  ancien:     ['#eaf0f7', '#58718f'],
}
function Activite({ dernier }) {
  let cle = 'ancien', texte = 'Aucun appel'
  if (dernier) {
    const j = Math.floor((Date.now() - new Date(dernier)) / 86400000)
    if (j <= 0) { cle = 'aujourdhui'; texte = "Actif aujourd'hui" }
    else if (j === 1) { cle = 'hier'; texte = 'Hier' }
    else if (j <= 7) { cle = 'semaine'; texte = `Il y a ${j} j` }
    else { cle = 'ancien'; texte = `Le ${fmtDate(dernier)}` }
  }
  const [fond, encre] = PASTILLES[cle]
  return <Pastille fond={fond} encre={encre} texte={texte} />
}
const Pastille = ({ fond, encre, texte }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: fond, color: encre, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 550, whiteSpace: 'nowrap' }}>
    <span style={{ height: 8, width: 8, background: 'currentColor', borderRadius: '50%' }} />{texte}
  </span>
)

const th = (num = false) => ({ textAlign: num ? 'right' : 'left', color: '#4c6487', fontSize: 12, fontWeight: 650, padding: '11px 13px', whiteSpace: 'nowrap' })
const td = (num = false) => ({ padding: '12px 13px', borderBottom: '1px solid #e9eff6', fontVariantNumeric: 'tabular-nums', textAlign: num ? 'right' : 'left' })
const tdMono = { ...td(true), fontFamily: MONO, fontSize: 13, whiteSpace: 'nowrap' }

/* ════════════════════════════ VUE ÉQUIPE ════════════════════════════ */
export function VueEquipe({ stats, heures, rappels, selection, onCollaborateur, onVoirRappels }) {
  const kpis = [
    { icone: 'ti-phone-incoming', label: 'Appels entrants',       valeur: fmtNb(stats.entrantsTotal), accent: '#00a2ee', aide: 'Appels entrants de la période et de la sélection.' },
    { icone: 'ti-phone-outgoing', label: 'Appels sortants',       valeur: fmtNb(stats.sortants),      accent: COULEURS.sortant, aide: 'Tentatives sortantes, y compris celles sans réponse.' },
    { icone: 'ti-circle-check',   label: 'Appels traités',        valeur: fmtNb(stats.traites),       accent: '#15ad64', aide: 'Entrants décrochés et sortants aboutis.' },
    { icone: 'ti-phone-off',      label: 'Entrants manqués',      valeur: fmtNb(stats.manques),       accent: '#ed4568', aide: 'Entrants non décrochés. Les re-sonneries d\'un même appel ne comptent qu\'une fois.' },
    { icone: 'ti-clock',          label: 'Temps de conversation', valeur: fmtHM(stats.secondes),      accent: '#009eee', aide: 'Temps parlé après connexion. Menu d\'accueil, messageries et bureau fermé exclus : personne n\'y parle.' },
    { icone: 'ti-headset',        label: 'Taux de décroché',      valeur: stats.decroche == null ? '—' : fmtPct(stats.entrants, stats.entrantsTotal), accent: '#159a55', aide: 'Entrants décrochés divisés par les entrants ; les sortants sont exclus.' },
  ]

  return (
    <>
      <section className="ap-kpis" aria-label="Indicateurs de la sélection">
        {kpis.map(k => <CarteKpi key={k.label} {...k} />)}
      </section>

      {/* ── Activité par collaborateur ── */}
      <div style={panneau}>
        <div style={{ padding: '17px 18px 12px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 22, letterSpacing: '-.4px', margin: 0, color: T.ink, fontWeight: 700 }}>Activité par collaborateur</h2>
          <p style={{ fontSize: 13, color: '#526d93', borderLeft: '1px solid #ccdaeb', margin: 0, paddingLeft: 18 }}>
            Volume, activité et temps de conversation
          </p>
        </div>

        <div style={{ overflowX: 'auto', padding: '0 5px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1020 }}>
            <thead>
              <tr>
                <th style={th()}>Collaborateur</th>
                <th style={th()}>Activité</th>
                <th style={th(true)}>Entrants</th>
                <th style={th(true)}>Sortants</th>
                <th style={th(true)}>Traités</th>
                <th style={th(true)}>Manqués</th>
                <th style={th(true)}>Temps parlé</th>
                <th style={th(true)}>Durée moy.</th>
                <th style={th(true)} title="Entrants décrochés ÷ entrants. Remplace « Occupation », qui exigerait les temps de présence de la téléphonie.">Décroché</th>
                <th style={th()} />
              </tr>
            </thead>
            <tbody>
              {!stats.parPersonne.length ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 35, color: '#617899' }}>Aucun appel rattaché à un poste sur cette sélection.</td></tr>
              ) : stats.parPersonne.map((p, i) => {
                const [fond, encre] = AVATARS[i % AVATARS.length]
                const choisi = selection === p.extension
                const faible = p.decroche != null && p.decroche < 0.8
                return (
                  <tr key={p.cle} onClick={() => onCollaborateur?.(p)}
                    style={{ cursor: 'pointer', background: choisi ? '#eaf8ff' : 'transparent' }}
                    onMouseEnter={e => { if (!choisi) e.currentTarget.style.background = '#f0f8fd' }}
                    onMouseLeave={e => { e.currentTarget.style.background = choisi ? '#eaf8ff' : 'transparent' }}>
                    <td style={{ ...td(), borderRadius: '4px 0 0 4px', boxShadow: choisi ? 'inset 3px 0 #00b4e8' : 'none' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap', fontWeight: 700 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 33, height: 30, borderRadius: 16, background: fond, color: encre, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {p.estService ? (p.extension || '?') : initiales(p.nom)}
                        </span>
                        <span>
                          {p.nom}
                          <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: T.muted }}>Poste {p.extension || '—'}</span>
                        </span>
                      </span>
                    </td>
                    <td style={td()}><Activite dernier={p.dernier} /></td>
                    <td style={td(true)}>{fmtNb(p.entrantsTotal)}</td>
                    <td style={td(true)}>{fmtNb(p.sortants)}</td>
                    <td style={td(true)}>{fmtNb(p.traites)}</td>
                    <td style={{ ...td(true), color: p.manques ? T.rouge : T.muted, fontWeight: p.manques ? 700 : 400 }}>{fmtNb(p.manques)}</td>
                    <td style={tdMono}>{fmtHM(p.secondes)}</td>
                    <td style={tdMono}>{fmtMS(p.moyenne)}</td>
                    <td style={td()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
                        <div style={{ height: 7, borderRadius: 20, width: 88, background: '#e7edf4', overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ height: '100%', width: `${(p.decroche || 0) * 100}%`, borderRadius: 20,
                            background: faible ? T.rouge : 'linear-gradient(90deg,#26be76,#77df69)' }} />
                        </div>
                        <span style={{ minWidth: 36, fontSize: 12, whiteSpace: 'nowrap', textAlign: 'right', color: faible ? T.rouge : T.ink, fontWeight: faible ? 700 : 400 }}>
                          {p.decroche == null ? '—' : fmtPct(p.entrants, p.entrantsTotal)}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...td(true), color: '#456d99' }}><i className="ti ti-chevron-right" style={{ fontSize: 16 }} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ margin: 0, padding: '10px 19px 14px', color: '#587298', fontSize: 12, lineHeight: 1.5 }}>
          Traités = entrants décrochés + sortants aboutis. « Manqués » concerne les entrants, re-sonneries d'un
          même appel déduites. Le temps de conversation exclut le menu d'accueil, les messageries et le bureau
          fermé. « Activité » se déduit du dernier appel : la présence en direct n'est pas remontée par 3CX.
        </p>
      </div>

      {/* ── Volume par heure + À surveiller ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.85fr) minmax(0,1fr)', gap: 17, marginTop: 18, alignItems: 'start' }}>
        <section style={panneau}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px 0', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 23, letterSpacing: '-.5px', margin: 0, color: T.ink, fontWeight: 700 }}>Volume par heure</h2>
            <div style={{ display: 'flex', gap: 17, fontSize: 12, color: '#3f5b80' }}>
              {[{ l: 'Entrants', c: '#00a2ee' }, { l: 'Sortants', c: COULEURS.sortant }].map(s => (
                <span key={s.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: s.c }} />{s.l}
                </span>
              ))}
            </div>
          </div>
          <div style={{ padding: '4px 15px 8px' }}>
            <BarresGroupees donnees={heures} hauteur={200}
              series={[{ cle: 'entrant', label: 'Entrants', couleur: '#00a2ee' }, { cle: 'sortant', label: 'Sortants', couleur: COULEURS.sortant }]} />
          </div>
        </section>

        <section style={{ ...panneau, padding: '13px 19px 17px' }}>
          <h2 style={{ fontSize: 23, letterSpacing: '-.5px', margin: 0, color: T.ink, fontWeight: 700 }}>À surveiller</h2>
          <p style={{ fontSize: 11, color: '#7d8ca1', margin: '2px 0 10px' }}>
            Calculé sur la période affichée · la file d'attente en direct n'est pas remontée par 3CX
          </p>
          <LigneSurveille icone="ti-phone-off" label="Personnes à rappeler"       valeur={fmtNb(rappels.length)} alerte />
          <LigneSurveille icone="ti-repeat"    label="Ont essayé 2 fois ou plus"  valeur={fmtNb(rappels.filter(r => r.tentatives > 1).length)} />
          <LigneSurveille icone="ti-moon"      label="Reçus bureau fermé"         valeur={fmtNb(stats.horsHoraires)} />
          <button onClick={onVoirRappels}
            style={{ width: '100%', marginTop: 13, minHeight: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              border: `1px solid ${T.bleu}`, borderRadius: 7, background: '#fff', color: '#0086d9', fontWeight: 650, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', padding: 4 }}>
            <i className="ti ti-calendar" style={{ fontSize: 17 }} />Voir les rappels
          </button>
        </section>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, fontSize: 11, color: '#7890ad', marginTop: 16, flexWrap: 'wrap' }}>
        <span>Cliquer sur un collaborateur pour consulter ses appels et ses durées.</span>
        <span>HUB DTX · téléphonie 3CX</span>
      </div>
    </>
  )
}

const LigneSurveille = ({ icone, label, valeur, alerte = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 6px', borderBottom: '1px solid #e4edf6', fontWeight: 600, fontSize: 13 }}>
    <i className={`ti ${icone}`} style={{ color: alerte ? '#d79412' : '#55759b', fontSize: 20, flexShrink: 0 }} />
    <span style={{ flex: 1 }}>{label}</span>
    <span style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 4, minWidth: 65, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
      background: alerte ? '#fff1d2' : '#e9f6ff', color: alerte ? '#a65a00' : T.ink }}>{valeur}</span>
  </div>
)

/* ════════════════════════════ RAPPELS ════════════════════════════ */
export function Rappels({ rappels, ouvrirFiche }) {
  const pastille = r => r.manque
    ? <Pastille fond="#fff0f1" encre="#c8475f" texte="Manqué" />
    : <Pastille fond="#f3ecff" encre="#6840af" texte="Bureau fermé" />

  return (
    <div style={panneau}>
      <div style={{ padding: '17px 18px 12px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 22, letterSpacing: '-.4px', margin: 0, color: T.ink, fontWeight: 700 }}>Suivi des rappels</h2>
        <span style={{ fontSize: 12, background: '#e4f4ff', color: '#0086c7', borderRadius: 20, padding: '3px 10px', fontWeight: 650 }}>
          {fmtNb(rappels.length)} à effectuer
        </span>
      </div>
      <p style={{ color: T.muted, fontSize: 12, padding: '0 19px 12px', margin: 0, lineHeight: 1.5 }}>
        Une ligne par personne : entrants manqués ou reçus bureau fermé, sans appel sortant vers ce numéro
        dans les 48 h. Déduit du journal — rien n'est coché à la main. Un appel sortant vers le numéro le
        fait disparaître de la liste au prochain chargement.
      </p>

      <div style={{ overflowX: 'auto', padding: '0 5px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
          <thead>
            <tr>
              <th style={th()}>Numéro</th>
              <th style={th()}>Interlocuteur</th>
              <th style={th(true)}>Tentatives</th>
              <th style={th()}>Motif</th>
              <th style={th()}>Dernier appel</th>
              <th style={th()}>Sur le poste</th>
              <th style={th()} />
            </tr>
          </thead>
          <tbody>
            {!rappels.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 35, color: '#617899' }}>Aucun rappel en attente sur cette sélection.</td></tr>
            ) : rappels.map(r => (
              <tr key={r.id} onClick={() => ouvrirFiche?.(r)} style={{ cursor: r.client_dossier ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (r.client_dossier) e.currentTarget.style.background = '#f0f8fd' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ ...td(), fontFamily: MONO, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.numero}</td>
                <td style={{ ...td(), color: r.contact ? T.ink : '#a9b8cc' }}>
                  {r.contact || 'Inconnu'}{r.client_dossier && <span style={{ color: T.muted, fontSize: 11 }}> · {r.client_dossier}</span>}
                </td>
                <td style={td(true)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 22, borderRadius: 4, fontSize: 12, fontWeight: 700,
                    background: r.tentatives > 2 ? '#fff0f1' : r.tentatives > 1 ? '#fff1d2' : '#eef4fa',
                    color: r.tentatives > 2 ? '#c8475f' : r.tentatives > 1 ? '#a65a00' : T.muted }}>{r.tentatives}</span>
                </td>
                <td style={td()}>{pastille(r)}</td>
                <td style={{ ...td(), fontFamily: MONO, fontSize: 13, whiteSpace: 'nowrap', color: '#415c80' }}>{fmtDT(r.debut)}</td>
                <td style={{ ...td(), color: '#415c80', whiteSpace: 'nowrap' }}>
                  {r.extension}{r.qui && r.qui !== `Poste ${r.extension}` ? ` · ${r.qui}` : ''}
                </td>
                <td style={{ ...td(true), color: '#456d99' }}>
                  {r.client_dossier && <i className="ti ti-external-link" style={{ fontSize: 15 }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
