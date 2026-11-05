// Affichage et saisie d'une fiche d'intermédiation Vie.
//
// Le composant ne connaît aucune question : il rend ce que src/lib/fichesVie.js
// décrit. Ajouter une question à la fiche papier, c'est l'ajouter là-bas, pas ici.
//
// Les réponses pré-remplies sont marquées « proposé » : le conseiller voit
// d'un coup d'œil ce qui vient du contrat et ce qu'il a validé lui-même.

import { useState } from 'react'

const C = {
  bleu: '#1A3A6B', bleuClair: '#eff6ff, #e2f1fa', bord: '#dce4ec',
  texte: '#0f1826', gris: '#56677c', grisClair: '#8c9cb0',
  orange: '#b45309', orangeFond: '#fffaf0', orangeBord: '#f0c478',
}

export default function FicheVieFormulaire({ fiche, reponses, onChange, proposees = {} }) {
  if (!fiche) return null
  return (
    <div>
      <Coordonnees fiche={fiche} reponses={reponses} onChange={onChange} proposees={proposees} />
      {(fiche.entete || []).map(q => (
        <Question key={q.id} q={q} reponses={reponses} onChange={onChange} proposees={proposees} />
      ))}
      {(fiche.parties || []).map(partie => (
        <Partie key={partie.id} partie={partie} reponses={reponses} onChange={onChange} proposees={proposees} />
      ))}
    </div>
  )
}

function Coordonnees({ fiche, reponses, onChange, proposees }) {
  return (
    <section style={carte}>
      <h3 style={titreSection}>{fiche.coordonnees.titre}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
        {fiche.coordonnees.champs.map(c => (
          <label key={c.id} style={{ display: 'block' }}>
            <span style={etiquette}>{c.libelle}</span>
            <input value={reponses?.[c.id] ?? ''} onChange={e => onChange(c.id, e.target.value)}
              style={{ ...champ, borderColor: proposees[c.id] !== undefined ? '#93c5fd' : C.bord }} />
          </label>
        ))}
      </div>
    </section>
  )
}

