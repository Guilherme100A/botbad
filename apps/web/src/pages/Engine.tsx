import { engineStatus } from '../mock/data.js';

export function Engine() {
  const e = engineStatus;
  const budgetPct = (e.budgetUsedTokens / e.budgetLimitTokens) * 100;

  return (
    <>
      <div className="section">
        <h2 className="section-title">Motor JEV</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
          Configuração e saúde do motor de classificação. Dados demonstrativos.
        </p>

        <div className="info-grid">
          <div className="info-item">
            <div className="info-label">Modelo</div>
            <div className="info-value">{e.model}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Versão da política</div>
            <div className="info-value">{e.policyVersion}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Versão do perfil</div>
            <div className="info-value">{e.profileVersion}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Modo</div>
            <div className="info-value" style={{ textTransform: 'capitalize' }}>
              {e.mode === 'shadow' ? 'Shadow (observação)' : 'Ativo'}
            </div>
          </div>
          <div className="info-item">
            <div className="info-label">Timeout</div>
            <div className="info-value">{e.timeoutMs.toLocaleString('pt-BR')}ms</div>
          </div>
          <div className="info-item">
            <div className="info-label">Saúde</div>
            <div className="info-value">
              <span className={`health-dot ${e.healthy ? 'ok' : 'err'}`} />
              {e.healthy ? 'Operacional' : 'Indisponível'}
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Orçamento de tokens</h2>
        <div className="card" style={{ maxWidth: 480 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Consumo</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {e.budgetUsedTokens.toLocaleString('pt-BR')} / {e.budgetLimitTokens.toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${budgetPct}%` }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            {budgetPct.toFixed(1)}% utilizado
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Último health check</h2>
        <div className="card" style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 14 }}>
            {new Date(e.lastHealthCheck).toLocaleString('pt-BR')}
          </div>
        </div>
      </div>
    </>
  );
}
