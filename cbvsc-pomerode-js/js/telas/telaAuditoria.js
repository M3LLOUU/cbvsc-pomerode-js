// TELA 7: Auditoria, Retenção 30 Dias e Backup (RF16, RNF07, RNF08, RNF09)
window.CBV = window.CBV || {};

window.CBV.TelaAuditoria = {
    render(container) {
        const usuario = CBV.App.getUsuario();
        const ehAdmin = usuario.perfilAcesso === 'ADMINISTRADOR';
        const logs = CBV.Store.listarAuditoria(usuario);
        const esc = CBV.App.escapeHtml;

        container.innerHTML = `
            <header class="page-header">
                <div>
                    <h1>Auditoria, Retenção (30 dias) e Backup</h1>
                    <p>Registro completo de alterações, cancelamentos, faltas e exportação/restauração de dados.</p>
                </div>
                ${ehAdmin ? `
                    <div class="btn-row">
                        <button type="button" class="btn btn-orange" onclick="CBV.TelaAuditoria.retencao()">Limpar &gt; 30 dias (RF16)</button>
                        <button type="button" class="btn btn-green" onclick="CBV.TelaAuditoria.baixarBackup()">Exportar Backup JSON (RNF08)</button>
                        <label class="btn btn-blue" style="cursor:pointer;">
                            Restaurar Backup
                            <input type="file" id="input-restore" accept=".json" style="display:none;">
                        </label>
                        <button type="button" class="btn btn-gray" onclick="CBV.TelaAuditoria.resetarDemo()">Resetar Demo</button>
                    </div>
                ` : ''}
            </header>

            <div class="card">
                <h3>Trilha de Auditoria (RNF09)</h3>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr><th>Data/Hora</th><th>Usuário</th><th>Perfil</th><th>Ação</th><th>Detalhes</th></tr>
                        </thead>
                        <tbody>
                            ${logs.map(l => `
                                <tr>
                                    <td>${CBV.App.formatarDataHora(l.dataHora)}</td>
                                    <td>${esc(l.usuario)}</td>
                                    <td>${esc(l.perfil)}</td>
                                    <td><strong>${esc(l.acao)}</strong></td>
                                    <td>${esc(l.detalhes)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const inputRestore = container.querySelector('#input-restore');
        if (inputRestore) {
            inputRestore.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        CBV.Store.restaurarBackup(usuario, JSON.parse(reader.result));
                        CBV.App.toast('Backup restaurado com sucesso!');
                    } catch (ex) {
                        CBV.App.toast(ex.message, true);
                    }
                };
                reader.readAsText(file);
            });
        }
    },

    retencao() {
        try {
            const qtd = CBV.Store.aplicarRetencao30Dias(CBV.App.getUsuario());
            CBV.App.toast(`Retenção executada: ${qtd} registro(s) com mais de 30 dias removidos.`);
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    },

    baixarBackup() {
        try {
            const dados = CBV.Store.exportarBackup(CBV.App.getUsuario());
            const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-cbvsc-pomerode-${CBV.Store.hojeISO(0)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            CBV.App.toast('Backup JSON exportado!');
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    },

    resetarDemo() {
        if (!confirm('Restaurar os dados iniciais de demonstração?')) return;
        try {
            CBV.Store.resetarDadosDemo(CBV.App.getUsuario());
            CBV.App.toast('Dados de demonstração restaurados!');
        } catch (ex) {
            CBV.App.toast(ex.message, true);
        }
    }
};
