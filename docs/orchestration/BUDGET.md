# JEV Traffic Router — Orcamento

## Desenvolvimento por agentes

Distribuicao inicial (ajustavel):

| Fase | Alocacao |
|------|----------|
| Contratos/fundacao (T0-T1) | 15% |
| Interface (T2) | 20% |
| Backend (T3-T4) | 30% |
| Integracao/verificacao (T5-T6) | 20% |
| Documentacao/entrega (T7) | 5% |
| Reserva de correcoes | 10% |

Teto financeiro: **nao informado**. Registrar valores propostos antes de despesas externas.

Formula de custo por agente:
```
custo_dev = sum[(tokens_entrada_nao_cacheada * preco_entrada + tokens_entrada_cacheada * preco_cache + tokens_saida * preco_saida) / 1_000_000] + ferramentas_faturadas
```

Controle: checkpoint em 80% do limite da tarefa; sem novas chamadas pagas em 100%.

## Runtime Jev em producao

```
Custo_IA = V * q * T / 1_000_000 * P
```

- V = acessos/mes
- q = (1 - r) * (1 - h) — fracao enviada ao Jev (r = regras, h = cache hit)
- T = tokens medios por chamada
- P = preco por milhao de tokens

Referencia (nao cotacao): P = US$0.042, T = 500 tokens exemplo.

| Cenario (V=1M) | Chamadas | Custo estimado |
|-----------------|----------|----------------|
| q=100% | 1.000.000 | US$21.00 |
| q=10% | 100.000 | US$2.10 |
| q=2% | 20.000 | US$0.42 |

Fracoes sao cenarios, nao metas. Planejar capacidade para q~100%.

## Gates externos pendentes

| Recurso | Estado | Impacto |
|---------|--------|---------|
| Conta Jev (TypeSafe AI) | Nao validado | Bloqueia integracao real (T4+) |
| Provedor de desafio | TBD | Bloqueia desafio real (T4+) |
| Fonte ASN com licenca | A identificar | Bloqueia enriquecimento real |
| Conjunto rotulado independente | Nao existe | Bloqueia avaliacao G3 |
| Ambiente/regiao de deploy | Nao definido | Bloqueia T8 |

## Controle separado

Categorias: desenvolvimento por agentes | avaliacao/shadow Jev | producao | infraestrutura. Custos reais do Jev incluem falhas potencialmente faturadas.
