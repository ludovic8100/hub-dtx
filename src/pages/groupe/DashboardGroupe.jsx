import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const SOCIETES = [
  { key: 'DYNASSUR', label: 'Dynassur SRL', color: '#0080BD', colorLight: '#e0f2fe', logo: '/logo_dynassur.png' },
  { key: 'DTX',      label: 'DTX SRL',      color: '#94a3b8', colorLight: '#f8fafc', logo: '/logo_dtx.png' },
  { key: 'LODE',     label: 'LODE SRL',     color: '#ea580c', colorLight: '#fff7ed', logo: '/logo_lode.png' },
]

function formatMontant(val) {
  if (val === null || val === undefined) return '—'
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val)
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '10px',
      border: '1px solid #e2e8f0',
      padding: '16px 20px',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardGroupe() {
  const [comptes, setComptes] = useState([])
  const [taches, setTaches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: comptesData }, { data: tachesData }] = await Promise.all([
        supabase.from('comptes_bancaires').select('societe_id, nom, solde_actuel, devise, iban').order('societe_id'),
        supabase.from('taches').select('statut, gestionnaire, created_at, echeance, titre, categorie').in('statut', ['en_cours', 'en_attente', 'retard']),
      ])
      setComptes(comptesData || [])
      setTaches(tachesData || [])
      setLoading(false)
    }
    load()
  }, [])

  // Solde total par société
  const soldeParSociete = SOCIETES.map(s => {
    const comptesSoc = comptes.filter(c => c.societe_id === s.key)
    const total = comptesSoc.reduce((acc, c) => acc + (c.solde_actuel || 0), 0)
    return { ...s, comptes: comptesSoc, total }
  })

  const soldeTotal = soldeParSociete.reduce((acc, s) => acc + s.total, 0)

  // Tâches en retard
  const now = new Date()
  const tachesRetard = taches.filter(t => t.echeance && new Date(t.echeance) < now)
  const tachesEnCours = taches.filter(t => !t.echeance || new Date(t.echeance) >= now)

  const f = { fontFamily: "'Source Sans Pro', sans-serif" }

  if (loading) return (
    <Layout currentPage="Tableau de bord général">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#94a3b8' }}>
        Chargement...
      </div>
    </Layout>
  )

  return (
    <Layout currentPage="Tableau de bord général">
      <div style={{ ...f, maxWidth: '1200px' }}>

        {/* Titre */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>
            Tableau de bord général
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Finances et tâches — toutes entités confondues
          </p>
        </div>

        {/* KPI ligne */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '32px' }}>
          <StatCard label="Trésorerie totale" value={formatMontant(soldeTotal)} color="#7c3aed" />
          <StatCard label="Comptes actifs" value={comptes.length} color="#0080BD" sub="toutes sociétés" />
          <StatCard label="Tâches en cours" value={tachesEnCours.length} color="#f59e0b" />
          <StatCard label="Tâches en retard" value={tachesRetard.length} color="#dc2626" sub={tachesRetard.length > 0 ? '⚠️ action requise' : '✓ aucun retard'} />
        </div>

        {/* Comptes bancaires par société */}
        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 14px' }}>
            Comptes bancaires
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {soldeParSociete.map(s => (
              <div key={s.key} style={{
                background: '#fff', borderRadius: '12px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
              }}>
                {/* Header société */}
                <div style={{
                  padding: '12px 16px',
                  background: s.color,
                  display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                  <img src={s.logo} alt={s.label} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  <div>
                    <div style={{ color: '#fff', fontWeight: '700', fontSize: '13px' }}>{s.label}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', color: '#fff', fontWeight: '800', fontSize: '16px' }}>
                    {formatMontant(s.total)}
                  </div>
                </div>

                {/* Liste des comptes */}
                <div style={{ padding: '8px 0' }}>
                  {s.comptes.length === 0 ? (
                    <div style={{ padding: '12px 16px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                      Aucun compte synchronisé
                    </div>
                  ) : (
                    s.comptes.map((c, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 16px',
                        borderBottom: i < s.comptes.length - 1 ? '1px solid #f1f5f9' : 'none'
                      }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{c.nom}</div>
                          {c.iban && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.iban.replace(/(.{4})/g, '$1 ').trim()}</div>}
                        </div>
                        <div style={{
                          fontSize: '14px', fontWeight: '700',
                          color: (c.solde_actuel || 0) >= 0 ? '#16a34a' : '#dc2626'
                        }}>
                          {formatMontant(c.solde_actuel)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tâches par société */}
        <section>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 14px' }}>
            Tâches en cours & en retard
          </h2>

          {taches.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0',
              padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px'
            }}>
              Aucune tâche en cours
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {/* Header tableau */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px',
                padding: '10px 16px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '11px', fontWeight: '700', color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                <div>Tâche</div>
                <div>Assigné à</div>
                <div>Échéance</div>
                <div>Statut</div>
              </div>

              {taches.map((t, i) => {
                const estRetard = t.echeance && new Date(t.echeance) < now
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 120px 120px 100px',
                    padding: '10px 16px',
                    borderBottom: i < taches.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: estRetard ? '#fff5f5' : '#fff',
                    alignItems: 'center'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>
                      {t.titre || '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {t.gestionnaire || '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: estRetard ? '#dc2626' : '#64748b', fontWeight: estRetard ? '600' : '400' }}>
                      {t.echeance ? new Date(t.echeance).toLocaleDateString('fr-BE') : '—'}
                    </div>
                    <div>
                      <span style={{
                        fontSize: '11px', fontWeight: '600',
                        padding: '3px 8px', borderRadius: '4px',
                        background: estRetard ? '#fee2e2' : t.statut === 'en_cours' ? '#dbeafe' : '#f1f5f9',
                        color: estRetard ? '#dc2626' : t.statut === 'en_cours' ? '#1d4ed8' : '#64748b'
                      }}>
                        {estRetard ? '⚠ Retard' : t.statut === 'en_cours' ? 'En cours' : 'En attente'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}
