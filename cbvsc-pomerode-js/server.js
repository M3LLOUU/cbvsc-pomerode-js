const express = require('express');
const cors = require('cors');
const pool = require('./database/db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

function hashTexto(valor) {
    let h1 = 0xdeadbeef ^ valor.length;
    let h2 = 0x41c6ce57 ^ valor.length;
    for (let i = 0; i < valor.length; i++) {
        const ch = valor.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 'HASH-' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

async function getColumns(conn, tableName) {
    const [rows] = await conn.query(
        `SELECT COLUMN_NAME, DATA_TYPE
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(?)`,
        [tableName]
    );
    const cols = {};
    for (const r of rows) cols[r.COLUMN_NAME.toLowerCase()] = r;
    return cols;
}

async function addColumnIfMissing(tableName, colName, colDef) {
    const cols = await getColumns(pool, tableName);
    if (Object.keys(cols).length > 0 && !cols[colName.toLowerCase()]) {
        await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
    }
}

function pickCol(cols, candidates) {
    for (const c of candidates) {
        if (cols[c.toLowerCase()]) return cols[c.toLowerCase()].COLUMN_NAME;
    }
    return null;
}

function formatarHorasParaTime(horas) {
    const h = Math.max(0, Math.min(23, Number(horas) || 6));
    return String(h).padStart(2, '0') + ':00:00';
}

function parseTimeParaHoras(timeStr) {
    if (!timeStr) return 6;
    const parts = String(timeStr).split(':');
    return parseInt(parts[0], 10) || 6;
}

function parsePeriodoTurno(periodo, id) {
    const texto = String(periodo || '');
    const matchHora = texto.match(/(\d{1,2})h\s*-\s*(\d{1,2})h/i);
    const defaults = {
        1: { nome: 'Manhã', periodo: '06h - 12h', inicio: 6, fim: 12 },
        2: { nome: 'Tarde', periodo: '12h - 18h', inicio: 12, fim: 18 },
        3: { nome: 'Noite', periodo: '18h - 06h', inicio: 18, fim: 6 }
    };
    const def = defaults[id] || { nome: `Turno ${id}`, periodo: texto || '06h - 12h', inicio: 6, fim: 12 };
    const nomeMatch = texto.match(/^([^(]+)/);
    return {
        nome: nomeMatch ? nomeMatch[1].trim() : def.nome,
        periodo: matchHora ? `${matchHora[1].padStart(2, '0')}h - ${matchHora[2].padStart(2, '0')}h` : def.periodo,
        horaInicio: matchHora ? Number(matchHora[1]) : def.inicio,
        horaFim: matchHora ? Number(matchHora[2]) : def.fim
    };
}

// Prepara colunas complementares nas tabelas existentes sem alterar suas colunas originais
async function prepararBanco() {
    // Colunas extras em PERFIL para login, perfil de acesso e LGPD
    await addColumnIfMissing('PERFIL', 'login', 'VARCHAR(60) NULL');
    await addColumnIfMissing('PERFIL', 'senha_hash', 'VARCHAR(255) NULL');
    await addColumnIfMissing('PERFIL', 'perfil_acesso', 'VARCHAR(30) NULL');
    await addColumnIfMissing('PERFIL', 'penalidade_atual', "VARCHAR(30) DEFAULT 'NENHUMA'");
    await addColumnIfMissing('PERFIL', 'dias_semana_fixos', 'VARCHAR(50) NULL');
    await addColumnIfMissing('PERFIL', 'turno_fixo_id', 'INT NULL');
    await addColumnIfMissing('PERFIL', 'data_inicio_escala_clt', 'DATE NULL');
    await addColumnIfMissing('PERFIL', 'turno_base_clt_id', 'INT NULL');
    await addColumnIfMissing('PERFIL', 'consentimento_lgpd', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfMissing('PERFIL', 'template_biometrico_hash', 'VARCHAR(255) NULL');

    // Coluna opcional em CONFIGURACAO para bloqueio pós-prazo
    await addColumnIfMissing('CONFIGURACAO', 'bloquear_apos_prazo', 'BOOLEAN DEFAULT FALSE');

    // Colunas complementares em PLANTAO
    await addColumnIfMissing('PLANTAO', 'origem', "VARCHAR(30) DEFAULT 'MANUAL'");
    await addColumnIfMissing('PLANTAO', 'registrado_por', 'VARCHAR(120) NULL');
    await addColumnIfMissing('PLANTAO', 'registrado_em', 'VARCHAR(40) NULL');
    await addColumnIfMissing('PLANTAO', 'hora_presenca_biometria', 'VARCHAR(40) NULL');
    await addColumnIfMissing('PLANTAO', 'hora_cancelamento', 'VARCHAR(40) NULL');
    await addColumnIfMissing('PLANTAO', 'cancelamento_fora_prazo', 'BOOLEAN DEFAULT FALSE');
    await addColumnIfMissing('PLANTAO', 'falta_registrada_por', 'VARCHAR(120) NULL');

    // Cria VIATURA e AUDITORIA caso ainda não existam no script
    await pool.query(`
        CREATE TABLE IF NOT EXISTS VIATURA (
            id INT AUTO_INCREMENT PRIMARY KEY,
            codigo VARCHAR(30) NOT NULL UNIQUE,
            nome VARCHAR(100) NOT NULL,
            tipo VARCHAR(30) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'DISPONIVEL',
            motorista_id INT NULL,
            motorista_nome VARCHAR(120) NULL,
            tripulacao_nomes TEXT NULL,
            destino_ocorrencia VARCHAR(255) NULL,
            saida_em VARCHAR(40) NULL,
            atualizada_por VARCHAR(120) NULL
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS AUDITORIA (
            id INT AUTO_INCREMENT PRIMARY KEY,
            data_hora VARCHAR(40) NOT NULL,
            usuario VARCHAR(120) NOT NULL,
            perfil VARCHAR(40) NOT NULL,
            acao VARCHAR(80) NOT NULL,
            detalhes TEXT
        )
    `);
}

async function lerEstadoCompleto() {
    const [perfisRows] = await pool.query('SELECT * FROM PERFIL ORDER BY id');
    if (perfisRows.length === 0) {
        return { empty: true };
    }

    const [turnosRows] = await pool.query('SELECT * FROM TURNO ORDER BY id');
    const [cfgRows] = await pool.query('SELECT * FROM CONFIGURACAO ORDER BY id LIMIT 1');
    const [capRows] = await pool.query('SELECT * FROM CAPACITACAO');
    const [viaturasRows] = await pool.query('SELECT * FROM VIATURA ORDER BY id');
    const [auditoriaRows] = await pool.query('SELECT * FROM AUDITORIA ORDER BY id DESC LIMIT 300');

    // Mapeia CAPACITACAO e PERFIL_CAPACITACAO
    const capById = {};
    for (const c of capRows) capById[c.id] = c;

    const pcCols = await getColumns(pool, 'PERFIL_CAPACITACAO');
    const colPcPerfil = pickCol(pcCols, ['perfil_id', 'id_perfil']);
    const colPcCap = pickCol(pcCols, ['capacitacao_id', 'id_capacitacao']);
    const capsPorPerfil = {};
    if (colPcPerfil && colPcCap) {
        const [pcRows] = await pool.query('SELECT * FROM PERFIL_CAPACITACAO');
        for (const r of pcRows) {
            const pid = r[colPcPerfil];
            const cap = capById[r[colPcCap]];
            if (!cap) continue;
            if (!capsPorPerfil[pid]) capsPorPerfil[pid] = { caps: [], nrs: [] };
            if (String(cap.tipo || '').toUpperCase() === 'NR' || String(cap.nome).startsWith('NR-')) {
                capsPorPerfil[pid].nrs.push(cap.nome);
            } else {
                capsPorPerfil[pid].caps.push(cap.nome);
            }
        }
    }

    // Mapeia PLANTAO detectando nomes das colunas de FK e data
    const plCols = await getColumns(pool, 'PLANTAO');
    const colPlPerfil = pickCol(plCols, ['perfil_id', 'id_perfil', 'bombeiro_id']);
    const colPlTurno = pickCol(plCols, ['turno_id', 'id_turno']);
    const colPlData = pickCol(plCols, ['data_plantao', 'data']);
    const colPlStatus = pickCol(plCols, ['status', 'situacao']);

    const [plantoesRows] = await pool.query('SELECT * FROM PLANTAO ORDER BY id');
    const perfilMap = {};
    for (const p of perfisRows) perfilMap[p.id] = p;

    const cfg = cfgRows[0] || { prazo_cancelamento: '06:00:00', dias_retencao: 30, bloquear_apos_prazo: 0 };

    return {
        empty: false,
        dados: {
            configuracao: {
                prazoLimiteCancelamentoHoras: parseTimeParaHoras(cfg.prazo_cancelamento),
                bloquearCancelamentoAposPrazo: Boolean(cfg.bloquear_apos_prazo),
                retencaoDias: Number(cfg.dias_retencao) || 30
            },
            turnos: turnosRows.map(t => {
                const parsed = parsePeriodoTurno(t.periodo, t.id);
                return {
                    id: Number(t.id),
                    nome: parsed.nome,
                    periodo: parsed.periodo,
                    horaInicio: parsed.horaInicio,
                    horaFim: parsed.horaFim,
                    minimo: Number(t.minimo),
                    limiteRecomendado: Number(t.limite_recomendado)
                };
            }),
            bombeiros: perfisRows.map(b => {
                const extras = capsPorPerfil[b.id] || { caps: [], nrs: [] };
                const loginFallback = (b.login || b.nome.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + b.id);
                return {
                    id: String(b.id),
                    nome: b.nome,
                    telefone: b.telefone || '',
                    login: loginFallback,
                    senhaHash: b.senha_hash || hashTexto('123'),
                    tipoVinculo: b.tipo || (b.fixo ? 'VOLUNTARIO_FIXO' : 'VOLUNTARIO_EVENTUAL'),
                    perfilAcesso: b.perfil_acesso || (b.tipo === 'CLT' ? 'CLT' : 'VOLUNTARIO'),
                    ativo: Boolean(b.ativo),
                    faltas: Number(b.faltas || 0),
                    penalidadeAtual: b.penalidade_atual || 'NENHUMA',
                    capacitacoes: extras.caps,
                    nrsClt: extras.nrs,
                    diasSemanaFixos: b.dias_semana_fixos ? JSON.parse(b.dias_semana_fixos) : [],
                    turnoFixoId: b.turno_fixo_id ? Number(b.turno_fixo_id) : null,
                    dataInicioEscalaClt: b.data_inicio_escala_clt || null,
                    turnoBaseCltId: b.turno_base_clt_id ? Number(b.turno_base_clt_id) : null,
                    consentimentoLgpd: Boolean(b.consentimento_lgpd),
                    templateBiometricoHash: b.template_biometrico_hash || null
                };
            }),
            plantoes: plantoesRows.map(p => {
                const pid = colPlPerfil ? p[colPlPerfil] : null;
                const perfil = perfilMap[pid] || {};
                return {
                    id: String(p.id),
                    bombeiroId: String(pid),
                    bombeiroNome: perfil.nome || 'Bombeiro',
                    tipoVinculo: perfil.tipo || 'VOLUNTARIO_EVENTUAL',
                    turnoId: Number(colPlTurno ? p[colPlTurno] : 1),
                    data: colPlData ? String(p[colPlData]).slice(0, 10) : '',
                    status: colPlStatus ? p[colPlStatus] : 'AGENDADO',
                    origem: p.origem || 'MANUAL',
                    registradoPor: p.registrado_por || 'Sistema',
                    registradoEm: p.registrado_em || new Date().toISOString(),
                    horaPresencaBiometria: p.hora_presenca_biometria || null,
                    horaCancelamento: p.hora_cancelamento || null,
                    cancelamentoForaPrazo: Boolean(p.cancelamento_fora_prazo),
                    faltaRegistradaPor: p.falta_registrada_por || null
                };
            }),
            viaturas: viaturasRows.map(v => ({
                id: String(v.id),
                codigo: v.codigo,
                nome: v.nome,
                tipo: v.tipo,
                status: v.status,
                motoristaId: v.motorista_id ? String(v.motorista_id) : null,
                motoristaNome: v.motorista_nome || null,
                tripulacaoNomes: v.tripulacao_nomes ? JSON.parse(v.tripulacao_nomes) : [],
                destinoOcorrencia: v.destino_ocorrencia || null,
                saidaEm: v.saida_em || null,
                atualizadaPor: v.atualizada_por || 'Sistema'
            })),
            auditorias: auditoriaRows.map(a => ({
                id: String(a.id),
                dataHora: a.data_hora,
                usuario: a.usuario,
                perfil: a.perfil,
                acao: a.acao,
                detalhes: a.detalhes
            }))
        }
    };
}

app.get('/api/state', async (req, res) => {
    try {
        const estado = await lerEstadoCompleto();
        res.json(estado);
    } catch (err) {
        console.error('Erro GET /api/state:', err);
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/sync', async (req, res) => {
    const db = req.body;
    if (!db || !Array.isArray(db.bombeiros)) {
        return res.status(400).json({ erro: 'Payload inválido.' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. CONFIGURACAO (converte horas para TIME 'HH:00:00')
        const prazoTime = formatarHorasParaTime(db.configuracao.prazoLimiteCancelamentoHoras);
        const [cfgExist] = await conn.query('SELECT id FROM CONFIGURACAO LIMIT 1');
        if (cfgExist.length === 0) {
            await conn.query(
                'INSERT INTO CONFIGURACAO (prazo_cancelamento, dias_retencao, bloquear_apos_prazo) VALUES (?, ?, ?)',
                [prazoTime, db.configuracao.retencaoDias || 30, db.configuracao.bloquearCancelamentoAposPrazo ? 1 : 0]
            );
        } else {
            await conn.query(
                'UPDATE CONFIGURACAO SET prazo_cancelamento = ?, dias_retencao = ?, bloquear_apos_prazo = ? WHERE id = ?',
                [prazoTime, db.configuracao.retencaoDias || 30, db.configuracao.bloquearCancelamentoAposPrazo ? 1 : 0, cfgExist[0].id]
            );
        }

        // 2. TURNO
        for (const t of db.turnos) {
            const periodoFull = `${t.nome} (${t.periodo})`;
            await conn.query(
                `INSERT INTO TURNO (id, periodo, minimo, limite_recomendado)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE periodo = VALUES(periodo), minimo = VALUES(minimo), limite_recomendado = VALUES(limite_recomendado)`,
                [t.id, periodoFull, t.minimo, t.limiteRecomendado]
            );
        }

        // 3. PERFIL + CAPACITACAO + PERFIL_CAPACITACAO
        const idMapPerfil = {}; // mapeia UUID temporário do front -> INT id do MySQL
        const pcCols = await getColumns(conn, 'PERFIL_CAPACITACAO');
        const colPcPerfil = pickCol(pcCols, ['perfil_id', 'id_perfil']);
        const colPcCap = pickCol(pcCols, ['capacitacao_id', 'id_capacitacao']);

        for (const b of db.bombeiros) {
            const isFixo = b.tipoVinculo === 'VOLUNTARIO_FIXO' ? 1 : 0;
            const escalaClt = b.tipoVinculo === 'CLT'
                ? (b.turnoBaseCltId === 3 ? '12x36 Noturno' : '12x36 Diurno')
                : null;

            const isNumericId = /^\d+$/.test(String(b.id));
            let perfilDbId;

            if (isNumericId) {
                perfilDbId = Number(b.id);
                await conn.query(
                    `UPDATE PERFIL SET
                        nome = ?, telefone = ?, tipo = ?, fixo = ?, ativo = ?, escala_12x36 = ?, faltas = ?,
                        login = ?, senha_hash = ?, perfil_acesso = ?, penalidade_atual = ?,
                        dias_semana_fixos = ?, turno_fixo_id = ?, data_inicio_escala_clt = ?, turno_base_clt_id = ?,
                        consentimento_lgpd = ?, template_biometrico_hash = ?
                     WHERE id = ?`,
                    [
                        b.nome, b.telefone, b.tipoVinculo, isFixo, b.ativo ? 1 : 0, escalaClt, b.faltas,
                        b.login, b.senhaHash, b.perfilAcesso, b.penalidadeAtual,
                        JSON.stringify(b.diasSemanaFixos || []), b.turnoFixoId || null,
                        b.dataInicioEscalaClt || null, b.turnoBaseCltId || null,
                        b.consentimentoLgpd ? 1 : 0, b.templateBiometricoHash || null,
                        perfilDbId
                    ]
                );
            } else {
                const [existingByLogin] = await conn.query('SELECT id FROM PERFIL WHERE login = ?', [b.login]);
                if (existingByLogin.length > 0) {
                    perfilDbId = existingByLogin[0].id;
                } else {
                    const [ins] = await conn.query(
                        `INSERT INTO PERFIL
                         (nome, telefone, tipo, fixo, ativo, escala_12x36, faltas, login, senha_hash, perfil_acesso,
                          penalidade_atual, dias_semana_fixos, turno_fixo_id, data_inicio_escala_clt, turno_base_clt_id,
                          consentimento_lgpd, template_biometrico_hash)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            b.nome, b.telefone, b.tipoVinculo, isFixo, b.ativo ? 1 : 0, escalaClt, b.faltas,
                            b.login, b.senhaHash, b.perfilAcesso, b.penalidadeAtual,
                            JSON.stringify(b.diasSemanaFixos || []), b.turnoFixoId || null,
                            b.dataInicioEscalaClt || null, b.turnoBaseCltId || null,
                            b.consentimentoLgpd ? 1 : 0, b.templateBiometricoHash || null
                        ]
                    );
                    perfilDbId = ins.insertId;
                }
            }
            idMapPerfil[String(b.id)] = perfilDbId;

            // Sincroniza CAPACITACAO e PERFIL_CAPACITACAO
            if (colPcPerfil && colPcCap) {
                await conn.query(`DELETE FROM PERFIL_CAPACITACAO WHERE ${colPcPerfil} = ?`, [perfilDbId]);
                const todasCaps = [
                    ...(b.capacitacoes || []).map(nome => ({ nome, tipo: 'CAPACITACAO' })),
                    ...(b.nrsClt || []).map(nome => ({ nome, tipo: 'NR' }))
                ];
                for (const item of todasCaps) {
                    let [capFound] = await conn.query('SELECT id FROM CAPACITACAO WHERE nome = ?', [item.nome]);
                    let capId;
                    if (capFound.length > 0) {
                        capId = capFound[0].id;
                    } else {
                        const [insCap] = await conn.query('INSERT INTO CAPACITACAO (nome, tipo) VALUES (?, ?)', [item.nome, item.tipo]);
                        capId = insCap.insertId;
                    }
                    await conn.query(
                        `INSERT IGNORE INTO PERFIL_CAPACITACAO (${colPcPerfil}, ${colPcCap}) VALUES (?, ?)`,
                        [perfilDbId, capId]
                    );
                }
            }
        }

        // 4. PLANTAO + FALTA
        const plCols = await getColumns(conn, 'PLANTAO');
        const colPlPerfil = pickCol(plCols, ['perfil_id', 'id_perfil', 'bombeiro_id']);
        const colPlTurno = pickCol(plCols, ['turno_id', 'id_turno']);
        const colPlData = pickCol(plCols, ['data_plantao', 'data']);
        const colPlStatus = pickCol(plCols, ['status', 'situacao']);

        const faltaCols = await getColumns(conn, 'FALTA');
        const colFlPerfil = pickCol(faltaCols, ['perfil_id', 'id_perfil', 'bombeiro_id']);
        const colFlPlantao = pickCol(faltaCols, ['plantao_id', 'id_plantao']);
        const colFlData = pickCol(faltaCols, ['data_falta', 'data']);
        const colFlMotivo = pickCol(faltaCols, ['motivo', 'observacao', 'penalidade']);

        if (colPlPerfil && colPlTurno && colPlData && colPlStatus) {
            const numericPlantaoIds = db.plantoes
                .filter(p => /^\d+$/.test(String(p.id)))
                .map(p => Number(p.id));

            if (numericPlantaoIds.length > 0) {
                await conn.query('DELETE FROM PLANTAO WHERE id NOT IN (?)', [numericPlantaoIds]);
            } else if (db.plantoes.length === 0) {
                await conn.query('DELETE FROM PLANTAO');
            }

            for (const p of db.plantoes) {
                const perfilDbId = idMapPerfil[String(p.bombeiroId)] || Number(p.bombeiroId);
                if (!perfilDbId) continue;

                const isNum = /^\d+$/.test(String(p.id));
                let plantaoDbId;

                if (isNum) {
                    plantaoDbId = Number(p.id);
                    await conn.query(
                        `UPDATE PLANTAO SET
                            ${colPlStatus} = ?, hora_presenca_biometria = ?, hora_cancelamento = ?,
                            cancelamento_fora_prazo = ?, falta_registrada_por = ?
                         WHERE id = ?`,
                        [
                            p.status, p.horaPresencaBiometria || null, p.horaCancelamento || null,
                            p.cancelamentoForaPrazo ? 1 : 0, p.faltaRegistradaPor || null, plantaoDbId
                        ]
                    );
                } else {
                    const [insPl] = await conn.query(
                        `INSERT INTO PLANTAO
                         (${colPlPerfil}, ${colPlTurno}, ${colPlData}, ${colPlStatus}, origem, registrado_por, registrado_em,
                          hora_presenca_biometria, hora_cancelamento, cancelamento_fora_prazo, falta_registrada_por)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            perfilDbId, p.turnoId, p.data, p.status, p.origem || 'MANUAL',
                            p.registradoPor || 'Sistema', p.registradoEm || new Date().toISOString(),
                            p.horaPresencaBiometria || null, p.horaCancelamento || null,
                            p.cancelamentoForaPrazo ? 1 : 0, p.faltaRegistradaPor || null
                        ]
                    );
                    plantaoDbId = insPl.insertId;
                }

                // Se status for FALTA, registra também na tabela FALTA
                if (p.status === 'FALTA' && colFlPerfil) {
                    const checkSql = colFlPlantao
                        ? `SELECT id FROM FALTA WHERE ${colFlPlantao} = ?`
                        : `SELECT id FROM FALTA WHERE ${colFlPerfil} = ?` + (colFlData ? ` AND ${colFlData} = ?` : '');
                    const checkParams = colFlPlantao
                        ? [plantaoDbId]
                        : (colFlData ? [perfilDbId, p.data] : [perfilDbId]);

                    const [faltaExist] = await conn.query(checkSql, checkParams);
                    if (faltaExist.length === 0) {
                        const colsInsert = [colFlPerfil];
                        const valsInsert = [perfilDbId];
                        if (colFlPlantao) { colsInsert.push(colFlPlantao); valsInsert.push(plantaoDbId); }
                        if (colFlData) { colsInsert.push(colFlData); valsInsert.push(p.data); }
                        if (colFlMotivo) { colsInsert.push(colFlMotivo); valsInsert.push(`Registrada por ${p.faltaRegistradaPor || 'Chefia'}`); }

                        await conn.query(
                            `INSERT INTO FALTA (${colsInsert.join(', ')}) VALUES (${colsInsert.map(() => '?').join(', ')})`,
                            valsInsert
                        );
                    }
                }
            }
        }

        // 5. VIATURA
        for (const v of db.viaturas) {
            const motDbId = v.motoristaId ? (idMapPerfil[String(v.motoristaId)] || Number(v.motoristaId) || null) : null;
            await conn.query(
                `INSERT INTO VIATURA
                 (codigo, nome, tipo, status, motorista_id, motorista_nome, tripulacao_nomes, destino_ocorrencia, saida_em, atualizada_por)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                  status = VALUES(status), motorista_id = VALUES(motorista_id), motorista_nome = VALUES(motorista_nome),
                  tripulacao_nomes = VALUES(tripulacao_nomes), destino_ocorrencia = VALUES(destino_ocorrencia),
                  saida_em = VALUES(saida_em), atualizada_por = VALUES(atualizada_por)`,
                [
                    v.codigo, v.nome, v.tipo, v.status, motDbId, v.motoristaNome || null,
                    JSON.stringify(v.tripulacaoNomes || []), v.destinoOcorrencia || null,
                    v.saidaEm || null, v.atualizadaPor || 'Sistema'
                ]
            );
        }

        // 6. AUDITORIA
        for (const a of (db.auditorias || []).slice(0, 50).reverse()) {
            const [audExist] = await conn.query(
                'SELECT id FROM AUDITORIA WHERE data_hora = ? AND acao = ? AND detalhes = ? LIMIT 1',
                [a.dataHora, a.acao, a.detalhes]
            );
            if (audExist.length === 0) {
                await conn.query(
                    'INSERT INTO AUDITORIA (data_hora, usuario, perfil, acao, detalhes) VALUES (?, ?, ?, ?, ?)',
                    [a.dataHora, a.usuario, a.perfil, a.acao, a.detalhes]
                );
            }
        }

        await conn.commit();
        const estadoAtualizado = await lerEstadoCompleto();
        res.json(estadoAtualizado);
    } catch (err) {
        await conn.rollback();
        console.error('Erro POST /api/sync:', err);
        res.status(500).json({ erro: err.message });
    } finally {
        conn.release();
    }
});

function formatarDataISO(val) {
    if (!val) return '';
    if (val instanceof Date) {
        const ano = val.getFullYear();
        const mes = String(val.getMonth() + 1).padStart(2, '0');
        const dia = String(val.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }
    return String(val).slice(0, 10);
}

prepararBanco()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`✅ Conectado ao MySQL 'bombeiros' em http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Erro ao conectar no MySQL:', err.message);
    });