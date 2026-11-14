// LES DOCUMENTS D'UN CHANTIER — dépôt, liste et aperçu au survol.
//
// Trois demandes de Ludovic du 14/11/2026, dans ses mots :
//
//   « ajouter un document qui est sur mon disque dur (le bon de commande du
//     fournisseur, le devis du fournisseur, les fiches techniques, les QR codes
//     qui servent à connecter le moteur…) »
//   « avoir un dossier rien qu'avec ces documents »
//   « passer avec ma souris dessus et voir apparaître le devis, la facture »
//
// Le fichier part dans SharePoint — `ADMINISTRATION/LODE_CHANTIERS/<numéro> -
// <client>/` — et le Hub n'en garde que l'adresse et une vignette. Une seule
// copie : deux copies du même PDF, dont une annotée, et plus personne ne sait
// laquelle fait foi.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { COUL } from '../lib/theme'
import { useAuth } from '../lib/auth'
import { fichiersDeEvenement, trierFichiers, vignetteDe, envoyerParMorceaux, EXT_ACCEPTEES } from '../lib/depot'

const FONT = "'Source Sans Pro', system-ui, sans-serif"
const OR = '#ea580c'
const BUCKET = 'chantiers-vignettes'

const ko = (n) => n == null ? '' : n < 1024 * 1024
  ? `${Math.round(n / 1024)} Ko` : `${(n / (1024 * 1024)).toFixed(1)} Mo`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''

