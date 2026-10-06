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
    if (!formPrimaryUrl.startsWith('https://')) { setFormError('Destino principal deve usar HTTPS.'); return; }
    if (!formAltUrl.startsWith('https://')) { setFormError('Destino alternativo deve usar HTTPS.'); return; }
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
    return <div className="loading"><div className="spinner" />Carregando campanhas...</div>;
  }

  if (campaigns.length === 0 && !showCreate) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#9776;</div>
        <div className="empty-state-title">Nenhuma campanha</div>
        <p>Crie sua primeira campanha para começar a rotear tráfego.</p>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setShowCreate(true)}>+ Criar campanha</button>
      </div>
    );
  }

  return (
    <>
      <div className="section-header">
        <h2 className="section-title" style={{ margin: 0 }}>Campanhas ({campaigns.length})</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Criar campanha</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Status</th>
              <th>Origem</th>
              <th>Slug</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(c => {
              const primaryDest = getDestination(destinations, c.primaryDestinationId);
              const altDest = getDestination(destinations, c.alternativeDestinationId);
              const isExpanded = simulating === c.id;
              const isLoading = actionLoading === c.id;

              return (
                <tr key={c.id} style={{ verticalAlign: 'top' }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {primaryDest?.url ?? '—'} → {altDest?.url ?? '—'}
                    </div>
                  </td>
                  <td><span className={`badge badge-${c.status}`}>{STATUS_LABELS[c.status]}</span></td>
                  <td>{NETWORK_PROFILE_LABELS[c.networkProfile]}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>/r/{c.slug}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSimulating(isExpanded ? null : c.id)}
                      >
                        {isExpanded ? 'Fechar' : 'Simular'}
                      </button>
                      {c.status !== 'archived' && (
                        <button
                          className={`btn btn-sm ${c.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                          onClick={() => toggleStatus(c.id)}
                          disabled={isLoading}
                        >
                          {isLoading ? '...' : c.status === 'active' ? 'Pausar' : 'Ativar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Simulation panel */}
      {simulating && (() => {
        const campaign = campaigns.find(c => c.id === simulating);
        if (!campaign) return null;
        const primaryDest = getDestination(destinations, campaign.primaryDestinationId);
        const altDest = getDestination(destinations, campaign.alternativeDestinationId);

        return (
          <div className="section" style={{ marginTop: 24 }}>
            <h3 className="section-title">Simulação — {campaign.name}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
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

      {/* Create campaign modal */}
      {showCreate && (
        <div className="overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Criar campanha</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Clientes prováveis recebem a página principal. Bots identificados e automação provável recebem a página alternativa.
            </p>

            {formError && <div className="error-box" style={{ marginBottom: 20 }}>{formError}</div>}

            <div className="form-group">
              <label className="form-label">Nome da campanha</label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Ex: Oferta de Verão"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Destino principal (HTTPS)</label>
              <input
                value={formPrimaryUrl}
                onChange={e => setFormPrimaryUrl(e.target.value)}
                placeholder="https://exemplo.com/landing"
              />
              <div className="form-hint">Página mostrada a clientes prováveis.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Destino alternativo (HTTPS)</label>
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
                {formLoading ? 'Criando...' : 'Criar campanha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
