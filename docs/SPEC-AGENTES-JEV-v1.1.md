# JEV Traffic Router — Orquestração econômica e eficiente de agentes
Versão 1.1 • 06/10/2026 • Status: especificação preparada; execução não iniciada.

## 1. Objetivo e autoridade dos documentos
Organizar a construção de um sistema de classificação e roteamento de tráfego com Jev. O MVP combina evidências de requisição, sessão, rede e comportamento para selecionar um destino autorizado: acesso provavelmente humano recebe a página principal; automação identificada ou provável recebe a alternativa; evidência insuficiente segue desafio/fallback. Falhas operacionais seguem a política restritiva definida na base.

Construir com pouca duplicação de contexto, tarefas verificáveis e paralelismo apenas quando reduzir o tempo total. A economia vem de evitar retrabalho, sessões ociosas e revisões repetidas, mantendo os critérios funcionais e de qualidade.

Base funcional: [Spec funcional v0.4](./SPEC-CLOAKER-JEV-v0.4.txt). Disponibilizar o arquivo integral no ambiente de execução. SHA-256 informado no documento de entrada, a conferir em T0: `0089DD0478D47CAD46E0F583B0D0C14BA0D925B16706DE33B6E633364578994B`.

Este documento detalha a seção 9 da base. A versão 0.4 prevalece sobre a versão 0.3 existente em `SPEC-ORQUESTRACAO-JEV.md`, inclusive sobre o encaminhamento de automação identificada, mesmo quando não abusiva. A versão 0.3 fica preservada como histórico e não deve orientar novas tarefas. Requisitos de produto vêm da 0.4; processo de trabalho vem deste documento. Conflitos devem ser registrados antes de alterar contratos.

O pedido atual autoriza produzir esta especificação. Não inicia agentes, implementação, handoff ou publicação. Em uma futura execução autorizada, o orquestrador deve aproveitar a autorização vigente e resolver decisões técnicas rotineiras sem pedir confirmações repetidas.

Preços, modelos disponíveis, limites de conta, referências externas e acessos mencionados na base não foram revalidados nesta elaboração. A etapa T0 confirma o que depender deles. Nomes de agentes e conexões relatados pela base não comprovam que estejam disponíveis na futura sessão.

## 2. Duas economias, dois controles
| Dimensão | Objetivo | Controle |
| --- | --- | --- |
| Agentes de desenvolvimento | Menor custo e tempo por entrega aceita | Escopo curto, contexto seletivo, dono único, revisão por risco, orçamento por tarefa |
| Motor Jev em produção | Qualidade de decisão, latência e disponibilidade dentro do orçamento | Regras conclusivas, uma consulta por decisão síncrona, cache somente após avaliação, reservas atômicas |

Ordem de prioridade: cumprir proteção e fricção → cumprir latência e disponibilidade → reduzir custo e complexidade entre alternativas equivalentes. Limites financeiros continuam sendo restrições explícitas.

Não transferir uma meta de economia da equipe para a classificação de visitantes. Não impor percentual máximo de chamadas Jev, reduzir evidências essenciais ou aumentar TTL para compensar gasto de desenvolvimento. O runtime é um pipeline determinístico; não há equipe de agentes conversando por visita.

## 3. Equipe mínima e responsabilidades
Usar um orquestrador e, no máximo, dois executores simultâneos: três agentes ativos no total. Esse é um teto, não uma meta de ocupação. Começar com o orquestrador sozinho na etapa de contratos; abrir dois executores somente quando os contratos permitirem trabalho independente.

