# JEV Traffic Router — Matriz de Rastreabilidade

| ID | Requisito | Tarefa | Teste/Evidencia | Revisao | Status |
|----|-----------|--------|-----------------|---------|--------|
| R01 | Dois destinos HTTPS autorizados, distintos, sem loop; alternativa obrigatoria | T3, T2 | Criacao/ativacao invalidas rejeitadas; destinos iguais/loop bloqueados | Backend + Interface | pending |
| R02 | Automacao com identidade verificada vigente recebe alternativa; ASN isolado nao comprova automacao | T4 | Fixtures de bot verificado -> alternativa; ASN empresarial isolado nao causa deny | Backend | pending |
| R03 | Humano provavel -> principal; automacao provavel -> alternativa; incerteza -> desafio/fallback | T4 | Tabela de decisao, thresholds versionados, fixtures por classe | Backend | pending |
| R04 | Jev em toda decisao elegivel; max 1 chamada sincrona; sem retry oculto | T4 | Contagem chamadas por request; inspecao SDK defaults | Backend | pending |
| R05 | Timeout/indisponibilidade/orcamento esgotado nao liberam principal | T4 | Injecao de falhas: timeout, 429, 529, banco down, budget zero | Backend | pending |
| R06 | general por padrao; origem opcional; IP/ASN independente do perfil | T3, T2 | Campanha sem origem -> general; enriquecimento em todos os perfis | Interface + Backend | pending |
| R07 | Evidencias com origem, versao e validade; expirados nao confirmam identidade atual | T4 | Expiracao, revogacao, DNS, snapshots com timestamps | Backend | pending |
| R08 | Cache desabilitado ate avaliacao; sem reutilizacao indevida entre sessoes/tenants | T4, T6 | Invalidacao, concorrencia, replay temporal | Backend + Revisor | pending |
| R09 | Reservas atomicas, limites compartilhados, uso incerto contabilizado | T4 | Teste concorrente de reservas; saldo nao desaparece | Backend | pending |
| R10 | Autorizacao por tenant e papel; sem segredo no frontend/prompt/log | T3, T6 | Acessos cruzados entre tenants; inspecao de logs/responses | Backend + Revisor | pending |
| R11 | Desafio validado no servidor; nao supera regra rigida ou bot confirmado | T4 | Testes de precedencia: desafio aprovado vs. bot verificado | Backend | pending |
| R12 | Redirect autorizado, no-store, sem exposicao da principal na alternativa; prevencao open redirect/SSRF | T4, T6 | Validacao destinos, headers, respostas da alternativa | Backend + Revisor | pending |
| R13 | Shadow identificado; metricas mock e real nao se confundem | T5 | UI indica shadow; eventos separados por modo | Todos | pending |
| R14 | Redirect protege o link; nao oculta a origem nem impede acesso direto | T7 | Documentacao, demonstracao | Orquestrador | pending |
| R15 | Eventos, auditoria, retencao, observabilidade, backup e restauracao | T4, T5 | Operacao e recuperacao testadas | Backend + Orquestrador | pending |

## Criterios quantitativos (metas de projeto, nao medidos)

| Metrica | Meta | Condicao |
|---------|------|----------|
| Friccao humanos (IC95 sup) | < 1% enviados a alternativa/desafio | Por perfil promovido |
| Recall automacao | >= 90% no conjunto rotulado | Com IC e classes |
| Perda recall por otimizacao (IC95 unilateral) | <= 1pp vs baseline | Pareado, mesmo conjunto |
| Latencia p95 regras/cache | < 50ms | No servidor |
| Latencia p95 com Jev | < 800ms | Excl. carregamento destino |
| Jev completion rate | >= 99% elegiveis sem regra/cache | Carga suportada, fornecedor saudavel |
| Timeout Jev | 600ms inicial | Incluindo conexao e leitura |
