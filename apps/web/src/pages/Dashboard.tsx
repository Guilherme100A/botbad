import { getEngineStatus, getMetricsSummary, listCampaigns } from '../api/client.js';
import { DEMO_ENGINE, DEMO_METRICS, initialCampaigns } from '../mock/data.js';
import { useApiData } from '../hooks/useApiData.js';
import { DemoBadge } from '../components/DemoBadge.js';

export function Dashboard() {
  const metrics = useApiData(() => getMetricsSummary(30), DEMO_METRICS);
  const engine = useApiData(getEngineStatus, DEMO_ENGINE);
  const campaignList = useApiData(listCampaigns, initialCampaigns);

  if (metrics.loading || engine.loading || campaignList.loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Carregando painel…
      </div>
    );
  }

  const s = metrics.data;
  const e = engine.data;
  const campaigns = campaignList.data;
  const demo = metrics.demo || engine.demo || campaignList.demo;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalCampaigns = campaigns.length;
  const budgetPct = e.budget.monthlyLimit > 0 ? Math.min(100, (e.budget.usedMonth / e.budget.monthlyLimit) * 100) : 0;

  const fmt = (n: number) => n.toLocaleString('pt-BR');
  const pct = (n: number) => `${((n / s.totalAccesses) * 100).toFixed(1).replace('.', ',')}%`;

  const split = [
    { key: 'primary', label: 'Página principal', value: s.routePrimary, cls: 'c-primary' },
    { key: 'alt', label: 'Página alternativa', value: s.routeAlternative, cls: 'c-alt' },
    { key: 'challenge', label: 'Desafio', value: s.challenge, cls: 'c-challenge' },
    { key: 'deny', label: 'Negado', value: s.deny, cls: 'c-deny' },
  ];

  const sources = [
    { label: 'Jev', sub: 'Classificação pelo motor', value: s.decisionSources.jev },
    { label: 'Regra', sub: 'Bots verificados e limites', value: s.decisionSources.rule },
    { label: 'Cache', sub: 'Decisões reutilizadas', value: s.decisionSources.cache },
    { label: 'Fallback', sub: 'Motor indisponível', value: s.decisionSources.fallback },
  ];
  const sourcesTotal = sources.reduce((a, x) => a + x.value, 0);

  return (
    <>
      <DemoBadge show={demo} />

      <section className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-eyebrow">Acessos nos últimos {s.days} dias</div>
            <div className="hero-value">{fmt(s.totalAccesses)}</div>
            <div className="hero-caption">
              {s.totalAccesses > 0
                ? `${pct(s.routePrimary)} chegaram à página principal`
                : 'Nenhum acesso ainda — ative uma campanha e compartilhe o link /r/…'}
            </div>
          </div>
          <a className="btn btn-primary" href="#/campaigns">Nova campanha</a>
        </div>

        {s.totalAccesses > 0 && (
          <>
            <div className="split-bar" role="img" aria-label="Distribuição das decisões">
              {split.map(x => <span key={x.key} className={x.cls} style={{ flexGrow: x.value }} />)}
            </div>

            <div className="legend">
              {split.map(x => (
                <div className="legend-item" key={x.key}>
                  <span className={`swatch ${x.cls}`} />
                  {x.label}
                  <span className="num">{fmt(x.value)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="card-grid section">
        <div className="card">
          <div className="card-label">Campanhas ativas</div>
          <div className="card-value">{activeCampaigns}<span className="unit">/ {totalCampaigns}</span></div>
        </div>
        <div className="card">
          <div className="card-label">Latência p95</div>
          <div className="card-value">
            {s.latencyP95Ms ?? '—'}{s.latencyP95Ms != null && <span className="unit">ms</span>}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Motor</div>
          <div className="card-value-sm" style={{ height: 35 }}>
            <span className={`health-dot ${e.healthy ? 'ok' : 'err'}`} />
            {e.healthy ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Orçamento Jev (mês)</div>
          <div className="card-value">{budgetPct.toFixed(0)}<span className="unit">%</span></div>
          <div className="progress-bar" style={{ marginTop: 12 }}>
            <div className="progress-fill" style={{ width: `${budgetPct}%` }} />
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Origem das decisões</h2>
        <div className="list">
          {sources.map(x => (
            <div className="list-row" key={x.label}>
              <div className="list-row-main">
                <div className="list-row-title">{x.label}</div>
                <div className="list-row-sub">{x.sub}</div>
              </div>
              <div className="list-row-meter progress-bar">
                <div className="progress-fill" style={{ width: `${sourcesTotal ? (x.value / sourcesTotal) * 100 : 0}%` }} />
              </div>
              <div className="list-row-value num" style={{ minWidth: 64 }}>{fmt(x.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
