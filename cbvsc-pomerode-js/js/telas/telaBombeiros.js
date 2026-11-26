// TELA 6: Cadastro de Bombeiros, Capacitações e NRs (RF01, RF02, RF04, RF05, RF17, RNF06)
window.CBV = window.CBV || {};

window.CBV.TelaBombeiros = {
    render(container) {
        const usuario = CBV.App.getUsuario();
        const ehAdmin = usuario.perfilAcesso === 'ADMINISTRADOR';
        const lista = CBV.Store.listarBombeiros();
        const esc = CBV.App.escapeHtml;

        container.innerHTML = `
            <header class="page-header">
                <div>
                    <h1>Bombeiros, Capacitações e NRs (RF01 / RF02)</h1>
                    <p>Cadastro completo do efetivo com habilitações de direção, NRs de CLTs e consentimento LGPD.</p>
                </div>
            </header>

            ${ehAdmin ? `
                <div class="card">
                    <h3>Cadastrar Novo Bombeiro</h3>
                    <form id="form-bombeiro">
                        <div class="grid-3">
                            <div class="form-group"><label>Nome Completo *</label><input type="text" id="b-nome" required></div>
                            <div class="form-group"><label>Contato / Telefone *</label><input type="text" id="b-tel" required placeholder="(47) 99999-0000"></div>
                            <div class="form-group"><label>Login *</label><input type="text" id="b-login" required></div>
                            <div class="form-group"><label>Senha *</label><input type="password" id="b-senha" required></div>
                            <div class="form-group">
                                <label>Vínculo (RF01)</label>
                                <select id="b-vinculo">
                                    <option value="VOLUNTARIO_EVENTUAL">Voluntário Eventual</option>
                                    <option value="VOLUNTARIO_FIXO">Voluntário Fixo</option>
                                    <option value="CLT">Contratado (CLT 12x36)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Perfil de Acesso (RF17)</label>
                                <select id="b-perfil">
                                    <option value="VOLUNTARIO">Voluntário</option>
                                    <option value="CLT">CLT</option>
                                    <option value="CHEFE_EQUIPE">Chefe de Equipe</option>
                                    <option value="ADMINISTRADOR">Administrador</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid-2">
                            <div class="form-group">
                                <label>Capacitações Especiais (RF02)</label>
                                <div class="check-group">
                                    <label><input type="checkbox" name="cap" value="MOTORISTA_VIATURA"> Motorista de Viatura</label>
                                    <label><input type="checkbox" name="cap" value="MOTORISTA_AMBULANCIA"> Motorista de Ambulância</label>
                                </div>
                            </div>
                            <div class="form-group" id="box-nrs" style="display:none;">
                                <label>NRs do Bombeiro CLT (RF02)</label>
                                <div class="check-group">
                                    <label><input type="checkbox" name="nr" value="NR-20"> NR-20</label>
                                    <label><input type="checkbox" name="nr" value="NR-33"> NR-33</label>
                                    <label><input type="checkbox" name="nr" value="NR-35"> NR-35</label>
                                </div>
                            </div>
                        </div>

                        <div class="grid-2" id="box-fixo" style="display:none;">
                            <div class="form-group">
                                <label>Dias Fixos da Semana (RF04)</label>
                                <div class="check-group">
                                    <label><input type="checkbox" name="diaFixo" value="1"> Seg</label>
                                    <label><input type="checkbox" name="diaFixo" value="2"> Ter</label>
                                    <label><input type="checkbox" name="diaFixo" value="3"> Qua</label>
                                    <label><input type="checkbox" name="diaFixo" value="4"> Qui</label>
                                    <label><input type="checkbox" name="diaFixo" value="5"> Sex</label>
                                    <label><input type="checkbox" name="diaFixo" value="6"> Sáb</label>
                                    <label><input type="checkbox" name="diaFixo" value="7"> Dom</label>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Turno Fixo</label>
                                <select id="b-turno-fixo">
                                    <option value="1">Manhã (06h - 12h)</option>
                                    <option value="2">Tarde (12h - 18h)</option>
                                    <option value="3">Noite (18h - 06h)</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid-2" id="box-clt" style="display:none;">
                            <div class="form-group">
                                <label>Data de Início da Escala 12x36 (RF05)</label>
                                <input type="date" id="b-inicio-clt" value="${CBV.Store.hojeISO(0)}">
                            </div>
                            <div class="form-group">
                                <label>Período 12x36</label>
                                <select id="b-turno-clt">
                                    <option value="1">Diurno (06h - 18h)</option>
                                    <option value="3">Noturno (18h - 06h)</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid-2" style="background:#f8f9fa; padding:12px; border-radius:8px; margin-bottom:12px;">
                            <div class="form-group" style="margin:0;">
                                <label><input type="checkbox" id="b-lgpd" style="width:auto;"> Consentimento LGPD para biometria (RNF06)</label>
                            </div>
                            <div class="form-group" style="margin:0;">
                                <input type="text" id="b-bio" placeholder="Código biométrico (salvo apenas como hash)">
                            </div>
                        </div>

                        <button type="submit" class="btn">Cadastrar Bombeiro</button>
                    </form>
                </div>
            ` : ''}

            <div class="card">
                <h3>Efetivo Cadastrado (${lista.length} bombeiros)</h3>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr><th>Nome</th><th>Contato</th><th>Vínculo</th><th>Perfil</th><th>Capacitações / NRs</th><th>LGPD</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            ${lista.map(b => `
                                <tr>
                                    <td><strong>${esc(b.nome)}</strong><div class="meta">login: ${esc(b.login)}</div></td>
                                    <td>${esc(b.telefone || '-')}</td>
                                    <td>${esc(b.tipoVinculo)}</td>
                                    <td>${esc(b.perfilAcesso)}</td>
                                    <td>
                                        ${esc(b.capacitacoes.join(', ') || '-')}
                                        ${b.nrsClt.length ? `<div class="meta">NRs: ${esc(b.nrsClt.join(', '))}</div>` : ''}
                                    </td>
                                    <td>${b.consentimentoLgpd ? '✅ Aceito' : '⚠️ Pendente'}</td>
                                    <td>${b.ativo ? '<span class="badge b-verde">ATIVO</span>' : '<span class="badge b-vermelho">DESLIGADO</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        if (ehAdmin) {
            const selVinculo = container.querySelector('#b-vinculo');
            const atualizarCampos = () => {
                const v = selVinculo.value;
                container.querySelector('#box-fixo').style.display = v === 'VOLUNTARIO_FIXO' ? 'grid' : 'none';
                container.querySelector('#box-clt').style.display = v === 'CLT' ? 'grid' : 'none';
                container.querySelector('#box-nrs').style.display = v === 'CLT' ? 'block' : 'none';
            };
            selVinculo.addEventListener('change', atualizarCampos);

            container.querySelector('#form-bombeiro').addEventListener('submit', (e) => {
                e.preventDefault();
                try {
                    const capacitacoes = Array.from(container.querySelectorAll('input[name="cap"]:checked')).map(c => c.value);
                    const nrsClt = Array.from(container.querySelectorAll('input[name="nr"]:checked')).map(c => c.value);
                    const diasSemanaFixos = Array.from(container.querySelectorAll('input[name="diaFixo"]:checked')).map(c => Number(c.value));

                    CBV.Store.cadastrarBombeiro(usuario, {
                        nome: container.querySelector('#b-nome').value,
                        telefone: container.querySelector('#b-tel').value,
                        login: container.querySelector('#b-login').value,
                        senha: container.querySelector('#b-senha').value,
                        tipoVinculo: selVinculo.value,
                        perfilAcesso: container.querySelector('#b-perfil').value,
                        capacitacoes,
                        nrsClt,
                        diasSemanaFixos,
                        turnoFixoId: container.querySelector('#b-turno-fixo').value,
                        dataInicioEscalaClt: container.querySelector('#b-inicio-clt').value,
                        turnoBaseCltId: container.querySelector('#b-turno-clt').value,
                        consentimentoLgpd: container.querySelector('#b-lgpd').checked,
                        codigoBiometrico: container.querySelector('#b-bio').value
                    });
                    CBV.App.toast('Bombeiro cadastrado com sucesso!');
                } catch (ex) {
                    CBV.App.toast(ex.message, true);
                }
            });
        }
    }
};
