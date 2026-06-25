import { useState, useEffect, Component } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  blue: '#0080BD', blueDark: '#005f8e', bluePale: '#e8f4fb',
  ok: '#16a34a', okPale: '#dcfce7',
  warn: '#d97706', warnPale: '#fef3c7',
  danger: '#dc2626', dangerPale: '#fee2e2',
  grey: '#64748b', greyPale: '#f1f5f9',
  border: '#e2e8f0', white: '#ffffff', bg: '#f8fafc',
  text: '#0f172a', textM: '#475569', textL: '#94a3b8',
}

const fmt = v => v == null ? '—' : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
const fmtN = v => v == null ? '—' : new Intl.NumberFormat('fr-BE').format(v)
const fmtPct = v => v == null ? '—' : `${Number(v).toFixed(1)} %`
const isVieDom = dom => { const d = (dom || '').toLowerCase(); return d.includes('vie') || d.includes('placement') }

function pctColor(pct) {
  if (pct == null) return C.grey
  if (pct >= 100) return C.ok
  if (pct >= 70) return C.blue
  if (pct >= 50) return C.warn
  return C.danger
}

function retColor(ret) {
  if (ret == null) return C.grey
  if (ret >= 80) return C.ok
  if (ret >= 65) return C.warn
  return C.danger
}

