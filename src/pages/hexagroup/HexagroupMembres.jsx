import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner, useMobile } from '../../components/ui/AccountableUI'
import HexMembreForm from '../../components/HexMembreForm'
import { COUL } from '../../lib/theme'

export default function HexagroupMembres() {
  const E = ENTITES.hexagroup
  const mob = useMobile()
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)   // null | 'new' | membre
  const [q, setQ] = useState('')

  const charger = async () => {
    setLoading(true)
    const { data } = await supabase.from('hex_membres').select('*').order('actif', { ascending: false }).order('societe', { nullsFirst: false })
    setMembres(data || []); setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const toggle = async (m) => { await supabase.from('hex_membres').update({ actif: !m.actif }).eq('id', m.id); charger() }

  const filtre = membres.filter(m => {
    if (!q.trim()) return true
    const s = (m.societe + ' ' + m.contact + ' ' + (m.numero_bce || '')).toLowerCase()
    return s.includes(q.trim().toLowerCase())
  })
  const actifs = membres.filter(m => m.actif).length

  const ibtn = (icon, label, onClick, col) => (
    <button onClick={onClick} title={label} aria-label={label}
      style={{ width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid #e2e8f0', background: COUL.surface, borderRadius: 6, cursor: 'pointer', color: col || '#475569' }}>
      <i className={`ti ${icon}`} style={{ fontSize: 16 }} />
    </button>
  )

  return (
    <Layout currentPage="Membres">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Membres" subtitle="Hexagroup ASBL"
          action={
            <button onClick={() => setEdit('new')} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: COUL.surface, color: '#6E2C91', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              <i className="ti ti-plus" style={{ fontSize: 15, verticalAlign: -2, marginRight: 4 }} />Nouveau membre
            </button>
          } />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: 10, color: COUL.texteFaible, fontSize: 16 }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un membre (nom, BCE)…"
              style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 8, border: '0.5px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ fontSize: 13, color: COUL.texteDoux }}>{actifs} actif{actifs > 1 ? 's' : ''} / {membres.length}</div>
        </div>

        {mob ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading && <div style={{ padding: 24, textAlign: 'center', color: COUL.texteFaible }}>Chargement…</div>}
            {!loading && filtre.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: COUL.texteFaible }}>Aucun membre.</div>}
            {filtre.map(m => (
              <div key={m.id} style={{ background: COUL.surface, border: '0.5px solid #e2e8f0', borderRadius: 12, padding: 14, opacity: m.actif ? 1 : 0.55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{m.societe || m.contact || '—'}</div>
                    {m.societe && m.contact && <div style={{ fontSize: 12, color: COUL.texteFaible }}>{m.contact}</div>}
                  </div>
                  {m.actif ? <i className="ti ti-circle-check" style={{ color: COUL.succes, fontSize: 20 }} /> : <i className="ti ti-circle" style={{ color: COUL.bordFort, fontSize: 20 }} />}
                </div>
                <div style={{ fontSize: 12.5, color: COUL.texteDoux, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div>BCE : {m.numero_bce || '—'}</div>
                  <div>{[m.adresse, [m.cp, m.ville].filter(Boolean).join(' ')].filter(Boolean).join(' – ') || '—'}</div>
                  <div style={{ color: m.email ? '#334155' : COUL.danger }}>{m.email || 'e-mail à compléter'}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  {ibtn('ti-pencil', 'Éditer', () => setEdit(m))}
                  {ibtn(m.actif ? 'ti-user-off' : 'ti-user-check', m.actif ? 'Désactiver' : 'Réactiver', () => toggle(m))}
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div style={{ background: COUL.surface, border: '0.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: COUL.fond, color: COUL.texteDoux, textAlign: 'left' }}>
              <th style={{ padding: '11px 12px', fontWeight: 700 }}>Membre</th>
              <th style={{ padding: '11px 12px', fontWeight: 700 }}>N° BCE</th>
              <th style={{ padding: '11px 12px', fontWeight: 700 }}>Adresse</th>
              <th style={{ padding: '11px 12px', fontWeight: 700 }}>E-mail</th>
              <th style={{ padding: '11px 12px', fontWeight: 700, textAlign: 'center' }}>Actif</th>
              <th style={{ padding: '11px 12px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: COUL.texteFaible }}>Chargement…</td></tr>}
              {!loading && filtre.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: COUL.texteFaible }}>Aucun membre.</td></tr>}
              {filtre.map(m => (
                <tr key={m.id} style={{ borderTop: '0.5px solid #eef2f7', opacity: m.actif ? 1 : 0.5 }}>
                  <td style={{ padding: '11px 12px' }}><div style={{ fontWeight: 600 }}>{m.societe || m.contact || '—'}</div>{m.societe && m.contact && <div style={{ fontSize: 12, color: COUL.texteFaible }}>{m.contact}</div>}</td>
                  <td style={{ padding: '11px 12px', color: COUL.texteDoux }}>{m.numero_bce || '—'}</td>
                  <td style={{ padding: '11px 12px', color: COUL.texteDoux }}>{[m.adresse, [m.cp, m.ville].filter(Boolean).join(' ')].filter(Boolean).join(' – ') || '—'}</td>
                  <td style={{ padding: '11px 12px', color: m.email ? '#334155' : COUL.danger }}>{m.email || 'à compléter'}</td>
                  <td style={{ padding: '11px 12px', textAlign: 'center' }}>{m.actif ? <i className="ti ti-circle-check" style={{ color: COUL.succes, fontSize: 18 }} /> : <i className="ti ti-circle" style={{ color: COUL.bordFort, fontSize: 18 }} />}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {ibtn('ti-pencil', 'Éditer', () => setEdit(m))}{' '}
                    {ibtn(m.actif ? 'ti-user-off' : 'ti-user-check', m.actif ? 'Désactiver' : 'Réactiver', () => toggle(m))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {edit && <HexMembreForm initial={edit === 'new' ? null : edit} onSaved={charger} onClose={() => setEdit(null)} />}
    </Layout>
  )
}
