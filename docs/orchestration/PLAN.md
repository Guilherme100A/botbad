# JEV Traffic Router — Plano de Execucao

| ID | Dono | Entrega | Depende de | Estado |
|----|------|---------|------------|--------|
| T0 | Orquestrador | Inventario real, ADR minima, contratos, fixtures, mapa de fontes, protocolo de avaliacao, orcamento e comandos de validacao | Autorizacao para executar | running |
| T1 | Orquestrador | Monorepo inicial, scripts, schemas, adapter mock identificado, CI basica | T0: contratos locais prontos | planned |
| T2 | Interface | Seis telas da base, criar/simular/ativar/pausar com mock, dois destinos e origem opcional | T1 | planned |
| T3 | Backend | Schema/migrations, login, organizacoes, papeis, campanhas/destinos, ativacao atomica e API | T1 | planned |
| T4 | Backend | Pipeline, evidencias IP/ASN, Jev real atras do adapter, desafio, reservas, fallback e eventos | T3; acesso real somente nas partes dependentes dele | planned |
| T5 | Orquestrador + donos | Painel usando API, E2E local, metricas, auditoria e composicao de servicos | T2 + T4 | planned |
| T6 | Revisor + dono da correcao | Revisao critica, avaliacao independente, carga, restauracao e revisao visual com evidencias | T5 | planned |
| T7 | Orquestrador | Runbook, relatorio, limitacoes, demonstracao e pacote de entrega | T6; pendencias explicitas se gates externos bloquearem | planned |
| T8 | Orquestrador | Shadow, canario e expansao monitorada no ambiente autorizado | T7 + gates de promocao + autorizacao aplicavel | planned |

## Paralelismo util

- T2 (interface) em paralelo com T3/T4 (backend) apos T1.
- Dentro do backend, persistencia/autorizacao (T3) antes do motor integrado (T4).
- Executor de interface inativo entre T2 e T5; retomar com contrato e diff relevante.

## Distincao T0

- `contratos_locais_prontos`: schemas, tipos, fixtures, adapter mock — desbloqueia T1/T2/T3.
- `integracoes_externas_validadas`: conta Jev, fonte ASN, provedor desafio — desbloqueia partes de T4 e T6+.