| Papel | Responsabilidade | Limite de atuação |
| --- | --- | --- |
| Orquestrador | Contratos, plano, distribuição, orçamento, integração, revisão e comunicação | Único dono de contratos compartilhados, arquivos de raiz e decisão de aceite |
| Executor de interface | Painel, formulários, estados, acessibilidade, cliente da API e testes de UI | Não altera contratos, autorização do backend ou política de decisão |
| Executor de backend | API, dados, motor, Jev, evidências, desafios, limites, eventos e testes correspondentes | Único dono do runtime; não altera interface ou contratos unilateralmente |
| Revisor de código temporário | Revisão independente de mudanças críticas e verificação de falhas | Ocupa uma das duas vagas de executor, após liberar seu trabalho anterior; não cria uma quarta vaga |

O revisor de código temporário deve ser uma sessão que não escreveu o trecho crítico revisado. Pode ser uma sessão nova com contexto restrito. Não criar especialistas permanentes de arquitetura, segurança, QA, DevOps e documentação para um MVP. O orquestrador distribui essas responsabilidades dentro das tarefas existentes.

Executores não podem criar subagentes, delegar novamente ou ampliar o escopo. Ao terminar, entregam resultado e aguardam nova tarefa sem polling contínuo. Desativar sessões sem trabalho pronto; persistir o contexto necessário à retomada.

### 3.1. Escolha de capacidade do modelo
Escolher entre os modelos efetivamente disponíveis, sem assumir preços ou nomes comerciais. Se a plataforma não permitir seleção, aplicar a mesma política de escopo e contexto ao modelo disponível.

| Classe de tarefa | Capacidade inicial | Escalar quando |
| --- | --- | --- |
| Ajuste mecânico, texto, fixture ou UI com contrato fechado | Menor custo que cumpra o aceite | Surgir ambiguidade funcional ou falha não trivial |
| Implementação de módulo com contratos claros | Modelo de programação de capacidade intermediária | Houver problema persistente de integração ou raciocínio |
| Contratos, isolamento, concorrência, orçamento, fallback, avaliação estatística e revisão crítica | Capacidade alta desde o início | Exigir especialista ou dado externo ausente |

Não passar um problema crítico por vários modelos baratos antes de usar capacidade adequada. Após uma correção malsucedida pela mesma causa, revisar contexto e hipótese antes de outra tentativa. Jev é o classificador do produto, não um modelo presumido para programar a aplicação.

## 4. Contratos e propriedade de arquivos
Estrutura proposta para um projeto novo, a confirmar em T0 se houver código prévio:

```text
apps/web/                   executor de interface
apps/api/                   executor de backend
packages/contracts/         orquestrador
packages/db/                executor de backend
tests/e2e/                  orquestrador durante integração
tests/evaluation/           backend na implementação; revisor durante avaliação
infra/                      orquestrador
docs/orchestration/         orquestrador
docs/evidence/<task-id>/    executor responsável pela tarefa
```

Arquivos de raiz, gerenciador de pacotes, lockfile, configuração de CI e contratos têm um único escritor: o orquestrador. Pedidos de dependências chegam como nome, finalidade e compatibilidade necessária; o orquestrador resolve versões suportadas, instala em lote e atualiza o lockfile. Executores não instalam dependências simultaneamente no checkout compartilhado.

Congelar antes do paralelismo: schemas de campanhas e destinos; `NetworkEvidence`, `JevAssessment` e `RoutingDecision`; enums e códigos de motivo; erros; autorização; paginação; versões; interface do adapter Jev; fixtures compartilhadas; formato de eventos e métricas. Schemas de entrada e saída são a fonte dos tipos. UI não mantém uma segunda definição manual.

Mudança de contrato: executor registra problema e consumidores afetados → orquestrador decide e versiona → pausa apenas tarefas incompatíveis → atualiza fixtures → comunica a revisão. Nenhum executor altera contrato compartilhado silenciosamente.

Um conjunto de arquivos só pode ter um escritor ativo. Transferir propriedade exige entrega/checkpoint e registro pelo orquestrador. Em checkout compartilhado, não executar reset, limpeza ou comandos que descartem trabalho alheio; não usar staging global. Commits e aplicação de patches devem incluir somente os arquivos atribuídos.

