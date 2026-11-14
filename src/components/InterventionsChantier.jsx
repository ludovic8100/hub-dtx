// LES PASSAGES SUR UN CHANTIER — une ligne par personne et par déplacement.
//
// Remplace la saisie unique (heures / visites / taux) qui ne tenait pas debout
// face au cas décrit par Ludovic le 14/11/2026 :
//
//   « on peut très bien y retourner un autre jour. 4 h le mardi, il manque une
//     pièce, 4 h le vendredi »
//
// Le chantier ne portait QU'UN jeu de champs : le vendredi écrasait le mardi,
// deux personnes étaient impossibles, et « il manque une pièce » n'avait nulle
// part où aller.
//
// ⚠️ ON COMPTE DES JOURNÉES, PAS DES HEURES. Règle de Ludovic : « un style de
// forfait journée — 450 €/journée/homme pour 8 h de travail ». C'est ce que
// l'architecture prévoyait déjà sous le nom de « barème forfaitaire ». Saisir
// des heures et diviser par 8 serait un taux horaire déguisé.
//
// ⚠️ LE TRAJET SE COMPTE PAR PASSAGE. C'est tout l'enjeu de l'exemple :
// revenir parce qu'il manque une pièce, c'est un déplacement et un chargement
// de plus. Si on additionne simplement 4 + 4 = une journée, un chantier bien
// préparé et un chantier raté coûtent pareil, et la préparation ne rapporte
// rien de visible. Le nombre de lignes EST le nombre de trajets.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { COUL } from '../lib/theme'
import { useAuth } from '../lib/auth'
import { chargerIntervenants } from '../lib/collaborateurs'

const FONT = "'Source Sans Pro', system-ui, sans-serif"
const OR = '#ea580c'

const eur = n => n == null ? '—' : new Intl.NumberFormat('fr-BE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(n)
const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE', { weekday: 'short', day: '2-digit', month: '2-digit' }) : ''
const aujourdhui = () => new Date().toISOString().slice(0, 10)

const lbl = { display: 'block', fontSize: 10.5, fontWeight: 700, color: COUL.texteFaible, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }
const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13.5, fontFamily: FONT, background: COUL.surface, color: COUL.texteFort }

