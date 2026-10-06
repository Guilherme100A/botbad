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

const PAGE_SIZE = 10;

export function History() {
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner" />Carregando histórico...</div>;
  }

  const total = decisionEvents.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageEvents = decisionEvents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (total === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128340;</div>
        <div className="empty-state-title">Nenhum evento registrado</div>
        <p>O histórico de decisões aparecerá aqui.</p>
      </div>
    );
  }

  return (
    <>
      <div className="section">
        <div className="section-header">
          <h2 className="section-title" style={{ margin: 0 }}>Histórico de eventos ({total})</h2>
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
                const campaign = getCampaignById(initialCampaigns, ev.campaignId);
                const dest = getDestination(initialDestinations, ev.destinationId);
                const ts = new Date(ev.timestamp);

                return (
                  <tr key={ev.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {ts.toLocaleDateString('pt-BR')} {ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td>{campaign?.name ?? '—'}</td>
                    <td><span className={`badge badge-${ev.action}`}>{ACTION_LABELS[ev.action]}</span></td>
                    <td style={{ fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dest?.url ?? '—'}
                    </td>
                    <td>{SOURCE_LABELS[ev.source]}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {REASON_LABELS[ev.reasonCode] ?? ev.reasonCode}
                    </td>
                    <td>{ev.jevAssessment ?? '—'}</td>
                    <td>{ev.jevConfidence != null ? `${(ev.jevConfidence * 100).toFixed(0)}%` : '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{ev.durationMs}ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button
            className="btn btn-secondary btn-sm"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
          >
            &#8592; Anterior
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Página {page + 1} de {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
          >
            Próxima &#8594;
          </button>
        </div>
      </div>
    </>
  );
}
