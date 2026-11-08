import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { COUL } from '../../lib/theme'
import {
  AMBIANCES, ambianceEffective, dansLaFenetre, reglesEcrites, appliquer,
} from '../../lib/themes'

// L'ambiance du Hub — un réglage de GROUPE.
//
// Règle donnée par Ludovic le 08/11 : « c'est un admin qui change pour tout
// le monde ». Il n'y a donc aucun choix par utilisateur, et le sélecteur a
// quitté l'en-tête. Cet écran est la seule commande.
//
// DEUX FAÇONS DE CHOISIR, ET UNE SEULE GAGNE
//
//   • Imposer une ambiance — les dates sont ignorées.
//   • Suivre le calendrier — chaque saison a sa fenêtre de dates.
//
// La base garantit qu'il n'y a jamais deux ambiances imposées à la fois
// (index unique partiel) : le code n'a donc pas à départager.

const FONT = "'Source Sans Pro', sans-serif"
const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
// Année non bissextile : le 29 février ferait une borne fantôme 3 ans sur 4.
const JOURS_MAX = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const carte = {
  background: COUL.surface, border: `1px solid ${COUL.bord}`,
  borderRadius: 10, padding: '14px 16px', marginBottom: 10,
}
const selStyle = {
  padding: '6px 8px', border: `1px solid ${COUL.bordFort}`, borderRadius: 7,
  fontSize: 13.5, fontFamily: FONT, background: COUL.surface, color: COUL.texte,
}

function Vignette({ code, taille = 74 }) {
  const a = AMBIANCES[code]
  if (!a) return null
  return (
    <div style={{
      width: taille, height: Math.round(taille * 0.56), flexShrink: 0,
      borderRadius: 7, border: `1px solid ${COUL.bord}`,
      backgroundImage: `url('${a.couverture}')`, backgroundSize: 'cover', backgroundPosition: 'center',
    }} />
  )
}

