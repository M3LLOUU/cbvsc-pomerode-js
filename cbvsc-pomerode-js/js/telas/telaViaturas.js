// TELA 4: Gestão de Viaturas (RF14 + validação de capacitação RF02)
window.CBV = window.CBV || {};

window.CBV.TelaViaturas = {
    render(container) {
        const usuario = CBV.App.getUsuario();
        const gestor = CBV.App.ehGestor();
        const esc = CBV.App.escapeHtml;
        const podeCadastrar = ['ADMINISTRADOR', 'CHEFE_EQUIPE'].includes(usuario.perfilAcesso);
        const viaturas = CBV.Store.listarViaturas();
        const disponiveis = viaturas.filter(v => v.status === 'DISPONIVEL');
        const ativos = CBV.Store.listarBombeiros().filter(b => b.ativo);

        const cards = viaturas.map(v => {
            const badge = v.status === 'DISPONIVEL' ? 'b-verde'
                : (v.status === 'EM_OCORRENCIA' ? 'b-vermelho' : 'b-laranja');

            const botoes = gestor ? `
                <div class="btn-row" style="margin-top:10px;">
                    ${v.status !== 'DISPONIVEL'
                        ? `<button type="button" class="btn btn-sm btn-green" onclick="CBV.TelaViaturas.atualizarStatus('${v.id}', 'DISPONIVEL')">Retorno ao CBV</button>`
                        : `<button type="button" class="btn btn-sm btn-orange" onclick="CBV.TelaViaturas.atualizarStatus('${v.id}', 'MANUTENCAO')">Enviar p/ Manutenção</button>`}
                </div>
            ` : '';

            return `
                <div class="card">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <h3 style="margin:0;">${esc(v.codigo)} — ${esc(v.nome)}</h3>
                        <span class="badge ${badge}">${esc(v.status)}</span>
                    </div>
                    <p class="meta" style="margin:6px 0;">Tipo: ${esc(v.tipo)}</p>
                    ${v.status === 'EM_OCORRENCIA' ? `
                        <p style="font-size:0.88rem;"><strong>Destino:</strong> ${esc(v.destinoOcorrencia)}</p>
                        <p style="font-size:0.88rem;"><strong>Saída:</strong> ${CBV.App.formatarDataHora(v.saidaEm)}</p>
                        <p style="font-size:0.88rem;"><strong>Equipe a bordo:</strong> ${esc((v.tripulacaoNomes || []).join(', '))}</p>
                    ` : `<p class="meta">${v.status === 'MANUTENCAO' ? 'Em manutenção.' : 'Disponível no quartel CBVSC Pomerode.'}</p>`}
                    ${botoes}
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <header class="page-header">
                <div>
                    <h1>Controle de Viaturas (RF14)</h1>
                    <p>Acompanhe quais veículos estão no CBV, quais saíram e quem compõe a guarnição.</p>
                </div>
            </header>

            <div class="grid-3">${cards}</div>

            ${gestor ? `
                <div class="card">
                    <h3>Registrar Saída de Viatura</h3>
                    ${disponiveis.length === 0 ? '<p class="meta">Nenhuma viatura disponível no momento.</p>' : `
                        <form id="form-saida-viatura">
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>Viatura Disponível</label>
                                    <select id="v-select" required>
                                        ${disponiveis.map(v => `<option value="${v.id}">${esc(v.codigo)} - ${esc(v.nome)} (${esc(v.tipo)})</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Motorista Habilitado (RF02)</label>
                                    <select id="v-motorista" required>
                                        ${ativos.map(b => `<option value="${b.id}">${esc(b.nome)} [${esc(b.capacitacoes.join(', ') || 'Sem cap. motorista')}]</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Destino / Ocorrência</label>
                                    <input type="text" id="v-destino" required placeholder="Ex: Incêndio residencial — Testo Salto">
                                </div>
                                <div class="form-group">
                                    <label>Demais Integrantes na Viatura (Ctrl para selecionar vários)</label>
                                    <select id="v-tripulacao" multiple size="3">
                                        ${ativos.map(b => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <button type="submit" class="btn">Registrar Saída</button>
                        </form>
                    `}
                </div>
            ` : ''}

            ${podeCadastrar ? `
                <div class="card">
                    <h3>Cadastrar Nova Viatura</h3>
                    <form id="form-nova-viatura">
                        <div class="grid-3">
                            <div class="form-group"><label>Prefixo / Código</label><input type="text" id="nv-cod" required placeholder="Ex: AR-04"></div>
                            <div class="form-group"><label>Descrição</label><input type="text" id="nv-nome" required placeholder="Ex: Auto Resgate"></div>
                            <div class="form-group">
                                <label>Tipo (define capacitação exigida)</label>
                                <select id="nv-tipo">
                                    <option value="VIATURA">Viatura (Motorista de Viatura)</option>
                                    <option value="AMBULANCIA">Ambulância (Motorista de Ambulância)</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-blue">Adicionar Viatura</button>
                    </form>
                </div>
            ` : ''}
        `;

        const formSaida = container.querySelector('#form-saida-viatura');
        if (formSaida) {
            formSaida.addEventListener('submit', (e) => {
                e.preventDefault();
                try {
                    const tripulacaoIds = Array.from(container.querySelector('#v-tripulacao').selectedOptions).map(o => o.value);
                    CBV.Store.registrarSaidaViatura(usuario, container.querySelector('#v-select').value, {
                        motoristaId: container.querySelector('#v-motorista').value,
                        tripulacaoIds,
                        destino: container.querySelector('#v-destino').value
                    });
                    CBV.App.toast('Saída de viatura registrada!');
                } catch (ex) {
                    CBV.App.toast(ex.message, true);
                }
            });
        }

        const formNova = container.querySelector('#form-nova-viatura');
        if (formNova) {
            formNova.addEventListener('submit', (e) => {
                e.preventDefault();
                try {
                    CBV.Store.cadastrarViatura(usuario, {
                        codigo: container.querySelector('#nv-cod').value,
                        nome: container.querySelector('#nv-nome').value,
                        tipo: container.querySelector('#nv-tipo').value
                    });
                    CBV.App.toast('Viatura cadastrada na frota!');
                } catch (ex) {
                    CBV.App.toast(ex.message, true);
                }
            });
        }
    },

    atualizarStatus(id, novoStatus) {
        try {
            CBV.Store.registrarRetornoViatura(CBV.App.getUsuario(), id, novoStatus);
            CBV.App.toast(`Viatura atualizada para ${novoStatus}.`);
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    }
};
