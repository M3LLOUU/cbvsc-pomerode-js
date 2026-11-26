// TELA 5: Painel Operacional — Escala Fixa, 12x36, Limites e Faltas (RF04, RF05, RF06, RF07, RF08, RF09, RF11)
window.CBV = window.CBV || {};

window.CBV.TelaOperacional = {
    render(container) {
        const cfg = CBV.Store.obterConfiguracoes();
        const bombeiros = CBV.Store.listarBombeiros();
        const esc = CBV.App.escapeHtml;

        container.innerHTML = `
            <header class="page-header">
                <div>
                    <h1>Painel Operacional: Escalas, Limites e Faltas</h1>
                    <p>Gere escalas automáticas de 30 dias, configure alertas por turno e acompanhe faltas.</p>
                </div>
            </header>

            <div class="grid-2">
                <div class="card">
                    <h3>Geração Automática de Escalas (30 dias)</h3>
                    <p class="meta" style="margin-bottom:14px;">
                        Aplica a rotina dos voluntários fixos (RF04) e o ciclo 12x36 dos bombeiros CLT (RF05).
                    </p>
                    <div class="btn-row">
                        <button type="button" class="btn btn-blue" onclick="CBV.TelaOperacional.gerarFixa()">Gerar Escala Fixa (RF04)</button>
                        <button type="button" class="btn btn-green" onclick="CBV.TelaOperacional.gerarClt()">Gerar Escala 12x36 CLT (RF05)</button>
                    </div>
                </div>

                <div class="card">
                    <h3>Regra de Cancelamento (RF08 / RF09)</h3>
                    <div class="form-group">
                        <label>Prazo limite antes do início do turno (em horas)</label>
                        <input type="number" id="cfg-prazo" min="0" max="72" value="${cfg.sistema.prazoLimiteCancelamentoHoras}">
                    </div>
                    <div class="form-group">
                        <label>Ação após o horário limite</label>
                        <select id="cfg-bloquear">
                            <option value="false" ${!cfg.sistema.bloquearCancelamentoAposPrazo ? 'selected' : ''}>Permitir e sinalizar como FORA DO PRAZO</option>
                            <option value="true" ${cfg.sistema.bloquearCancelamentoAposPrazo ? 'selected' : ''}>Bloquear cancelamento de voluntários após o prazo</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>Limites de Cobertura por Turno (RF06 / RF07)</h3>
                <div class="grid-3">
                    ${cfg.turnos.map(t => `
                        <div class="card" style="margin:0;">
                            <h4>${esc(t.nome)} (${esc(t.periodo)})</h4>
                            <div class="form-group" style="margin-top:8px;">
                                <label>Mínimo (alerta laranja)</label>
                                <input type="number" id="min-${t.id}" min="1" value="${t.minimo}">
                            </div>
                            <div class="form-group">
                                <label>Limite recomendado (alerta roxo)</label>
                                <input type="number" id="max-${t.id}" min="1" value="${t.limiteRecomendado}">
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn" style="margin-top:14px;" onclick="CBV.TelaOperacional.salvar()">Salvar Configurações</button>
            </div>

            <div class="card">
                <h3>Quadro Disciplinar de Faltas (RF11)</h3>
                <p class="meta" style="margin-bottom:10px;">
                    Regra automática: 1ª falta = Anotação • 2ª falta = Advertência • 3ª falta = Desligamento.
                </p>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr><th>Bombeiro</th><th>Vínculo</th><th>Status</th><th>Faltas</th><th>Penalidade Atual</th></tr>
                        </thead>
                        <tbody>
                            ${bombeiros.map(b => `
                                <tr>
                                    <td>${esc(b.nome)}</td>
                                    <td>${esc(b.tipoVinculo)}</td>
                                    <td>${b.ativo ? '<span class="badge b-verde">ATIVO</span>' : '<span class="badge b-vermelho">DESLIGADO</span>'}</td>
                                    <td><strong>${b.faltas}</strong></td>
                                    <td>${esc(b.penalidadeAtual)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    salvar() {
        try {
            const turnos = [1, 2, 3].map(id => ({
                id,
                minimo: Number(document.getElementById(`min-${id}`).value),
                limiteRecomendado: Number(document.getElementById(`max-${id}`).value)
            }));
            const sistema = {
                prazoLimiteCancelamentoHoras: Number(document.getElementById('cfg-prazo').value),
                bloquearCancelamentoAposPrazo: document.getElementById('cfg-bloquear').value === 'true'
            };
            CBV.Store.atualizarConfiguracoes(CBV.App.getUsuario(), turnos, sistema);
            CBV.App.toast('Configurações de turno e cancelamento salvas!');
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    },

    gerarFixa() {
        try {
            const qtd = CBV.Store.gerarEscalaFixa(CBV.App.getUsuario());
            CBV.App.toast(`${qtd} plantão(ões) de voluntários fixos gerados para 30 dias.`);
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    },

    gerarClt() {
        try {
            const qtd = CBV.Store.gerarEscalaClt12x36(CBV.App.getUsuario());
            CBV.App.toast(`${qtd} turno(s) da escala 12x36 CLT gerados para 30 dias.`);
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    }
};