Usar worktrees isoladas apenas se já houver Git e se a operação de merge economizar mais do que custar. Registrar commit-base e revisar o diff antes de integrar. Sem Git, registrar hashes dos arquivos de entrada/saída e preservar checkpoints; não exigir worktrees para começar.

## 5. Plano de execução e dependências
Tarefas são entregas observáveis, não uma lista de arquivos. A tabela define pacotes de trabalho; se algum pacote ficar grande demais para uma sessão coerente, dividi-lo em subtarefas sequenciais com o mesmo dono e aceite específico.

| ID | Dono | Entrega e encerramento | Depende de |
| --- | --- | --- | --- |
| T0 | Orquestrador | Inventário real, ADR mínima, contratos, fixtures, mapa de fontes, protocolo de avaliação, orçamento e comandos de validação | Autorização para executar |
| T1 | Orquestrador | Monorepo inicial, scripts, schemas, adapter mock explicitamente identificado, CI básica | T0: contratos locais prontos |
| T2 | Interface | Seis telas da base, criar/simular/ativar/pausar com mock, dois destinos e origem opcional | T1 |
| T3 | Backend | Schema/migrations, login, organizações, papéis, campanhas/destinos, ativação atômica e API | T1 |
| T4 | Backend | Pipeline, evidências IP/ASN, Jev real atrás do adapter, desafio, reservas, fallback e eventos | T3; acesso real somente nas partes dependentes dele |
| T5 | Orquestrador + donos | Painel usando API, E2E local, métricas, auditoria e composição de serviços | T2 + T4 |
| T6 | Revisor + dono da correção | Revisão crítica, avaliação independente, carga, restauração e revisão visual com evidências | T5 |
| T7 | Orquestrador | Runbook, relatório, limitações, demonstração e pacote de entrega | T6; pendências explícitas se gates externos bloquearem |
| T8 | Orquestrador | Shadow, canário e expansão monitorada no ambiente autorizado | T7 + gates de promoção + autorização aplicável |

Paralelismo útil: T2 ocorre junto de T3 e T4. Dentro do backend, persistência/autorização antecedem o motor integrado para evitar dois donos do mesmo runtime. Não manter o executor de interface ativo esperando T4; retomar a sessão em T5 com o contrato e o diff relevante.

T0 distingue `contratos_locais_prontos` de `integracoes_externas_validadas`. Falta de credencial, fonte verificável, domínio, amostra rotulada ou orçamento de avaliação não paralisa UI, mocks e testes locais. Bloqueia somente chamadas reais, alegações de cobertura e promoção dependentes desses itens. Mock aprovado não fecha integração real.

### 5.1. Saída mínima de T0
- Confirmar o estado real do repositório e escolher comandos reproduzíveis de instalação, lint, tipos, build e testes.

- Fixar os contratos da seção 4 e a matriz de rastreabilidade dos requisitos da seção 10 da base.

- Definir provedor, forma de autenticação e limites do Jev disponíveis; conferir documentação oficial durante a integração. Segredos ficam no ambiente autorizado, nunca nos pacotes de contexto.

- Nomear as fontes de ASN e de cada identidade automatizada suportada, incluindo licença, validade e método. Sem fonte verificável, registrar cobertura desconhecida, não suporte concluído.

- Definir provedor de desafio, contrato de verificação e plano de falha. Sem provedor real, manter fixture identificada e gate externo pendente.

- Definir protocolo estatístico, conjunto rotulado independente, separação temporal/por sessão/campanha e critérios de suficiência da amostra antes de ajustar thresholds.

- Registrar ambiente/região candidatos e limites para experimentos pagos; não contratar infraestrutura como efeito implícito de preparar contratos.

## 6. Protocolo de tarefas e comunicação
Estados: `planned → ready → running → review → accepted`. Estados adicionais: `blocked`, `cancelled` e `superseded`. `review → running` exige defeito concreto; `blocked → ready` exige resolução documentada. Só o orquestrador aceita a entrega.

