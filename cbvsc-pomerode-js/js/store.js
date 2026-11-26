window.CBV = window.CBV || {};

(function () {
    const STORAGE_KEY = (window.CBV.Config && window.CBV.Config.STORAGE_KEY) || 'cbvsc_pomerode_db_v1';
    const SYNC_CHANNEL = typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('cbvsc_pomerode_sync')
        : null;

    const listeners = [];

    function uuid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    // Hash para senhas e template biométrico (RNF05 / RNF06 - LGPD)
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

    function hojeISO(offsetDias = 0) {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() + offsetDias);
        return d.toISOString().split('T')[0];
    }

    function diffDias(isoA, isoB) {
        const a = new Date(isoA + 'T12:00:00');
        const b = new Date(isoB + 'T12:00:00');
        return Math.round((b - a) / 86400000);
    }

    function diaSemanaISO(iso) {
        const d = new Date(iso + 'T12:00:00').getDay(); // 0=Dom ... 6=Sáb
        return d === 0 ? 7 : d; // 1=Seg ... 7=Dom
    }

    function criarDadosIniciais() {
        const turnos = [
            { id: 1, nome: 'Manhã', periodo: '06h - 12h', horaInicio: 6, horaFim: 12, minimo: 3, limiteRecomendado: 5 },
            { id: 2, nome: 'Tarde', periodo: '12h - 18h', horaInicio: 12, horaFim: 18, minimo: 3, limiteRecomendado: 6 },
            { id: 3, nome: 'Noite', periodo: '18h - 06h', horaInicio: 18, horaFim: 6, minimo: 4, limiteRecomendado: 8 }
        ];

        const bombeiros = [
            {
                id: uuid(), nome: 'Administrador CBVSC', telefone: '(47) 99900-0001', login: 'admin',
                senhaHash: hashTexto('123'), tipoVinculo: 'CLT', perfilAcesso: 'ADMINISTRADOR',
                ativo: true, faltas: 0, penalidadeAtual: 'NENHUMA',
                capacitacoes: ['MOTORISTA_VIATURA', 'MOTORISTA_AMBULANCIA'], nrsClt: ['NR-20', 'NR-33', 'NR-35'],
                diasSemanaFixos: [], turnoFixoId: null, dataInicioEscalaClt: hojeISO(0), turnoBaseCltId: 1,
                consentimentoLgpd: true, templateBiometricoHash: hashTexto('LGPD::BIO-ADMIN')
            },
            {
                id: uuid(), nome: 'Carlos Silva', telefone: '(47) 99900-0002', login: 'chefe',
                senhaHash: hashTexto('123'), tipoVinculo: 'CLT', perfilAcesso: 'CHEFE_EQUIPE',
                ativo: true, faltas: 0, penalidadeAtual: 'NENHUMA',
                capacitacoes: ['MOTORISTA_VIATURA'], nrsClt: ['NR-33', 'NR-35'],
                diasSemanaFixos: [], turnoFixoId: null, dataInicioEscalaClt: hojeISO(0), turnoBaseCltId: 3,
                consentimentoLgpd: true, templateBiometricoHash: hashTexto('LGPD::BIO-CHEFE')
            },
            {
                id: uuid(), nome: 'João Pereira', telefone: '(47) 99900-0003', login: 'clt',
                senhaHash: hashTexto('123'), tipoVinculo: 'CLT', perfilAcesso: 'CLT',
                ativo: true, faltas: 0, penalidadeAtual: 'NENHUMA',
                capacitacoes: ['MOTORISTA_AMBULANCIA'], nrsClt: ['NR-20', 'NR-35'],
                diasSemanaFixos: [], turnoFixoId: null, dataInicioEscalaClt: hojeISO(1), turnoBaseCltId: 1,
                consentimentoLgpd: true, templateBiometricoHash: hashTexto('LGPD::BIO-CLT')
            },
            {
                id: uuid(), nome: 'Ana Luisa Caponegri', telefone: '(47) 99900-0004', login: 'voluntario',
                senhaHash: hashTexto('123'), tipoVinculo: 'VOLUNTARIO_FIXO', perfilAcesso: 'VOLUNTARIO',
                ativo: true, faltas: 0, penalidadeAtual: 'NENHUMA',
                capacitacoes: ['MOTORISTA_AMBULANCIA'], nrsClt: [],
                diasSemanaFixos: [1, 3, 5, 6], turnoFixoId: 2, dataInicioEscalaClt: null, turnoBaseCltId: null,
                consentimentoLgpd: true, templateBiometricoHash: hashTexto('LGPD::BIO-ANA')
            },
            {
                id: uuid(), nome: 'Jaime de Mello', telefone: '(47) 99900-0005', login: 'jaime',
                senhaHash: hashTexto('123'), tipoVinculo: 'VOLUNTARIO_EVENTUAL', perfilAcesso: 'VOLUNTARIO',
                ativo: true, faltas: 0, penalidadeAtual: 'NENHUMA',
                capacitacoes: ['MOTORISTA_VIATURA'], nrsClt: [],
                diasSemanaFixos: [], turnoFixoId: null, dataInicioEscalaClt: null, turnoBaseCltId: null,
                consentimentoLgpd: false, templateBiometricoHash: null
            }
        ];

        const viaturas = [
            {
                id: uuid(), codigo: 'ABTR-01', nome: 'Auto Bomba Tanque Resgate', tipo: 'VIATURA',
                status: 'DISPONIVEL', motoristaId: null, motoristaNome: null,
                tripulacaoNomes: [], destinoOcorrencia: null, saidaEm: null, atualizadaPor: 'Sistema'
            },
            {
                id: uuid(), codigo: 'ASU-02', nome: 'Auto Socorro de Urgência', tipo: 'AMBULANCIA',
                status: 'DISPONIVEL', motoristaId: null, motoristaNome: null,
                tripulacaoNomes: [], destinoOcorrencia: null, saidaEm: null, atualizadaPor: 'Sistema'
            },
            {
                id: uuid(), codigo: 'AT-03', nome: 'Auto Tanque Apoio', tipo: 'VIATURA',
                status: 'MANUTENCAO', motoristaId: null, motoristaNome: null,
                tripulacaoNomes: [], destinoOcorrencia: 'Revisão preventiva', saidaEm: null, atualizadaPor: 'Sistema'
            }
        ];

        return {
            configuracao: {
                prazoLimiteCancelamentoHoras: 6,
                bloquearCancelamentoAposPrazo: false,
                retencaoDias: 30
            },
            turnos,
            bombeiros,
            plantoes: [],
            viaturas,
            auditorias: []
        };
    }

    function carregarDB() {
        const salvo = localStorage.getItem(STORAGE_KEY);
        if (salvo) {
            try { return JSON.parse(salvo); } catch (_) {}
        }
        const inicial = criarDadosIniciais();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inicial));
        return inicial;
    }

    let db = carregarDB();

    function salvarDB(notificar = true) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        if (window.CBV.Config && window.CBV.Config.MODO_PERSISTENCIA === 'API') {
            fetch(`${window.CBV.Config.API_BASE_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(db)
            })
            .then(r => r.json())
            .then(res => {
                if (res && res.dados) {
                    db = res.dados;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
                    listeners.forEach(fn => fn());
                }
            })
            .catch(err => console.error('Falha ao sincronizar com MySQL:', err));
        }
        if (notificar && SYNC_CHANNEL) SYNC_CHANNEL.postMessage({ tipo: 'DB_ATUALIZADO' });
        if (notificar) listeners.forEach(fn => fn());
    }

    function registrarAuditoria(usuario, acao, detalhes) {
        db.auditorias.unshift({
            id: uuid(),
            dataHora: new Date().toISOString(),
            usuario: usuario ? usuario.nome : 'Sistema',
            perfil: usuario ? usuario.perfilAcesso : 'SISTEMA',
            acao,
            detalhes
        });
        if (db.auditorias.length > 300) db.auditorias.length = 300;
    }

    function exigirPerfil(usuario, permitidos) {
        if (!usuario || !permitidos.includes(usuario.perfilAcesso)) {
            throw new Error('Permissão negada para o seu perfil de acesso.');
        }
    }

    // Sincronização em tempo real entre abas do navegador (RNF04 / RF15)
    if (SYNC_CHANNEL) {
        SYNC_CHANNEL.onmessage = () => {
            db = carregarDB();
            listeners.forEach(fn => fn());
        };
    }
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            db = carregarDB();
            listeners.forEach(fn => fn());
        }
    });

    const Store = {
        hojeISO,
        onChange(fn) { listeners.push(fn); },

        // ==================== RF17 / RNF05: AUTENTICAÇÃO ====================
        autenticar(login, senha) {
            const usuario = db.bombeiros.find(b => b.login.toLowerCase() === login.trim().toLowerCase());
            if (!usuario || usuario.senhaHash !== hashTexto(senha)) {
                throw new Error('Usuário ou senha inválidos.');
            }
            if (!usuario.ativo) {
                throw new Error('Cadastro inativo/desligado. Procure a administração.');
            }
            registrarAuditoria(usuario, 'LOGIN', 'Acesso autenticado no sistema.');
            salvarDB();
            return usuario;
        },

        obterBombeiroPorId(id) {
            return db.bombeiros.find(b => b.id === id) || null;
        },

        obterPlantaoPorId(id) {
            return db.plantoes.find(p => p.id === id) || null;
        },

        listarBombeiros() {
            return [...db.bombeiros].sort((a, b) => a.nome.localeCompare(b.nome));
        },

        // ==================== RF01 / RF02 / RNF06: CADASTRO DE BOMBEIROS ====================
        cadastrarBombeiro(operador, dados) {
            exigirPerfil(operador, ['ADMINISTRADOR']);

            if (!dados.nome.trim() || !dados.login.trim() || !dados.senha.trim()) {
                throw new Error('Nome, login e senha são obrigatórios.');
            }
            if (db.bombeiros.some(b => b.login.toLowerCase() === dados.login.trim().toLowerCase())) {
                throw new Error('Já existe um bombeiro cadastrado com este login.');
            }

            const novo = {
                id: uuid(),
                nome: dados.nome.trim(),
                telefone: (dados.telefone || '').trim(),
                login: dados.login.trim().toLowerCase(),
                senhaHash: hashTexto(dados.senha),
                tipoVinculo: dados.tipoVinculo,
                perfilAcesso: dados.perfilAcesso,
                ativo: true,
                faltas: 0,
                penalidadeAtual: 'NENHUMA',
                capacitacoes: dados.capacitacoes || [],
                nrsClt: dados.tipoVinculo === 'CLT' ? (dados.nrsClt || []) : [],
                diasSemanaFixos: dados.tipoVinculo === 'VOLUNTARIO_FIXO' ? (dados.diasSemanaFixos || []) : [],
                turnoFixoId: dados.tipoVinculo === 'VOLUNTARIO_FIXO' ? Number(dados.turnoFixoId) : null,
                dataInicioEscalaClt: dados.tipoVinculo === 'CLT' ? (dados.dataInicioEscalaClt || hojeISO(0)) : null,
                turnoBaseCltId: dados.tipoVinculo === 'CLT' ? Number(dados.turnoBaseCltId || 1) : null,
                consentimentoLgpd: Boolean(dados.consentimentoLgpd),
                templateBiometricoHash: (dados.consentimentoLgpd && dados.codigoBiometrico)
                    ? hashTexto('LGPD::' + dados.codigoBiometrico.trim())
                    : null
            };

            db.bombeiros.push(novo);
            registrarAuditoria(operador, 'CADASTRO_BOMBEIRO', `${novo.nome} (${novo.tipoVinculo} / ${novo.perfilAcesso})`);
            salvarDB();
            return novo;
        },

        // ==================== RF07 / RF15: CONSULTA DE ESCALA ====================
        consultarEscalaPorData(dataISO) {
            const data = dataISO || hojeISO(0);
            const turnos = db.turnos.map(t => {
                const plantoes = db.plantoes
                    .filter(p => p.data === data && p.turnoId === t.id)
                    .sort((a, b) => a.registradoEm.localeCompare(b.registradoEm));

                const totalAtivos = plantoes.filter(p => p.status === 'AGENDADO' || p.status === 'PRESENTE').length;

                let statusCor = 'status-verde';
                let statusLabel = `Adequado (${totalAtivos} de ${t.minimo}-${t.limiteRecomendado})`;
                if (totalAtivos < t.minimo) {
                    statusCor = 'status-laranja';
                    statusLabel = `Abaixo do mínimo (${totalAtivos}/${t.minimo})`;
                } else if (totalAtivos > t.limiteRecomendado) {
                    statusCor = 'status-roxo';
                    statusLabel = `Acima do limite (${totalAtivos}/${t.limiteRecomendado})`;
                }

                return { config: t, totalAtivos, statusCor, statusLabel, plantoes };
            });

            return { data, configuracao: db.configuracao, turnos };
        },

        // ==================== RF03 / RF13: AGENDAMENTO ====================
        agendarPlantao(operador, { bombeiroId, data, turnoId, origem = 'MANUAL' }) {
            const idAlvo = bombeiroId || operador.id;
            if (idAlvo !== operador.id) {
                exigirPerfil(operador, ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT']);
            }

            const hoje = hojeISO(0);
            const limiteFuturo = hojeISO(db.configuracao.retencaoDias);
            if (!data || data < hoje) throw new Error('Não é permitido agendar em data passada.');
            if (data > limiteFuturo) throw new Error(`Agendamento limitado à janela ativa de ${db.configuracao.retencaoDias} dias.`);

            const bombeiro = this.obterBombeiroPorId(idAlvo);
            if (!bombeiro || !bombeiro.ativo) throw new Error('Bombeiro inativo ou não encontrado.');

            const turno = db.turnos.find(t => t.id === Number(turnoId));
            if (!turno) throw new Error('Turno inválido.');

            const duplicado = db.plantoes.some(p =>
                p.bombeiroId === bombeiro.id && p.data === data && p.turnoId === turno.id &&
                (p.status === 'AGENDADO' || p.status === 'PRESENTE')
            );
            if (duplicado) throw new Error(`${bombeiro.nome} já está escalado neste turno.`);

            const plantao = {
                id: uuid(),
                bombeiroId: bombeiro.id,
                bombeiroNome: bombeiro.nome,
                tipoVinculo: bombeiro.tipoVinculo,
                turnoId: turno.id,
                data,
                status: 'AGENDADO',
                origem,
                registradoPor: operador.nome,
                registradoEm: new Date().toISOString(),
                horaPresencaBiometria: null,
                horaCancelamento: null,
                cancelamentoForaPrazo: false,
                faltaRegistradaPor: null
            };

            db.plantoes.push(plantao);
            if (origem === 'MANUAL') {
                registrarAuditoria(operador, 'AGENDAR_PLANTAO', `${bombeiro.nome} em ${data} (${turno.nome})`);
                salvarDB();
            }
            return plantao;
        },

        listarPlantoesDoUsuario(usuarioId) {
            const corte = hojeISO(-db.configuracao.retencaoDias);
            return db.plantoes
                .filter(p => p.bombeiroId === usuarioId && p.data >= corte)
                .sort((a, b) => a.data.localeCompare(b.data) || a.turnoId - b.turnoId);
        },

        // ==================== RF08 / RF09: CANCELAMENTO COM PRAZO LIMITE ====================
        cancelarPlantao(operador, plantaoId) {
            const plantao = db.plantoes.find(p => p.id === plantaoId);
            if (!plantao) throw new Error('Plantão não encontrado.');
            if (plantao.bombeiroId !== operador.id) {
                exigirPerfil(operador, ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT']);
            }
            if (plantao.status !== 'AGENDADO') {
                throw new Error('Somente plantões AGENDADOS podem ser cancelados.');
            }

            const turno = db.turnos.find(t => t.id === plantao.turnoId);
            const [ano, mes, dia] = plantao.data.split('-').map(Number);
            const inicioTurno = new Date(ano, mes - 1, dia, turno.horaInicio, 0, 0);
            const prazoLimite = new Date(inicioTurno.getTime() - db.configuracao.prazoLimiteCancelamentoHoras * 3600000);
            const foraDoPrazo = new Date() > prazoLimite;

            if (foraDoPrazo && db.configuracao.bloquearCancelamentoAposPrazo && operador.perfilAcesso === 'VOLUNTARIO') {
                registrarAuditoria(operador, 'CANCELAMENTO_BLOQUEADO',
                    `Tentativa após prazo limite (${db.configuracao.prazoLimiteCancelamentoHoras}h) em ${plantao.data} (${turno.nome})`);
                salvarDB();
                throw new Error(`Cancelamento bloqueado: prazo limite de ${db.configuracao.prazoLimiteCancelamentoHoras}h antes do turno encerrado.`);
            }

            plantao.horaCancelamento = new Date().toISOString();
            plantao.cancelamentoForaPrazo = foraDoPrazo;
            plantao.status = foraDoPrazo ? 'CANCELADO_FORA_PRAZO' : 'CANCELADO';

            registrarAuditoria(
                operador,
                foraDoPrazo ? 'CANCELAMENTO_FORA_PRAZO' : 'CANCELAMENTO_PLANTAO',
                `${plantao.bombeiroNome} em ${plantao.data} (${turno.nome})`
            );
            salvarDB();

            return {
                foraDoPrazo,
                mensagem: foraDoPrazo
                    ? `Cancelamento efetuado FORA DO PRAZO (${db.configuracao.prazoLimiteCancelamentoHoras}h) e sinalizado à chefia.`
                    : 'Cancelamento confirmado dentro do prazo.'
            };
        },

        // ==================== RF10 / RNF06: PRESENÇA POR BIOMETRIA + LGPD ====================
        registrarPresencaBiometria(operador, plantaoId, codigoBiometrico, aceitarLgpd) {
            const plantao = db.plantoes.find(p => p.id === plantaoId);
            if (!plantao) throw new Error('Plantão não encontrado.');
            if (plantao.bombeiroId !== operador.id) {
                exigirPerfil(operador, ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT']);
            }
            if (plantao.status !== 'AGENDADO') {
                throw new Error('A presença biométrica só pode ser registrada para plantões AGENDADOS.');
            }

            const bombeiro = this.obterBombeiroPorId(plantao.bombeiroId);
            if (!bombeiro.consentimentoLgpd) {
                if (!aceitarLgpd) throw new Error('Consentimento LGPD obrigatório para leitura biométrica.');
                bombeiro.consentimentoLgpd = true;
            }
            if (!codigoBiometrico || !codigoBiometrico.trim()) {
                throw new Error('Informe o código/leitura biométrica.');
            }

            const hashInformado = hashTexto('LGPD::' + codigoBiometrico.trim());
            if (!bombeiro.templateBiometricoHash) {
                bombeiro.templateBiometricoHash = hashInformado;
            } else if (bombeiro.templateBiometricoHash !== hashInformado) {
                throw new Error('Biometria não confere com o template protegido cadastrado.');
            }

            plantao.status = 'PRESENTE';
            plantao.horaPresencaBiometria = new Date().toISOString();
            registrarAuditoria(operador, 'PRESENCA_BIOMETRIA', `${bombeiro.nome} em ${plantao.data}`);
            salvarDB();
            return plantao;
        },

        // ==================== RF11 / RF12: CONTROLE DE FALTAS ====================
        registrarFalta(operador, plantaoId) {
            exigirPerfil(operador, ['CLT', 'CHEFE_EQUIPE', 'ADMINISTRADOR']);

            const plantao = db.plantoes.find(p => p.id === plantaoId);
            if (!plantao) throw new Error('Plantão não encontrado.');
            if (plantao.status === 'FALTA') throw new Error('Falta já registrada neste plantão.');
            if (plantao.status === 'PRESENTE') throw new Error('Plantão já possui presença biométrica confirmada.');

            const bombeiro = this.obterBombeiroPorId(plantao.bombeiroId);
            plantao.status = 'FALTA';
            plantao.faltaRegistradaPor = operador.nome;
            bombeiro.faltas += 1;

            if (bombeiro.faltas === 1) {
                bombeiro.penalidadeAtual = 'ANOTACAO';
            } else if (bombeiro.faltas === 2) {
                bombeiro.penalidadeAtual = 'ADVERTENCIA';
            } else {
                bombeiro.penalidadeAtual = 'DESLIGAMENTO';
                bombeiro.ativo = false;
                const hoje = hojeISO(0);
                db.plantoes.forEach(p => {
                    if (p.bombeiroId === bombeiro.id && p.status === 'AGENDADO' && p.data >= hoje) {
                        p.status = 'CANCELADO';
                        p.horaCancelamento = new Date().toISOString();
                    }
                });
            }

            registrarAuditoria(operador, 'REGISTRAR_FALTA',
                `${bombeiro.nome} atingiu ${bombeiro.faltas} falta(s) -> ${bombeiro.penalidadeAtual}`);
            salvarDB();

            return `Falta nº ${bombeiro.faltas} aplicada a ${bombeiro.nome} — Medida: ${bombeiro.penalidadeAtual}.`;
        },

        // ==================== RF04 / RF05: ESCALA FIXA E 12x36 CLT ====================
        gerarEscalaFixa(operador) {
            exigirPerfil(operador, ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT']);
            let criados = 0;

            db.bombeiros.forEach(b => {
                if (!b.ativo || b.tipoVinculo !== 'VOLUNTARIO_FIXO' || !b.turnoFixoId || !b.diasSemanaFixos.length) return;
                for (let d = 0; d < db.configuracao.retencaoDias; d++) {
                    const data = hojeISO(d);
                    if (b.diasSemanaFixos.includes(diaSemanaISO(data))) {
                        try {
                            this.agendarPlantao(operador, { bombeiroId: b.id, data, turnoId: b.turnoFixoId, origem: 'ESCALA_FIXA' });
                            criados++;
                        } catch (_) {}
                    }
                }
            });

            registrarAuditoria(operador, 'GERAR_ESCALA_FIXA', `${criados} plantões fixos gerados (30 dias).`);
            salvarDB();
            return criados;
        },

        gerarEscalaClt12x36(operador) {
            exigirPerfil(operador, ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT']);
            let criados = 0;

            db.bombeiros.forEach(b => {
                if (!b.ativo || b.tipoVinculo !== 'CLT') return;
                const inicio = b.dataInicioEscalaClt || hojeISO(0);
                const turnoBase = b.turnoBaseCltId || 1;

                for (let d = 0; d < db.configuracao.retencaoDias; d++) {
                    const data = hojeISO(d);
                    const delta = diffDias(inicio, data);
                    if (delta >= 0 && delta % 2 === 0) {
                        const turnosDia = turnoBase === 3 ? [3] : [1, 2]; // 12h Noturno ou 12h Diurno (Manhã + Tarde)
                        turnosDia.forEach(tid => {
                            try {
                                this.agendarPlantao(operador, { bombeiroId: b.id, data, turnoId: tid, origem: 'ESCALA_12X36' });
                                criados++;
                            } catch (_) {}
                        });
                    }
                }
            });

            registrarAuditoria(operador, 'GERAR_ESCALA_12X36', `${criados} turnos 12x36 CLT gerados (30 dias).`);
            salvarDB();
            return criados;
        },

        // ==================== RF06 / RF08 / RF09: CONFIGURAÇÕES ====================
        obterConfiguracoes() {
            return { turnos: db.turnos, sistema: db.configuracao };
        },

        atualizarConfiguracoes(operador, novosTurnos, novaConfig) {
            exigirPerfil(operador, ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT']);
            novosTurnos.forEach(nt => {
                const atual = db.turnos.find(t => t.id === nt.id);
                if (nt.minimo < 1 || nt.limiteRecomendado < nt.minimo) {
                    throw new Error(`No turno ${atual.nome}, o limite recomendado deve ser maior ou igual ao mínimo.`);
                }
                atual.minimo = nt.minimo;
                atual.limiteRecomendado = nt.limiteRecomendado;
            });

            if (novaConfig.prazoLimiteCancelamentoHoras < 0) {
                throw new Error('O prazo limite de cancelamento não pode ser negativo.');
            }
            db.configuracao.prazoLimiteCancelamentoHoras = novaConfig.prazoLimiteCancelamentoHoras;
            db.configuracao.bloquearCancelamentoAposPrazo = novaConfig.bloquearCancelamentoAposPrazo;

            registrarAuditoria(operador, 'ATUALIZAR_CONFIG',
                `Limites por turno e prazo de cancelamento (${novaConfig.prazoLimiteCancelamentoHoras}h) atualizados.`);
            salvarDB();
        },

        // ==================== RF14: VIATURAS ====================
        listarViaturas() {
            return db.viaturas;
        },

        cadastrarViatura(operador, { codigo, nome, tipo }) {
            exigirPerfil(operador, ['ADMINISTRADOR', 'CHEFE_EQUIPE']);
            if (!codigo.trim() || !nome.trim()) throw new Error('Código e nome da viatura são obrigatórios.');
            const v = {
                id: uuid(), codigo: codigo.trim().toUpperCase(), nome: nome.trim(),
                tipo: tipo || 'VIATURA', status: 'DISPONIVEL',
                motoristaId: null, motoristaNome: null, tripulacaoNomes: [],
                destinoOcorrencia: null, saidaEm: null, atualizadaPor: operador.nome
            };
            db.viaturas.push(v);
            registrarAuditoria(operador, 'CADASTRO_VIATURA', `${v.codigo} - ${v.nome}`);
            salvarDB();
            return v;
        },

        registrarSaidaViatura(operador, viaturaId, { motoristaId, tripulacaoIds, destino }) {
            exigirPerfil(operador, ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT']);
            const v = db.viaturas.find(x => x.id === viaturaId);
            if (!v || v.status !== 'DISPONIVEL') throw new Error('Viatura não está disponível no CBV.');

            const motorista = this.obterBombeiroPorId(motoristaId);
            const capExigida = v.tipo === 'AMBULANCIA' ? 'MOTORISTA_AMBULANCIA' : 'MOTORISTA_VIATURA';
            if (!motorista || !motorista.capacitacoes.includes(capExigida)) {
                throw new Error(`Motorista selecionado não possui capacitação obrigatória (${capExigida}).`);
            }

            const tripulacao = [`${motorista.nome} (Motorista)`];
            (tripulacaoIds || []).forEach(tid => {
                if (tid !== motorista.id) {
                    const b = this.obterBombeiroPorId(tid);
                    if (b) tripulacao.push(b.nome);
                }
            });

            v.status = 'EM_OCORRENCIA';
            v.motoristaId = motorista.id;
            v.motoristaNome = motorista.nome;
            v.tripulacaoNomes = tripulacao;
            v.destinoOcorrencia = (destino || 'Ocorrência em andamento').trim();
            v.saidaEm = new Date().toISOString();
            v.atualizadaPor = operador.nome;

            registrarAuditoria(operador, 'SAIDA_VIATURA', `${v.codigo} saiu com ${tripulacao.join(', ')} -> ${v.destinoOcorrencia}`);
            salvarDB();
            return v;
        },

        registrarRetornoViatura(operador, viaturaId, novoStatus = 'DISPONIVEL') {
            exigirPerfil(operador, ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT']);
            const v = db.viaturas.find(x => x.id === viaturaId);
            if (!v) throw new Error('Viatura não encontrada.');

            v.status = novoStatus;
            v.motoristaId = null;
            v.motoristaNome = null;
            v.tripulacaoNomes = [];
            v.destinoOcorrencia = null;
            v.saidaEm = null;
            v.atualizadaPor = operador.nome;

            registrarAuditoria(operador, 'RETORNO_VIATURA', `${v.codigo} atualizada para ${novoStatus}`);
            salvarDB();
            return v;
        },

        // ==================== RF16 / RNF07 / RNF08 / RNF09: RETENÇÃO, AUDITORIA E BACKUP ====================
        aplicarRetencao30Dias(operador) {
            if (operador) exigirPerfil(operador, ['ADMINISTRADOR']);
            const corte = hojeISO(-db.configuracao.retencaoDias);
            const antes = db.plantoes.length;
            db.plantoes = db.plantoes.filter(p => p.data >= corte);
            const removidos = antes - db.plantoes.length;
            if (operador) {
                registrarAuditoria(operador, 'RETENCAO_30_DIAS', `${removidos} plantão(ões) fora da janela ativa removidos.`);
            }
            salvarDB();
            return removidos;
        },

        listarAuditoria(operador) {
            exigirPerfil(operador, ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT']);
            return db.auditorias;
        },

        exportarBackup(operador) {
            exigirPerfil(operador, ['ADMINISTRADOR']);
            registrarAuditoria(operador, 'BACKUP_EXPORTADO', 'Snapshot JSON exportado.');
            salvarDB();
            return { geradoEm: new Date().toISOString(), sistema: 'CBVSC Pomerode', dados: db };
        },

        restaurarBackup(operador, jsonBackup) {
            exigirPerfil(operador, ['ADMINISTRADOR']);
            if (!jsonBackup || !jsonBackup.dados || !Array.isArray(jsonBackup.dados.bombeiros)) {
                throw new Error('Arquivo de backup inválido.');
            }
            db = jsonBackup.dados;
            registrarAuditoria(operador, 'BACKUP_RESTAURADO', 'Base de dados restaurada a partir de backup JSON.');
            salvarDB();
        },

        resetarDadosDemo(operador) {
            exigirPerfil(operador, ['ADMINISTRADOR']);
            db = criarDadosIniciais();
            const adminSeed = db.bombeiros[0];
            this.gerarEscalaFixa(adminSeed);
            this.gerarEscalaClt12x36(adminSeed);
            registrarAuditoria(adminSeed, 'RESET_DEMO', 'Base restaurada para o estado inicial de demonstração.');
            salvarDB();
        }
    };

    async function conectarMySQL() {
        if (!window.CBV.Config || window.CBV.Config.MODO_PERSISTENCIA !== 'API') {
            if (db.plantoes.length === 0) {
                const adminSeed = db.bombeiros[0];
                Store.gerarEscalaFixa(adminSeed);
                Store.gerarEscalaClt12x36(adminSeed);
            }
            Store.aplicarRetencao30Dias(null);
            return;
        }

        try {
            const resp = await fetch(`${window.CBV.Config.API_BASE_URL}/state`);
            const json = await resp.json();
            if (json.empty) {
                db = criarDadosIniciais();
                const adminSeed = db.bombeiros[0];
                Store.gerarEscalaFixa(adminSeed);
                Store.gerarEscalaClt12x36(adminSeed);
                salvarDB(true);
            } else if (json.dados) {
                db = json.dados;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
                listeners.forEach(fn => fn());
            }
        } catch (err) {
            console.warn('Servidor Node offline, usando cache local:', err);
        }
    }

    conectarMySQL();
    window.CBV.Store = Store;
})();