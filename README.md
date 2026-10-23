# RepWise AI 0.5

Aplicativo responsivo de treino com cadastro por nome, e-mail e senha, autenticação no servidor, registros em JSON por usuário e temas claro/escuro. O assistente ainda usa respostas simuladas.

## Acessar

https://repwise-ai.ynk-victor.chatgpt.site

Toque em **Criar conta**, preencha seu nome, e-mail, senha e confirmação. Contas novas começam sem treinos. Nos próximos acessos, entre com o mesmo e-mail e senha para recuperar seus registros no computador ou no celular. O RepWise não depende de conta ChatGPT.

**Entrar na demonstração** permite explorar dados fictícios sem cadastro. Os dados desse modo ficam apenas no navegador.

A senha é armazenada como hash PBKDF2-SHA512 com salt individual. A sessão dura até sete dias e usa cookie HttpOnly, Secure na publicação e SameSite=Lax. O servidor valida cada operação pela sessão e rejeita origens externas e excesso de tentativas. O botão Sair invalida a sessão no servidor. Não há confirmação de e-mail nem recuperação de senha nesta primeira versão.

## Dados em JSON

O perfil, os treinos e o histórico são serializados em JSON no banco D1 da hospedagem. Assim os dados sobrevivem às atualizações e podem ser acessados em outro aparelho. Não há arquivo JSON público com senhas ou registros. Credenciais e sessões permanecem no servidor; somente o hash do token da sessão fica no banco.

O app avisa quando está salvando, quando falha a conexão e quando há conflito com alterações de outra aba/aparelho. Aguarde **Salvo na sua conta** antes de sair. Abra ou recarregue a página em outro aparelho para carregar a versão atual. Alterações pendentes usam uma cópia local até a sincronização; o app não garante funcionamento offline completo. No Perfil é possível exportar/restaurar backup JSON. Contas locais de versões anteriores não são contas cadastradas no servidor.

## Desenvolvimento

Requer Node.js 22.13 ou superior. Execute npm ci, depois prepare o banco local:

```text
node scripts/local-db.mjs
```

Execute npm run dev para abrir o endereço local informado. Após instalar as dependências, o iniciador Windows prepara o banco e abre o servidor na porta 4173. O antigo servidor estático server.cjs não executa as APIs de contas. Para compilar para hospedagem, use npm run build.

A publicação usa o fluxo Sites, preserva o projeto em .openai/hosting.json e aplica as migrações hospedadas antes de enviar o servidor. Alterar o código local não altera automaticamente o endereço público.

## Testes

npm test verifica treino, cadastro, senha incorreta, confirmação de senha, e-mail duplicado, expiração/saída, limites de tentativas, isolamento de usuários, dados inválidos e conflitos de gravação. A interface foi conferida em navegador com tela móvel, incluindo entrada em um segundo navegador, salvamento, recarregamento, falha de conexão e nova tentativa.

tests/auth-ui.check.cjs usa Playwright e um servidor de desenvolvimento já aberto em http://127.0.0.1:5184. Configure REPWISE_PLAYWRIGHT e REPWISE_BROWSER para seus caminhos locais, se necessário. Os scripts antigos ui.check/ui.extra/appearance usam a antiga base estática e representam a validação da versão 0.4.

## Estrutura

- index.html e src/: interface, regras de treino, efeitos e temas.
- app/api/auth/: cadastro, login e saída por e-mail e senha.
- lib/auth.mjs: senha, sessão e limites de tentativas.
- app/api/account/ e lib/account-api.mjs: leitura e escrita autenticadas do JSON de cada conta.
- db/schema.ts e drizzle/: esquema e migrações do banco.
- worker/, vite.config.ts e scripts/: base Vinext/Sites para hospedagem.

O assistente não chama uma LLM, não diagnostica sintomas e exige confirmação antes de criar uma ficha sugerida. Backups contêm seus registros: guarde-os em local privado. Os documentos de escopo e validação anteriores descrevem a etapa 0.4; esta página descreve a versão atual.

