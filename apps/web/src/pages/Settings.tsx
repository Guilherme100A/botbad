import { tenantSettings } from '../mock/data.js';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  operator: 'Operador',
  viewer: 'Visualizador',
};

export function Settings() {
  const { tenant, members, limits } = tenantSettings;

  return (
    <>
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
                  <td className="mono">{m.userId.slice(0, 8)}...</td>
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
            <div className="info-label">Campanhas máximas</div>
            <div className="info-value info-value-number">{limits.maxCampaigns}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Destinos máximos</div>
            <div className="info-value info-value-number">{limits.maxDestinations}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Req/minuto</div>
            <div className="info-value info-value-number">{limits.maxRequestsPerMinute.toLocaleString('pt-BR')}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Orçamento diário Jev</div>
            <div className="info-value info-value-number">{limits.jevBudgetDailyTokens.toLocaleString('pt-BR')} tokens</div>
          </div>
        </div>
      </div>
    </>
  );
}
