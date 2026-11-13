PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    senha_hash TEXT,
    demonstracao INTEGER NOT NULL DEFAULT 0 CHECK (demonstracao IN (0, 1)),
    revisao INTEGER NOT NULL DEFAULT 1 CHECK (revisao >= 1),
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL,
    expira_em INTEGER,
    CHECK ((demonstracao = 0 AND email IS NOT NULL AND senha_hash IS NOT NULL AND expira_em IS NULL)
        OR (demonstracao = 1 AND email IS NULL AND senha_hash IS NULL AND expira_em IS NOT NULL))
) STRICT;

CREATE TABLE IF NOT EXISTS perfis_usuario (
    id_usuario TEXT PRIMARY KEY REFERENCES usuarios ON DELETE CASCADE,
    objetivo_treino TEXT NOT NULL,
    nivel_experiencia TEXT NOT NULL,
    frequencia_semanal INTEGER NOT NULL CHECK (frequencia_semanal BETWEEN 1 AND 7),
    duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos BETWEEN 15 AND 120),
    preferencias TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS exercicios (
    id_exercicio TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    grupo_muscular TEXT NOT NULL,
    equipamento TEXT NOT NULL,
    descricao TEXT NOT NULL,
    tipo TEXT NOT NULL,
    ordem INTEGER NOT NULL UNIQUE CHECK (ordem >= 1)
) STRICT;

