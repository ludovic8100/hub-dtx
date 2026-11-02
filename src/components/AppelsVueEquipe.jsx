import { BarresGroupees, COULEURS } from './GraphAppels'

// Vue équipe et file des rappels — maquette Dynassur du 02/11/2026.
//
// Deux colonnes de la maquette ne sont pas alimentables et ont été remplacées
// par des équivalents de même poids visuel qui, eux, disent quelque chose de
// vrai :
//   « Statut » (Disponible / En appel / Pause) est de la présence temps réel.
//     `appels` est un journal d'appels terminés : aucune présence n'y figure,
//     et rien ne la pousse dans Supabase. → remplacé par « Activité »,
//     déduite de la date du dernier appel.
//   « Occupation » est temps parlé ÷ temps de présence. Le dénominateur
//     n'existe pas ; un mi-temps sortirait à 30 % sans que ça veuille dire
//     quoi que ce soit. → remplacé par le taux de décroché, même barre.
//
// Le panneau « À surveiller » perd de même les compteurs de file d'attente
// (profondeur, attente la plus longue), qui sont des valeurs vivantes
// qu'aucune colonne ne stocke.

const NAVY = '#0D2F5E'

const fmtNb = n => Number(n || 0).toLocaleString('fr-BE')
const fmtPct = (n, d) => d ? `${Math.round((n / d) * 100)} %` : '—'
const fmtHM = s => {
  if (!s) return '0 h 00'
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60)
  return `${h} h ${String(m).padStart(2, '0')}`
}
const fmtMS = s => s == null ? '—' : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' }) : '—'
const fmtDT = v => v ? new Date(v).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

const TEINTES = ['#dbeafe|#1d4ed8', '#ede9fe|#6d28d9', '#dcfce7|#15803d', '#ffedd5|#c2410c', '#fce7f3|#be185d', '#e0f2fe|#0369a1']
const initiales = nom => (nom || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map(m => m[0]).join('').toUpperCase()

/* ── Carte de chiffre, bordure haute colorée ── */
function CarteKpi({ icone, label, valeur, couleur, fond }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8edf4', borderTop: `3px solid ${couleur}`, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: fond, color: couleur, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`ti ${icone}`} style={{ fontSize: 18 }} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 2, lineHeight: 1.25 }}>{label}</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: '#0f172a', lineHeight: 1.05 }}>{valeur}</div>
      </div>
    </div>
  )
}

/* ── Pastille d'activité (ex-« Statut ») ── */
function Activite({ dernier }) {
  if (!dernier) return <Pastille c="#94a3b8" f="#f1f5f9" t="Aucun appel" />
  const j = Math.floor((Date.now() - new Date(dernier)) / 86400000)
  if (j <= 0) return <Pastille c="#15803d" f="#dcfce7" t="Actif aujourd'hui" />
  if (j === 1) return <Pastille c="#1d4ed8" f="#dbeafe" t="Hier" />
  if (j <= 7) return <Pastille c="#b45309" f="#fef3c7" t={`Il y a ${j} j`} />
  return <Pastille c="#64748b" f="#f1f5f9" t={`Le ${fmtDate(dernier)}`} />
}
const Pastille = ({ c, f, t }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: f, color: c, borderRadius: 20, padding: '3px 10px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{t}
  </span>
)

