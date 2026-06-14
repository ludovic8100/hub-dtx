import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const MODULES = [
  { section: 'Dynassur', items: [
    { key: 'dyn_dashboard',    label: 'Tableau de bord' },
    { key: 'dyn_taches',       label: 'Tâches' },
    { key: 'dyn_clients',      label: 'Clients' },
    { key: 'dyn_production',   label: 'Production' },
    { key: 'dyn_bordereaux',   label: 'Bordereaux' },
    { key: 'dyn_chiffres',     label: 'Chiffres' },
    { key: 'dyn_objectifs',    label: 'Objectifs' },
    { key: 'dyn_compagnies',   label: 'Compagnies' },
    { key: 'dyn_sinistres',    label: 'Sinistres' },
    { key: 'dyn_banque',       label: 'Banque' },
    { key: 'dyn_comptabilite', label: 'Comptabilité' },
  ]},
  { section: 'DTX SRL', items: [
    { key: 'dtx_dashboard',    label: 'Tableau de bord' },
    { key: 'dtx_immobilier',   label: 'Immobilier' },
    { key: 'dtx_vehicules',    label: 'Véhicules' },
    { key: 'dtx_trading',      label: 'Trading' },
    { key: 'dtx_comptabilite', label: 'Comptabilité' },
  ]},
  { section: 'Accès sociétés', items: [
    { key: 'acc_dynassur', label: 'Dynassur' },
    { key: 'acc_dtx',      label: 'DTX SRL' },
    { key: 'acc_lode',     label: 'LODE SRL' },
    { key: 'acc_holding',  label: 'Holding' },
  ]},
]

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('user_permissions')
      .select('*')
      .order('nom')
      .then(({ data }) => setUsers(data || []))
  }, [])

  function selectUser(u) {
    setSelected({ ...u })
    setSaved(false)
  }

  function toggle(key) {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('user_permissions')
      .update(selected)
      .eq('id', selected.id)

    if (!error) {
      setUsers(prev => prev.map(u => u.id === selected.id ? selected : u))
      setSaved(true)
    }
    setSaving(false)
  }

  const s = { fontFamily: "'Source Sans Pro', sans-serif" }

  return (
    <Layout currentPage="Utilisateurs">
      <div style={{ ...s, maxWidth: '1100px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0D2F5E', margin: '0 0 24px' }}>
          Gestion des utilisateurs
        </h1>

        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

          {/* Liste users */}
          <div style={{
            width: '280px', minWidth: '280px',
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '14px 16px',
              background: '#0D2F5E',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              {users.length} utilisateurs
            </div>
            {users.map(u => (
              <div
                key={u.id}
                onClick={() => selectUser(u)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  background: selected?.id === u.id ? '#eff6ff' : '#fff',
                  borderLeft: selected?.id === u.id ? '3px solid #0080BD' : '3px solid transparent',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background 0.1s'
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#0D2F5E' }}>{u.nom}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{u.user_email}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{
                    fontSize: '11px', padding: '2px 7px', borderRadius: '4px',
                    background: u.role === 'admin' ? '#dbeafe' : '#f1f5f9',
                    color: u.role === 'admin' ? '#1e40af' : '#64748b',
                    fontWeight: '600'
                  }}>
                    {u.role}
                  </span>
                  <span style={{
                    fontSize: '11px', padding: '2px 7px', borderRadius: '4px',
                    background: u.actif ? '#dcfce7' : '#fee2e2',
                    color: u.actif ? '#166534' : '#991b1b',
                    fontWeight: '600'
                  }}>
                    {u.actif ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Panneau droits */}
          {selected ? (
            <div style={{ flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>

              {/* Header user sélectionné */}
              <div style={{
                padding: '16px 24px',
                background: '#0D2F5E',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: '700', fontSize: '16px' }}>{selected.nom}</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{selected.user_email}</div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {/* Actif toggle */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#fff', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={selected.actif || false}
                      onChange={() => toggle('actif')}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    Compte actif
                  </label>
                  {/* Rôle */}
                  <select
                    value={selected.role || 'user'}
                    onChange={e => setSelected(prev => ({ ...prev, role: e.target.value }))}
                    style={{
                      padding: '5px 10px', borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff', fontSize: '13px', cursor: 'pointer'
                    }}
                  >
                    <option value="user" style={{ background: '#0D2F5E' }}>user</option>
                    <option value="admin" style={{ background: '#0D2F5E' }}>admin</option>
                  </select>
                </div>
              </div>

              {/* Modules par section */}
              <div style={{ padding: '20px 24px' }}>
                {MODULES.map(section => (
                  <div key={section.section} style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '11px', fontWeight: '700',
                      color: '#94a3b8', letterSpacing: '0.07em',
                      textTransform: 'uppercase', marginBottom: '10px'
                    }}>
                      {section.section}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {section.items.map(item => (
                        <label
                          key={item.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            padding: '7px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${selected[item.key] ? '#93c5fd' : '#e2e8f0'}`,
                            background: selected[item.key] ? '#eff6ff' : '#f8fafc',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: selected[item.key] ? '#1e40af' : '#64748b',
                            fontWeight: selected[item.key] ? '600' : '400',
                            transition: 'all 0.15s',
                            userSelect: 'none'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected[item.key] || false}
                            onChange={() => toggle(item.key)}
                            style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#0080BD' }}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Bouton save */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <button
                    onClick={save}
                    disabled={saving}
                    style={{
                      padding: '10px 28px',
                      background: saving ? '#94a3b8' : '#0080BD',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s'
                    }}
                  >
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  {saved && (
                    <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: '600' }}>
                      ✓ Droits mis à jour
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0',
              minHeight: '300px', color: '#94a3b8', fontSize: '14px'
            }}>
              Sélectionne un utilisateur pour gérer ses droits
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
