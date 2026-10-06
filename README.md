# JEV Traffic Router

Classifica visitantes (humano provável × automação) e redireciona cada um para o destino principal ou alternativo de uma campanha, usando o motor Jev (TypeSafe AI). Falhas nunca liberam a página principal.

Especificação: `docs/SPEC-CLOAKER-JEV-v0.4.txt` · orquestração: `docs/orchestration/`.

## Estrutura

| Pasta | O que é |
|---|---|
| `apps/api` | API Hono: autenticação, campanhas, destinos, eventos e o roteador `GET /r/:slug` |
| `apps/web` | Painel React + Vite |
| `packages/contracts` | Tipos e schemas Zod compartilhados, fixtures |
| `packages/db` | Schema Drizzle e migrations SQL (`packages/db/drizzle`) |
| `infra` | Dockerfiles, docker-compose e Caddy |
| `tests` | E2E do pipeline, integração API + Postgres, integração com o Jev via OpenRouter |

## Rodar localmente

Requisitos: Node 20+ e um Postgres (local ou `docker compose -f infra/docker-compose.yml up -d postgres`).

```bash
npm install
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/botbad

npm run db:migrate                 # cria/atualiza as tabelas
SEED_DEMO=1 npm run db:seed        # tenant + dono (admin@jev.local, senha gerada é exibida) + campanha /r/demo

npm run dev -w @botbad/api         # API em http://localhost:3000 (Jev simulado se não houver chave)
npm run dev -w @botbad/web         # painel em http://localhost:5173
```

Em desenvolvimento, sem `JWT_SECRET` a API gera uma chave temporária (os logins expiram ao reiniciar) e o CORS aceita qualquer `localhost`.

## Testes

```bash
npm test                    # E2E do pipeline + limites de confiança (+ API/Postgres se TEST_DATABASE_URL existir)
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres npm run test:integration
OPENROUTER_API_KEY=... npm run test:jev   # chamadas reais ao Jev via OpenRouter
npm run typecheck
bash scripts/validate.sh    # tipos + build + testes
```

O teste de integração cria e recria o banco `botbad_test` no servidor apontado.

## Produção (Docker)

```bash
cp .env.example .env        # preencha JWT_SECRET, POSTGRES_PASSWORD, domínio, chave do Jev, SEED_ADMIN_*
docker compose --env-file .env -f infra/docker-compose.yml up -d --build
docker compose --env-file .env -f infra/docker-compose.yml run --rm migrate node dist/seed.js   # primeira vez
```

- `migrate` aplica as migrations antes da API subir.
- Caddy (`web`) serve o painel, faz proxy da API no mesmo domínio e obtém TLS automaticamente para `SITE_ADDRESS`.
- A API recusa iniciar em produção sem `JWT_SECRET` (32+ caracteres), `CORS_ORIGINS`, `DATABASE_URL` e um adaptador Jev real (o simulado é proibido).
- O Postgres não é publicado na rede; só os containers acessam.

### Variáveis

Todas estão comentadas em `.env.example`. As principais:

| Variável | Para quê |
|---|---|
| `JEV_ADAPTER` | `real`, `openrouter` (avaliação) ou `mock` (só dev) |
| `JEV_TIMEOUT_MS` | Prazo da chamada ao Jev (spec: 600 ms na API real) |
| `JEV_MIN_CONFIDENCE_PRIMARY` / `_AUTOMATION` | Limites de confiança — provisórios até calibrar com dados rotulados |
| `RATE_LIMIT_PER_IP_PER_MIN` | Limite por visitante (padrão 120/min) |
| `TRUSTED_PROXIES` | IPs/CIDRs que podem informar `X-Forwarded-For` |
| `PUBLIC_BASE_URL` | Usado para recusar destinos que apontam de volta para o roteador |

## Operação

- **Novo usuário:** por enquanto via banco (tabelas `users` + `memberships`); senhas com scrypt (`apps/api/src/auth/password.ts`).
- **Nova migration:** altere `packages/db/src/schema.ts` e rode `npm run generate -w @botbad/db`.
- **Backup:** `docker compose ... exec postgres pg_dump -U postgres botbad > backup.sql`.
- **Limitações atuais:** sem tela de desafio (Turnstile/hCaptcha), sem fonte de ASN, sem modo shadow, rate limit e circuit breaker em memória (uma instância). Lista completa na nota "O que falta".
