import Layout from '../../components/Layout'
import { SYNCS, SyncCard, WebhookStatus } from '../../components/SyncCards'

const BLUE = '#0080BD'
const NAVY = '#0D2F5E'

export default function SyncCenter() {
  return (
    <Layout currentPage="Synchronisation">
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      <div style={{ fontFamily:"'Source Sans Pro',sans-serif", maxWidth:1100 }}>
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <i className="ti ti-refresh" style={{ fontSize:20, color:BLUE }} />
            <h1 style={{ fontSize:20, fontWeight:800, color:NAVY, margin:0 }}>Centre de synchronisation</h1>
          </div>
          <p style={{ fontSize:13, color:'#64748b', margin:0 }}>
            Lance manuellement les imports de données. Chaque synchronisation tourne en arrière-plan via n8n.
          </p>
        </div>

        <WebhookStatus />

        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'10px 14px', marginBottom:18, fontSize:12, color:'#92400e', display:'flex', gap:8, alignItems:'flex-start' }}>
          <i className="ti ti-info-circle" style={{ fontSize:15, marginTop:1, flexShrink:0 }} />
          <span>Les compteurs se rafraîchissent automatiquement quelques secondes après le lancement. Une synchro complète peut prendre 1 à 2 minutes selon le volume.</span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(330px,1fr))', gap:16 }}>
          {SYNCS.map(s => <SyncCard key={s.key} sync={s} />)}
        </div>
      </div>
    </Layout>
  )
}
