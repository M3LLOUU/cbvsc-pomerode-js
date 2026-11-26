// TELA 3: Meus Plantões, Cancelamento e Biometria (RF03, RF08, RF09, RF10, RF13, RNF06)
window.CBV = window.CBV || {};

window.CBV.TelaAgendamento = {
    NOMES_TURNO: { 1: 'Manhã (06h - 12h)', 2: 'Tarde (12h - 18h)', 3: 'Noite (18h - 06h)' },

    render(container) {
        const usuario = CBV.App.getUsuario();
        const gestor = CBV.App.ehGestor();
        const esc = CBV.App.escapeHtml;
        const meus = CBV.Store.listarPlantoesDoUsuario(usuario.id);
        const ativos = CBV.Store.listarBombeiros().filter(b => b.ativo);

        const linhas = meus.length === 0
            ? '<tr><td colspan="6" class="meta">Nenhum plantão registrado na janela ativa de 30 dias.</td></tr>'
            : meus.map(p => `
                <tr>
                    <td>${esc(p.data)}</td>
                    <td>${esc(this.NOMES_TURNO[p.turnoId] || p.turnoId)}</td>
                    <td>${esc(p.origem)}</td>
                    <td>${CBV.App.formatarDataHora(p.registradoEm)}</td>
                    <td><strong>${esc(p.status)}</strong></td>
                    <td>
                        ${p.status === 'AGENDADO' ? `
                            <div class="btn-row">
                                <button type="button" class="btn btn-sm btn-green" onclick="CBV.TelaAgendamento.biometria('${p.id}')">Biometria</button>
                                <button type="button" class="btn btn-sm btn-gray" onclick="CBV.TelaAgendamento.cancelar('${p.id}')">Cancelar</button>
                            </div>
                        ` : '-'}
                    </td>
                </tr>
            `).join('');

        container.innerHTML = `
            <header class="page-header">
                <div>
                    <h1>Meus Plantões & Presença Biométrica</h1>
                    <p>Escolha data e turno para escalar, cancele dentro do prazo ou confirme presença via biometria.</p>
                </div>
            </header>

            <div class="card">
                <h3>Agendar Plantão (RF03 / RF13)</h3>
                <form id="form-agendar">
                    <div class="grid-3">
                        <div class="form-group">
                            <label>Data (janela ativa de 30 dias)</label>
                            <input type="date" id="ag-data" required value="${CBV.Store.hojeISO(0)}">
                        </div>
                        <div class="form-group">
                            <label>Turno</label>
                            <select id="ag-turno" required>
                                <option value="1">Manhã (06h - 12h)</option>
                                <option value="2">Tarde (12h - 18h)</option>
                                <option value="3">Noite (18h - 06h)</option>
                            </select>
                        </div>
                        ${gestor ? `
                            <div class="form-group">
                                <label>Escalar Bombeiro (Opcional — Gestão)</label>
                                <select id="ag-bombeiro">
                                    <option value="">-- Para mim (${esc(usuario.nome)}) --</option>
                                    ${ativos.map(b => `<option value="${b.id}">${esc(b.nome)} (${esc(b.tipoVinculo)})</option>`).join('')}
                                </select>
                            </div>
                        ` : ''}
                    </div>
                    <button type="submit" class="btn">Confirmar Agendamento</button>
                </form>
            </div>

            <div class="card">
                <h3>Meus Plantões (Janela Ativa de 30 Dias)</h3>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr><th>Data</th><th>Turno</th><th>Origem</th><th>Registrado em</th><th>Status</th><th>Ações</th></tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
            </div>
        `;

        container.querySelector('#form-agendar').addEventListener('submit', (e) => {
            e.preventDefault();
            try {
                const bombeiroEl = container.querySelector('#ag-bombeiro');
                CBV.Store.agendarPlantao(usuario, {
                    bombeiroId: bombeiroEl ? (bombeiroEl.value || null) : null,
                    data: container.querySelector('#ag-data').value,
                    turnoId: Number(container.querySelector('#ag-turno').value)
                });
                CBV.App.toast('Plantão agendado com sucesso!');
            } catch (ex) {
                CBV.App.toast(ex.message, true);
            }
        });
    },

    cancelar(plantaoId) {
        if (!confirm('Deseja cancelar sua presença neste plantão?')) return;
        try {
            const res = CBV.Store.cancelarPlantao(CBV.App.getUsuario(), plantaoId);
            CBV.App.toast(res.mensagem, res.foraDoPrazo);
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    },

    biometria(plantaoId) {
        const codigo = prompt('Passe a digital no terminal (ex: BIO-ANA, BIO-CLT, BIO-CHEFE, BIO-ADMIN):');
        if (!codigo) return;
        const lgpd = confirm('Autoriza o tratamento do dado biométrico (hash protegido) conforme LGPD?');
        try {
            CBV.Store.registrarPresencaBiometria(CBV.App.getUsuario(), plantaoId, codigo, lgpd);
            CBV.App.toast('Presença biométrica registrada com sucesso!');
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    }
};
