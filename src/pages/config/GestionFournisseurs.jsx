import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

// ─── Fournisseurs ──────────────────────────────────────────────────────────
//
// Onglet de Paramètres, aux côtés des catégories. Ce n'est PAS un outil : le
// menu Outils sert à gagner du temps ou à produire une analyse pour un client
// (recherche BCE, questionnaire investisseur, simulateur successoral). Une
// table de référence partagée n'y a rien à faire — elle se configure.
//
// Les fiches sont créées automatiquement à partir de ce qui est lu dans les
// PDF, groupées par numéro de TVA. Une seule chose est saisie à la main, et
// aucune machine ne devrait la deviner : le NOM COURT.
//
//   « Radius Business Solutions (Belgium) NV »  →  « Radius »
//
// C'est lui qui servira à nommer les fichiers. Un nom d'usage est un choix
// humain : « Partena Professional » s'appelle « Partena » pour tout le monde
// ici, et aucune règle de troncature ne le trouverait.
//
// Le classement par volume n'est pas cosmétique : 25 fournisseurs couvrent la
// moitié des factures. Annoter dans cet ordre, c'est s'arrêter quand ça ne
// rapporte plus.

const fmt = n => (n ?? 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export default function GestionFournisseurs() {
  const [lignes, setLignes]   = useState(null)
  const [erreur, setErreur]   = useState(null)
  const [q, setQ]             = useState('')
  const [filtre, setFiltre]   = useState('a_nommer')   // a_nommer | tous | nommes
  const [edition, setEdition] = useState({})           // id -> valeur en cours de frappe
  const [sauve, setSauve]     = useState({})           // id -> 'en_cours' | 'ok' | 'erreur'

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('v_fournisseurs_usage')
      .select('*')
      .order('nb_factures', { ascending: false })
      .limit(1000)
    if (error) { setErreur(error); return }
    setLignes(data || [])
  }, [])

  useEffect(() => { charger() }, [charger])

  async function enregistrer(id, valeur) {
    const propre = (valeur || '').trim()
    setSauve(s => ({ ...s, [id]: 'en_cours' }))
    const { error } = await supabase
      .from('fournisseurs')
      .update({ nom_court: propre || null, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      setSauve(s => ({ ...s, [id]: 'erreur' }))
      setErreur(error)
      return
    }
    setLignes(ls => ls.map(l => l.id === id ? { ...l, nom_court: propre || null } : l))
    setEdition(e => { const c = { ...e }; delete c[id]; return c })
    setSauve(s => ({ ...s, [id]: 'ok' }))
    setTimeout(() => setSauve(s => { const c = { ...s }; delete c[id]; return c }), 1500)
  }

  const visibles = useMemo(() => {
    if (!lignes) return []
    const t = q.trim().toLowerCase()
    return lignes.filter(l => {
      if (filtre === 'a_nommer' && l.nom_court) return false
      if (filtre === 'nommes'   && !l.nom_court) return false
      if (!t) return true
      return (l.nom_officiel || '').toLowerCase().includes(t)
          || (l.nom_court || '').toLowerCase().includes(t)
          || (l.tva || '').toLowerCase().includes(t)
    })
  }, [lignes, q, filtre, edition])

  const nommes = (lignes || []).filter(l => l.nom_court).length
  const total  = (lignes || []).length
  // Ce que les noms déjà saisis couvrent en volume de factures — la seule
  // mesure qui dise s'il reste du travail utile.
  const couv = total
    ? Math.round(100 * (lignes.filter(l => l.nom_court).reduce((s, l) => s + l.nb_factures, 0))
                     / Math.max(1, lignes.reduce((s, l) => s + l.nb_factures, 0)))
    : 0

  const Onglet = ({ v, libelle }) => (
    <button onClick={() => setFiltre(v)}
      style={{ padding: '7px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
               border: '1px solid ' + (filtre === v ? '#1A3A6B' : '#e2e8f0'),
               background: filtre === v ? '#1A3A6B' : '#fff',
               color: filtre === v ? '#fff' : '#64748b' }}>{libelle}</button>
  )

  if (lignes === null) {
    return <div style={{ padding: 28, color: '#94a3b8', fontSize: 13 }}>Chargement des fournisseurs…</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Fournisseurs</div>
          <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>
            Donnez un nom court à chaque fournisseur — c'est lui qui nommera les fichiers
          </div>
        </div>
        <button onClick={charger} style={{ padding: '7px 13px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Rafraîchir</button>
      </div>

      {erreur && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '11px 15px', marginBottom: 12, color: '#991b1b', fontSize: 13 }}>
          {erreur.message || String(erreur)}
        </div>
      )}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 15px', marginBottom: 14, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
        <b>{nommes} / {total}</b> fournisseurs nommés — ils couvrent <b>{couv} %</b> de tes factures.
        {couv < 80 && <> Les premiers de la liste sont les plus rentables à traiter : inutile d'aller jusqu'au bout.</>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Onglet v="a_nommer" libelle={`À nommer (${total - nommes})`} />
        <Onglet v="nommes"   libelle={`Nommés (${nommes})`} />
        <Onglet v="tous"     libelle={`Tous (${total})`} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un fournisseur, un n° de TVA…"
          style={{ flex: 1, minWidth: 190, padding: '8px 11px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
      </div>

      {!visibles.length && (
        <div style={{ padding: 36, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          {filtre === 'a_nommer' ? 'Tout est nommé.' : 'Aucun fournisseur ne correspond.'}
        </div>
      )}

      {visibles.map(l => {
        const enCours = edition[l.id] !== undefined
        const valeur  = enCours ? edition[l.id] : (l.nom_court || '')
        const etat    = sauve[l.id]
        return (
          <div key={l.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 13px',
                                   borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: '#1e293b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.nom_officiel}
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                {l.nb_factures} facture{l.nb_factures > 1 ? 's' : ''} · {fmt(Number(l.montant_total))}
                {l.tva ? <> · {l.tva}</> : <> · <span style={{ color: '#b45309' }}>pas de n° TVA</span></>}
                {l.nb_alias > 1 && <> · {l.nb_alias} libellés</>}
              </div>
            </div>

            <input
              value={valeur}
              placeholder="Nom court…"
              onChange={e => setEdition(ed => ({ ...ed, [l.id]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') enregistrer(l.id, valeur); if (e.key === 'Escape') setEdition(ed => { const c = { ...ed }; delete c[l.id]; return c }) }}
              onBlur={() => { if (enCours && valeur !== (l.nom_court || '')) enregistrer(l.id, valeur) }}
              style={{ width: 170, padding: '7px 10px', borderRadius: 8, fontSize: 13,
                       border: '1px solid ' + (etat === 'erreur' ? '#fecaca' : enCours ? '#1A3A6B' : '#e2e8f0'),
                       background: etat === 'ok' ? '#f0fdf4' : '#fff' }}
            />
            <div style={{ width: 18, fontSize: 14, color: etat === 'ok' ? '#16a34a' : '#cbd5e1' }}>
              {etat === 'en_cours' ? '…' : etat === 'ok' ? '✓' : etat === 'erreur' ? '!' : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
