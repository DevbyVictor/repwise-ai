# Escopo e arquitetura da primeira versão

Esta entrega valida a experiência do RepWise AI com dados simulados. Os documentos fornecidos foram utilizados como referência de produto; as propostas de frameworks e infraestrutura do documento de arquitetura não foram tratadas como decisões obrigatórias para esta etapa.

## Referências utilizadas

- RepWise_Prototype_Editorial_v2.html: identidade visual e fluxos de início, treinos, sessão, evolução e assistente.
- RepWise - Documento Requisitos Funcionais & Não Funcionais.pdf: RF01–RF16, regras de preservação do histórico e política de IA.
- RepWise - Funcionalidades.docx: critérios e fluxos dos casos de uso UC01–UC15.
- RepWise - Arquitetura.docx: separação entre ficha, sessão, séries, consentimento e proposta confirmável.

Os arquivos originais foram preservados. O projeto foi colocado em uma nova subpasta `RepWise_AI`.

## Cobertura dos requisitos funcionais

| Requisito | Implementação nesta etapa | Limite |
| --- | --- | --- |
| RF01–RF02 | Cadastro, login, logout e demonstração | Autenticação simulada no navegador, sem sessão de servidor |
| RF03 | Perfil de treino editável | Dados locais por conta |
| RF04 | Catálogo de 16 exercícios com detalhes, busca e filtros | Catálogo fixo; sem administração de exercícios |
| RF05–RF06 | Fichas, rascunhos, ordenação, edição e arquivamento | Arquivar representa exclusão lógica; não há tela para reativação |
| RF07–RF08 | Sessão, séries, observações, retomada e conclusão revisada | Uma sessão em andamento por conta |
| RF09 | Histórico, detalhes, período e CSV | Sem edição de sessões concluídas pela interface |
| RF10 | Séries temporais de carga, repetições e volume; frequência de sessões | Cálculos locais, apenas com séries concluídas |
| RF11 | Conversa e indisponibilidade simuladas | Respostas por regras; sem LLM |
| RF12 | Consentimento e contexto por exercício | Processamento local; sem envio externo |
| RF13 | Modelo de ficha com parâmetros declarados | Não gera planejamento individual ou agenda semanal |
| RF14 | Propostas pendentes, revisão, edição, rejeição e aplicação única | Confirmação validada no cliente |
| RF15 | Rótulos de conteúdo simulado e origem AI das fichas | Sem auditoria de servidor |
| RF16 | Feedback útil ou inadequado, uma avaliação vigente por mensagem | Sem campo de comentário opcional ou serviço de melhoria |

## Organização do código

`src/core.js` contém funções independentes de interface: catálogo, carga inicial, validações, snapshots, conclusão, métricas, seleção de contexto e propostas. O mesmo arquivo é usado no navegador e nos testes de Node.js.

`src/app.js` contém as telas, tratamento de formulários e adaptação para `localStorage`. Essa camada deve ser trocada por serviços HTTP quando o backend for implementado. As rotas são identificadores de tela no fragmento da URL.

`server.cjs` serve somente o HTML e os arquivos de `src` e `assets`, vinculados a 127.0.0.1. Ele não processa autenticação, treino, persistência ou IA. O aplicativo também pode ser aberto diretamente como arquivo, sujeito às limitações do navegador.

Não foram adicionadas dependências ou etapas de compilação, para facilitar a apresentação local desta primeira versão. A implementação está em HTML, CSS e JavaScript; não utiliza React, NestJS, Prisma ou PostgreSQL nesta etapa.

## Modelo de dados local

- Contas: identificador, e-mail normalizado, salt e derivação da senha de teste.
- Perfil: nome, objetivo, experiência, frequência, duração e preferências.
- Ficha: identificador, nome, descrição, estado, origem e itens ordenados.
- Item: referência ao exercício, séries planejadas, repetições e carga de referência.
- Sessão: identificador, ficha de origem, nome preservado, início, conclusão, observações e retrato dos exercícios e séries.
- Série: carga, repetições e marcação de conclusão.
- Mensagem: origem, texto, contexto resumido, feedback e referência opcional à proposta.
- Proposta: estado, validade de 24 horas, parâmetros e ficha estruturada pendente.
- Eventos locais: autorização/revogação e decisões sobre propostas. São dados demonstrativos, alteráveis no cliente.

As contas compartilham um índice local, mas cada uma tem seu próprio conjunto de fichas, sessões e conversas. A conta de demonstração é separada e não exige senha. Essa separação serve à demonstração e não constitui uma fronteira de segurança.

## Regras aplicadas

- A ficha precisa de exercício para iniciar. Uma ficha vazia permanece como rascunho.
- Planejamento: 1–20 séries por exercício, 1–200 repetições, 0–1.000 kg e até 30 exercícios por ficha. Os limites são operacionais, não recomendações de treinamento.
- Execução: carga finita não negativa e repetições inteiras de 0–200. Campos vazios não podem ser marcados como concluídos.
- A finalização exige pelo menos uma série concluída e válida. Séries não concluídas não entram nos indicadores.
- A sessão copia os dados da ficha no início. Editar ou arquivar a ficha não altera os registros anteriores.
- A conclusão remove o estado ativo e não insere novamente o mesmo identificador de sessão.
- Volume = soma de carga × repetições em séries concluídas. Gráficos usam somente sessões finalizadas e o período/exercício escolhido.
- A análise de histórico verifica consentimento antes de consultar as séries. Somente os registros do exercício relevante nas últimas oito semanas são selecionados.
- Propostas são dados pendentes. A criação de ficha requer confirmação explícita; rejeição, expiração ou estado já aplicado bloqueiam aplicação.
- O assistente não modifica fichas existentes, não exclui dados e não prescreve tratamento. Relatos de sintomas e práticas de risco recebem respostas limitadas.
- O navegador pode perder dados. Backup JSON e exportação CSV são controles para esta etapa; não equivalem a backup de servidor.

## Requisitos não funcionais

Usabilidade, responsividade, identificação de conteúdo AI e funcionamento dos treinos com o assistente indisponível são demonstrados. Validação de números e snapshots cobrem as regras locais de integridade. Não foram executados testes de carga, auditoria de segurança, matriz completa de navegadores ou conformidade legal.

Autenticação real, isolamento entre usuários, controles invioláveis de consentimento, imutabilidade contra acesso direto, privacidade operacional, retenção e rastreabilidade de produção dependem do backend. Portanto, esta entrega não declara os requisitos de segurança de produção como atendidos.

## Próxima etapa sugerida

1. Definir a stack definitiva e implementar API de aplicação com validação e autorização por proprietário.
2. Migrar fichas, sessões, séries, consentimentos e propostas para PostgreSQL com transações, constraints e migrações.
3. Implementar autenticação de servidor, recuperação de conta, expiração e revogação de sessão.
4. Introduzir gateway de LLM no backend com contexto mínimo, timeout, validação de respostas e sem acesso direto do modelo ao banco.
5. Garantir transação e idempotência no servidor na conclusão das sessões e aplicação das propostas.
6. Definir retenção de conversas, logs mínimos, backups, monitoramento e testes de autorização entre contas.