Cada tarefa recebe um pacote curto, com referências acessíveis e contexto suficiente. O executor lê primeiro o pacote e os arquivos relevantes; consulta a base completa se precisar esclarecer um requisito. Não replicar histórico de conversa, logs completos ou toda a spec em cada mensagem.

```yaml
id: T4.1
objective: Implementar seleção determinística de ação e destino.
owner: executor-backend
depends_on: [T3]
base_revision: <commit ou manifesto de hashes>
contract_version: <versão vigente>
read:
  - SPEC-CLOAKER-JEV-v0.4.txt: seções 4, 5, 6 e 10
  - packages/contracts/: contratos aplicáveis
write_scope:
  - apps/api/src/decision/
  - apps/api/test/decision/
  - docs/evidence/T4.1/
out_of_scope: [UI, alteração de contratos, deploy, novas dependências]
acceptance:
  - Acesso automatizado com identidade verificada e vigente recebe alternativa.
  - Falha do motor não libera a principal.
  - ASN empresarial isolado não comprova automação.
validation: <comandos definidos em T0 para esses comportamentos>
budget: <limite de tokens/custo/tempo da tarefa, quando mensurável>
stop_conditions: [bloqueio externo, conflito de contrato, orçamento atingido]
```

Resposta de entrega deve conter: ID; estado; resumo do comportamento; arquivos e revisão exata; comandos executados e resultados; caminho das evidências; limitações; consumo conhecido; pendências. Um comando não executado deve ser marcado como não executado, com causa. “Parece funcionar” não é evidência de aceite.

Atualizações entre agentes somente em entrega, bloqueio, risco material, conflito de contrato ou limite próximo. O orquestrador aguarda eventos de conclusão em vez de perguntar continuamente pelo status. Sem mecanismos de evento, usar intervalo moderado e interromper consultas ao receber conclusão.

Não mandar ao agente “continue melhorando” ou “revise tudo novamente”. Toda devolução identifica arquivo/comportamento, expectativa, reprodução e condição de encerramento. Após duas rodadas sem resolver a mesma causa, reduzir a tarefa, trocar a hipótese ou escalar capacidade; não repetir o mesmo prompt indefinidamente.

Bloqueio informa o que falta, evidência, impacto e trabalho que ainda pode avançar. Dúvidas resolvíveis por contrato, código ou documentação devem ser investigadas antes de perguntar ao usuário.

## 7. Orçamento da equipe e redução de contexto
Não há teto financeiro informado neste pedido. T0 registra valores propostos, unidade e origem de cada limite antes de despesas externas. Disponibilidade de ferramenta não equivale a orçamento para contratar serviços ou executar carga paga sem limite.

Controle separado para: desenvolvimento por agentes; avaliação/shadow do Jev; produção; infraestrutura. Custos reais do Jev incluem falhas potencialmente faturadas, como determina a base.

Distribuição inicial sugerida do orçamento de desenvolvimento, ajustável em T0: 15% contratos/fundação, 20% interface, 30% backend, 20% integração/verificação, 5% documentação/entrega e 10% reserva de correções. São limites de planejamento, não estimativas de desempenho ou de preço.

Para APIs com cobrança por token:

`custo_dev = Σ[(tokens_entrada_não_cacheada × preço_entrada + tokens_entrada_cacheada × preço_cache + tokens_saída × preço_saída) / 1.000.000] + ferramentas_faturadas`

Usar apenas categorias efetivamente reportadas pelo provedor, sem duplicar tokens de raciocínio já contabilizados. Se houver assinatura sem custo por chamada observável, acompanhar tokens/tempo/cotas disponíveis e marcar custo monetário como desconhecido. Não inventar valores por agente.

