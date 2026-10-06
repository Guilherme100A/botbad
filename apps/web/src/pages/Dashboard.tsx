import { useState, useEffect } from 'react';
import { listCampaigns } from '../api/client.js';
import { dashboardStats, engineStatus, initialCampaigns } from '../mock/data.js';
import type { Campaign } from '@botbad/contracts';
import { Scramble } from '../components/Scramble.js';
import { MatrixRain } from '../components/MatrixRain.js';

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await listCampaigns();
        if (!cancelled) setCampaigns(items);
      } catch {
        if (!cancelled) setCampaigns(initialCampaigns);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Carregando painel…
      </div>
    );
  }

  const s = dashboardStats;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalCampaigns = campaigns.length;
  const budgetPct = (engineStatus.budgetUsedTokens / engineStatus.budgetLimitTokens) * 100;

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
      <section className="hero">
        <MatrixRain className="hero-rain" size={14} interval={80} density={0.35} />
        <div className="hero-top">
          <div>
            <div className="hero-eyebrow">Acessos totais</div>
            <div className="hero-value"><Scramble text={fmt(s.totalAccesses)} duration={900} /></div>
            <div className="hero-caption">{pct(s.routePrimary)} chegaram à página principal</div>
          </div>
          <a className="btn btn-primary" href="#/campaigns">Nova campanha</a>
        </div>

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
      </section>

      <div className="card-grid section">
        <div className="card">
          <div className="card-label">Campanhas ativas</div>
          <div className="card-value"><Scramble text={String(activeCampaigns)} delay={150} /><span className="unit">/ {totalCampaigns}</span></div>
        </div>
        <div className="card">
          <div className="card-label">Latência p95</div>
          <div className="card-value"><Scramble text={String(s.latencyP95Ms)} delay={220} /><span className="unit">ms</span></div>
        </div>
        <div className="card">
          <div className="card-label">Motor</div>
          <div className="card-value-sm" style={{ height: 35 }}>
            <span className={`health-dot ${engineStatus.healthy ? 'ok' : 'err'}`} />
            {engineStatus.healthy ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Orçamento Jev</div>
          <div className="card-value"><Scramble text={budgetPct.toFixed(0)} delay={360} /><span className="unit">%</span></div>
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
                <div className="progress-fill" style={{ width: `${(x.value / sourcesTotal) * 100}%` }} />
              </div>
              <div className="list-row-value num" style={{ minWidth: 64 }}><Scramble text={fmt(x.value)} delay={300} /></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