export default function DocumentsChantier({ dossier }) {
  // ⚠️ `perms` et non `collaborateur` : c'est le nom que le contexte expose
  // (voir la valeur du Provider dans `src/lib/auth.jsx`). Une propriété
  // inexistante rend `undefined` sans rien dire — ni le build ni `no-undef`
  // ne l'attrapent, contrairement à une variable absente.
  const { isAdmin, perms } = useAuth() || {}
  const [docs, setDocs] = useState([])
  const [charge, setCharge] = useState(true)
  const [survol, setSurvol] = useState(false)
  const [enCours, setEnCours] = useState([])      // [{ nom, pct }]
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const inputRef = useRef(null)
  const zoneRef = useRef(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from('dossier_documents')
      .select('id,nom,sharepoint_url,taille,type_mime,vignette_path,note,depose_par,created_at')
      .eq('dossier_id', dossier.id).order('created_at', { ascending: false })
    if (error) setErreur(`Lecture des documents — ${error.message}`)
    setDocs(data || []); setCharge(false)
  }, [dossier.id])

  useEffect(() => { charger() }, [charger])

  // ⚠️ LE COLLER EST ÉCOUTÉ SUR LA FENÊTRE, pas sur la zone.
  //
  // C'est le repli du cas Outlook, et il ne doit pas exiger d'avoir cliqué au
  // bon endroit avant. Mais on ne le capte QUE si le panneau est ouvert et
  // qu'on n'est pas en train de taper dans un champ — sinon coller du texte
  // dans la note déclencherait un dépôt.
  useEffect(() => {
    const surColler = (e) => {
      const cible = e.target
      if (cible?.closest?.('input, textarea, [contenteditable]')) return
      const { fichiers, message: m } = fichiersDeEvenement(e)
      if (fichiers.length) { e.preventDefault(); deposer(fichiers) }
      else if (m) setMessage(m)
    }
    window.addEventListener('paste', surColler)
    return () => window.removeEventListener('paste', surColler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossier.id])

  async function deposer(liste) {
    setErreur(''); setMessage('')
    const { ok, refuses } = trierFichiers(liste)
    if (refuses.length) {
      setMessage(refuses.map(r => `« ${r.nom} » : ${r.raison}`).join(' · '))
    }
    if (!ok.length) return

    setEnCours(ok.map(f => ({ nom: f.name, pct: 0 })))
    for (const f of ok) {
      try {
        // 1. Le serveur crée le dossier et ouvre la session. Il ne voit jamais
        //    le fichier : Vercel plafonne à 4,5 Mo de corps de requête.
        const r = await fetch('/api/chantier-document', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero: dossier.numero, client: dossier.client_nom,
            fichier: f.name, taille: f.size,
          }),
        })
        const prep = await r.json()
        if (!r.ok) throw new Error(prep?.erreur || `Préparation refusée (${r.status})`)

        // 2. Le navigateur envoie directement à SharePoint, par morceaux.
        const item = await envoyerParMorceaux(prep.uploadUrl, f, (p) =>
          setEnCours(l => l.map(x => x.nom === f.name ? { ...x, pct: p } : x)))

        // 3. La vignette, qui ne doit jamais faire échouer le dépôt.
        let vignette = null
        const v = await vignetteDe(f)
        if (v) {
          const chemin = `${dossier.id}/${crypto.randomUUID()}.webp`
          const { error: eV } = await supabase.storage.from(BUCKET).upload(chemin, v, { upsert: false })
          if (!eV) vignette = chemin
        }

        // 4. La métadonnée. Le fichier est déjà en sécurité dans SharePoint :
        //    si cette ligne échoue, on le dit, mais rien n'est perdu.
        const { error: eI } = await supabase.from('dossier_documents').insert({
          dossier_id: dossier.id,
          societe: dossier.societe || 'LODE',
          nom: item?.name || f.name,
          sharepoint_item_id: item?.id || null,
          sharepoint_url: item?.webUrl || null,
          taille: f.size, type_mime: f.type || null,
          vignette_path: vignette,
          depose_par: perms?.code || null,
        })
        if (eI) throw new Error(`Fichier envoyé, mais non référencé — ${eI.message}`)
      } catch (e) {
        setErreur(`« ${f.name} » — ${e?.message || e}`)
      } finally {
        setEnCours(l => l.filter(x => x.nom !== f.name))
      }
    }
    await charger()
  }

  async function supprimer(d) {
    if (!isAdmin) return
    if (!window.confirm(`Retirer « ${d.nom} » de ce chantier ?\n\nLe fichier reste dans SharePoint — seule la fiche du Hub est retirée.`)) return
    const { error } = await supabase.from('dossier_documents').delete().eq('id', d.id)
    if (error) { setErreur(`Suppression refusée — ${error.message}`); return }
    if (d.vignette_path) await supabase.storage.from(BUCKET).remove([d.vignette_path])
    await charger()
  }

  return (
    <div
      ref={zoneRef}
      onDragOver={e => { e.preventDefault(); setSurvol(true) }}
      onDragLeave={e => { if (!zoneRef.current?.contains(e.relatedTarget)) setSurvol(false) }}
      onDrop={e => {
        e.preventDefault(); setSurvol(false)
        const { fichiers, message: m } = fichiersDeEvenement(e)
        if (fichiers.length) deposer(fichiers)
        else if (m) setMessage(m)
      }}
      style={{
        border: `2px dashed ${survol ? OR : '#e2e8f0'}`,
        background: survol ? '#fff7ed' : 'transparent',
        borderRadius: 10, padding: 12, transition: 'background .12s, border-color .12s',
      }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, color: COUL.texteDoux }}>
          Glisse tes fichiers ici, <strong>colle-les (Ctrl+V)</strong>, ou{' '}
          <button type="button" onClick={() => inputRef.current?.click()}
            style={{ border: 'none', background: 'none', padding: 0, color: OR, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, textDecoration: 'underline' }}>
            choisis-les
          </button>.
        </div>
        <input ref={inputRef} type="file" multiple accept={EXT_ACCEPTEES} style={{ display: 'none' }}
          onChange={e => { deposer(Array.from(e.target.files || [])); e.target.value = '' }} />
      </div>

      {enCours.map(x => (
        <div key={x.nom} style={{ fontSize: 12, color: COUL.texteDoux, marginBottom: 6 }}>
          {x.nom} — {Math.round(x.pct * 100)} %
          <div style={{ height: 3, background: '#e2e8f0', borderRadius: 2, marginTop: 3 }}>
            <div style={{ height: 3, width: `${x.pct * 100}%`, background: OR, borderRadius: 2, transition: 'width .2s' }} />
          </div>
        </div>
      ))}

      {message && (
        <div style={{ fontSize: 12.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginBottom: 8, lineHeight: 1.45 }}>
          {message}
        </div>
      )}
      {erreur && (
        <div style={{ fontSize: 12.5, color: COUL.dangerFonce, background: COUL.dangerFondDoux, borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
          {erreur}
        </div>
      )}

      {charge && <div style={{ fontSize: 12.5, color: COUL.texteFaible }}>Chargement…</div>}
      {!charge && docs.length === 0 && !enCours.length && (
        <div style={{ fontSize: 12.5, color: COUL.texteFaible, padding: '6px 0' }}>
          Aucun document. Bon de commande, devis fournisseur, fiche technique, QR du moteur…
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {docs.map(d => (
          <LigneDocument key={d.id} doc={d} isAdmin={isAdmin} onSupprimer={() => supprimer(d)} />
        ))}
      </div>
    </div>
  )
}

/** Une ligne, et son aperçu au survol. */
function LigneDocument({ doc, isAdmin, onSupprimer }) {
  const [apercu, setApercu] = useState(null)
  const [dessus, setDessus] = useState(false)

  // ⚠️ L'URL signée n'est demandée QU'AU PREMIER SURVOL, et gardée ensuite.
  // Les demander toutes au chargement ferait autant d'appels que de documents
  // pour des aperçus que personne n'ouvrira peut-être.
  useEffect(() => {
    if (!dessus || apercu || !doc.vignette_path) return
    let vivant = true
    supabase.storage.from(BUCKET).createSignedUrl(doc.vignette_path, 3600)
      .then(({ data }) => { if (vivant && data?.signedUrl) setApercu(data.signedUrl) })
    return () => { vivant = false }
  }, [dessus, apercu, doc.vignette_path])

  return (
    <div
      onMouseEnter={() => setDessus(true)}
      onMouseLeave={() => setDessus(false)}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 7, background: dessus ? COUL.fond : 'transparent' }}>

      <a href={doc.sharepoint_url || '#'} target="_blank" rel="noreferrer"
        style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COUL.texteFort, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {doc.nom}
        </div>
        <div style={{ fontSize: 11, color: COUL.texteFaible }}>
          {ko(doc.taille)}{doc.depose_par ? ` · ${doc.depose_par}` : ''} · {fmtDate(doc.created_at)}
          {!doc.vignette_path && ' · sans aperçu'}
        </div>
      </a>

      {isAdmin && dessus && (
        <button onClick={onSupprimer} title="Retirer du chantier"
          style={{ border: '1px solid #e2e8f0', background: COUL.surface, color: COUL.danger, borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
          Retirer
        </button>
      )}

      {/* L'aperçu. Positionné à droite et au-dessus pour ne pas recouvrir la
          ligne survolée — sinon le pointeur sort de la ligne, l'aperçu
          disparaît, le pointeur revient : l'image clignote. */}
      {dessus && apercu && (
        <div style={{
          position: 'absolute', left: '100%', top: -8, marginLeft: 10, zIndex: 50,
          background: COUL.surface, border: '1px solid #e2e8f0', borderRadius: 10,
          padding: 6, boxShadow: '0 12px 36px rgba(0,0,0,.18)', pointerEvents: 'none',
        }}>
          <img src={apercu} alt="" style={{ display: 'block', width: 260, borderRadius: 6 }} />
        </div>
      )}
    </div>
  )
}
