import { engineStatus } from '../mock/data.js';

export function Engine() {
  const e = engineStatus;
  const budgetPct = (e.budgetUsedTokens / e.budgetLimitTokens) * 100;

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: 'Modelo', value: e.model, mono: true },
    { label: 'Versão da política', value: e.policyVersion, mono: true },
    { label: 'Versão do perfil', value: e.profileVersion, mono: true },
    { label: 'Modo', value: e.mode === 'shadow' ? 'Shadow (observação)' : 'Ativo' },
    { label: 'Timeout', value: `${e.timeoutMs.toLocaleString('pt-BR')} ms`, mono: true },
    { label: 'Último health check', value: new Date(e.lastHealthCheck).toLocaleString('pt-BR') },
  ];

  return (
    <>
      <div className="card-grid section">
        <div className="card">
          <div className="card-label">Saúde</div>
          <div className="card-value-sm" style={{ height: 35 }}>
            <span className={`health-dot ${e.healthy ? 'ok' : 'err'}`} />
            {e.healthy ? 'Operacional' : 'Indisponível'}
          </div>
        </div>
        <div className="card span-2">
          <div className="card-label">Orçamento de tokens</div>
          <div className="card-value">
            {budgetPct.toFixed(1).replace('.', ',')}<span className="unit">%</span>
          </div>
          <div className="progress-bar" style={{ marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${budgetPct}%` }} />
          </div>
          <div className="card-sub num">
            {e.budgetUsedTokens.toLocaleString('pt-BR')} / {e.budgetLimitTokens.toLocaleString('pt-BR')}
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Configuração</h2>
        <div className="list">
          {rows.map(r => (
            <div className="list-row" key={r.label}>
              <div className="list-row-main list-row-title">{r.label}</div>
              <div className={`list-row-value ${r.mono ? 'num' : ''}`} style={{ color: 'var(--text-2)' }}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
