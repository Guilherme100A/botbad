# JEV Traffic Router — Indice de Contratos

Todos os contratos em `packages/contracts/src/`. Schemas Zod sao a fonte; tipos TypeScript derivados.

| Contrato | Arquivo | Versao | Consumidores |
|----------|---------|--------|--------------|
| NetworkProfile | network.ts | 1.0.0 | apps/api, apps/web |
| NetworkEvidence | network.ts | 1.0.0 | apps/api |
| Assessment | jev.ts | 1.0.0 | apps/api |
| JevAssessment | jev.ts | 1.0.0 | apps/api |
| RoutingDecision | decision.ts | 1.0.0 | apps/api, apps/web |
| Campaign | campaign.ts | 1.0.0 | apps/api, apps/web |
| Destination | destination.ts | 1.0.0 | apps/api, apps/web |
| Tenant | tenant.ts | 1.0.0 | apps/api, apps/web |
| Membership | tenant.ts | 1.0.0 | apps/api, apps/web |
| DecisionEvent | events.ts | 1.0.0 | apps/api, apps/web |
| JevAdapter | jev-adapter.ts | 1.0.0 | apps/api |
| ReasonCode | reason-codes.ts | 1.0.0 | apps/api, apps/web |
| ErrorCode | errors.ts | 1.0.0 | apps/api, apps/web |
| Pagination | pagination.ts | 1.0.0 | apps/api, apps/web |

## Regras

- Unico escritor: orquestrador.
- Mudanca: executor registra problema e consumidores afetados -> orquestrador decide e versiona -> pausa tarefas incompativeis -> atualiza fixtures -> comunica.
- UI nao mantém segunda definicao manual dos tipos; importa de packages/contracts.