Antes de despachar, verificar saldo para executar e validar a tarefa; reservar seu limite. Evitar consumir todo o saldo em implementação e deixar a revisão sem recursos. Em 80% do limite da tarefa, registrar checkpoint e previsão de conclusão; em 100%, não lançar novas chamadas pagas além do autorizado. Limite atingido não significa entrega aceita. Registrar estado e preservar trabalho para retomada.

Se a plataforma não fornecer bloqueio rígido por tokens, usar checkpoints e limites de chamadas/tempo disponíveis, declarando que o controle é aproximado. Não prometer enforcement que o orquestrador não consegue aplicar.

Regras práticas de economia:

1. Orquestrador lê a base integral uma vez e mantém um índice de requisitos; cada executor recebe as seções necessárias e acesso ao original.

2. Reutilizar schemas, fixtures, scripts e evidências em arquivos. Mensagens transmitem decisões e diferenças, não cópias integrais.

3. Pesquisar primeiro arquivos conhecidos; leituras e buscas independentes podem ser agrupadas. Evitar varrer repetidamente todo o repositório.

4. Registrar decisões duráveis em ADRs curtas; não rediscutir stack ou arquitetura sem nova evidência.

5. Executar testes relacionados durante implementação e a suíte acordada sobre a versão integrada. Repetir checks quando uma alteração ou falha invalide a evidência anterior.

6. Não delegar uma tarefa pequena se explicar, revisar e integrar custar mais do que fazê-la diretamente.

7. Não abrir agentes duplicados para produzir soluções concorrentes sem hipótese comparativa e critério de escolha.

8. Usar revisão independente nos pontos críticos; mudanças simples de texto/layout recebem revisão proporcional.

Medir custo por tarefa aceita, duração, tempo bloqueado, retrabalho, conflitos de arquivos e falhas após integração. Comparar pacotes de complexidade semelhante. Quantidade de agentes, commits ou linhas produzidas não mede eficiência.

## 8. Requisitos que todos os pacotes devem preservar
Estes invariantes resumem a base para orientar delegação; não substituem seus critérios completos.

| ID | Invariante | Dono principal / verificação |
| --- | --- | --- |
| R01 | Dois destinos HTTPS autorizados, distintos e sem loop; alternativa obrigatória | Backend + interface / criação e ativação inválidas |
| R02 | Automação com identidade verificada vigente, inclusive não abusiva, recebe alternativa; ASN/empresa isolados não comprovam automação | Backend / fixtures de identidade e contraexemplos |
| R03 | Acesso provavelmente humano com evidência suficiente recebe principal; automação provável recebe alternativa; incerteza usa desafio/fallback | Backend / tabela de decisão e thresholds versionados |
| R04 | Jev participa de toda nova decisão elegível salvo exceções da base; no máximo uma chamada síncrona e sem retry oculto | Backend / contagem de chamadas e falhas |
| R05 | Timeout, indisponibilidade e orçamento/capacidade esgotados não liberam silenciosamente a principal | Backend / injeção de falhas e fallback |
| R06 | `general` por padrão; origem opcional; IP/ASN independente do perfil declarado | Interface + backend / campanha sem origem e migração |
| R07 | Evidências têm origem, versão e validade; dados expirados não confirmam identidade atual | Backend / expiração, revogação, DNS e snapshots |
| R08 | Cache começa desabilitado e só é ativado após avaliação; nenhuma reutilização indevida entre sessões/tenants | Backend / invalidação, concorrência e replay temporal |
| R09 | Reservas atômicas, limites compartilhados e uso incerto contabilizado | Backend / concorrência e reconciliação |
| R10 | Autorização por tenant e papel; nenhum segredo no frontend, prompt ou log | Backend + revisor / acessos cruzados e inspeção |
| R11 | Desafio validado no servidor, com expiração/replay/sessão; não supera regra rígida ou identidade automatizada confirmada | Backend / testes de precedência |
| R12 | Redirecionamento autorizado, no-store, sem exposição da principal na alternativa; prevenção de open redirect/SSRF | Backend + revisor / respostas e validação de destinos |
| R13 | Shadow é identificado; métricas mock e integração real não se confundem | Todos / UI, eventos e relatório |
| R14 | Redirect protege o link; não oculta a origem nem impede acesso direto | Orquestrador / documentação e demonstração |
| R15 | Eventos, auditoria, retenção, observabilidade, backup e restauração seguem a base | Backend + orquestrador / operação e recuperação |

