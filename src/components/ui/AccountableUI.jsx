// Composants UI réutilisables — style « Accountable » adapté à la charte du Hub.
// Tous prennent une couleur d'accent (color) pour respecter l'identité de chaque entité.
// Usage : import { StatBanner, TabsBar, StatusBadge, ActionButton, DataCard } from '../components/ui/AccountableUI'

import { useState, useEffect } from 'react'

const FONT = "'Source Sans Pro', sans-serif"

// Détection mobile interne (évite une dépendance externe)
function useMobile(bp = 768) {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < bp)
  useEffect(() => {
    const f = () => setM(window.innerWidth < bp)
    window.addEventListener('resize', f); f()
    return () => window.removeEventListener('resize', f)
  }, [bp])
  return m
}

// Convertit un hex en rgba (pour les fonds translucides)
function hexToRgba(hex, a = 1) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

/* ---------------------------------------------------------------------------
 * Bandeau de statistiques — l'en-tête coloré façon Accountable.
 * props: color, colorLight, title, subtitle, stats[{label,value}], action (JSX), logoUrl
 * ------------------------------------------------------------------------- */
export function StatBanner({ color, colorDark, title, subtitle, stats = [], action, logoUrl, footer }) {
  const mob = useMobile()
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(135deg, ${color} 0%, ${colorDark || color} 140%)`,
      borderRadius: 16, padding: mob ? '12px 16px' : '16px 24px', marginBottom: mob ? 8 : 10, color: '#fff',
      fontFamily: FONT, boxShadow: `0 6px 20px ${hexToRgba(color, 0.25)}`,
    }}>
      {/* Cercle décoratif en fond */}
      <div style={{ position: 'absolute', right: -40, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'absolute', right: 70, bottom: -90, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: mob ? 'stretch' : 'flex-start', flexDirection: mob ? 'column' : 'row', flexWrap: 'wrap', gap: mob ? 14 : 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: mob ? 12 : 16 }}>
          {logoUrl && (
            <div style={{ width: mob ? 44 : 54, height: mob ? 44 : 54, borderRadius: 12, background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 7, flexShrink: 0 }}>
              <img src={logoUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          )}
          <div>
            <h1 style={{ fontSize: mob ? 21 : 26, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>{title}</h1>
            {subtitle && <p style={{ fontSize: mob ? 12.5 : 13.5, margin: '3px 0 0', opacity: 0.85 }}>{subtitle}</p>}
          </div>
        </div>
        {action && <div style={{ position: 'relative' }}>{action}</div>}
      </div>

      {footer && (
        <div style={{ position: 'relative', marginTop: mob ? 12 : 16 }}>{footer}</div>
      )}

      {stats.length > 0 && (
        <div style={{ position: 'relative', display: 'flex', gap: mob ? 20 : 36, marginTop: mob ? 14 : 18, flexWrap: 'wrap' }}>
          {stats.map((s, i) => (
            <div key={i} onClick={s.onClick} style={{ cursor: s.onClick ? 'pointer' : 'default', transition: 'opacity .15s' }}
              onMouseEnter={e => { if (s.onClick) e.currentTarget.style.opacity = 0.75 }}
              onMouseLeave={e => { if (s.onClick) e.currentTarget.style.opacity = 1 }}>
              <div style={{ fontSize: mob ? 10 : 11, fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}{s.onClick && <span style={{ marginLeft: 5, opacity: 0.7 }}>▸</span>}</div>
              <div style={{ fontSize: mob ? 19 : 24, fontWeight: 800, marginTop: 2, textDecoration: s.onClick ? 'underline' : 'none', textUnderlineOffset: 3, textDecorationThickness: 1, textDecorationColor: 'rgba(255,255,255,0.35)' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Barre d'onglets avec compteurs.
 * props: color, tabs[{key,label,count}], active, onChange
 * ------------------------------------------------------------------------- */
export function TabsBar({ color, tabs = [], active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '2px solid #eef2f6', fontFamily: FONT, flexWrap: 'wrap' }}>
      {tabs.map(t => {
        const on = active === t.key
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{
            background: 'none', border: 'none', padding: '11px 18px', cursor: 'pointer',
            fontSize: 14.5, fontWeight: 700, color: on ? color : '#94a3b8',
            borderBottom: on ? `2.5px solid ${color}` : '2.5px solid transparent', marginBottom: -2,
            display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT,
          }}>
            {t.label}
            {t.count != null && (
              <span style={{
                fontSize: 11.5, fontWeight: 700, padding: '1px 8px', borderRadius: 20,
                background: on ? hexToRgba(color, 0.12) : '#f1f5f9', color: on ? color : '#94a3b8',
              }}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Badge de statut coloré (pastille).
 * props: bg, col, label  OU  tone ('grey'|'blue'|'green'|'red'|'amber') + label
 * ------------------------------------------------------------------------- */
const TONES = {
  grey: { bg: '#f1f5f9', col: '#64748b' },
  blue: { bg: '#dbeafe', col: '#2563eb' },
  green: { bg: '#dcfce7', col: '#16a34a' },
  red: { bg: '#fee2e2', col: '#dc2626' },
  amber: { bg: '#fef3c7', col: '#b45309' },
}
export function StatusBadge({ bg, col, tone, label }) {
  const c = tone ? TONES[tone] : { bg, col }
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 11px',
      borderRadius: 20, background: c.bg, color: c.col, fontFamily: FONT, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

/* ---------------------------------------------------------------------------
 * Bouton d'action discret (tableau).
 * props: onClick, disabled, children, tone ('grey'|'pdf'|'excel'|'accent'|'danger'|'peppol'), color (pour 'accent')
 * ------------------------------------------------------------------------- */
const BTN_TONES = {
  grey: { bg: '#f1f5f9', col: '#64748b' },
  pdf: { bg: '#fef2f2', col: '#dc2626' },
  excel: { bg: '#f0fdf4', col: '#16a34a' },
  peppol: { bg: '#eff6ff', col: '#2563eb' },
  danger: { bg: '#fff', col: '#dc2626' },
}
export function ActionButton({ onClick, disabled, children, tone = 'grey', color }) {
  const c = tone === 'accent' ? { bg: hexToRgba(color || '#ea580c', 0.1), col: color || '#ea580c' } : (BTN_TONES[tone] || BTN_TONES.grey)
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: c.bg, color: c.col, border: 'none', borderRadius: 8, padding: '5px 11px',
      cursor: disabled ? 'default' : 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: FONT,
      opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  )
}

/* ---------------------------------------------------------------------------
 * Carte conteneur blanche arrondie (pour tableaux/contenus).
 * ------------------------------------------------------------------------- */
export function DataCard({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #eef2f6', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', fontFamily: FONT, ...style }}>
      {children}
    </div>
  )
}

/* Bouton primaire (ex: « + Nouveau »), à placer dans StatBanner.action — blanc sur fond coloré */
export function PrimaryButton({ onClick, children, color }) {
  return (
    <button onClick={onClick} style={{
      background: '#fff', color: color || '#ea580c', border: 'none', borderRadius: 10,
      padding: '10px 18px', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, fontFamily: FONT,
      display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    }}>{children}</button>
  )
}

export { hexToRgba, useMobile }
