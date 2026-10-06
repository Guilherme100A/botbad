import { useState, useEffect } from 'react';
import { listCampaigns } from '../api/client.js';
import { dashboardStats, engineStatus, initialCampaigns } from '../mock/data.js';
import type { Campaign } from '@botbad/contracts';

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
        Carregando painel...
      </div>
    );
  }

  const s = dashboardStats;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const totalCampaigns = campaigns.length;
  const budgetPct = (engineStatus.budgetUsedTokens / engineStatus.budgetLimitTokens) * 100;

  return (
    <>
      <div className="welcome-banner">
        <div className="welcome-text">
          <h2>Bem-vindo ao JEV Traffic Router</h2>
          <p>Configure campanhas de roteamento inteligente. O motor JEV classifica visitantes e direciona ao destino correto.</p>
        </div>
        <a href="#/campaigns" className="btn btn-primary" style={{ textDecoration: 'none', flexShrink: 0 }}>
          + Nova campanha
        </a>
      </div>

      <div className="onboarding">
        <div className="onboarding-step">
          <div className="onboarding-num">1</div>
          <div className="onboarding-title">Configurar destinos</div>
          <div className="onboarding-desc">Defina a pagina principal (humanos) e alternativa (bots).</div>
        </div>
        <div className="onboarding-step">
          <div className="onboarding-num">2</div>
          <div className="onboarding-title">Simular cenarios</div>
          <div className="onboarding-desc">Teste os 4 perfis de visitante com dados de fixture.</div>
        </div>
        <div className="onboarding-step">
          <div className="onboarding-num">3</div>
          <div className="onboarding-title">Ativar roteamento</div>
          <div className="onboarding-desc">Ative a campanha e monitore as decisoes em tempo real.</div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Campanhas</h2>
        <div className="card-grid">
          <div className="card">
            <div className="card-label">Total</div>
            <div className="card-value">{totalCampaigns}</div>
          </div>
          <div className="card">
            <div className="card-label">Ativas</div>
            <div className="card-value" style={{ color: 'var(--green)' }}>{activeCampaigns}</div>
          </div>
          <div className="card">
            <div className="card-label">Motor</div>
            <div className="card-value-sm">
              <span className={`health-dot ${engineStatus.healthy ? 'ok' : 'err'}`} />
              {engineStatus.healthy ? 'Online' : 'Offline'}
            </div>
          </div>
          <div className="card">
            <div className="card-label">Orcamento</div>
            <div className="card-value-sm">{budgetPct.toFixed(0)}%</div>
            <div className="progress-bar" style={{ marginTop: 8 }}>
              <div className="progress-fill" style={{ width: `${budgetPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Acessos e decisoes</h2>
        <div className="card-grid">
          <div className="card">
            <div className="card-label">Total de acessos</div>
            <div className="card-value">{s.totalAccesses.toLocaleString('pt-BR')}</div>
          </div>
          <div className="card">
            <div className="card-label">Pagina principal</div>
            <div className="card-value" style={{ color: 'var(--green)' }}>{s.routePrimary.toLocaleString('pt-BR')}</div>
            <div className="card-sub">{((s.routePrimary / s.totalAccesses) * 100).toFixed(1)}% dos acessos</div>
          </div>
          <div className="card">
            <div className="card-label">Pagina alternativa</div>
            <div className="card-value" style={{ color: 'var(--red)' }}>{s.routeAlternative.toLocaleString('pt-BR')}</div>
            <div className="card-sub">{((s.routeAlternative / s.totalAccesses) * 100).toFixed(1)}% dos acessos</div>
          </div>
          <div className="card">
            <div className="card-label">Latencia p95</div>
            <div className="card-value">{s.latencyP95Ms}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>ms</span></div>
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Origem das decisoes</h2>
        <div className="card-grid">
          <div className="card">
            <div className="card-label">Regra</div>
            <div className="card-value-sm">{s.decisionSources.rule.toLocaleString('pt-BR')}</div>
            <div className="card-sub">Bots verificados e limites</div>
          </div>
          <div className="card">
            <div className="card-label">Cache</div>
            <div className="card-value-sm">{s.decisionSources.cache.toLocaleString('pt-BR')}</div>
            <div className="card-sub">Decisoes reutilizadas</div>
          </div>
          <div className="card">
            <div className="card-label">Jev</div>
            <div className="card-value-sm">{s.decisionSources.jev.toLocaleString('pt-BR')}</div>
            <div className="card-sub">Classificacao pelo motor</div>
          </div>
          <div className="card">
            <div className="card-label">Fallback</div>
            <div className="card-value-sm">{s.decisionSources.fallback.toLocaleString('pt-BR')}</div>
            <div className="card-sub">Motor indisponivel</div>
          </div>
        </div>
      </div>
    </>
  );
}
