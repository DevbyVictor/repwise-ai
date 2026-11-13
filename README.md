# RepWise AI 0.6.0

Aplicação de organização e registro de treinos com banco relacional SQLite, cadastro por e-mail e senha, histórico por usuário e assistente de treino com IA local (Ollama).

## Iniciar

1. Instale o Node.js 22.13 ou superior.
2. Extraia todos os arquivos do pacote.
3. No Windows, abra INICIAR_REPWISE.cmd.
4. Abra http://127.0.0.1:4173 no navegador.

Também é possível iniciar com npm start ou node server.mjs. O projeto usa os recursos incluídos no Node.js. A criação do banco e do catálogo acontece na primeira execução.

Entre na demonstração para explorar uma conta temporária com registros fictícios, válida por 24 horas. Para manter seus treinos, crie uma conta com nome, e-mail e senha.

## Assistente de IA (Ollama)

O assistente usa um modelo de linguagem que roda no próprio computador pelo Ollama. Não precisa de chave de API nem de internet depois da instalação.

1. Rode uma vez `npm run ia:instalar`. O comando instala o Ollama (winget no Windows, Homebrew no macOS ou o instalador oficial no Linux), baixa o modelo padrão qwen2.5:0.5b (cerca de 400 MB) e faz uma pergunta de teste. No Windows, se ele pedir, feche e abra o terminal e rode o comando de novo.
2. Se a instalação automática não funcionar, instale manualmente por https://ollama.com/download e rode `ollama pull qwen2.5:0.5b`.
3. Deixe o Ollama aberto e inicie o RepWise normalmente. `npm run ia:verificar` confere se o Ollama e o modelo estão prontos.

O contexto de academia enviado ao modelo fica em lib/contexto-academia.json. O servidor junta esse contexto com o perfil do usuário e, somente com autorização, um resumo do histórico. Perguntas sobre dor, sintomas ou práticas extremas recebem respostas fixas e não passam pelo modelo. A ficha sugerida usa apenas exercícios do catálogo, fica com carga zero e só é criada depois da confirmação. Se o Ollama estiver fechado, o assistente responde por regras e o restante do app continua funcionando.

Variáveis opcionais: OLLAMA_MODEL troca o modelo (por exemplo llama3.2:1b ou qwen2.5:1.5b, que respondem melhor e usam mais memória), OLLAMA_URL define o endereço do Ollama e OLLAMA_TIMEOUT_MS define o tempo máximo de resposta.

## Banco e código

O arquivo db/esquema.sql contém o esquema completo. O servidor cria o banco em dados/repwise.sqlite.

As 14 tabelas de domínio são usuarios, perfis_usuario, exercicios, fichas_treino, ficha_exercicios, sessoes_treino, sessao_exercicios, series_executadas, consentimentos_ia, conversas_ia, mensagens_ia, propostas_ia, feedbacks_ia e eventos_auditoria. Duas tabelas adicionais controlam sessões de autenticação e tentativas de acesso.

O servidor salva os registros nas tabelas em uma transação, valida a conta pela sessão e rejeita gravações com revisão desatualizada. Para preservar o banco completo, encerre o servidor e copie a pasta dados.

Em Perfil, use Exportar backup JSON para obter uma cópia dos registros da conta. Para trazer os registros de uma versão anterior, exporte o backup naquela versão, crie uma conta nesta versão e use Restaurar backup JSON. A restauração substitui os registros de treino da conta autenticada.

Execute node db/verificar.mjs para verificar a integridade e consultar as quantidades de registros por tabela.

## Uso em outro dispositivo

O computador que executa o servidor precisa permanecer ligado e acessível ao outro dispositivo. No PowerShell, defina HOST como 0.0.0.0 e APP_ORIGIN como o endereço completo de acesso, por exemplo http://192.168.1.10:4173, antes de executar npm start. Use o endereço real do computador. A mesma origem deve ser usada em todos os acessos.

A publicação em um servidor exige Node.js compatível, uma pasta persistente para o banco e HTTPS. REPWISE_DB permite definir o caminho do banco, PORT define a porta e APP_ORIGIN define a origem pública. O cookie recebe a proteção Secure quando a origem usa HTTPS.

## Testes e apresentação

Execute npm test. As suítes cobrem regras de treino, as tabelas do domínio, autenticação, isolamento de contas, rollback de falhas, concorrência de gravação e recuperação do banco após reiniciar.

O roteiro tests/auth-ui.check.cjs usa Playwright e Edge para conferir cadastro, acesso em dois contextos, salvamento, falha de conexão, conflito e saída. Para executá-lo, inicie o servidor na porta 5187 e configure REPWISE_PLAYWRIGHT com o caminho do pacote Playwright. REPWISE_BROWSER permite escolher o executável do navegador. Esses recursos são opcionais para os testes de interface.

Na apresentação, demonstre cadastro, criação de ficha, execução de uma série, finalização, histórico e recarregamento. O assistente responde com IA local, registra consentimento e feedback e exige confirmação para criar a ficha sugerida. Mensagens, propostas e decisões são persistidas nas tabelas correspondentes.

As senhas usam PBKDF2-SHA512 com salt individual. A sessão autenticada dura até sete dias. Recuperação de senha, confirmação de e-mail e entrada por voz são possibilidades de evolução.