export default function InterventionsChantier({ dossier, onChange }) {
  const { perms, isAdmin } = useAuth() || {}
  const [lignes, setLignes] = useState([])
  const [gens, setGens] = useState([])
  const [bareme, setBareme] = useState(null)
  const [ouvert, setOuvert] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')

  const [f, setF] = useState({ date: aujourdhui(), qui: '', quantite: '1', km: '', note: '', termine: false })
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  const charger = useCallback(async () => {
    const [{ data: l, error }, { data: b }] = await Promise.all([
      supabase.from('dossier_interventions')
        .select('id,date,collaborateur_id,quantite,forfait_jour,note,trajet_km,termine,cree_par')
        .eq('dossier_id', dossier.id).order('date', { ascending: false }),
      supabase.from('ref_baremes_intervention')
        .select('code,libelle,forfait_jour').eq('actif', true).order('forfait_jour'),
    ])
    if (error) setErreur(`Lecture des passages — ${error.message}`)
    setLignes(l || [])
    setBareme((b || [])[0] || null)
  }, [dossier.id])

  useEffect(() => { charger() }, [charger])

  // Qui peut prester : les rattachés qui portent `installation` ou
  // `gestion_chantier`. Pas les commerciaux purs — LLO vend mais ne pose rien.
  useEffect(() => {
    let annule = false
    chargerIntervenants('LODE').then(d => { if (!annule) setGens(d) })
    return () => { annule = true }
  }, [])

  const nomDe = id => gens.find(g => String(g.id) === String(id))?.nom_complet || '—'

  const journees = lignes.reduce((s, l) => s + Number(l.quantite || 0), 0)
  const cout     = lignes.reduce((s, l) => s + Number(l.quantite || 0) * Number(l.forfait_jour || 0), 0)
  const km       = lignes.reduce((s, l) => s + Number(l.trajet_km || 0), 0)
  const fini     = lignes.some(l => l.termine)

  async function ajouter() {
    setErreur('')
    const q = Number(String(f.quantite).replace(',', '.'))
    if (!Number.isFinite(q) || q <= 0) { setErreur('La durée doit être 1 (journée) ou 0,5 (demi-journée).'); return }
    if (!f.qui) { setErreur('Indique qui a presté.'); return }

    setOccupe(true)
    const { error } = await supabase.from('dossier_interventions').insert({
      dossier_id: dossier.id,
      societe: dossier.societe || 'LODE',
      date: f.date || aujourdhui(),
      collaborateur_id: Number(f.qui),
      quantite: q,
      // ⚠️ FIGÉ À LA SAISIE, jamais relu du barème à l'affichage. Augmenter le
      // tarif l'an prochain ne doit pas changer la marge d'un chantier de
      // cette année — même règle que l'ancien taux horaire.
      forfait_jour: bareme?.forfait_jour ?? null,
      bareme_code: bareme?.code ?? null,
      note: f.note.trim() || null,
      trajet_km: f.km.trim() ? Number(f.km.replace(',', '.')) : null,
      termine: f.termine,
      cree_par: perms?.code || null,
    })
    setOccupe(false)
    if (error) { setErreur(`Enregistrement refusé — ${error.message}`); return }
    setF({ date: aujourdhui(), qui: '', quantite: '1', km: '', note: '', termine: false })
    await charger(); onChange?.()
  }

  async function retirer(l) {
    if (!window.confirm(`Retirer le passage du ${fmtDate(l.date)} (${l.quantite} j) ?`)) return
    const { error } = await supabase.from('dossier_interventions').delete().eq('id', l.id)
    if (error) { setErreur(`Suppression refusée — ${error.message}`); return }
    await charger(); onChange?.()
  }

  return (
    <div style={{ padding: '2px 20px 14px' }}>
      {/* Le résumé, calculé et jamais saisi. */}
      <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginBottom: 10 }}>
        {lignes.length === 0
          ? <span style={{ color: COUL.texteFaible }}>Aucun passage enregistré.</span>
          : <>
              <strong>{lignes.length}</strong> passage{lignes.length > 1 ? 's' : ''} ·{' '}
              <strong>{journees.toString().replace('.', ',')}</strong> journée{journees > 1 ? 's' : ''}-homme ·{' '}
              <strong style={{ color: COUL.texteFort }}>{eur(cout)}</strong>
              {km > 0 && <> · {km} km</>}
              {fini && <span style={{ color: COUL.succes, fontWeight: 700 }}> · chantier terminé</span>}
            </>}
      </div>

      {lignes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {lignes.map(l => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ width: 88, fontSize: 12, color: COUL.texteDoux, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {fmtDate(l.date)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COUL.texteFort }}>
                  {nomDe(l.collaborateur_id)}
                  <span style={{ fontWeight: 400, color: COUL.texteDoux }}>
                    {' · '}{String(l.quantite).replace('.', ',').replace(/,?0+$/, '')} j
                    {l.trajet_km ? ` · ${l.trajet_km} km` : ''}
                  </span>
                  {l.termine && <span style={{ marginLeft: 6, fontSize: 11, color: COUL.succes, fontWeight: 700 }}>terminé</span>}
                </div>
                {l.note && <div style={{ fontSize: 12, color: COUL.texteDoux, marginTop: 1 }}>{l.note}</div>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: COUL.texteFort, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {eur(Number(l.quantite) * Number(l.forfait_jour || 0))}
              </div>
              {isAdmin && (
                <button onClick={() => retirer(l)} title="Retirer ce passage"
                  style={{ border: 'none', background: 'none', color: COUL.texteFaible, cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px', fontFamily: FONT }}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {!ouvert && (
        <button onClick={() => setOuvert(true)} style={{
          border: `1px solid ${OR}`, background: COUL.surface, color: OR, borderRadius: 7,
          padding: '6px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
        }}>+ Ajouter un passage</button>
      )}

      {ouvert && (
        <div style={{ background: COUL.fond, borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 130px' }}>
              <label style={lbl}>Date</label>
              <input type="date" value={f.date} onChange={e => set('date', e.target.value)} style={{ ...inp, width: '100%' }} />
            </div>
            <div style={{ flex: '2 1 180px' }}>
              <label style={lbl}>Qui a presté</label>
              <select value={f.qui} onChange={e => set('qui', e.target.value)} style={{ ...inp, width: '100%' }}>
                <option value="">—</option>
                {gens.filter(g => g.id != null).map(g => (
                  <option key={g.id} value={g.id}>{g.nom_complet}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: '1 1 130px' }}>
              <label style={lbl}>Durée</label>
              <select value={f.quantite} onChange={e => set('quantite', e.target.value)} style={{ ...inp, width: '100%' }}>
                <option value="1">Journée</option>
                <option value="0.5">Demi-journée</option>
              </select>
            </div>
            <div style={{ flex: '1 1 110px' }}>
              <label style={lbl}>Trajet (km)</label>
              <input value={f.km} onChange={e => set('km', e.target.value)} inputMode="decimal"
                placeholder="aller-retour" style={{ ...inp, width: '100%' }} />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={lbl}>Remarque</label>
            <input value={f.note} onChange={e => set('note', e.target.value)}
              placeholder="ex. il manquait une pièce, retour prévu vendredi" style={{ ...inp, width: '100%' }} />
          </div>

          {/* La fin du chantier se coche SUR LE PASSAGE qu'on saisit déjà,
              plutôt que d'ajouter un champ sur le chantier. Un mécanisme qui
              n'a de valeur que si quelqu'un pense à un geste de plus est un
              mécanisme qui tombera. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: COUL.texteFort, cursor: 'pointer' }}>
            <input type="checkbox" checked={f.termine} onChange={e => set('termine', e.target.checked)} />
            Le chantier est terminé après ce passage
          </label>

          <div style={{ fontSize: 11.5, color: COUL.texteFaible, marginTop: 10, lineHeight: 1.5, background: COUL.fondDoux, borderRadius: 8, padding: '8px 10px' }}>
            {bareme
              ? <>Forfait appliqué : <strong>{eur(bareme.forfait_jour)}</strong> par journée et par personne.
                  Il est <strong>figé sur ce passage</strong> — changer le barème plus tard ne modifiera
                  pas ce chantier. Le barème se règle dans <strong>Paramètres</strong>.</>
              : <span style={{ color: COUL.danger }}>Aucun barème actif : le coût restera à zéro.</span>}
          </div>

          {erreur && (
            <div style={{ fontSize: 12.5, color: COUL.dangerFonce, background: COUL.dangerFondDoux, borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
              {erreur}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button onClick={() => { setOuvert(false); setErreur('') }} style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: COUL.surface,
              color: COUL.texteDoux, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              Annuler
            </button>
            <button onClick={ajouter} disabled={occupe} style={{
              padding: '7px 12px', borderRadius: 8, border: 'none', background: OR, color: COUL.blanc,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, opacity: occupe ? 0.6 : 1 }}>
              {occupe ? 'Enregistrement…' : 'Enregistrer le passage'}
            </button>
          </div>
        </div>
      )}

      {erreur && !ouvert && (
        <div style={{ fontSize: 12.5, color: COUL.dangerFonce, marginTop: 8 }}>{erreur}</div>
      )}
    </div>
  )
}
