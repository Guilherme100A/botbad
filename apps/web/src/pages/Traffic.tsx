import { useState, useEffect } from 'react';
import {
  decisionEvents,
  initialCampaigns,
  initialDestinations,
  getDestination,
  getCampaignById,
  ACTION_LABELS,
  SOURCE_LABELS,
  REASON_LABELS,
} from '../mock/data.js';

export function Traffic() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner" />Carregando decisões...</div>;
  }

  const recent = decisionEvents.slice(0, 15);

  if (recent.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#8644;</div>
        <div className="empty-state-title">Nenhuma decisão recente</div>
        <p>As decisões de roteamento aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <>
      <div className="section">
        <h2 className="section-title">Decisões recentes</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Campanha</th>
                <th>Ação</th>
                <th>Destino</th>
                <th>Origem</th>
                <th>Motivo</th>
                <th>Duração</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(ev => {
                const campaign = getCampaignById(initialCampaigns, ev.campaignId);
                const dest = getDestination(initialDestinations, ev.destinationId);
                const time = new Date(ev.timestamp);
                const timeStr = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                return (
                  <tr key={ev.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{timeStr}</td>
                    <td>{campaign?.name ?? '—'}</td>
                    <td><span className={`badge badge-${ev.action}`}>{ACTION_LABELS[ev.action]}</span></td>
                    <td style={{ fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dest?.url ?? '—'}
                    </td>
                    <td>{SOURCE_LABELS[ev.source]}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {REASON_LABELS[ev.reasonCode] ?? ev.reasonCode}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{ev.durationMs}ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