CREATE TABLE IF NOT EXISTS fichas_treino (
    id_usuario TEXT NOT NULL REFERENCES usuarios ON DELETE CASCADE,
    id_ficha TEXT NOT NULL,
    nome TEXT NOT NULL,
    subtitulo TEXT NOT NULL,
    estilo TEXT NOT NULL CHECK (estilo IN ('push', 'pull', 'legs')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
    origem TEXT NOT NULL CHECK (origem IN ('user', 'ai')),
    ordem INTEGER NOT NULL CHECK (ordem >= 1),
    PRIMARY KEY (id_usuario, id_ficha),
    UNIQUE (id_usuario, ordem)
) STRICT;

CREATE TABLE IF NOT EXISTS ficha_exercicios (
    id_usuario TEXT NOT NULL,
    id_ficha TEXT NOT NULL,
    ordem INTEGER NOT NULL CHECK (ordem >= 1),
    id_exercicio TEXT NOT NULL REFERENCES exercicios,
    series_planejadas INTEGER NOT NULL CHECK (series_planejadas BETWEEN 1 AND 20),
    repeticoes_planejadas INTEGER NOT NULL CHECK (repeticoes_planejadas BETWEEN 1 AND 200),
    carga_planejada REAL NOT NULL CHECK (carga_planejada BETWEEN 0 AND 1000),
    PRIMARY KEY (id_usuario, id_ficha, ordem),
    FOREIGN KEY (id_usuario, id_ficha) REFERENCES fichas_treino ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS sessoes_treino (
    id_usuario TEXT NOT NULL REFERENCES usuarios ON DELETE CASCADE,
    id_sessao TEXT NOT NULL,
    id_ficha_origem TEXT,
    nome_ficha_snapshot TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'finished')),
    iniciada_em TEXT NOT NULL,
    finalizada_em TEXT,
    duracao_segundos INTEGER,
    observacao TEXT NOT NULL,
    CHECK ((status = 'active' AND finalizada_em IS NULL AND duracao_segundos IS NULL)
        OR (status = 'finished' AND finalizada_em IS NOT NULL AND duracao_segundos > 0 AND duracao_segundos IS NOT NULL)),
    PRIMARY KEY (id_usuario, id_sessao),
    FOREIGN KEY (id_usuario, id_ficha_origem) REFERENCES fichas_treino DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS sessao_ativa_por_usuario ON sessoes_treino (id_usuario) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS sessoes_por_periodo ON sessoes_treino (id_usuario, finalizada_em);

CREATE TABLE IF NOT EXISTS sessao_exercicios (
    id_usuario TEXT NOT NULL,
    id_sessao TEXT NOT NULL,
    ordem INTEGER NOT NULL CHECK (ordem >= 1),
    id_exercicio TEXT NOT NULL REFERENCES exercicios,
    nome_exercicio_snapshot TEXT NOT NULL,
    series_planejadas INTEGER NOT NULL CHECK (series_planejadas BETWEEN 1 AND 20),
    repeticoes_planejadas INTEGER NOT NULL CHECK (repeticoes_planejadas BETWEEN 1 AND 200),
    carga_planejada REAL NOT NULL CHECK (carga_planejada BETWEEN 0 AND 1000),
    observacao TEXT NOT NULL,
    PRIMARY KEY (id_usuario, id_sessao, ordem),
    FOREIGN KEY (id_usuario, id_sessao) REFERENCES sessoes_treino ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS series_executadas (
    id_usuario TEXT NOT NULL,
    id_sessao TEXT NOT NULL,
    ordem_exercicio INTEGER NOT NULL,
    numero_serie INTEGER NOT NULL CHECK (numero_serie BETWEEN 1 AND 20),
    repeticoes INTEGER CHECK (repeticoes BETWEEN 0 AND 200),
    carga_kg REAL CHECK (carga_kg BETWEEN 0 AND 1000),
    concluida INTEGER NOT NULL CHECK (concluida IN (0, 1)),
    CHECK (concluida = 0 OR (repeticoes IS NOT NULL AND carga_kg IS NOT NULL)),
    PRIMARY KEY (id_usuario, id_sessao, ordem_exercicio, numero_serie),
    FOREIGN KEY (id_usuario, id_sessao, ordem_exercicio) REFERENCES sessao_exercicios ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS consentimentos_ia (
    id_usuario TEXT NOT NULL REFERENCES usuarios ON DELETE CASCADE,
    ordem INTEGER NOT NULL CHECK (ordem >= 1),
    finalidade TEXT NOT NULL,
    concedido INTEGER NOT NULL CHECK (concedido IN (0, 1)),
    decidido_em TEXT NOT NULL,
    PRIMARY KEY (id_usuario, ordem)
) STRICT;

CREATE TABLE IF NOT EXISTS conversas_ia (
    id_usuario TEXT PRIMARY KEY REFERENCES usuarios ON DELETE CASCADE,
    assistente_disponivel INTEGER NOT NULL CHECK (assistente_disponivel IN (0, 1)),
    criada_em TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS mensagens_ia (
    id_usuario TEXT NOT NULL REFERENCES conversas_ia ON DELETE CASCADE,
    id_mensagem TEXT NOT NULL,
    ordem INTEGER NOT NULL CHECK (ordem >= 1),
    papel TEXT NOT NULL CHECK (papel IN ('user', 'assistant')),
    conteudo TEXT NOT NULL,
    categoria TEXT,
    contexto TEXT,
    criada_em TEXT NOT NULL,
    PRIMARY KEY (id_usuario, id_mensagem),
    UNIQUE (id_usuario, ordem)
) STRICT;

CREATE TABLE IF NOT EXISTS propostas_ia (
    id_usuario TEXT NOT NULL REFERENCES usuarios ON DELETE CASCADE,
    id_proposta TEXT NOT NULL,
    id_mensagem_origem TEXT,
    id_ficha_resultante TEXT,
    ordem INTEGER NOT NULL CHECK (ordem >= 1),
    tipo_acao TEXT NOT NULL CHECK (tipo_acao = 'CRIAR_FICHA'),
    payload_validado TEXT NOT NULL CHECK (json_valid(payload_validado)),
    status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'rejected')),
    criada_em TEXT NOT NULL,
    expira_em TEXT NOT NULL,
    decidida_em TEXT,
    PRIMARY KEY (id_usuario, id_proposta),
    UNIQUE (id_usuario, ordem),
    FOREIGN KEY (id_usuario, id_mensagem_origem) REFERENCES mensagens_ia DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (id_usuario, id_ficha_resultante) REFERENCES fichas_treino DEFERRABLE INITIALLY DEFERRED
) STRICT;

CREATE TABLE IF NOT EXISTS feedbacks_ia (
    id_usuario TEXT NOT NULL,
    id_mensagem TEXT NOT NULL,
    classificacao TEXT NOT NULL CHECK (classificacao IN ('useful', 'inappropriate')),
    PRIMARY KEY (id_usuario, id_mensagem),
    FOREIGN KEY (id_usuario, id_mensagem) REFERENCES mensagens_ia ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS eventos_auditoria (
    id_usuario TEXT NOT NULL REFERENCES usuarios ON DELETE CASCADE,
    ordem INTEGER NOT NULL CHECK (ordem >= 1),
    tipo_evento TEXT NOT NULL,
    id_entidade TEXT,
    ocorrido_em TEXT NOT NULL,
    PRIMARY KEY (id_usuario, ordem)
) STRICT;

CREATE TABLE IF NOT EXISTS sessoes_autenticacao (
    token_hash TEXT PRIMARY KEY,
    id_usuario TEXT NOT NULL REFERENCES usuarios ON DELETE CASCADE,
    expira_em INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS tentativas_autenticacao (
    chave TEXT PRIMARY KEY,
    quantidade INTEGER NOT NULL,
    expira_em INTEGER NOT NULL
) STRICT;
