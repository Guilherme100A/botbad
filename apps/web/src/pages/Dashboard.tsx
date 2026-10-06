import { useState, useEffect } from 'react';
import { dashboardStats, engineStatus } from '../mock/data.js';

export function Dashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Carregando painel...
      </div>
    );
  }

  const s = dashboardStats;

  return (
    <>
      {/* Onboarding */}
      <div className="onboarding">
        <div className="onboarding-step">
          <div className="onboarding-num">1</div>
          <div className="onboarding-title">Configurar páginas</div>
          <div className="onboarding-desc">Defina o destino principal e alternativo da campanha.</div>
        </div>
        <div className="onboarding-step">
          <div className="onboarding-num">2</div>
          <div className="onboarding-title">Simular</div>
          <div className="onboarding-desc">Teste os 4 cenários de classificação com fixtures.</div>
        </div>
        <div className="onboarding-step">
          <div className="onboarding-num">3</div>
          <div className="onboarding-title">Ativar</div>
          <div className="onboarding-desc">Ative o roteamento após validar os resultados.</div>
        </div>
      </div>

      {/* Main stats */}
      <div className="section">
        <h2 className="section-title">Acessos e destinos</h2>
        <div className="card-grid">
          <div className="card">
            <div className="card-label">Total de acessos</div>
            <div className="card-value">{s.totalAccesses.toLocaleString('pt-BR')}</div>
          </div>
          <div className="card">
            <div className="card-label">Página principal</div>
            <div className="card-value" style={{ color: 'var(--green)' }}>{s.routePrimary.toLocaleString('pt-BR')}</div>
            <div className="card-sub">{((s.routePrimary / s.totalAccesses) * 100).toFixed(1)}% dos acessos</div>
          </div>
          <div className="card">
            <div className="card-label">Página alternativa</div>
            <div className="card-value" style={{ color: 'var(--red)' }}>{s.routeAlternative.toLocaleString('pt-BR')}</div>
            <div className="card-sub">{((s.routeAlternative / s.totalAccesses) * 100).toFixed(1)}% dos acessos</div>
          </div>
          <div className="card">
            <div className="card-label">Latência p95</div>
            <div className="card-value">{s.latencyP95Ms}ms</div>
          </div>
        </div>
      </div>

      {/* Decision sources */}
      <div className="section">
        <h2 className="section-title">Origem das decisões</h2>
        <div className="card-grid">
          <div className="card">
            <div className="card-label">Regra</div>
            <div className="card-value-sm">{s.decisionSources.rule.toLocaleString('pt-BR')}</div>
            <div className="card-sub">Bots verificados e limites</div>
          </div>
          <div className="card">
            <div className="card-label">Cache</div>
            <div className="card-value-sm">{s.decisionSources.cache.toLocaleString('pt-BR')}</div>
            <div className="card-sub">Decisões equivalentes reutilizadas</div>
          </div>
          <div className="card">
            <div className="card-label">Jev</div>
            <div className="card-value-sm">{s.decisionSources.jev.toLocaleString('pt-BR')}</div>
            <div className="card-sub">Classificação pelo motor</div>
          </div>
          <div className="card">
            <div className="card-label">Fallback</div>
            <div className="card-value-sm">{s.decisionSources.fallback.toLocaleString('pt-BR')}</div>
            <div className="card-sub">Motor indisponível</div>
          </div>
        </div>
      </div>

      {/* Engine health */}
      <div className="section">
        <h2 className="section-title">Saúde do motor</h2>
        <div className="card" style={{ maxWidth: 400 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className={`health-dot ${engineStatus.healthy ? 'ok' : 'err'}`} />
            <span style={{ fontWeight: 600 }}>{engineStatus.healthy ? 'Operacional' : 'Indisponível'}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Modelo: {engineStatus.model} &middot; Modo: {engineStatus.mode}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="section">
        <a href="#/campaigns" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          + Criar campanha
        </a>
      </div>
    </>
  );
}
