window.CBV = window.CBV || {};

(function () {
    let usuarioLogado = null;
    let telaAtual = 'escala';

    const TELAS = [
        { id: 'escala',      label: '📅 Escala em Tempo Real',      roles: ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT', 'VOLUNTARIO'], modulo: () => CBV.TelaEscala },
        { id: 'agendamento', label: '➕ Meus Plantões & Biometria', roles: ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT', 'VOLUNTARIO'], modulo: () => CBV.TelaAgendamento },
        { id: 'viaturas',    label: '🚒 Viaturas',                  roles: ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT', 'VOLUNTARIO'], modulo: () => CBV.TelaViaturas },
        { id: 'operacional', label: '⚙️ Escalas, Faltas & Limites', roles: ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT'],               modulo: () => CBV.TelaOperacional },
        { id: 'bombeiros',   label: '👤 Bombeiros & Capacitações',  roles: ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT'],               modulo: () => CBV.TelaBombeiros },
        { id: 'auditoria',   label: '🛡️ Auditoria & Backup',        roles: ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT'],               modulo: () => CBV.TelaAuditoria }
    ];

    const App = {
        getUsuario() {
            if (!usuarioLogado) return null;
            usuarioLogado = CBV.Store.obterBombeiroPorId(usuarioLogado.id) || usuarioLogado;
            return usuarioLogado;
        },

        ehGestor() {
            const u = this.getUsuario();
            return u && ['ADMINISTRADOR', 'CHEFE_EQUIPE', 'CLT'].includes(u.perfilAcesso);
        },

        escapeHtml(str) {
            return String(str == null ? '' : str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        formatarDataHora(iso) {
            return iso ? new Date(iso).toLocaleString('pt-BR') : '-';
        },

        toast(msg, erro = false) {
            const el = document.getElementById('toast');
            el.textContent = msg;
            el.style.background = erro ? '#c62828' : '#2e7d32';
            el.style.display = 'block';
            clearTimeout(el._t);
            el._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
        },

        toggleMenu() {
            document.getElementById('sidebar').classList.toggle('open');
        },

        iniciarSessao(usuario) {
            usuarioLogado = usuario;
            document.getElementById('login-root').innerHTML = '';
            document.getElementById('app-container').style.display = 'flex';
            this.atualizarSidebar();
            this.navegar('escala');
        },

        logout() {
            usuarioLogado = null;
            document.getElementById('app-container').style.display = 'none';
            CBV.TelaLogin.render(document.getElementById('login-root'));
        },

        atualizarSidebar() {
            const u = this.getUsuario();
            if (!u) return;

            document.getElementById('info-nome').textContent = u.nome;
            document.getElementById('info-perfil').textContent = `${u.perfilAcesso} • ${u.tipoVinculo}`;
            document.getElementById('info-faltas').textContent = `Faltas: ${u.faltas} (${u.penalidadeAtual})`;

            const menu = document.getElementById('menu-list');
            menu.innerHTML = TELAS
                .filter(t => t.roles.includes(u.perfilAcesso))
                .map(t => `<li class="${t.id === telaAtual ? 'active' : ''}" onclick="CBV.App.navegar('${t.id}')">${t.label}</li>`)
                .join('');
        },

        navegar(id) {
            const u = this.getUsuario();
            if (!u) return;
            const cfg = TELAS.find(t => t.id === id && t.roles.includes(u.perfilAcesso));
            if (!cfg) return;

            telaAtual = id;
            document.getElementById('sidebar').classList.remove('open');
            this.atualizarSidebar();
            cfg.modulo().render(document.getElementById('screen-root'));
        },

        reRenderAtual() {
            if (!usuarioLogado) return;
            this.atualizarSidebar();
            const cfg = TELAS.find(t => t.id === telaAtual);
            if (cfg) cfg.modulo().render(document.getElementById('screen-root'));
        }
    };

    window.CBV.App = App;

    // Atualiza tela automaticamente quando outra aba ou ação alterar o banco (RNF04)
    CBV.Store.onChange(() => App.reRenderAtual());

    document.addEventListener('DOMContentLoaded', () => {
        CBV.TelaLogin.render(document.getElementById('login-root'));
    });
})();
