import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from './Layout'
import { useAuth } from '../lib/auth'
import BlocComptes from './BlocComptes'
import { ENTITES } from '../lib/entites'
import { StatBanner, DataCard, StatusBadge } from './ui/AccountableUI'
import { COUL } from '../lib/theme'

// Tableau de bord type d'une société du groupe (DTX, LODE, Hexagroup, Privé).
// Remplace quatre pages identiques à la couleur et au code société près : toute
// correction faite ici vaut pour les quatre, au lieu d'être à refaire quatre fois.
//
// Dynassur garde sa propre page : son contenu (production, quittances) n'a rien
// de commun avec celui-ci.

const fmt = v => v == null ? '—' : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' }) : '—'

// Premier jour du mois en cours et premier jour du mois suivant, en ISO.
// On borne par « < premier du mois suivant » et jamais par « <= le 31 » :
// un 31 novembre n'existe pas et Postgres rejette la requête entière.
function borneesMoisCourant() {
  const now = new Date()
  const debut = new Date(now.getFullYear(), now.getMonth(), 1)
  const finExclue = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { debut: iso(debut), finExclue: iso(finExclue) }
}

function KpiCard({ label, value, icon, color, sub, onClick }) {
  return (
    <div onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
    <DataCard style={{ padding: 20, borderTop: `3px solid ${color}`, borderRadius: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: COUL.texteFaible, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: COUL.texteFort, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: COUL.texteFaible, marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ width: 44, height: 44, background: color + '18', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={'ti ' + icon} style={{ fontSize: 22, color }} />
        </div>
      </div>
    </DataCard>
    </div>
  )
}

export default function DashboardSociete({ entite, sousTitre }) {
  const E = ENTITES[entite]
  const societeCode = entite.toUpperCase()

  const { perms, user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  // null = la requête a échoué. On affiche « — » plutôt qu'un 0 rassurant et faux :
  // c'est exactement ce qui a laissé le bloc Trésorerie vide pendant des mois.
  const [txStats, setTxStats] = useState({ entrees: 0, sorties: 0 })
  const [loading, setLoading] = useState(true)

  const firstName = (perms?.nom || user?.user_metadata?.full_name || '').split(' ')[0]

  useEffect(() => {
    let annule = false

    async function load() {
      setLoading(true)
      const { debut, finExclue } = borneesMoisCourant()

      const [resTx, resTickets] = await Promise.all([
        chargerFluxDuMois(societeCode, debut, finExclue),
        // La table « taches » a ete renommee « tickets » le 02/11 : elle ne
        // portait plus que des tickets. La vue de compatibilite existe encore,
        // mais elle disparaitra — on vise la table.
        supabase.from('tickets')
          .select('id,titre,gestionnaire,ticket_statut,priorite,derniere_activite')
          .eq('is_ticket', true).neq('statut', 'terminee').eq('entite', entite)
          .order('derniere_activite', { ascending: false }).limit(50),
      ])

      if (annule) return
      if (resTickets.error) console.error(`[Dashboard ${societeCode}] tickets :`, resTickets.error)
      setTickets(resTickets.data || [])
      setTxStats(resTx)
      setLoading(false)
    }

    load()
    return () => { annule = true }
  }, [entite, societeCode])

  // Les transactions ne portent pas de société : le lien passe par le compte
  // bancaire (transactions.compte_id → comptes_bancaires.societe_id).
  async function chargerFluxDuMois(code, debut, finExclue) {
    const { data: soc, error: errSoc } = await supabase.from('societes').select('id').eq('code', code).maybeSingle()
    if (errSoc || !soc) {
      console.error(`[Dashboard ${code}] société introuvable :`, errSoc)
      return null
    }

    const { data: comptes, error: errCpt } = await supabase.from('comptes_bancaires')
      .select('id').eq('societe_id', soc.id).eq('actif', true)
    if (errCpt) {
      console.error(`[Dashboard ${code}] comptes bancaires :`, errCpt)
      return null
    }

    const ids = (comptes || []).map(c => c.id)
    if (ids.length === 0) return { entrees: 0, sorties: 0 }

    const { data: txs, error: errTx } = await supabase.from('transactions')
      .select('montant').in('compte_id', ids)
      .gte('date_valeur', debut).lt('date_valeur', finExclue)
    if (errTx) {
      console.error(`[Dashboard ${code}] transactions :`, errTx)
      return null
    }

    return {
      entrees: (txs || []).filter(t => t.montant > 0).reduce((s, t) => s + Number(t.montant), 0),
      sorties: (txs || []).filter(t => t.montant < 0).reduce((s, t) => s + Math.abs(Number(t.montant)), 0),
    }
  }

  const valFlux = cle => loading ? '…' : (txStats == null ? '—' : fmt(txStats[cle]))

  return (
    <Layout currentPage="Tableau de bord">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner
          color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
          title={`Bonjour ${firstName || ''}`.trim()}
          subtitle={sousTitre || `${E.label} — aperçu de l'activité`}
          stats={[
            { label: 'Tickets ouverts', value: loading ? '…' : tickets.length },
            { label: 'Entrées ce mois', value: valFlux('entrees') },
            { label: 'Sorties ce mois', value: valFlux('sorties') },
          ]}
        />

        <div style={{ marginBottom: 20 }} />

        {!loading && txStats == null && (
          <div style={{ marginBottom: 18, padding: '10px 14px', background: COUL.alerteFond, border: '1px solid #fcd34d', borderRadius: 9, fontSize: 12, color: COUL.alerteFonce, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-alert-triangle" style={{ fontSize: 15 }} />
            Les flux du mois n'ont pas pu être chargés — détail dans la console du navigateur.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
          <KpiCard label="Tickets ouverts" value={loading ? '…' : tickets.length} icon="ti-ticket" color="#0ea5e9" sub="cliquer pour voir" onClick={() => navigate('/tickets')} />
          <KpiCard label="Entrées ce mois" value={valFlux('entrees')} icon="ti-trending-up" color={COUL.succes} />
          <KpiCard label="Sorties ce mois" value={valFlux('sorties')} icon="ti-trending-down" color={COUL.danger} />
        </div>

        <div style={{ marginBottom: 22 }}>
          {isAdmin && <BlocComptes societeCode={societeCode} color={E.color} />}
        </div>

        <DataCard>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-ticket" style={{ fontSize: 15, color: '#0ea5e9' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: COUL.texteFort }}>Tickets ouverts</span>
            <span onClick={() => navigate('/tickets')} style={{ marginLeft: 'auto', fontSize: 12, color: '#0ea5e9', cursor: 'pointer', fontWeight: 600 }}>Tous les tickets →</span>
          </div>
          {loading
            ? <div style={{ padding: 30, textAlign: 'center', color: COUL.texteFaible }}>Chargement…</div>
            : tickets.length === 0
              ? <div style={{ padding: 30, textAlign: 'center', color: COUL.succes, fontSize: 13 }}>Aucun ticket ouvert</div>
              : <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {tickets.map((t, i) => (
                    <div key={t.id} onClick={() => navigate('/tickets?ticket=' + t.id)} style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, padding: '10px 18px', borderBottom: i < tickets.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: COUL.texte }}>#{t.id} — {t.titre || '—'}</div>
                        <div style={{ fontSize: 11, color: COUL.texteFaible }}>{t.gestionnaire || 'non assigné'} · {fmtDate(t.derniere_activite)}</div>
                      </div>
                      <StatusBadge tone="blue" label={t.ticket_statut || 'ouvert'} />
                    </div>
                  ))}
                </div>
          }
        </DataCard>
      </div>
    </Layout>
  )
}
