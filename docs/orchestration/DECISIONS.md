# JEV Traffic Router — Decisoes de Arquitetura

## ADR-001: Stack do monorepo

Monorepo TypeScript. Frontend: React + Vite. API: Hono em Node.js LTS. Validacao: Zod (schemas como fonte de tipos). ORM: Drizzle. Banco: PostgreSQL. HTTPS: Caddy. Containers: Docker Compose. Um repositorio, uma implantacao inicial. Sem Kubernetes, broker dedicado ou banco vetorial no MVP.

## ADR-002: Jev como motor de classificacao

Jev da TypeSafe AI via `POST https://api.typesafe.ai/v1/systemone`, Bearer auth, modelo `jev-1.13.0`. Adapter pattern: interface `JevAdapter` em packages/contracts, implementacao real em apps/api, mock explicito para testes. Conta/provedor a confirmar antes de integracao real. Preco referencia: US$0.042/M tokens entrada, saida gratuita (revalidar).

## ADR-003: Dois destinos obrigatorios e redirect

Campanha exige `primaryDestinationId` e `alternativeDestinationId` — HTTPS, autorizados, distintos, sem loop. Link publico em `/r/:campaignSlug`, 302 para destino escolhido pelo backend. MVP redirect protege o link; nao esconde a origem nem bloqueia acesso direto. Modo proxy e futuro.

## ADR-004: Perfil geral por padrao

`networkProfile` opcional, normalizado para `general` quando omitido. Valores: `general | tiktok | meta | google | x | organic | custom`. Origem declarada e contexto opcional; nao e prova. IP/ASN coletado para todas as campanhas independentemente da origem declarada.

## ADR-005: Cache desabilitado inicialmente

Cache de decisao comeca desabilitado. Manter apenas deduplicacao de chamada concorrente. Comparar TTLs 0/5/15/30s em replay temporal separado. Ativar somente sem regressao de protecao/friccao. Chave inclui tenant + campanha + versoes + hash de sinais + sessao pseudonimizada.

## ADR-006: Fallback restritivo

Timeout, indisponibilidade, orcamento esgotado ou resposta invalida -> alternativa com motivo de falha. Nenhuma falha libera silenciosamente a principal. Configuracao invalida -> 503 local. Regras rigidas de seguranca continuam valendo em qualquer cenario.

## ADR-007: Desafio com validacao server-side

Provedor de desafio TBD. Validacao no backend: token, dominio, expiracao, replay, tentativas. Comprovacao de sessao: Secure/HttpOnly, max 10min, ligada a tenant+campanha+politica. Aprovacao de desafio nao substitui regra rigida nem identidade conclusiva de bot.