// ── Barre de progression ──────────────────────────────────────
function ProgressBar({ pct, col }) {
  const c = col || pctColor(pct)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: C.border, borderRadius: 4, height: 7, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct || 0, 100)}%`, height: '100%', background: c, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: c, minWidth: 40, textAlign: 'right' }}>{fmtPct(pct)}</span>
    </div>
  )
}

// ── Badge statut ──────────────────────────────────────────────
function Badge({ label, color, pale }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: pale, color, letterSpacing: 0.3 }}>
      {label}
    </span>
  )
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, pct, col, icon, onClick }) {
  const c = col || C.blue
  return (
    <div onClick={onClick}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = `0 4px 14px ${c}25` }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
      style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 18px', borderTop: `3px solid ${c}`, cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow .15s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textL, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        {onClick ? <i className="ti ti-zoom-in" style={{ fontSize: 16, color: c }} /> : (icon && <i className={`ti ${icon}`} style={{ fontSize: 18, color: c + '80' }} />)}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: sub ? 4 : 0 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.textM, marginBottom: pct != null ? 8 : 0 }}>{sub}</div>}
      {pct != null && <ProgressBar pct={pct} col={c} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ONGLET 1 — COMMERCIAUX
// ══════════════════════════════════════════════════════════════
// ── Fenêtre de détail : lignes derrière un réalisé ──
class DetailBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err) { console.error('DetailModal crash:', err) }
  render() {
    if (this.state.err) return (
      <div onClick={this.props.onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
        <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', padding:24, borderRadius:12, maxWidth:600, width:'100%' }}>
          <div style={{ fontWeight:800, color:'#dc2626', marginBottom:8, fontSize:15 }}>Erreur d'affichage du détail</div>
          <pre style={{ fontSize:12, whiteSpace:'pre-wrap', wordBreak:'break-word', color:'#475569', background:'#f8fafc', padding:12, borderRadius:8, maxHeight:300, overflow:'auto' }}>{String(this.state.err?.stack || this.state.err?.message || this.state.err)}</pre>
          <button onClick={this.props.onClose} style={{ marginTop:14, padding:'8px 18px', border:'none', borderRadius:8, background:'#0080BD', color:'#fff', fontWeight:700, cursor:'pointer' }}>Fermer</button>
        </div>
      </div>
    )
    return this.props.children
  }
}

function DetailModal({ titre, kind, rows, onClose }) {
  rows = Array.isArray(rows) ? rows : []
  const isQ = kind === 'quittances'
  const totC = rows.reduce((s, r) => s + (Number(r.commission) || 0), 0)
  const totP = rows.reduce((s, r) => s + (Number(r.prime_totale) || 0), 0)
  const tri = isQ
    ? [...rows].sort((a, b) => (b.date_comptable || '').localeCompare(a.date_comptable || ''))
    : [...rows].sort((a, b) => (b.mois || '').localeCompare(a.mois || ''))
  const show = tri.slice(0, 1000)
  const MO = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const cols = isQ ? ['Date', 'Client', 'Compagnie', 'Domaine', 'Prime', 'Commission'] : ['Mois', 'Type', 'Client', 'Compagnie', 'N° contrat']
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(880px,96vw)', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 30px rgba(0,0,0,.2)' }}>
        <div style={{ background: C.blueDark, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>{titre}</div>
            <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 2 }}>
              {fmtN(rows.length)} ligne(s){isQ ? ` · Primes ${fmt(totP)} · Commissions ${fmt(totC)}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead><tr style={{ background: C.bg, position: 'sticky', top: 0 }}>
              {cols.map((h, i) => <th key={h} style={{ textAlign: isQ && i >= 4 ? 'right' : 'left', padding: '8px 12px', fontSize: 10, fontWeight: 700, color: C.textL, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {show.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.greyPale}` }}>
                  {isQ ? <>
                    <td style={{ padding: '7px 12px', color: C.textM, whiteSpace: 'nowrap' }}>{r.date_comptable || '—'}</td>
                    <td style={{ padding: '7px 12px', fontWeight: 600, color: C.text }}>{[r.client_nom, r.client_prenom].filter(Boolean).join(' ') || '—'}</td>
                    <td style={{ padding: '7px 12px', color: C.textM }}>{r.compagnie || '—'}</td>
                    <td style={{ padding: '7px 12px', color: C.textM }}>{r.domaine || '—'}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700 }}>{fmt(r.prime_totale)}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: C.ok, fontWeight: 700 }}>{fmt(r.commission)}</td>
                  </> : <>
                    <td style={{ padding: '7px 12px', color: C.textM, whiteSpace: 'nowrap' }}>{MO[parseInt(r.mois)] || r.mois || '—'}</td>
                    <td style={{ padding: '7px 12px', fontWeight: 600, color: C.text }}>{r.type_prod || '—'}</td>
                    <td style={{ padding: '7px 12px', color: C.textM }}>{r.nom_client || '—'}</td>
                    <td style={{ padding: '7px 12px', color: C.textM }}>{r.cie || '—'}</td>
                    <td style={{ padding: '7px 12px', color: C.textM, whiteSpace: 'nowrap' }}>{r.police || '—'}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
          {tri.length > 1000 && <p style={{ padding: '12px 16px', color: C.textL, fontSize: 12 }}>… et {fmtN(tri.length - 1000)} autres lignes (totaux calculés sur l'ensemble).</p>}
        </div>
      </div>
    </div>
  )
}

function OngletCommerciaux({ objectifs, reel, loading, raw, onDetail }) {
  const commerciaux = objectifs.filter(o => o.categorie === 'EMPLOYE' && o.obj_com_nette_total)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textL }}>Chargement…</div>

  // KPIs globaux commerciaux
  const totalObj = commerciaux.reduce((s, o) => s + (o.obj_com_nette_total || 0), 0)
  const totalReel = commerciaux.reduce((s, o) => s + (reel[o.collaborateur_code]?.com_nette || 0), 0)
  const totalObjNA = commerciaux.reduce((s, o) => s + (o.obj_na_total || 0), 0)
  const totalReelNA = commerciaux.reduce((s, o) => s + (reel[o.collaborateur_code]?.na || 0), 0)
  const totalObjVie = commerciaux.reduce((s, o) => s + (o.obj_prime_vie || 0), 0)
  const totalReelVie = commerciaux.reduce((s, o) => s + (reel[o.collaborateur_code]?.prime_vie || 0), 0)

  return (
    <div>
      {/* KPIs globaux */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Commission nette Dynassur" value={fmt(totalReel)} sub={`Objectif : ${fmt(totalObj)}`} pct={totalObj > 0 ? totalReel / totalObj * 100 : null} col={C.blue} icon="ti-coin"
          onClick={() => { const x = commerciaux.flatMap(o => raw[o.collaborateur_code]?.quitt || []); x.length && onDetail('Tous commerciaux — commissions 2026', 'quittances', x) }} />
        <KpiCard label="Nouvelles affaires" value={fmtN(totalReelNA)} sub={`Objectif : ${fmtN(totalObjNA)} NA`} pct={totalObjNA > 0 ? totalReelNA / totalObjNA * 100 : null} col="#7c3aed" icon="ti-file-plus"
          onClick={() => { const x = commerciaux.flatMap(o => raw[o.collaborateur_code]?.na || []); x.length && onDetail('Tous commerciaux — Nouvelles Affaires 2026', 'mouvements', x) }} />
        <KpiCard label="Prime VIE (capital)" value={fmt(totalReelVie)} sub={`Objectif : ${fmt(totalObjVie)}`} pct={totalObjVie > 0 ? totalReelVie / totalObjVie * 100 : null} col="#0d9488" icon="ti-heart"
          onClick={() => { const x = commerciaux.flatMap(o => (raw[o.collaborateur_code]?.quitt || []).filter(r => isVieDom(r.domaine))); x.length && onDetail('Tous commerciaux — quittances VIE 2026', 'quittances', x) }} />
      </div>

      {/* Tableau par commercial */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.textL, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Détail par commercial
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['Commercial', 'Commission obj.', 'Commission réelle', 'Avancement', 'NA obj.', 'NA réel', 'Prime VIE obj.', 'Prime VIE réelle', 'Rétention obj.', 'Rét. réelle'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.textL, textAlign: 'left', borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {commerciaux.map(o => {
                const r = reel[o.collaborateur_code] || {}
                const pctCom = o.obj_com_nette_total > 0 ? (r.com_nette || 0) / o.obj_com_nette_total * 100 : null
                const retObj = o.obj_taux_retention
                const retReel = r.retention
                return (
                  <tr key={o.collaborateur_code}
                    onMouseEnter={e => e.currentTarget.style.background = C.bluePale}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{o.collaborateur_code}</div>
                      <div style={{ fontSize: 11, color: C.textL }}>{o.categorie}</div>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.textM }}>{fmt(o.obj_com_nette_total)}</td>
                    <td onClick={() => (raw[o.collaborateur_code]?.quitt?.length) && onDetail(`${o.collaborateur_code} — commissions 2026`, 'quittances', raw[o.collaborateur_code].quitt)}
                      style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: pctColor(pctCom), cursor: raw[o.collaborateur_code]?.quitt?.length ? 'pointer' : 'default', textDecoration: raw[o.collaborateur_code]?.quitt?.length ? 'underline dotted' : 'none' }}>{fmt(r.com_nette)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, minWidth: 160 }}><ProgressBar pct={pctCom} /></td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.textM }}>{fmtN(o.obj_na_total)}</td>
                    <td onClick={() => (raw[o.collaborateur_code]?.na?.length) && onDetail(`${o.collaborateur_code} — Nouvelles Affaires 2026`, 'mouvements', raw[o.collaborateur_code].na)}
                      style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text, cursor: raw[o.collaborateur_code]?.na?.length ? 'pointer' : 'default', textDecoration: raw[o.collaborateur_code]?.na?.length ? 'underline dotted' : 'none' }}>{fmtN(r.na)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.textM }}>{fmt(o.obj_prime_vie)}</td>
                    <td onClick={() => { const x = (raw[o.collaborateur_code]?.quitt || []).filter(rr => isVieDom(rr.domaine)); x.length && onDetail(`${o.collaborateur_code} — quittances VIE 2026`, 'quittances', x) }}
                      style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: C.text, cursor: (raw[o.collaborateur_code]?.quitt || []).some(rr => isVieDom(rr.domaine)) ? 'pointer' : 'default', textDecoration: (raw[o.collaborateur_code]?.quitt || []).some(rr => isVieDom(rr.domaine)) ? 'underline dotted' : 'none' }}>{fmt(r.prime_vie)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.textM }}>{fmtPct(retObj)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: retColor(retReel) }}>{fmtPct(retReel)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bonus paliers */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textL, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Paliers de bonus — TJA & GGO</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Palier 1', seuil: '> 200.000 €', bonus: '+5% sur le surplus', col: C.blue },
            { label: 'Palier 2', seuil: '> 250.000 €', bonus: '+8% sur le surplus', col: C.ok },
            { label: 'Palier 3', seuil: '> 300.000 €', bonus: '+10% sur le surplus', col: '#7c3aed' },
          ].map(p => {
            const tjaReel = reel['TJA']?.com_nette || 0
            const ggoReel = reel['GGO']?.com_nette || 0
            const seuilNum = p.label === 'Palier 1' ? 200000 : p.label === 'Palier 2' ? 250000 : 300000
            return (
              <div key={p.label} style={{ flex: 1, minWidth: 200, background: C.bg, borderRadius: 8, padding: '12px 16px', borderLeft: `3px solid ${p.col}` }}>
                <div style={{ fontWeight: 700, color: p.col, marginBottom: 4 }}>{p.label}</div>
                <div style={{ fontSize: 12, color: C.textM, marginBottom: 4 }}>{p.seuil}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>{p.bonus}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Badge label={`TJA ${tjaReel >= seuilNum ? '✓' : '✗'}`} color={tjaReel >= seuilNum ? C.ok : C.danger} pale={tjaReel >= seuilNum ? C.okPale : C.dangerPale} />
                  <Badge label={`GGO ${ggoReel >= seuilNum ? '✓' : '✗'}`} color={ggoReel >= seuilNum ? C.ok : C.danger} pale={ggoReel >= seuilNum ? C.okPale : C.dangerPale} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ONGLET 2 — SOUS-AGENTS
// ══════════════════════════════════════════════════════════════
function OngletSousAgents({ objectifs, reel, loading, raw, onDetail }) {
  const sa = objectifs.filter(o => o.categorie === 'SA' && o.obj_com_nette_total)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textL }}>Chargement…</div>

  const totalObj = sa.reduce((s, o) => s + (o.obj_com_nette_total || 0), 0)
  const totalReel = sa.reduce((s, o) => s + (reel[o.collaborateur_code]?.com_dynassur || 0), 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Part Dynassur — tous SA" value={fmt(totalReel)} sub={`Objectif : ${fmt(totalObj)}`} pct={totalObj > 0 ? totalReel / totalObj * 100 : null} col={C.blue} icon="ti-coin"
          onClick={() => { const x = sa.flatMap(o => raw[o.collaborateur_code]?.quitt || []); x.length && onDetail('Tous sous-agents — commissions 2026', 'quittances', x) }} />
        <KpiCard label="SA avec objectif" value={sa.length} col="#7c3aed" icon="ti-users" />
        <KpiCard label="SA en difficulté (rét. < 60%)" value={sa.filter(o => (reel[o.collaborateur_code]?.retention || 100) < 60).length} col={C.danger} icon="ti-alert-triangle" />
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.textL, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Part nette Dynassur par sous-agent
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['SA', 'Taux Dynassur', 'Part obj.', 'Part réelle', 'Avancement', 'Rét. obj.', 'Rét. réelle', 'NA réel', 'Statut'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.textL, textAlign: 'left', borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sa.sort((a, b) => (reel[b.collaborateur_code]?.com_dynassur || 0) - (reel[a.collaborateur_code]?.com_dynassur || 0)).map(o => {
                const r = reel[o.collaborateur_code] || {}
                const pctCom = o.obj_com_nette_total > 0 ? (r.com_dynassur || 0) / o.obj_com_nette_total * 100 : null
                const retReel = r.retention
                const enDifficulte = retReel != null && retReel < 60

                return (
                  <tr key={o.collaborateur_code}
                    onMouseEnter={e => e.currentTarget.style.background = C.bluePale}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontWeight: 700, color: C.text }}>{o.collaborateur_code}</div>
                      <div style={{ fontSize: 11, color: C.textL }}>{o.taux_retention_dynassur}% Dynassur</div>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                      <Badge label={`${o.taux_retention_dynassur}%`} color={o.taux_retention_dynassur >= 20 ? C.blue : C.grey} pale={C.bluePale} />
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.textM }}>{fmt(o.obj_com_nette_total)}</td>
                    <td onClick={() => (raw[o.collaborateur_code]?.quitt?.length) && onDetail(`${o.collaborateur_code} — commissions 2026`, 'quittances', raw[o.collaborateur_code].quitt)}
                      style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 700, color: pctColor(pctCom), cursor: raw[o.collaborateur_code]?.quitt?.length ? 'pointer' : 'default', textDecoration: raw[o.collaborateur_code]?.quitt?.length ? 'underline dotted' : 'none' }}>{fmt(r.com_dynassur)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, minWidth: 140 }}><ProgressBar pct={pctCom} /></td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.textM }}>{fmtPct(o.obj_taux_retention)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: retColor(retReel) }}>{fmtPct(retReel)}</span>
                    </td>
                    <td onClick={() => (raw[o.collaborateur_code]?.na?.length) && onDetail(`${o.collaborateur_code} — Nouvelles Affaires 2026`, 'mouvements', raw[o.collaborateur_code].na)}
                      style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text, cursor: raw[o.collaborateur_code]?.na?.length ? 'pointer' : 'default', textDecoration: raw[o.collaborateur_code]?.na?.length ? 'underline dotted' : 'none' }}>{fmtN(r.na)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                      {enDifficulte
                        ? <Badge label="⚠ Rétention faible" color={C.danger} pale={C.dangerPale} />
                        : <Badge label="✓ OK" color={C.ok} pale={C.okPale} />
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ONGLET 3 — RÉTENTION GLOBALE
// ══════════════════════════════════════════════════════════════
function OngletRetention({ reel, loading, raw, onDetail }) {
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textL }}>Chargement…</div>

  const tous = Object.entries(reel).filter(([, r]) => r.na > 0 || r.chutes > 0)
  const totalNA = tous.reduce((s, [, r]) => s + (r.na || 0), 0)
  const totalChutes = tous.reduce((s, [, r]) => s + (r.chutes || 0), 0)
  const totalTFT = tous.reduce((s, [, r]) => s + (r.tft || 0), 0)
  const retGlobal = totalNA > 0 ? (1 - totalChutes / totalNA) * 100 : null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KpiCard label="NA 2026" value={fmtN(totalNA)} col={C.blue} icon="ti-file-plus"
          onClick={() => { const x = tous.flatMap(([code]) => raw[code]?.na || []); x.length && onDetail('Tous producteurs — Nouvelles Affaires 2026', 'mouvements', x) }} />
        <KpiCard label="Chutes réelles" value={fmtN(totalChutes)} col={C.danger} icon="ti-trending-down"
          onClick={() => { const x = tous.flatMap(([code]) => raw[code]?.chutes || []); x.length && onDetail('Tous producteurs — chutes 2026', 'mouvements', x) }} />
        <KpiCard label="TFT (transferts)" value={fmtN(totalTFT)} col={C.warn} icon="ti-arrows-exchange" sub="Client gardé, CIE changée"
          onClick={() => { const x = tous.flatMap(([code]) => raw[code]?.tft || []); x.length && onDetail('Tous producteurs — TFT / mandats faveur 2026', 'mouvements', x) }} />
        <KpiCard label="Net (NA - chutes)" value={fmtN(totalNA - totalChutes)} col={C.ok} icon="ti-trending-up" />
        <KpiCard label="Rétention globale 2026" value={fmtPct(retGlobal)} sub="Objectif : ≥ 70%" pct={retGlobal} col={retColor(retGlobal)} icon="ti-shield" />
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.textL, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Rétention par producteur 2026
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {['Producteur', 'NA', 'Chutes', 'TFT', 'Net', 'Rétention', 'Base 2025', 'Évolution'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.textL, textAlign: 'left', borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tous.sort((a, b) => (b[1].na || 0) - (a[1].na || 0)).map(([code, r]) => {
                const ret = r.na > 0 ? (1 - r.chutes / r.na) * 100 : null
                const base = r.base2025
                const evol = ret != null && base != null ? ret - base : null
                return (
                  <tr key={code}
                    onMouseEnter={e => e.currentTarget.style.background = C.bluePale}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontWeight: 700, color: C.text }}>{code}</td>
                    <td onClick={() => (raw[code]?.na?.length) && onDetail(`${code} — Nouvelles Affaires 2026`, 'mouvements', raw[code].na)}
                      style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.text, cursor: raw[code]?.na?.length ? 'pointer' : 'default', textDecoration: raw[code]?.na?.length ? 'underline dotted' : 'none' }}>{fmtN(r.na)}</td>
                    <td onClick={() => (raw[code]?.chutes?.length) && onDetail(`${code} — chutes 2026`, 'mouvements', raw[code].chutes)}
                      style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.danger, cursor: raw[code]?.chutes?.length ? 'pointer' : 'default', textDecoration: raw[code]?.chutes?.length ? 'underline dotted' : 'none' }}>{fmtN(r.chutes)}</td>
                    <td onClick={() => (raw[code]?.tft?.length) && onDetail(`${code} — TFT / mandats faveur 2026`, 'mouvements', raw[code].tft)}
                      style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.warn, cursor: raw[code]?.tft?.length ? 'pointer' : 'default', textDecoration: raw[code]?.tft?.length ? 'underline dotted' : 'none' }}>{fmtN(r.tft)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: (r.na - r.chutes) > 0 ? C.ok : C.danger }}>{fmtN(r.na - r.chutes)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: retColor(ret), minWidth: 52 }}>{fmtPct(ret)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.textM }}>{fmtPct(base)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
                      {evol != null && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: evol >= 0 ? C.ok : C.danger }}>
                          {evol >= 0 ? '▲' : '▼'} {Math.abs(evol).toFixed(1)} pts
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function ObjectifsView() {
  const [onglet, setOnglet] = useState('commerciaux')
  const [objectifs, setObjectifs] = useState([])
  const [reel, setReel] = useState({})
  const [raw, setRaw] = useState({})
  const [detail, setDetail] = useState(null)   // { titre, kind, rows }
  const [loading, setLoading] = useState(true)
  const onDetail = (titre, kind, rows) => setDetail({ titre, kind, rows })

  const ONGLETS = [
    { key: 'commerciaux', label: 'Commerciaux', icon: 'ti-target' },
    { key: 'sa', label: 'Sous-agents', icon: 'ti-users' },
    { key: 'retention', label: 'Rétention', icon: 'ti-shield' },
  ]

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // 1. Objectifs
        const { data: obj } = await supabase.from('objectifs_2026').select('*')

        // 2. Quittances 2026 — commissions réelles
        let quittances = []
        let offset = 0
        while (true) {
          const { data: rows } = await supabase.from('quittances')
            .select('sous_agent,commission,prime_totale,domaine,date_comptable,compagnie,client_nom,client_prenom,police')
            .gte('date_comptable', '2026-01-01')
            .range(offset, offset + 999)
          if (!rows || rows.length === 0) break
          quittances = quittances.concat(rows)
          if (rows.length < 1000) break
          offset += 1000
        }

        // 3. Mouvements production 2026 — NA, chutes, TFT
        let mouvements = []
        offset = 0
        while (true) {
          const { data: rows } = await supabase.from('mouvements_production')
            .select('sa_contrat,type_prod,mois,police,nom_client,cie')
            .eq('annee', 2026)
            .range(offset, offset + 999)
          if (!rows || rows.length === 0) break
          mouvements = mouvements.concat(rows)
          if (rows.length < 1000) break
          offset += 1000
        }

        // 4. Mouvements 2025 — base rétention
        let mouv2025 = []
        offset = 0
        while (true) {
          const { data: rows } = await supabase.from('mouvements_production')
            .select('sa_contrat,type_prod')
            .eq('annee', 2025)
            .range(offset, offset + 999)
          if (!rows || rows.length === 0) break
          mouv2025 = mouv2025.concat(rows)
          if (rows.length < 1000) break
          offset += 1000
        }

        // Mapping nom → code
        const { data: collabs } = await supabase.from('collaborateurs').select('code,nom_sa_data')
        const nameToCode = {}
        collabs?.forEach(c => { if (c.nom_sa_data) nameToCode[c.nom_sa_data] = c.code })

        // Taux SA
        const TAUX = {}
        obj?.forEach(o => { TAUX[o.collaborateur_code] = (o.taux_retention_dynassur || 100) / 100 })

        const EMPLOYES = new Set(['GGO', 'TJA', 'PFQ', 'MTE', 'BHU', 'NGI', 'FBL', 'LDE'])
        const EXCLURE = new Set(['Detilloux Ludovic', 'Priscilla Fernandez Quiroga'])
        const CHUTES = new Set(['Renon', 'Résiliation Non paiement', 'Disparition de Risque', 'Mandat défaveur', 'Suspension'])
        const TFT = new Set(['TFT CIE', 'Mandat faveur'])

        function isVie(dom) {
          const d = (dom || '').toLowerCase()
          return d.includes('vie') || d.includes('placement')
        }

        // Agréger commissions
        const reelMap = {}
        const rawMap = {}
        const ensure = code => {
          if (!reelMap[code]) reelMap[code] = { com_nette: 0, com_dynassur: 0, prime_vie: 0, na: 0, chutes: 0, tft: 0, base2025: null }
          if (!rawMap[code]) rawMap[code] = { quitt: [], na: [], chutes: [], tft: [] }
        }

        quittances.forEach(r => {
          const sa = (r.sous_agent || '').trim()
          if (!sa || sa === '-' || EXCLURE.has(sa)) return
          const code = nameToCode[sa] || sa.substring(0, 3).toUpperCase()
          ensure(code)
          const com = r.commission || 0
          const taux = TAUX[code] || (EMPLOYES.has(code) ? 1 : 0.20)
          reelMap[code].com_nette += com
          reelMap[code].com_dynassur += com * taux
          if (isVie(r.domaine)) reelMap[code].prime_vie += r.prime_totale || 0
          rawMap[code].quitt.push(r)
        })

        // Agréger mouvements 2026
        mouvements.forEach(r => {
          const sa = (r.sa_contrat || '').trim()
          if (!sa || EXCLURE.has(sa)) return
          const code = nameToCode[sa] || sa.split(' ')[0].toUpperCase().substring(0, 3)
          ensure(code)
          if (r.type_prod === 'N.A.') { reelMap[code].na++; rawMap[code].na.push(r) }
          else if (CHUTES.has(r.type_prod)) { reelMap[code].chutes++; rawMap[code].chutes.push(r) }
          else if (TFT.has(r.type_prod)) { reelMap[code].tft++; rawMap[code].tft.push(r) }
        })

        // Rétention réelle 2026
        Object.keys(reelMap).forEach(code => {
          const r = reelMap[code]
          r.retention = r.na > 0 ? (1 - r.chutes / r.na) * 100 : null
        })

        // Base rétention 2025
        const base2025 = {}
        mouv2025.forEach(r => {
          const sa = (r.sa_contrat || '').trim()
          if (!sa || EXCLURE.has(sa)) return
          const code = nameToCode[sa] || sa.split(' ')[0].toUpperCase().substring(0, 3)
          if (!base2025[code]) base2025[code] = { na: 0, chutes: 0 }
          if (r.type_prod === 'N.A.') base2025[code].na++
          else if (CHUTES.has(r.type_prod)) base2025[code].chutes++
        })
        Object.entries(base2025).forEach(([code, v]) => {
          ensure(code)
          reelMap[code].base2025 = v.na > 0 ? (1 - v.chutes / v.na) * 100 : null
        })

        setObjectifs(obj || [])
        setReel(reelMap)
        setRaw(rawMap)
      } catch (e) {
        console.error('ObjectifsView error:', e)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ fontFamily: "'Source Sans Pro', sans-serif", padding: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <i className="ti ti-target" style={{ fontSize: 20, color: C.blue }} />
          <h1 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>Objectifs 2026</h1>
          <Badge label="DYNASSUR" color={C.blue} pale={C.bluePale} />
        </div>
        <p style={{ fontSize: 12, color: C.textL, margin: 0 }}>Suivi production, commissions nettes et rétention</p>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', borderBottom: `2px solid ${C.border}`, marginBottom: 20, background: C.white, borderRadius: '10px 10px 0 0', padding: '0 4px' }}>
        {ONGLETS.map(o => {
          const active = onglet === o.key
          return (
            <button key={o.key} onClick={() => setOnglet(o.key)} style={{
              padding: '12px 18px', border: 'none', borderBottom: active ? `2px solid ${C.blue}` : '2px solid transparent',
              background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 400,
              color: active ? C.blue : C.textL, marginBottom: -2, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6
            }}>
              <i className={`ti ${o.icon}`} style={{ fontSize: 15 }} />
              {o.label}
            </button>
          )
        })}
      </div>

      {/* Contenu */}
      {onglet === 'commerciaux' && <OngletCommerciaux objectifs={objectifs} reel={reel} loading={loading} raw={raw} onDetail={onDetail} />}
      {onglet === 'sa' && <OngletSousAgents objectifs={objectifs} reel={reel} loading={loading} raw={raw} onDetail={onDetail} />}
      {onglet === 'retention' && <OngletRetention reel={reel} loading={loading} raw={raw} onDetail={onDetail} />}

      {detail && <DetailBoundary onClose={() => setDetail(null)}><DetailModal titre={detail.titre} kind={detail.kind} rows={detail.rows} onClose={() => setDetail(null)} /></DetailBoundary>}
    </div>
  )
}