export default function GestionAmbiances() {
  const [lignes, setLignes] = useState([])
  const [edits, setEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [flash, setFlash] = useState(null)
  const [busy, setBusy] = useState(false)

  function notify(m) { setFlash(m); setTimeout(() => setFlash(null), 3200) }

  async function charger() {
    const { data, error } = await supabase.from('ref_ambiances').select('*').order('ordre')
    if (error) { setErreur(error.message); setLoading(false); return }
    setErreur(null)
    setLignes(data || [])
    setEdits({})
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const val = (l, k) => (edits[l.code] && k in edits[l.code]) ? edits[l.code][k] : l[k]
  const modifie = (code, k, v) => setEdits(p => ({ ...p, [code]: { ...p[code], [k]: v } }))
  const CHAMPS = ['actif', 'forcee', 'debut_mois', 'debut_jour', 'fin_mois', 'fin_jour']
  const estModifie = (l) => CHAMPS.some(k => val(l, k) !== l[k])

  // L'état projeté tient compte des modifications NON ENREGISTRÉES : on veut
  // voir l'effet avant de cliquer, pas après.
  const projetees = lignes.map(l => Object.fromEntries(
    [['code', l.code], ...CHAMPS.map(k => [k, val(l, k)])]
  ))
  const imposee = projetees.find(p => p.forcee)
  const effective = ambianceEffective(new Date(), projetees)
  const nbActives = projetees.filter(p => p.actif && p.code !== 'standard').length

  /** Imposer une ambiance : une seule à la fois, la base le garantit aussi. */
  function imposer(code) {
    lignes.forEach(l => modifie(l.code, 'forcee', l.code === code))
  }
  function suivreLeCalendrier() {
    lignes.forEach(l => modifie(l.code, 'forcee', false))
  }

  // Deux saisons actives sur un même jour : la première de la liste gagne.
  // Ce n'est pas une erreur, mais sans le dire on cherche longtemps pourquoi
  // Halloween ne sort jamais.
  const chevauchements = []
  for (let i = 0; i < projetees.length; i++) {
    for (let j = i + 1; j < projetees.length; j++) {
      const a = projetees[i], b = projetees[j]
      if (!a.actif || !b.actif || a.code === 'standard' || b.code === 'standard') continue
      let croise = false
      for (let m = 1; m <= 12 && !croise; m++) {
        for (let d = 1; d <= JOURS_MAX[m - 1]; d++) {
          if (dansLaFenetre(a, m, d) && dansLaFenetre(b, m, d)) { croise = true; break }
        }
      }
      if (croise) chevauchements.push([a.code, b.code])
    }
  }

  async function enregistrer() {
    setBusy(true)
    // Les lignes « forcée = faux » d'abord : l'index unique partiel refuse
    // deux lignes forcées, même une demi-seconde. Lever avant de poser.
    const aEcrire = lignes.filter(estModifie).map(l => ({
      code: l.code,
      actif: !!val(l, 'actif'),
      forcee: !!val(l, 'forcee'),
      debut_mois: val(l, 'debut_mois') || null,
      debut_jour: val(l, 'debut_jour') || null,
      fin_mois: val(l, 'fin_mois') || null,
      fin_jour: val(l, 'fin_jour') || null,
      maj_le: new Date().toISOString(),
    })).sort((a, b) => Number(a.forcee) - Number(b.forcee))

    let faute = null
    for (const { code, ...champs } of aEcrire) {
      const { error } = await supabase.from('ref_ambiances').update(champs).eq('code', code)
      if (error) { faute = error.message; break }
    }
    setBusy(false)
    if (faute) { notify(`Échec : ${faute}`); return }

    // Le cache sert le prochain chargement — y compris la page de garde, qui
    // ne peut pas lire la base. On l'écrit ici et on applique tout de suite.
    reglesEcrites(projetees)
    appliquer(projetees)
    notify(`Enregistré. Tout le groupe verra « ${AMBIANCES[effective]?.label} » au prochain chargement.`)
    charger()
  }

  const nbModifiees = lignes.filter(estModifie).length

  if (loading) return <div style={{ padding: 20, color: COUL.texteDoux, fontFamily: FONT }}>Chargement…</div>

  if (erreur) return (
    <div style={{ ...carte, borderColor: COUL.dangerBord, background: COUL.dangerFondDoux, fontFamily: FONT }}>
      <b style={{ color: COUL.dangerFonce }}>Le réglage n'est pas lisible</b>
      <p style={{ margin: '6px 0 0', fontSize: 13.5, color: COUL.texteSombre }}>{erreur}</p>
      <p style={{ margin: '8px 0 0', fontSize: 12.5, color: COUL.texteDoux }}>
        La table <code>ref_ambiances</code> vient de la migration
        <code> 20261108090000_ref_ambiances.sql</code>. Si elle n'est pas appliquée
        sur cette base, cet écran ne peut rien afficher.
      </p>
    </div>
  )

  return (
    <div style={{ fontFamily: FONT, maxWidth: 860 }}>

      <p style={{ fontSize: 13.5, color: COUL.texteDoux, margin: '0 0 4px', lineHeight: 1.55 }}>
        L'ambiance du Hub, pour <b>tout le groupe</b>. Il n'y a pas de choix individuel :
        ce qui est réglé ici s'applique à tout le monde.
      </p>
      <p style={{ fontSize: 12.5, color: COUL.texteFaible, margin: '0 0 18px', lineHeight: 1.5 }}>
        Le changement est visible au prochain chargement de page de chacun.
      </p>

      {/* Ce que tout le monde voit */}
      <div style={{
        ...carte, display: 'flex', alignItems: 'center', gap: 14,
        background: COUL.fond, borderColor: COUL.bordFort,
      }}>
        <Vignette code={effective} taille={108} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: COUL.texteDoux, letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>
            Ce que tout le monde voit
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: COUL.texteFort, marginTop: 2 }}>
            <span aria-hidden="true" style={{ color: COUL.saison, marginRight: 7 }}>{AMBIANCES[effective]?.symbole}</span>
            {AMBIANCES[effective]?.label || effective}
          </div>
          <div style={{ fontSize: 12.5, color: COUL.texteFaible, marginTop: 3 }}>
            {imposee ? 'Imposée par un administrateur.'
              : nbActives === 0 ? 'Calendrier éteint — aucune saison active.'
              : `Par le calendrier (${nbActives} saison${nbActives > 1 ? 's' : ''} active${nbActives > 1 ? 's' : ''}).`}
          </div>
        </div>
      </div>

      {/* Comment on choisit */}
      <div style={{ display: 'flex', gap: 10, margin: '16px 0 10px', flexWrap: 'wrap' }}>
        {[
          ['imposer', 'Imposer une ambiance', 'Les dates sont ignorées.'],
          ['calendrier', 'Suivre le calendrier', 'Les dates ci-dessous décident.'],
        ].map(([cle, titre, sous]) => {
          const choisi = cle === 'imposer' ? !!imposee : !imposee
          return (
            <button key={cle} onClick={() => cle === 'imposer' ? imposer('standard') : suivreLeCalendrier()}
              style={{
                flex: '1 1 240px', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
                background: choisi ? COUL.infoFondDoux : COUL.surface,
                border: `2px solid ${choisi ? COUL.bleu : COUL.bord}`,
                borderRadius: 10, padding: '12px 14px',
              }}>
              <div style={{ fontSize: 14.5, fontWeight: 650, color: COUL.texteFort }}>{titre}</div>
              <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 2 }}>{sous}</div>
            </button>
          )
        })}
      </div>

      {/* Imposer : la galerie des cinq */}
      {imposee && (
        <div style={{ ...carte }}>
          <div style={{ fontSize: 13, fontWeight: 650, color: COUL.texteSombre, marginBottom: 10 }}>
            Quelle ambiance imposer ?
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {lignes.map(l => {
              const choisi = val(l, 'forcee')
              return (
                <button key={l.code} onClick={() => imposer(l.code)}
                  style={{
                    cursor: 'pointer', fontFamily: FONT, padding: 6, borderRadius: 10,
                    background: choisi ? COUL.infoFondDoux : 'transparent',
                    border: `2px solid ${choisi ? COUL.bleu : COUL.bord}`,
                  }}>
                  <Vignette code={l.code} taille={104} />
                  <div style={{ fontSize: 12.5, fontWeight: choisi ? 700 : 500, color: COUL.texteSombre, marginTop: 5 }}>
                    <span aria-hidden="true" style={{ marginRight: 4 }}>{AMBIANCES[l.code]?.symbole}</span>
                    {l.libelle}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Calendrier : les fenêtres de dates */}
      {!imposee && (
        <>
          {chevauchements.length > 0 && (
            <div style={{ ...carte, background: COUL.alerteFondDoux, borderColor: COUL.alerteVif }}>
              <b style={{ fontSize: 13.5, color: COUL.alerteFonce }}>Deux saisons se chevauchent</b>
              <p style={{ margin: '5px 0 0', fontSize: 13, color: COUL.texteSombre, lineHeight: 1.5 }}>
                {chevauchements.map(([a, b]) => `${AMBIANCES[a]?.label} et ${AMBIANCES[b]?.label}`).join(' ; ')}.
                Ce n'est pas bloquant — <b>la première de la liste gagne</b> sur les jours communs —
                mais l'autre ne sortira jamais ces jours-là.
              </p>
            </div>
          )}

          {lignes.filter(l => l.code !== 'standard').map(l => {
            const actif = !!val(l, 'actif')
            return (
              <div key={l.code} style={{
                ...carte,
                borderColor: estModifie(l) ? COUL.bleu : COUL.bord,
                opacity: actif ? 1 : 0.7,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Vignette code={l.code} />
                  <div style={{ minWidth: 110, flex: '1 1 120px', fontSize: 15, fontWeight: 650, color: COUL.texteFort }}>
                    <span aria-hidden="true" style={{ marginRight: 6 }}>{AMBIANCES[l.code]?.symbole}</span>
                    {l.libelle}
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={actif}
                      onChange={e => modifie(l.code, 'actif', e.target.checked)} />
                    Active
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <span style={{ color: COUL.texteDoux }}>du</span>
                    <select style={selStyle} value={val(l, 'debut_jour') || 1}
                      onChange={e => modifie(l.code, 'debut_jour', Number(e.target.value))}>
                      {Array.from({ length: JOURS_MAX[(val(l, 'debut_mois') || 1) - 1] }, (_, i) => i + 1)
                        .map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select style={selStyle} value={val(l, 'debut_mois') || 1}
                      onChange={e => modifie(l.code, 'debut_mois', Number(e.target.value))}>
                      {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <span style={{ color: COUL.texteDoux }}>au</span>
                    <select style={selStyle} value={val(l, 'fin_jour') || 1}
                      onChange={e => modifie(l.code, 'fin_jour', Number(e.target.value))}>
                      {Array.from({ length: JOURS_MAX[(val(l, 'fin_mois') || 1) - 1] }, (_, i) => i + 1)
                        .map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select style={selStyle} value={val(l, 'fin_mois') || 1}
                      onChange={e => modifie(l.code, 'fin_mois', Number(e.target.value))}>
                      {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )
          })}

          <p style={{ fontSize: 12, color: COUL.texteFaible, margin: '0 0 4px', lineHeight: 1.55 }}>
            Une saison peut enjamber le Nouvel An (du 27 déc. au 6 janv.) — c'est prévu.
            Décocher toutes les saisons éteint le calendrier <b>sans perdre les dates</b>.
          </p>
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
        <button onClick={enregistrer} disabled={busy || nbModifiees === 0}
          style={{
            padding: '10px 18px', borderRadius: 8, border: 'none', fontFamily: FONT,
            background: nbModifiees === 0 ? COUL.bordFort : COUL.bleu, color: COUL.blanc,
            fontSize: 14, fontWeight: 650, cursor: nbModifiees === 0 ? 'default' : 'pointer',
          }}>
          {busy ? 'Enregistrement…' : nbModifiees === 0 ? 'Rien à enregistrer' : 'Appliquer à tout le groupe'}
        </button>
        {nbModifiees > 0 && (
          <button onClick={() => setEdits({})} style={{
            padding: '10px 14px', borderRadius: 8, fontFamily: FONT,
            background: 'transparent', border: `1px solid ${COUL.bordFort}`,
            color: COUL.texteDoux, fontSize: 13.5, cursor: 'pointer',
          }}>Annuler</button>
        )}
        {flash && <span style={{ fontSize: 13.5, color: COUL.texteSombre }}>{flash}</span>}
      </div>
    </div>
  )
}
