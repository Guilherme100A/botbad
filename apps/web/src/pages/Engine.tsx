import { getEngineStatus } from '../api/client.js';
import { DEMO_ENGINE } from '../mock/data.js';
import { useApiData } from '../hooks/useApiData.js';
import { DemoBadge } from '../components/DemoBadge.js';

const ADAPTER_LABELS = { real: 'TypeSafe (API direta)', openrouter: 'OpenRouter (avaliação)', mock: 'Simulado (desenvolvimento)' } as const;
const CIRCUIT_LABELS = { closed: 'Normal', open: 'Aberto — usando fallback', 'half-open': 'Testando recuperação' } as const;

export function Engine() {
  const { data: e, demo, loading } = useApiData(getEngineStatus, DEMO_ENGINE);

  if (loading) {
    return <div className="loading"><div className="spinner" />Carregando motor…</div>;
  }

  const budgetPct = e.budget.monthlyLimit > 0 ? Math.min(100, (e.budget.usedMonth / e.budget.monthlyLimit) * 100) : 0;
  const pctLabel = (n: number) => `${Math.round(n * 100)}%`;

  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: 'Adaptador', value: ADAPTER_LABELS[e.adapter] },
    { label: 'Modelo', value: e.model, mono: true },
    { label: 'Versão da política', value: e.policyVersion, mono: true },
    { label: 'Versão do perfil', value: e.profileVersion, mono: true },
    { label: 'Modo', value: e.mode === 'shadow' ? 'Shadow (observação)' : 'Ativo' },
    { label: 'Timeout', value: `${e.timeoutMs.toLocaleString('pt-BR')} ms`, mono: true },
    { label: 'Circuito', value: CIRCUIT_LABELS[e.circuit] },
    { label: 'Confiança mínima p/ principal', value: pctLabel(e.thresholds.primary), mono: true },
    { label: 'Confiança mínima p/ automação', value: pctLabel(e.thresholds.automation), mono: true },
    { label: 'Último health check', value: new Date(e.checkedAt).toLocaleString('pt-BR') },
  ];

  return (
    <>
      <DemoBadge show={demo} />

      <div className="card-grid section">
        <div className="card">
          <div className="card-label">Saúde</div>
          <div className="card-value-sm" style={{ height: 35 }}>
            <span className={`health-dot ${e.healthy ? 'ok' : 'err'}`} />
            {e.healthy ? 'Operacional' : 'Indisponível'}
          </div>
        </div>
        <div className="card span-2">
          <div className="card-label">Orçamento de tokens (mês)</div>
          <div className="card-value">
            {budgetPct.toFixed(1).replace('.', ',')}<span className="unit">%</span>
          </div>
          <div className="progress-bar" style={{ marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${budgetPct}%` }} />
          </div>
          <div className="card-sub num">
            {e.budget.usedMonth.toLocaleString('pt-BR')} / {e.budget.monthlyLimit.toLocaleString('pt-BR')}
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