Migrações preservam origem já definida, normalizam ausências para `general` e deixam campanhas sem alternativa válida pausadas. Não aplicar automaticamente a política antiga da versão 0.3 para automação legítima.

## 9. Gates de aceite e promoção
### G0 — Contratos suficientes para construir
Contratos versionados, donos atribuídos, dependências claras e matriz de todos os critérios da seção 10 da base. Cada linha da matriz deve ter requisito, tarefa, teste/evidência, revisão do código e status. Integrações externas pendentes ficam identificadas, permitindo trabalho local independente.

### G1 — Entrega de módulo
Escopo respeitado, diff revisável, critérios da tarefa satisfeitos, comandos pertinentes aprovados e nenhum bloqueador oculto. O executor comprova comportamento com testes de risco e contrato, sem criar testes que apenas repitam a implementação. Falta de dependência externa deve constar no estado da entrega.

### G2 — Versão integrada
Build, tipos, lint e testes acordados passam na revisão exata integrada. Demonstrar criar campanha com ambos os destinos → simular humano/bot/incerteza/falha → ativar em teste → resolver principal/alternativa → consultar motivo → pausar/reverter. Revisar desktop, mobile, teclado e estados vazio/carregamento/erro.

Revisão independente obrigatória antes de promoção para isolamento de tenants, autorização de destinos, precedência de decisão, validação de desafio, orçamento concorrente, cache e tratamento de falhas. Achados críticos retornam ao dono do módulo. A revisão deve informar cenários e evidências, não apenas uma aprovação genérica.

### G3 — Qualidade e capacidade reais
Executar o protocolo da base, com rótulos independentes do Jev e sem usar fixture sintética como prova de precisão em tráfego real. Comparar regras isoladas, Jev sem cache e otimizações no conjunto adequado. Relatar automação e abuso separadamente, matriz de confusão, cobertura, incerteza, desafios, fallback e resultados por perfil.

Critérios herdados da 0.4, ainda metas de projeto:

- Limite superior do intervalo de confiança de 95% abaixo de 1% para humanos indevidamente enviados à alternativa ou desafio, incluindo a união por decisão e separação da degradação por falha.

- Recall de automação de pelo menos 90% no conjunto rotulado, com intervalos de confiança, classes e cobertura reportados.

- Otimizações preservam o gate de fricção e apresentam limite superior unilateral de 95% para perda de recall de no máximo 1 ponto percentual, em comparação pareada com baseline sem otimização.

- p95 menor que 50 ms no caminho de regras/cache e menor que 800 ms no caminho com Jev, conforme escopo da base; medir também p50/p99 e separar Jev concluído de fallback.

- Pelo menos 99% das decisões elegíveis sem regra/cache concluídas pelo Jev dentro do deadline, sob carga suportada e fornecedor saudável. Timeout inicial de 600 ms permanece proposta a validar.

- Testar proporções de 10%, 50% e 100% de decisões elegíveis chamando Jev, começando em 10 requests/s e respeitando capacidade real e orçamento autorizado. Fallback não conta como capacidade Jev entregue.

- Verificar timeout, resposta inválida, 401/429/529, banco indisponível, desafio indisponível, orçamento esgotado, sobrecarga e restauração de backup.

Amostra insuficiente, ausência de credenciais ou resultado inconclusivo bloqueiam o gate correspondente; não reduzem automaticamente a exigência. Manter baseline quando uma otimização não comprovar equivalência suficiente.

