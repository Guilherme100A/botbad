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

const PAGE_SIZE = 10;

export function History() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
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
    return <div className="loading"><div className="spinner" />Carregando histórico...</div>;
  }

  const total = events.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageEvents = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (total === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div className="empty-state-title">Nenhum evento registrado</div>
        <div className="empty-state-desc">O histórico de decisões aparecerá aqui.</div>
      </div>
    );
  }

  return (
    <div className="section">
      <DemoBadge show={demo} />
      <div className="section-header">
        <h2 className="section-title" style={{ margin: 0 }}>Eventos<span className="count">{total}</span></h2>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Campanha</th>
              <th>Ação</th>
              <th>Destino</th>
              <th>Origem</th>
              <th>Motivo</th>
              <th>Classificação</th>
              <th>Confiança</th>
              <th>Duração</th>
            </tr>
          </thead>
          <tbody>
            {pageEvents.map(ev => {
              const campaign = getCampaignById(campaigns, ev.campaignId);
              const dest = getDestination(destinations, ev.destinationId);
              const ts = new Date(ev.timestamp);

              return (
                <tr key={ev.id}>
                  <td className="num">
                    {ts.toLocaleDateString('pt-BR')} {ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td>{campaign?.name ?? '—'}</td>
                  <td><span className={`badge badge-${ev.action}`}>{ACTION_LABELS[ev.action]}</span></td>
                  <td className="mono truncate">
                    {dest?.url ?? '—'}
                  </td>
                  <td>{SOURCE_LABELS[ev.source]}</td>
                  <td className="dim">
                    {REASON_LABELS[ev.reasonCode] ?? ev.reasonCode}
                  </td>
                  <td className="dim">{ev.jevAssessment ?? '—'}</td>
                  <td className="num">{ev.jevConfidence != null ? `${(ev.jevConfidence * 100).toFixed(0)}%` : '—'}</td>
                  <td className="num">{ev.durationMs}ms</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="págination">
        <button
          className="btn btn-secondary btn-sm"
          disabled={page === 0}
          onClick={() => setPage(p => p - 1)}
        >
          Anterior
        </button>
        <span className="num">
          {page + 1} / {totalPages}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page >= totalPages - 1}
          onClick={() => setPage(p => p + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
