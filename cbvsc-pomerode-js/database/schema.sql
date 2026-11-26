-- Script SQL (MySQL 8+) preparado para quando conectar o sistema ao banco 'bombeiros'
CREATE DATABASE IF NOT EXISTS bombeiros
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bombeiros;

CREATE TABLE IF NOT EXISTS turnos (
    id INT PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    periodo VARCHAR(50) NOT NULL,
    hora_inicio INT NOT NULL,
    hora_fim INT NOT NULL,
    minimo INT NOT NULL DEFAULT 3,
    limite_recomendado INT NOT NULL DEFAULT 6
);

INSERT IGNORE INTO turnos (id, nome, periodo, hora_inicio, hora_fim, minimo, limite_recomendado) VALUES
(1, 'Manhã', '06h - 12h', 6, 12, 3, 5),
(2, 'Tarde', '12h - 18h', 12, 18, 3, 6),
(3, 'Noite', '18h - 06h', 18, 6, 4, 8);

CREATE TABLE IF NOT EXISTS configuracao_sistema (
    id INT PRIMARY KEY DEFAULT 1,
    prazo_limite_cancelamento_horas INT NOT NULL DEFAULT 6,
    bloquear_cancelamento_apos_prazo BOOLEAN NOT NULL DEFAULT FALSE,
    retencao_dias INT NOT NULL DEFAULT 30
);

INSERT IGNORE INTO configuracao_sistema (id, prazo_limite_cancelamento_horas, bloquear_cancelamento_apos_prazo, retencao_dias)
VALUES (1, 6, FALSE, 30);

CREATE TABLE IF NOT EXISTS bombeiros (
    id VARCHAR(36) PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    telefone VARCHAR(30),
    login VARCHAR(60) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    tipo_vinculo ENUM('VOLUNTARIO_FIXO', 'VOLUNTARIO_EVENTUAL', 'CLT') NOT NULL,
    perfil_acesso ENUM('VOLUNTARIO', 'CLT', 'CHEFE_EQUIPE', 'ADMINISTRADOR') NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    faltas INT NOT NULL DEFAULT 0,
    penalidade_atual ENUM('NENHUMA', 'ANOTACAO', 'ADVERTENCIA', 'DESLIGAMENTO') NOT NULL DEFAULT 'NENHUMA',
    capacitacoes JSON,
    nrs_clt JSON,
    dias_semana_fixos JSON,
    turno_fixo_id INT NULL,
    data_inicio_escala_clt DATE NULL,
    turno_base_clt_id INT NULL,
    consentimento_lgpd BOOLEAN NOT NULL DEFAULT FALSE,
    template_biometrico_hash VARCHAR(255) NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plantoes (
    id VARCHAR(36) PRIMARY KEY,
    bombeiro_id VARCHAR(36) NOT NULL,
    turno_id INT NOT NULL,
    data_plantao DATE NOT NULL,
    status ENUM('AGENDADO', 'PRESENTE', 'CANCELADO', 'CANCELADO_FORA_PRAZO', 'FALTA') NOT NULL DEFAULT 'AGENDADO',
    origem ENUM('MANUAL', 'ESCALA_FIXA', 'ESCALA_12X36') NOT NULL DEFAULT 'MANUAL',
    registrado_por VARCHAR(120) NOT NULL,
    registrado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hora_presenca_biometria DATETIME NULL,
    hora_cancelamento DATETIME NULL,
    cancelamento_fora_prazo BOOLEAN NOT NULL DEFAULT FALSE,
    falta_registrada_por VARCHAR(120) NULL,
    FOREIGN KEY (bombeiro_id) REFERENCES bombeiros(id),
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
);

CREATE TABLE IF NOT EXISTS viaturas (
    id VARCHAR(36) PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    tipo ENUM('VIATURA', 'AMBULANCIA') NOT NULL,
    status ENUM('DISPONIVEL', 'EM_OCORRENCIA', 'MANUTENCAO') NOT NULL DEFAULT 'DISPONIVEL',
    motorista_id VARCHAR(36) NULL,
    tripulacao_nomes JSON,
    destino_ocorrencia VARCHAR(255) NULL,
    saida_em DATETIME NULL,
    atualizada_por VARCHAR(120),
    atualizada_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (motorista_id) REFERENCES bombeiros(id)
);

CREATE TABLE IF NOT EXISTS auditoria (
    id VARCHAR(36) PRIMARY KEY,
    data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usuario VARCHAR(120) NOT NULL,
    perfil VARCHAR(40) NOT NULL,
    acao VARCHAR(80) NOT NULL,
    detalhes TEXT
);
