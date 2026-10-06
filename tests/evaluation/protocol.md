# Evaluation Protocol — JEV Traffic Router

Version: 1.0 (T0 draft) · Status: defined, not yet executed.

## 1. Statistical Protocol

### Labeled set requirements
- Independent of Jev: labels assigned by human reviewers or ground-truth signals, never by the Jev model itself.
- Temporal separation: evaluation data collected in a time window disjoint from any threshold tuning or rubric adjustment period.
- Session/campaign separation: no session or campaign appears in both tuning and evaluation sets.
- Minimum classes represented:
  - Human visitors (general profile, campaigns without origin specified)
  - Abusive automation (volumetric, scraping, credential stuffing patterns)
  - Non-abusive automation (legitimate crawlers, preview bots, monitoring)
  - Verified bots (Googlebot, Bingbot, and others with DNS-confirmable identity)
  - Missing signals (unavailable ASN, no UA, stripped headers)
  - Hostile inputs (forged UA, spoofed reverse DNS, injected headers)
  - Internal browsers (TikTok WebView, Instagram in-app browser, Facebook browser)

### Sample sufficiency
- Compute confidence intervals for all reported metrics using Wilson or Clopper-Pearson method.
- Block promotion to canary/production if the 95% CI width for any primary metric exceeds the threshold tolerance (e.g., if the CI for false-positive rate includes values above 1%).
- Minimum recommended: 500 labeled samples per major class; adjust upward if CIs are too wide.

## 2. Metrics

### Primary (gate-blocking)
| Metric | Target | Notes |
|--------|--------|-------|
| False positive rate (humans → alternative or challenge) | Upper bound 95% CI < 1% | Per profile promoted; report each path and union |
| Automation recall | ≥ 90% on labeled set | Report by class: abusive vs. non-abusive separately |
| Optimization recall loss | Upper bound unilateral 95% ≤ 1pp vs. no-optimization baseline | Paired comparison on same set |

### Secondary (reported, not gate-blocking at MVP)
| Metric | Description |
|--------|-------------|
| Confusion matrix | Human / automation / insufficient — predicted vs. actual |
| Precision by class | Per assessment category |
| Challenge accuracy | Rate of challenge-approved visitors that are actually human |
| Fallback rate by profile | Fraction of decisions falling to fallback, by network profile |
| Degradation by failure | Humans routed to alternative due to Jev timeout/error/budget |
| Abuse recall (rigid rules) | Confirmed abuse caught by rate-limiting/rules before Jev |

## 3. Baseline Comparisons

Three configurations, measured on the same labeled set:

1. **Rules-only**: mandatory controls + verified bot identity, no Jev.
2. **Jev-per-eligible**: every eligible decision calls Jev, cache disabled.
3. **Jev + optimizations**: Jev with cache/rules/context optimizations enabled.

Report all metrics from §2 for each. Optimizations accepted only if they pass the recall-loss gate.

## 4. Load Testing

### Scenarios
| Jev eligible fraction | Starting rate | Sustain target | Peak target |
|----------------------|---------------|----------------|-------------|
| 10% | 10 req/s | Subject to real account limits | — |
| 50% | 10 req/s | Subject to real account limits | — |
| 100% | 10 req/s | Subject to real account limits | — |

### Measurements
- p50 / p95 / p99 latency, separated by: rules/cache path vs. Jev path vs. fallback path.
- Latency targets: p95 < 50ms (rules/cache), p95 < 800ms (Jev path).
- Jev availability: ≥ 99% of eligible decisions (without rule/cache resolution) completed by Jev within deadline, under supported load and healthy provider.
- Fallback is NOT counted as Jev-delivered capacity.
- Measure separately: Jev-completed latency vs. fallback-triggered latency.

### Failure injection
- Jev timeout (600ms deadline exceeded)
- Invalid Jev response (malformed JSON, missing fields, probabilities not summing)
- HTTP 401 / 429 / 529 from provider
- Database unavailable
- Challenge provider unavailable
- Budget/capacity exhausted
- Overload (requests beyond measured capacity)

## 5. Promotion Gates

1. **Sample sufficient**: CIs computed and within tolerance — else block.
2. **False positive gate**: upper 95% CI < 1% — else block.
3. **Recall gate**: automation recall ≥ 90% — else block.
4. **Optimization gate**: if optimizations applied, unilateral 95% upper bound ≤ 1pp recall loss vs. baseline — else revert to baseline.
5. **Latency gate**: p95 within targets under sustained load — else investigate.
6. **Availability gate**: ≥ 99% Jev completion rate — else investigate.
7. **Failure behavior**: all injected failures result in defined restrictive behavior, no silent primary release — else block.

Inconclusive results or insufficient samples block the corresponding gate; they do not lower the requirement.
