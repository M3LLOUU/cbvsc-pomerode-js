// TELA 2: Escala em Tempo Real e Controle de Faltas (RF07, RF11, RF12, RF13, RF15, RNF04)
window.CBV = window.CBV || {};

window.CBV.TelaEscala = {
    dataSelecionada: null,

    render(container) {
        if (!this.dataSelecionada) this.dataSelecionada = CBV.Store.hojeISO(0);
        const escala = CBV.Store.consultarEscalaPorData(this.dataSelecionada);
        const gestor = CBV.App.ehGestor();
        const esc = CBV.App.escapeHtml;

        const cardsTurnos = escala.turnos.map(t => {
            const badgeClass = t.statusCor === 'status-laranja' ? 'b-laranja'
                : (t.statusCor === 'status-roxo' ? 'b-roxo' : 'b-verde');

            const lista = t.plantoes.length === 0
                ? '<p class="meta">Nenhum bombeiro escalado neste turno.</p>'
                : t.plantoes.map(p => {
                    const stBadge = p.status === 'PRESENTE' ? '<span class="badge b-verde">PRESENTE (BIO)</span>'
                        : p.status === 'FALTA' ? '<span class="badge b-vermelho">FALTA</span>'
                        : p.status === 'CANCELADO_FORA_PRAZO' ? '<span class="badge b-laranja">CANC. FORA PRAZO</span>'
                        : p.status === 'CANCELADO' ? '<span class="badge b-cinza">CANCELADO</span>'
                        : '<span class="badge b-azul">AGENDADO</span>';

                    const acoes = (gestor && p.status === 'AGENDADO') ? `
                        <div class="btn-row">
                            <button type="button" class="btn btn-sm btn-green" onclick="CBV.TelaEscala.biometria('${p.id}')">Biometria</button>
                            <button type="button" class="btn btn-sm" onclick="CBV.TelaEscala.lancarFalta('${p.id}')">Falta</button>
                        </div>
                    ` : '';

                    return `
                        <div class="plantao-item">
                            <div>
                                <strong>${esc(p.bombeiroNome)}</strong> ${stBadge}
                                <div class="meta">${esc(p.tipoVinculo)} • ${esc(p.origem)} • Escalado: ${CBV.App.formatarDataHora(p.registradoEm)}</div>
                            </div>
                            ${acoes}
                        </div>
                    `;
                }).join('');

            return `
                <div class="card turno-card ${t.statusCor}">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                        <h3 style="margin:0;">${esc(t.config.nome)} (${esc(t.config.periodo)})</h3>
                        <span class="badge ${badgeClass}">${esc(t.statusLabel)}</span>
                    </div>
                    <p class="meta" style="margin-bottom:10px;">
                        Mínimo (Laranja): ${t.config.minimo} | Limite recomendado (Roxo): ${t.config.limiteRecomendado}
                    </p>
                    ${lista}
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <header class="page-header">
                <div>
                    <h1>Escala em Tempo Real</h1>
                    <p>Consulta atualizada instantaneamente para todos os perfis, substituindo o papel e o WhatsApp.</p>
                </div>
                <div class="btn-row" style="align-items:center;">
                    <input type="date" id="filtro-data-escala" value="${this.dataSelecionada}"
                           style="padding:8px; border:1px solid #ccc; border-radius:6px;">
                    <button type="button" class="btn btn-blue" onclick="CBV.TelaEscala.irParaHoje()">Hoje</button>
                </div>
            </header>

            <div class="card" style="padding:12px 16px; display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
                <strong>Legenda (RF06/RF07):</strong>
                <span class="badge b-laranja">Laranja: Abaixo do mínimo</span>
                <span class="badge b-verde">Verde: Cobertura adequada</span>
                <span class="badge b-roxo">Roxo: Acima do recomendado</span>
                <span class="meta" style="margin-left:auto;">
                    Cancelamento até ${escala.configuracao.prazoLimiteCancelamentoHoras}h antes do turno
                    (${escala.configuracao.bloquearCancelamentoAposPrazo ? 'Bloqueia' : 'Sinaliza'} após o prazo)
                </span>
            </div>

            <div class="grid-3">${cardsTurnos}</div>
        `;

        container.querySelector('#filtro-data-escala').addEventListener('change', (e) => {
            this.dataSelecionada = e.target.value || CBV.Store.hojeISO(0);
            this.render(container);
        });
    },

    irParaHoje() {
        this.dataSelecionada = CBV.Store.hojeISO(0);
        CBV.App.reRenderAtual();
    },

    lancarFalta(plantaoId) {
        const plantao = CBV.Store.obterPlantaoPorId(plantaoId);
        const nome = plantao ? plantao.bombeiroNome : 'o bombeiro';
        if (!confirm(`Confirmar FALTA para ${nome}?
Regra automática: 1ª Anotação, 2ª Advertência, 3ª Desligamento.`)) return;
        try {
            const msg = CBV.Store.registrarFalta(CBV.App.getUsuario(), plantaoId);
            CBV.App.toast(msg);
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    },

    biometria(plantaoId) {
        const codigo = prompt('Leitura biométrica (ex: BIO-ANA, BIO-CLT, BIO-CHEFE, BIO-ADMIN):');
        if (!codigo) return;
        const lgpd = confirm('Confirma consentimento LGPD para validação biométrica protegida por hash?');
        try {
            CBV.Store.registrarPresencaBiometria(CBV.App.getUsuario(), plantaoId, codigo, lgpd);
            CBV.App.toast('Presença biométrica confirmada com sucesso!');
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    }
};