### G4 — Operação e publicação
Runbook reproduzível, configuração de segredos, migrations, instalação, retenção, backup/restauração, observabilidade e rollback ensaiados. Publicação ocorre conforme autorização vigente e capacidades reais do ambiente.

Promoção: shadow por perfil → canário limitado → expansão. Limites de erro, fallback e fricção são versionados antes do canário. Rollback restaura política protegida válida ou usa alternativa/indisponibilidade. Sem política anterior aprovada, shadow usa página neutra de teste.

## 10. Persistência do trabalho e retomada
Criar os seguintes artefatos durante a implementação; esta spec apenas define seus contratos:

```text
docs/orchestration/PLAN.md          tarefas, dependências, donos e estados
docs/orchestration/CONTRACTS.md     índice das versões e consumidores
docs/orchestration/DECISIONS.md     decisões curtas e justificativas
docs/orchestration/BUDGET.md        limites, reservas e consumo conhecido
docs/orchestration/ACCEPTANCE.md    matriz requisito → teste → evidência → revisão
docs/orchestration/STATUS.md        último checkpoint e próximo passo
docs/evidence/<task-id>/            resultados, logs sanitizados e capturas úteis
```

O orquestrador é o único escritor do estado global; executores escrevem nas suas pastas de evidência e enviam deltas. Isso evita que vários agentes editem o plano ao mesmo tempo.

Checkpoint registra tarefa, revisão-base, alterações, contratos usados, testes já executados, pendência exata, próximo passo e saldo conhecido. Na retomada, ler checkpoint e diff desde aquela revisão. Não repetir pesquisa e testes válidos sem motivo; alterações relevantes invalidam as evidências afetadas.

## 11. Condição de encerramento
Separar explicitamente três resultados:

1. **Implementação local validada:** código integrado e testes locais passam; acessos, amostras ou infraestrutura ainda podem estar pendentes.

2. **Piloto validado:** integração real, qualidade, carga e operação cumprem os gates aplicáveis, com evidências.

3. **Publicado:** versão efetivamente implantada no ambiente autorizado, com verificação e rollback disponíveis.

Não declarar o produto pronto para produção com base somente no primeiro resultado. Não manter agentes ativos apenas para aguardar um insumo externo. Entregar o estado verificável, o bloqueio concreto e a instrução de retomada.

Entrega final inclui revisão do código, funcionalidades demonstradas, testes e relatórios, cobertura de identidades automatizadas efetivamente suportadas, pendências externas, custos conhecidos e estimados separados, limitações do redirect e procedimentos de operação. O aceite de uma tarefa não dispensa o aceite do produto.

## 12. Prompt de início para uso após autorização de execução
O texto abaixo é um modelo de despacho, não uma mensagem enviada nem prova de autorização:

> Atue como orquestrador do JEV Traffic Router. Use SPEC-CLOAKER-JEV-v0.4.txt como contrato funcional e SPEC-AGENTES-JEV-v1.1.md como processo. Ignore requisitos conflitantes da antiga SPEC-ORQUESTRACAO-JEV.md v0.3. Confirme a autorização vigente e o estado real do ambiente. Comece por T0, sozinho: fixe contratos, fixtures, fontes, orçamento, protocolo de avaliação e critérios de aceite. Depois, use no máximo dois executores simultâneos, com um dono por conjunto de arquivos. Abra interface em paralelo com backend apenas quando os contratos estiverem prontos. Não permita subdelegação. Preserve contexto em arquivos e envie às tarefas apenas o necessário, com acesso à base. Exija evidência de validação e revisão independente dos pontos críticos. Economize retrabalho e contexto, mantendo os gates do produto. Jev continua obrigatório nas decisões elegíveis conforme a base; falhas não liberam silenciosamente a principal. Não invente cobertura de identidades automatizadas, medições ou integrações. Prossiga autonomamente no escopo autorizado, registre bloqueios externos e não publique nem contrate serviços além dessa autorização.
