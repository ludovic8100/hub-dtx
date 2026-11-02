import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Carte « Téléphonie 3CX » de l'écran Synchronisations.
//
// Elle appelle /api/3cx/diagnostic, qui interroge le central et rapporte ce
// qu'il expose réellement. Remplace le passage par la console du navigateur :
// personne ne devrait avoir à coller du code pour tester une connexion.
//
// La fonction serveur exige une session Supabase ; on la récupère ici plutôt
// que de la faire chercher à la main dans le stockage du navigateur.

const NAVY = '#0D2F5E'

const btn = (principal = false) => ({
  display: 'inline-flex', alignItems: 'center', gap: 7,
  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
  fontFamily: 'inherit', cursor: 'pointer',
  border: `1px solid ${principal ? NAVY : '#e2e8f0'}`,
  background: principal ? NAVY : '#fff',
  color: principal ? '#fff' : '#334155',
})

export default function Diagnostic3cx() {
  const [etat, setEtat] = useState('repos')   // repos | encours | fini
  const [rapport, setRapport] = useState(null)
  const [erreur, setErreur] = useState(null)

  const tester = async () => {
    setEtat('encours'); setErreur(null); setRapport(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error("Session introuvable. Déconnectez-vous et reconnectez-vous, puis réessayez.")
      }
      const r = await fetch('/api/3cx/diagnostic', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const txt = await r.text()
      let j
      try { j = JSON.parse(txt) } catch { throw new Error(`Réponse inattendue du serveur (HTTP ${r.status}) : ${txt.slice(0, 120)}`) }
      setRapport(j)
    } catch (e) {
      setErreur(e.message || String(e))
    }
    setEtat('fini')
  }

  const copier = () => navigator.clipboard?.writeText(JSON.stringify(rapport, null, 2))

  return (
    <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 800, color: NAVY, margin: 0 }}>Téléphonie 3CX</h2>
          <p style={{ fontSize: 11.5, color: '#94a3b8', margin: '3px 0 0', lineHeight: 1.5 }}>
            Jusqu'ici, 3CX écrit dans le Hub mais le Hub n'interroge jamais le central. Ce test
            ouvre le sens inverse et dit ce que votre installation expose réellement — c'est ce
            qui décidera si la présence en direct et la file d'attente sont réalisables.
          </p>
        </div>
        <button onClick={tester} disabled={etat === 'encours'} style={{ ...btn(true), opacity: etat === 'encours' ? 0.6 : 1 }}>
          <i className="ti ti-plug-connected" style={{ fontSize: 15 }} />
          {etat === 'encours' ? 'Test en cours…' : 'Tester la connexion'}
        </button>
      </div>

      {etat === 'encours' && (
        <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 12 }}>
          Interrogation du central… cela peut prendre une dizaine de secondes.
        </p>
      )}

      {erreur && (
        <div style={{ marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '11px 14px', fontSize: 12.5, color: '#991b1b' }}>
          {erreur}
        </div>
      )}

      {rapport && <Rapport r={rapport} onCopier={copier} />}
    </section>
  )
}

function Rapport({ r, onCopier }) {
  // Trois issues possibles : pas configuré, identifiants refusés, ou ça marche.
  if (r.configure === false) {
    return (
      <Bloc fond="#fffbeb" bord="#fde68a" encre="#92400e" titre="3CX n'est pas configuré">
        <p style={{ margin: 0 }}>{r.message}</p>
      </Bloc>
    )
  }

  if (r.authentifie === false) {
    return (
      <Bloc fond="#fef2f2" bord="#fecaca" encre="#991b1b" titre="Le central répond, mais refuse les identifiants">
        <p style={{ margin: '0 0 8px' }}>
          Bonne nouvelle : l'adresse est correcte et le central est joignable. Seule
          l'authentification échoue.
        </p>
        <p style={{ margin: '0 0 10px', fontFamily: 'monospace', fontSize: 11.5 }}>{r.erreur}</p>
        <b style={{ display: 'block', marginBottom: 6 }}>À vérifier, dans cet ordre :</b>
        <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          {(r.pistes || []).map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      </Bloc>
    )
  }

  const ok = (r.resultats || []).filter(x => x.repond)
  return (
    <Bloc fond="#f0fdf4" bord="#bbf7d0" encre="#166534"
      titre={`Connexion établie — ${ok.length} point${ok.length > 1 ? 's' : ''} d'accès sur ${(r.resultats || []).length}`}>
      <p style={{ margin: '0 0 10px' }}>
        Authentification acceptée{r.modeAuth ? ` (mode « ${r.modeAuth} »)` : ''}.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          {(r.resultats || []).map(x => (
            <tr key={x.chemin} style={{ borderTop: '1px solid rgba(22,101,52,.15)' }}>
              <td style={{ padding: '6px 8px 6px 0', width: 18 }}>
                <i className={`ti ${x.repond ? 'ti-circle-check' : 'ti-circle-x'}`}
                  style={{ color: x.repond ? '#16a34a' : '#94a3b8', fontSize: 15 }} />
              </td>
              <td style={{ padding: '6px 8px 6px 0' }}>{x.pour}</td>
              <td style={{ padding: '6px 0', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>
                {x.repond ? (x.forme?.lignes != null ? `${x.forme.lignes} ligne(s)` : 'OK') : `HTTP ${x.status || '—'}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onCopier} style={{ ...btn(), marginTop: 12 }}>
        <i className="ti ti-copy" style={{ fontSize: 14 }} />Copier le rapport détaillé
      </button>
      <p style={{ margin: '8px 0 0', fontSize: 11.5 }}>
        Collez-le dans la conversation : il dit précisément quelles colonnes de la maquette
        deviennent alimentables.
      </p>
    </Bloc>
  )
}

const Bloc = ({ fond, bord, encre, titre, children }) => (
  <div style={{ marginTop: 12, background: fond, border: `1px solid ${bord}`, borderRadius: 9, padding: '12px 15px', fontSize: 12.5, color: encre, lineHeight: 1.55 }}>
    <b style={{ display: 'block', marginBottom: 6 }}>{titre}</b>
    {children}
  </div>
)
