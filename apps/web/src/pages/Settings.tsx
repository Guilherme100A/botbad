import { getTenant } from '../api/client.js';
import { DEMO_TENANT } from '../mock/data.js';
import { useApiData } from '../hooks/useApiData.js';
import { DemoBadge } from '../components/DemoBadge.js';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  operator: 'Operador',
  viewer: 'Visualizador',
};

export function Settings() {
  const { data, demo, loading } = useApiData(getTenant, DEMO_TENANT);

  if (loading) {
    return <div className="loading"><div className="spinner" />Carregando configurações…</div>;
  }

  const { tenant, members, limits } = data;
  const n = (v: number) => v.toLocaleString('pt-BR');

  return (
    <>
      <DemoBadge show={demo} />

      <div className="section">
        <h2 className="section-title">Organização</h2>
        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Nome</div>
            <div className="info-value">{tenant.name}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Identificador</div>
            <div className="info-value mono">{tenant.id}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Criada em</div>
            <div className="info-value">{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</div>
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Membros e papéis</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Papel</th>
                <th>Desde</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td>{m.name ? <>{m.name} <span className="dim">· {m.email}</span></> : m.email}</td>
                  <td><span className={`badge badge-${m.role === 'owner' ? 'active' : m.role === 'operator' ? 'paused' : 'draft'}`}>{ROLE_LABELS[m.role] ?? m.role}</span></td>
                  <td className="dim">{new Date(m.createdAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Limites</h2>
        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Acessos por dia</div>
            <div className="info-value info-value-number">{n(limits.requestsPerDay)}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Acessos por mês</div>
            <div className="info-value info-value-number">{n(limits.requestsPerMonth)}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Por visitante (req/min)</div>
            <div className="info-value info-value-number">{n(limits.requestsPerMinutePerVisitor)}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Orçamento Jev por dia</div>
            <div className="info-value info-value-number">{n(limits.jevTokensPerDay)} tokens</div>
          </div>
        </div>
      </div>
    </>
  );
}