/* ════════════════════════════ VUE ÉQUIPE ════════════════════════════ */
export function VueEquipe({ stats, heures, rappels, onCollaborateur, onVoirRappels }) {
  const kpis = [
    { icone: 'ti-phone-incoming', label: 'Appels entrants',      valeur: fmtNb(stats.entrantsTotal), couleur: COULEURS.entrant, fond: '#e3f2fd' },
    { icone: 'ti-phone-outgoing', label: 'Appels sortants',      valeur: fmtNb(stats.sortants),      couleur: COULEURS.sortant, fond: '#dcfce7' },
    { icone: 'ti-circle-check',   label: 'Appels traités',       valeur: fmtNb(stats.traites),       couleur: '#16a34a',        fond: '#dcfce7' },
    { icone: 'ti-phone-off',      label: 'Entrants manqués',     valeur: fmtNb(stats.manques),       couleur: COULEURS.manque,  fond: '#fee2e2' },
    { icone: 'ti-clock',          label: 'Temps de conversation', valeur: fmtHM(stats.secondes),     couleur: '#0369a1',        fond: '#e0f2fe' },
    { icone: 'ti-headset',        label: 'Taux de décroché',     valeur: stats.decroche == null ? '—' : fmtPct(stats.entrants, stats.entrantsTotal), couleur: '#16a34a', fond: '#dcfce7' },
  ]

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(152px,1fr))', gap: 12, marginBottom: 18 }}>
        {kpis.map(k => <CarteKpi key={k.label} {...k} />)}
      </div>

      {/* ── Activité par collaborateur ── */}
      <section style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf4', padding: '18px 20px 14px', marginBottom: 18 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: NAVY, margin: 0, letterSpacing: '-0.015em' }}>Activité par collaborateur</h2>
          <span style={{ width: 1, height: 20, background: '#e2e8f0' }} />
          <span style={{ fontSize: 13.5, color: '#64748b' }}>Volume, activité et temps de conversation</span>
        </header>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                {['Collaborateur', 'Activité', 'Entrants', 'Sortants', 'Traités', 'Manqués', 'Temps parlé', 'Durée moy.', 'Décroché', ''].map((h, i) => (
                  <th key={i} style={{ padding: '0 12px 10px', fontSize: 12, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', textAlign: i >= 2 && i <= 7 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!stats.parPersonne.length ? (
                <tr><td colSpan={10} style={{ padding: 26, textAlign: 'center', color: '#94a3b8' }}>Aucun appel rattaché à un collaborateur sur la période.</td></tr>
              ) : stats.parPersonne.map((p, i) => {
                const [fond, encre] = TEINTES[i % TEINTES.length].split('|')
                const faible = p.decroche != null && p.decroche < 0.8
                return (
                  <tr key={p.cle} onClick={() => onCollaborateur?.(p)}
                    style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fbff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 31, height: 31, borderRadius: 9, background: fond, color: encre, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {p.estService ? (p.extension || '?') : initiales(p.nom)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{p.nom}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>Poste {p.extension || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 12px' }}><Activite dernier={p.dernier} /></td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNb(p.entrantsTotal)}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtNb(p.sortants)}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtNb(p.traites)}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.manques ? COULEURS.manque : '#94a3b8', fontWeight: p.manques ? 700 : 400 }}>{fmtNb(p.manques)}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtHM(p.secondes)}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtMS(p.moyenne)}</td>
                    <td style={{ padding: '11px 12px', minWidth: 132 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ flex: 1, height: 7, background: '#eef2f7', borderRadius: 4, overflow: 'hidden', minWidth: 52 }}>
                          <div style={{ width: `${(p.decroche || 0) * 100}%`, height: '100%', background: faible ? COULEURS.manque : '#16a34a', borderRadius: 4 }} />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: faible ? COULEURS.manque : '#334155', fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}>
                          {p.decroche == null ? '—' : fmtPct(p.entrants, p.entrantsTotal)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', color: '#cbd5e1' }}><i className="ti ti-chevron-right" style={{ fontSize: 16 }} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
          Traités = appels entrants décrochés + appels sortants aboutis. « Activité » se déduit du dernier
          appel : la présence en direct (disponible, en pause) n'est pas remontée par 3CX dans le Hub.
        </div>
      </section>

      {/* ── Volume par heure + À surveiller ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px,2fr) minmax(280px,1fr)', gap: 16, alignItems: 'start' }}>
        <section style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf4', padding: '18px 20px 16px' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: NAVY, margin: 0, letterSpacing: '-0.015em' }}>Volume par heure</h2>
            <div style={{ display: 'flex', gap: 14 }}>
              {[{ l: 'Entrants', c: COULEURS.entrant }, { l: 'Sortants', c: COULEURS.sortant }].map(s => (
                <span key={s.l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: s.c }} />{s.l}
                </span>
              ))}
            </div>
          </header>
          <BarresGroupees donnees={heures} hauteur={200}
            series={[{ cle: 'entrant', label: 'Entrants', couleur: COULEURS.entrant }, { cle: 'sortant', label: 'Sortants', couleur: COULEURS.sortant }]} />
        </section>

        <section style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf4', padding: '18px 20px' }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: NAVY, margin: '0 0 14px', letterSpacing: '-0.015em' }}>À surveiller</h2>
          <LigneSurveille icone="ti-phone-off" couleur="#dc2626" label="Personnes à rappeler" valeur={fmtNb(rappels.length)} fond="#fee2e2" />
          <LigneSurveille icone="ti-repeat"    couleur="#b45309" label="Ont essayé 2 fois ou plus" valeur={fmtNb(rappels.filter(r => r.tentatives > 1).length)} fond="#fef3c7" />
          <LigneSurveille icone="ti-moon"      couleur="#7c3aed" label="Reçus bureau fermé" valeur={fmtNb(stats.horsHoraires)} fond="#ede9fe" />
          <button onClick={onVoirRappels}
            style={{ width: '100%', marginTop: 14, padding: '11px 14px', borderRadius: 10, border: `1px solid ${COULEURS.entrant}`, background: '#fff', color: COULEURS.entrant, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <i className="ti ti-list-check" style={{ fontSize: 16 }} />Voir les rappels
          </button>
        </section>
      </div>
    </>
  )
}

const LigneSurveille = ({ icone, couleur, label, valeur, fond }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
    <span style={{ width: 32, height: 32, borderRadius: 9, background: fond, color: couleur, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <i className={`ti ${icone}`} style={{ fontSize: 17 }} />
    </span>
    <span style={{ flex: 1, fontSize: 13, color: '#334155' }}>{label}</span>
    <span style={{ background: fond, color: couleur, borderRadius: 7, padding: '3px 11px', fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{valeur}</span>
  </div>
)

/* ════════════════════════════ RAPPELS ════════════════════════════ */
export function Rappels({ rappels, ouvrirFiche }) {
  return (
    <section style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8edf4', padding: '18px 20px 14px' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: NAVY, margin: 0, letterSpacing: '-0.015em' }}>Rappels à effectuer</h2>
        <span style={{ width: 1, height: 20, background: '#e2e8f0' }} />
        <span style={{ fontSize: 13.5, color: '#64748b' }}>
          Une ligne par personne : entrants manqués ou reçus bureau fermé, sans appel sortant vers ce numéro dans les 48 h
        </span>
      </header>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>
        Déduit du journal : rien n'est coché à la main pour l'instant. Un appel sortant vers le numéro
        le fait disparaître de la liste au prochain chargement.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              {['Numéro', 'Contact', 'Tentatives', 'Motif', 'Dernier appel', 'Sur le poste', ''].map((h, i) => (
                <th key={i} style={{ padding: '0 12px 10px', fontSize: 12, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!rappels.length ? (
              <tr><td colSpan={7} style={{ padding: 26, textAlign: 'center', color: '#94a3b8' }}>Aucun rappel en attente sur la période.</td></tr>
            ) : rappels.map(r => (
              <tr key={r.id} onClick={() => ouvrirFiche?.(r)} style={{ borderTop: '1px solid #f1f5f9', cursor: r.client_dossier ? 'pointer' : 'default' }}
                onMouseEnter={e => { if (r.client_dossier) e.currentTarget.style.background = '#f8fbff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.numero}</td>
                <td style={{ padding: '10px 12px', color: r.contact ? '#1e293b' : '#cbd5e1' }}>
                  {r.contact || 'Inconnu'}{r.client_dossier && <span style={{ color: '#94a3b8', fontSize: 11 }}> · {r.client_dossier}</span>}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 26, height: 22, borderRadius: 7, fontSize: 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                    background: r.tentatives > 2 ? '#fee2e2' : r.tentatives > 1 ? '#fef3c7' : '#f1f5f9',
                    color: r.tentatives > 2 ? '#b91c1c' : r.tentatives > 1 ? '#b45309' : '#64748b' }}>{r.tentatives}</span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {r.manque
                    ? <Pastille c="#dc2626" f="#fee2e2" t="Manqué" />
                    : <Pastille c="#6d28d9" f="#ede9fe" t="Bureau fermé" />}
                </td>
                <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDT(r.debut)}</td>
                <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                  {r.extension}{r.qui && r.qui !== `Poste ${r.extension}` ? ` · ${r.qui}` : ''}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {r.client_dossier && <i className="ti ti-external-link" style={{ color: COULEURS.entrant }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