function Partie({ partie, reponses, onChange, proposees }) {
  const [ouvert, setOuvert] = useState(true)
  return (
    <section style={{ ...carte, padding: 0, overflow: 'hidden' }}>
      <button onClick={() => setOuvert(!ouvert)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px',
        background: '#f7fafc', border: 'none', borderBottom: ouvert ? `1px solid ${C.bord}` : 'none',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}>
        <i className={`ti ti-chevron-${ouvert ? 'down' : 'right'}`} style={{ color: C.grisClair, fontSize: 14 }} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.bleu, flex: 1 }}>{partie.titre}</span>
      </button>
      {ouvert && (
        <div style={{ padding: '12px 14px 16px' }}>
          {partie.avertissement && (
            <p style={{ fontSize: 11.5, lineHeight: 1.5, color: C.orange, background: C.orangeFond,
                        border: `1px solid ${C.orangeBord}`, borderRadius: 7, padding: '7px 9px', margin: '0 0 10px' }}>
              {partie.avertissement}
            </p>
          )}
          {partie.intro && <p style={intro}>{partie.intro}</p>}
          {(partie.notes || []).map((n, i) => <p key={i} style={{ ...intro, fontSize: 11 }}>{n}</p>)}
          {(partie.sections || []).map(section => (
            <div key={section.id} style={{ marginBottom: 14 }}>
              {section.titre && <h4 style={titreSousSection}>{section.titre}</h4>}
              {section.intro && <p style={intro}>{section.intro}</p>}
              {(section.questions || []).map(q => (
                <Question key={q.id} q={q} reponses={reponses} onChange={onChange} proposees={proposees} />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Question({ q, reponses, onChange, proposees }) {
  const v = reponses?.[q.id]
  const propose = proposees[q.id] !== undefined
    && JSON.stringify(proposees[q.id]) === JSON.stringify(v)

  const entete = (
    <>
      {q.sousTitre && <div style={{ fontSize: 12.5, fontWeight: 700, color: C.bleu, margin: '10px 0 4px' }}>{q.sousTitre}</div>}
      {q.libelle && (
        <div style={{ fontSize: 12.5, color: C.texte, marginBottom: 5, lineHeight: 1.45 }}>
          {q.libelle}
          {propose && <Badge />}
        </div>
      )}
    </>
  )

  if (q.type === 'radio' || q.type === 'check') {
    const choisies = q.type === 'radio' ? (v != null ? [v] : []) : (Array.isArray(v) ? v : [])
    const bascule = (opt) => {
      if (q.type === 'radio') onChange(q.id, v === opt ? null : opt)
      else onChange(q.id, choisies.includes(opt) ? choisies.filter(x => x !== opt) : [...choisies, opt])
    }
    return (
      <div style={{ marginBottom: 12 }}>
        {entete}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {(q.opts || []).map(opt => {
            const sel = choisies.includes(opt)
            return (
              <label key={opt} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 9px', borderRadius: 6,
                cursor: 'pointer', background: sel ? '#eff6ff' : 'transparent',
                border: sel ? '1px solid #93c5fd' : '1px solid transparent',
                fontSize: 12, color: sel ? '#1e40af' : C.gris, fontWeight: sel ? 600 : 400, lineHeight: 1.45,
              }}>
                <input type={q.type === 'radio' ? 'radio' : 'checkbox'} name={q.id} checked={sel}
                  onChange={() => bascule(opt)} style={{ accentColor: C.bleu, marginTop: 2, flexShrink: 0 }} />
                <span>{opt}</span>
              </label>
            )
          })}
        </div>
        {q.precision && choisies.includes(q.precision) && (
          <input placeholder="Précisez…" value={reponses?.[`${q.id}__precision`] ?? ''}
            onChange={e => onChange(`${q.id}__precision`, e.target.value)}
            style={{ ...champ, marginTop: 6 }} />
        )}
      </div>
    )
  }

  if (q.type === 'table') return <Tableau q={q} v={v} onChange={onChange} propose={propose} entete={entete} />

  if (q.type === 'zone') {
    return (
      <div style={{ marginBottom: 12 }}>
        {entete}
        <textarea value={v ?? ''} onChange={e => onChange(q.id, e.target.value)} rows={q.lignes || 2}
          style={{ ...champ, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>
    )
  }

  const suffixe = q.type === 'montant' ? 'EUR' : q.type === 'pourcentage' ? '%' : null
  return (
    <div style={{ marginBottom: 10 }}>
      {entete}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <input value={v ?? ''} onChange={e => onChange(q.id, e.target.value)}
          placeholder={q.aide || ''} style={{ ...champ, flex: 1 }} />
        {suffixe && <span style={{ fontSize: 12, color: C.gris, fontWeight: 600 }}>{suffixe}</span>}
      </div>
    </div>
  )
}

function Tableau({ q, v, onChange, propose, entete }) {
  const valeurs = v || {}
  const lignes = q.lignes || Array.from({ length: q.lignesLibres || 0 }, (_, i) => `(libre ${i + 1})`)
  const maj = (ligne, col, val) => {
    const copie = { ...valeurs, [ligne]: { ...(valeurs[ligne] || {}), [col]: val } }
    onChange(q.id, copie)
  }
  return (
    <div style={{ marginBottom: 14 }}>
      {entete}
      {q.titreTable && <div style={{ fontSize: 12, fontWeight: 700, color: C.bleu, margin: '6px 0' }}>{q.titreTable}</div>}
      <div style={{ overflowX: 'auto', border: `1px solid ${C.bord}`, borderRadius: 7 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: '#f7fafc' }}>
              <th style={th}>{q.enTeteLigne || 'Produit / catégorie'}</th>
              {(q.colonnes || []).map(c => <th key={c} style={{ ...th, textAlign: 'center', width: 95 }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne, i) => {
              if (ligne && typeof ligne === 'object' && ligne.titre) {
                return (
                  <tr key={`t${i}`}><td colSpan={(q.colonnes || []).length + 1}
                    style={{ ...td, fontWeight: 700, background: '#f8fafc' }}>{ligne.titre}</td></tr>
                )
              }
              const nom = String(ligne)
              return (
                <tr key={nom + i}>
                  <td style={td}>{nom}</td>
                  {(q.colonnes || []).map(col => (
                    <td key={col} style={{ ...td, textAlign: 'center' }}>
                      {col.toLowerCase().startsWith('volume') ? (
                        <input value={valeurs[nom]?.[col] ?? ''} onChange={e => maj(nom, col, e.target.value)}
                          style={{ ...champ, width: 78, padding: '3px 5px', fontSize: 11 }} />
                      ) : (
                        <input type="checkbox" checked={!!valeurs[nom]?.[col]}
                          onChange={e => maj(nom, col, e.target.checked)} style={{ accentColor: C.bleu }} />
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const Badge = () => (
  <span style={{
    marginLeft: 7, fontSize: 9.5, fontWeight: 700, color: '#1e40af', background: '#eff6ff',
    border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 5px', verticalAlign: 1,
  }}>proposé</span>
)

const carte = { background: '#fff', border: `1px solid ${C.bord}`, borderRadius: 10, padding: 14, marginBottom: 12 }
const titreSection = { fontSize: 14, fontWeight: 700, color: C.bleu, margin: '0 0 10px' }
const titreSousSection = { fontSize: 13, fontWeight: 700, color: C.bleu, margin: '12px 0 6px' }
const intro = { fontSize: 11.5, color: C.gris, lineHeight: 1.5, margin: '0 0 8px' }
const etiquette = { display: 'block', fontSize: 11, color: C.grisClair, fontWeight: 600, marginBottom: 3 }
const champ = {
  width: '100%', padding: '6px 9px', borderRadius: 6, border: `1px solid ${C.bord}`,
  fontSize: 12.5, color: C.texte, fontFamily: 'inherit', boxSizing: 'border-box',
}
const th = { textAlign: 'left', fontSize: 10, fontWeight: 700, color: C.grisClair, padding: '7px 8px',
             borderBottom: `1px solid ${C.bord}`, textTransform: 'uppercase', letterSpacing: '.04em' }
const td = { padding: '6px 8px', borderBottom: `1px solid #f1f5f9`, color: C.texte, lineHeight: 1.4 }
