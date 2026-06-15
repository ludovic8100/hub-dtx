import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useAuth } from '../../lib/auth'

export default function DashboardDtx() {
  const { perms, user } = useAuth()
  const [comptes, setComptes] = useState([])
  const [taches, setTaches] = useState([])
  const firstName = (perms?.nom || user?.user_metadata?.full_name || '').split(' ')[0]

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: t }] = await Promise.all([
        supabase.from('comptes_bancaires').select('nom, solde_actuel, devise, iban').eq('societe_id', 'DTX'),
        supabase.from('taches').select('id, titre, gestionnaire, echeance, statut').in('statut', ['en_cours', 'en_attente', 'retard']).order('echeance', { ascending: true }).limit(8),
      ])
      setComptes(c || [])
      setTaches(t || [])
    }
    load()
  }, [])

  const fmt = v => v != null ? new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '—'
  const now = new Date()

  return (
    <Layout currentPage="Tableau de bord">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", maxWidth: '1200px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>Bonjour {firstName} 👋</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>DTX SRL — aperçu de l'activité</p>
        </div>

        {/* Comptes */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ padding: '14px 20px', background: '#94a3b8', color: '#fff', fontWeight: '700', fontSize: '14px' }}>Comptes bancaires</div>
          {comptes.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Aucun compte synchronisé</div>
          ) : comptes.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < comptes.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{c.nom}</div>
                {c.iban && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.iban}</div>}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: (c.solde_actuel || 0) >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(c.solde_actuel)}</div>
            </div>
          ))}
        </div>

        {/* Tâches */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>Tâches en cours</div>
          {taches.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>✓ Aucune tâche en cours</div>
          ) : taches.map((t, i) => {
            const retard = t.echeance && new Date(t.echeance) < now
            return (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: i < taches.length - 1 ? '1px solid #f8fafc' : 'none', background: retard ? '#fff5f5' : '#fff' }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{t.titre || '—'}</div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{t.gestionnaire || '—'}</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '4px', background: retard ? '#fee2e2' : '#f1f5f9', color: retard ? '#dc2626' : '#475569' }}>
                    {retard ? '⚠ Retard' : 'En cours'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
