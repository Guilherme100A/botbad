import { useState, useEffect } from 'react';
import type { Campaign, Destination, DecisionEvent } from '@botbad/contracts';
import { listCampaigns, listDestinations, listEvents } from '../api/client.js';
import { DemoBadge } from '../components/DemoBadge.js';
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
  const [events, setEvents] = useState<DecisionEvent[]>([]);
  const [demo, setDemo] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, d] = await Promise.all([listCampaigns(), listDestinations()]);
        if (cancelled) return;
        setCampaigns(c);
        setDestinations(d);
        const ev = await listEvents(100);
        if (!cancelled) setEvents(ev);
      } catch {
        // API unreachable: show the demo fixture, labeled as such (never mixed with real data).
        if (!cancelled) {
          setCampaigns(initialCampaigns);
          setDestinations(initialDestinations);
          setEvents(decisionEvents);
          setDemo(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner" />Carregando decisões...</div>;
  }

  const recent = events.slice(0, 15);

  if (recent.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </div>
        <div className="empty-state-title">Nenhuma decisão recente</div>
        <div className="empty-state-desc">As decisões de roteamento aparecerão aqui.</div>
      </div>
    );
  }

  return (
    <div className="section">
      <DemoBadge show={demo} />
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
              const campaign = getCampaignById(campaigns, ev.campaignId);
              const dest = getDestination(destinations, ev.destinationId);
              const time = new Date(ev.timestamp);
              const timeStr = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

              return (
                <tr key={ev.id}>
                  <td className="num">{timeStr}</td>
                  <td>{campaign?.name ?? '—'}</td>
                  <td><span className={`badge badge-${ev.action}`}>{ACTION_LABELS[ev.action]}</span></td>
                  <td className="mono truncate">
                    {dest?.url ?? '—'}
                  </td>
                  <td>{SOURCE_LABELS[ev.source]}</td>
                  <td className="dim">
                    {REASON_LABELS[ev.reasonCode] ?? ev.reasonCode}
                  </td>
                  <td className="num">{ev.durationMs}ms</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
