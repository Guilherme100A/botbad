import { useState, useEffect } from 'react';
import type { Campaign, CampaignStatus, NetworkProfile, Destination } from '@botbad/contracts';
import {
  listCampaigns,
  listDestinations,
  createCampaign as apiCreateCampaign,
  createDestination as apiCreateDestination,
  activateCampaign,
  pauseCampaign,
  ApiError,
} from '../api/client.js';
import {
  initialCampaigns,
  initialDestinations,
  getDestination,
  SIMULATION_SCENARIOS,
  NETWORK_PROFILE_LABELS,
  STATUS_LABELS,
  ACTION_LABELS,
  SOURCE_LABELS,
  REASON_LABELS,
} from '../mock/data.js';

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [usingApi, setUsingApi] = useState(false);

  const [formName, setFormName] = useState('');
  const [formPrimaryUrl, setFormPrimaryUrl] = useState('');
  const [formAltUrl, setFormAltUrl] = useState('');
  const [formProfile, setFormProfile] = useState<NetworkProfile>('general');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, d] = await Promise.all([listCampaigns(), listDestinations()]);
        if (!cancelled) {
          setCampaigns(c);
          setDestinations(d);
          setUsingApi(true);
        }
      } catch {
        if (!cancelled) {
          setCampaigns(initialCampaigns);
          setDestinations(initialDestinations);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleCreate() {
    setFormError('');

    if (!formName.trim()) { setFormError('Nome é obrigatório.'); return; }
    if (!formPrimaryUrl.startsWith('https://')) { setFormError('Destino principal deve usar https.'); return; }
    if (!formAltUrl.startsWith('https://')) { setFormError('Destino alternativo deve usar https.'); return; }
    if (formPrimaryUrl === formAltUrl) { setFormError('Os destinos devem ser distintos.'); return; }

    if (usingApi) {
      setFormLoading(true);
      try {
        const [pd, ad] = await Promise.all([
          apiCreateDestination({ url: formPrimaryUrl, label: `Destino principal — ${formName}` }),
          apiCreateDestination({ url: formAltUrl, label: `Destino alternativo — ${formName}` }),
        ]);
        const campaign = await apiCreateCampaign({
          name: formName,
          primaryDestinationId: pd.id,
          alternativeDestinationId: ad.id,
          networkProfile: formProfile !== 'general' ? formProfile : undefined,
        });
        setDestinations(prev => [...prev, pd, ad]);
        setCampaigns(prev => [campaign, ...prev]);
        resetForm();
      } catch (err) {
        setFormError(err instanceof ApiError ? err.message : 'Erro ao criar campanha.');
      } finally {
        setFormLoading(false);
      }
      return;
    }

    const now = new Date().toISOString();
    const n = campaigns.length + destinations.length + 100;
    const pd: Destination = {
      id: `d-new-${n}-0000-4000-a000-000000000001`,
      tenantId: '00000000-0000-4000-a000-000000000001',
      url: formPrimaryUrl,
      label: `Destino principal — ${formName}`,
      createdAt: now, updatedAt: now,
    };
    const ad: Destination = {
      id: `d-new-${n}-0000-4000-a000-000000000002`,
      tenantId: '00000000-0000-4000-a000-000000000001',
      url: formAltUrl,
      label: `Destino alternativo — ${formName}`,
      createdAt: now, updatedAt: now,
    };
    const slug = formName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 128);
    const campaign: Campaign = {
      id: `c-new-${n}-0000-4000-a000-000000000001`,
      tenantId: '00000000-0000-4000-a000-000000000001',
      name: formName, slug,
      primaryDestinationId: pd.id, alternativeDestinationId: ad.id,
      networkProfile: formProfile, status: 'draft',
      policyVersion: '1.0.0', createdAt: now, updatedAt: now,
    };

    setDestinations(prev => [...prev, pd, ad]);
    setCampaigns(prev => [campaign, ...prev]);
    resetForm();
  }

  function resetForm() {
    setFormName('');
    setFormPrimaryUrl('');
    setFormAltUrl('');
    setFormProfile('general');
    setShowAdvanced(false);
    setShowCreate(false);
    setFormError('');
  }

  async function toggleStatus(id: string) {
    const c = campaigns.find(x => x.id === id);
    if (!c) return;

    if (usingApi) {
      setActionLoading(id);
      try {
        const updated = c.status === 'active'
          ? await pauseCampaign(id)
          : await activateCampaign(id);
        setCampaigns(prev => prev.map(x => x.id === id ? updated : x));
      } catch (err) {
        alert(err instanceof ApiError ? err.message : 'Erro ao alterar status.');
      } finally {
        setActionLoading(null);
      }
      return;
    }

    setCampaigns(prev => prev.map(x => {
      if (x.id !== id) return x;
      const next: CampaignStatus = x.status === 'active' ? 'paused' : 'active';
      return { ...x, status: next, updatedAt: new Date().toISOString() };
    }));
  }

  if (loading) {
    return <div className="loading"><div className="spinner" />Carregando campanhas…</div>;
  }

  if (campaigns.length === 0 && !showCreate) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <div className="empty-state-title">Nenhuma campanha</div>
        <div className="empty-state-desc">Crie sua primeira campanha para começar a rotear tráfego de forma inteligente.</div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Criar primeira campanha</button>
      </div>
    );
  }

  return (
    <>
      <div className="section-header">
        <h2 className="section-title" style={{ margin: 0 }}>Todas<span className="count">{campaigns.length}</span></h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>Nova campanha</button>
      </div>

      <div className="campaign-grid">
        {campaigns.map(c => {
          const isExpanded = simulating === c.id;
          const isLoading = actionLoading === c.id;

          return (
            <div className="campaign-card" key={c.id}>
              <div className="campaign-card-header">
                <span className="campaign-card-name">{c.name}</span>
                <span className={`badge badge-${c.status}`}>{STATUS_LABELS[c.status]}</span>
              </div>
              <div className="campaign-card-meta">
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  {NETWORK_PROFILE_LABELS[c.networkProfile]}
                </span>
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  <span className="mono">/r/{c.slug}</span>
                </span>
              </div>
              <div className="campaign-card-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSimulating(isExpanded ? null : c.id)}
                  style={{ flex: 1 }}
                >
                  {isExpanded ? 'Fechar' : 'Simular'}
                </button>
                {c.status !== 'archived' && (
                  <button
                    className={`btn btn-sm ${c.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => toggleStatus(c.id)}
                    disabled={isLoading}
                    style={{ flex: 1 }}
                  >
                    {isLoading ? '…' : c.status === 'active' ? 'Pausar' : 'Ativar'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {simulating && (() => {
        const campaign = campaigns.find(c => c.id === simulating);
        if (!campaign) return null;
        const primaryDest = getDestination(destinations, campaign.primaryDestinationId);
        const altDest = getDestination(destinations, campaign.alternativeDestinationId);

        return (
          <div className="section" style={{ marginTop: 24 }}>
            <h3 className="section-title">Simulação — {campaign.name}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 18 }}>
              Resultados de fixture identificados como dados demonstrativos. Não representam decisões reais do Jev.
            </p>
            {SIMULATION_SCENARIOS.map(sc => {
              const dest = sc.expectedAction === 'route_primary' ? primaryDest : altDest;
              return (
                <div className="sim-card" key={sc.key}>
                  <div className="sim-card-header">
                    <span className="sim-card-title">{sc.name}</span>
                    <span className={`badge badge-${sc.expectedAction}`}>
                      {ACTION_LABELS[sc.expectedAction]}
                    </span>
                  </div>
                  <div className="sim-detail">
                    {sc.description}<br />
                    <strong>Origem:</strong> {SOURCE_LABELS[sc.expectedSource]} &middot;{' '}
                    <strong>Motivo:</strong> {REASON_LABELS[sc.expectedReasonCode]}<br />
                    {dest && <><strong>Destino:</strong> {dest.url}</>}
                    {sc.expectedAssessment && <><br /><strong>Classificação:</strong> {sc.expectedAssessment}</>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {showCreate && (
        <div className="overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Nova campanha</h3>
            <p className="modal-desc">
              Visitantes humanos recebem a página principal. Bots e automação recebem a alternativa.
            </p>

            {formError && <div className="error-box">{formError}</div>}

            <div className="form-group">
              <label className="form-label">Nome da campanha</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Ex.: Oferta de verao"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Destino principal (https)</label>
              <input
                value={formPrimaryUrl}
                onChange={e => setFormPrimaryUrl(e.target.value)}
                placeholder="https://exemplo.com/landing"
              />
              <div className="form-hint">Página mostrada a clientes prováveis.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Destino alternativo (https)</label>
              <input
                value={formAltUrl}
                onChange={e => setFormAltUrl(e.target.value)}
                placeholder="https://exemplo.com/alt"
              />
              <div className="form-hint">Página mostrada a bots e automação.</div>
            </div>

            <button
              className="advanced-toggle"
              onClick={() => setShowAdvanced(v => !v)}
              type="button"
            >
              {showAdvanced ? '▾' : '▸'} Opções avançadas
            </button>

            {showAdvanced && (
              <div className="form-group">
                <label className="form-label">Origem da campanha (opcional)</label>
                <select
                  value={formProfile}
                  onChange={e => setFormProfile(e.target.value as NetworkProfile)}
                >
                  {(Object.entries(NETWORK_PROFILE_LABELS) as [NetworkProfile, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <div className="form-hint">Contexto para relatórios. Não prova de onde o visitante veio.</div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={formLoading}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={formLoading}>
                {formLoading ? 'Criando…' : 'Criar campanha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
