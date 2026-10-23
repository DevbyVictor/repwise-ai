# Validação da primeira versão

Data da conferência: 16 de outubro de 2026.

## Experiência visual e temas 0.4

- Alternância entre claro e escuro na entrada e na aplicação, preservação após recarregar e seleção explícita no Perfil.
- Opção automática reagindo à alteração da preferência do aparelho; uma escolha explícita de tema não é substituída pelo sistema.
- Geometria WebGL renderizada no navegador de conferência, anéis e ilustrações distintas de equipamentos.
- Transição conectada entre cartão e sessão em navegador compatível; resposta visual ao marcar uma série.
- Telas Início, Treinos, Catálogo, Histórico, Evolução, Assistente e Perfil nas larguras 320, 360, 390, 430, 600, 768, 844, 1024 e 1440 pixels, em ambos os temas, sem transbordamento horizontal do documento. As tabelas continuam com rolagem própria.
- Finalização de sessão em modo escuro com largura de 320 pixels, além das jornadas existentes de cadastro, treino, histórico, backup e assistente.
- Esfera do assistente respeitando movimento reduzido; nenhuma exceção JavaScript não tratada nas verificações.

O teste opcional `tests/appearance.check.cjs` reproduz persistência de tema, preferência do sistema, anéis, sessão móvel e assistente. As capturas dos dois temas, da sessão e do editor foram inspecionadas. O arquivo `src/core.js` permanece com o mesmo conteúdo da versão anterior.

## Revisão visual 0.3

As capturas da visão geral, entrada, assistente, evolução e edição de ficha foram conferidas em computador e celular. As sete telas principais foram verificadas nas nove larguras da revisão responsiva. Não houve transbordamento horizontal do documento, e campos e controles móveis mantiveram as dimensões previstas.

As duas suítes existentes de interface passaram após a revisão visual. Também foi conferido, com movimento normal, que os cartões aparecem, a ilustração flutua, a iluminação responde ao ponteiro e as janelas abrem e fecham. Ao ativar movimento reduzido no navegador, a flutuação e a transformação da ilustração foram desativadas. Não houve erro JavaScript não tratado nessas verificações.

O arquivo de regras `src/core.js` manteve seu conteúdo. A revisão concentra alterações na apresentação e não modifica contas, persistência, consentimento ou cálculos.

## Revisão de responsividade 0.2

Conferidas as telas Início, Treinos, Catálogo, Histórico, Evolução, Assistente e Perfil nas larguras 320, 360, 390, 430, 600, 768, 844, 1024 e 1440 pixels. A largura de 844 foi testada com altura de 390 pixels para representar posição horizontal. Nenhuma dessas telas excedeu a largura do documento; as tabelas têm rolagem própria.

O formulário de ficha foi conferido em 390 pixels, com campos de pelo menos 16 pixels de fonte e controles ampliados. A marcação de série foi conferida com área de toque de pelo menos 44 pixels. Capturas da evolução e do editor móvel foram inspecionadas. O gráfico usa largura variável e reduz a quantidade de rótulos no eixo horizontal em telas menores.

Após os ajustes, as duas suítes existentes de interface e os 12 testes de regras foram aprovados. A validação de dimensões usa navegação em modo móvel com toque no Edge controlado pelo Playwright; não substitui teste físico no Android ou iPhone.

## Regras de negócio

Resultado: **12 testes aprovados**, executados com o test runner nativo do Node.js.

- Coerência da carga inicial e cálculo de volume a partir das séries.
- Conta nova sem fichas ou histórico de outra conta.
- Rascunho vazio permitido e início de ficha vazia bloqueado.
- Snapshot da sessão preservado após edição e arquivamento da ficha.
- Retomada de sessão existente sem criar uma segunda sessão ativa.
- Valores inválidos rejeitados e finalização sem séries bloqueada.
- Métricas filtradas por exercício, período e conclusão.
- Consentimento exigido e revogação aplicada à próxima consulta.
- Pedidos de alteração, sintomas e risco sem escrita automática em fichas.
- Proposta sem efeito antes da confirmação e aplicação única.
- Propostas rejeitadas, expiradas ou inválidas bloqueadas.
- Treino disponível durante indisponibilidade simulada da IA.

Para reproduzir:

```text
npm test
```

## Interface no navegador

Conferência automatizada com Playwright e Microsoft Edge em ambiente isolado, sem utilizar os dados do navegador pessoal. As capturas do painel, da evolução e da versão móvel também foram inspecionadas visualmente.

Jornada principal aprovada:

1. Entrada na demonstração e painel em desktop.
2. Criação de ficha pelo catálogo, preenchimento de carga e salvamento.
3. Início, conclusão de série, resumo de finalização e detalhes do histórico.
4. Pergunta sobre supino bloqueada sem autorização, seguida de análise após consentimento.
5. Geração de proposta sem criar ficha, reabertura da proposta pendente e confirmação explícita.
6. Persistência após recarregar e gráfico de evolução.
7. Navegação móvel em Início, Treinos, Histórico, Evolução e Assistente.
8. Cadastro de conta vazia, saída, rejeição de senha incorreta e entrada com senha correta.
9. Ausência de rolagem horizontal do documento em 320, 390, 768, 1280 e 1440 pixels nas telas verificadas. As tabelas podem rolar dentro do próprio contêiner.
10. Nenhum erro JavaScript não tratado nas jornadas executadas.

Conferência adicional aprovada:

- Filtro do catálogo por grupo e termo, detalhes e criação de ficha com o exercício selecionado.
- Edição e arquivamento de ficha, mantendo o nome e os dados das sessões históricas.
- Download CSV do histórico.
- Exportação e restauração do próprio backup JSON, preservando a quantidade de sessões.
- Rejeição de backup com campos inválidos antes de substituir dados.
- Resposta de indisponibilidade do assistente, mantendo o treino operacional.
- Retomada de sessão ativa e série concluída após recarregamento.
- Confirmação de descarte da sessão.

Os scripts `tests/ui.check.cjs` e `tests/ui.extra.cjs` reproduzem essas verificações e iniciam servidores temporários nas portas 4180 e 4181. Eles exigem Playwright instalado no ambiente de desenvolvimento; não é uma dependência do aplicativo ou de `npm test`. Para executá-los em um ambiente com Playwright disponível:

```text
node tests/ui.check.cjs
node tests/ui.extra.cjs
```

No Windows, os scripts procuram o Microsoft Edge no caminho padrão; em outro ambiente usam o Chromium do Playwright. `REPWISE_BROWSER` permite indicar outro executável e `REPWISE_PLAYWRIGHT` permite indicar o módulo Playwright. As capturas da primeira suíte são salvas em `work/qa`.

## Limites desta conferência

Não representa auditoria de segurança, homologação clínica, teste de carga ou certificação de acessibilidade. Não houve teste em aparelhos físicos, Safari, Firefox ou serviços reais de autenticação, banco ou LLM. O cadastro é local e demonstrativo; o aplicativo não está pronto para armazenar dados pessoais de produção.
