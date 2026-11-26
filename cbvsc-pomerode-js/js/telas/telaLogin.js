// TELA 1: Login e Perfis de Acesso (RF17 / RNF05)
window.CBV = window.CBV || {};

window.CBV.TelaLogin = {
    render(container) {
        container.innerHTML = `
            <div class="login-overlay">
                <div class="login-box">
                    <h1>CBVSC Pomerode</h1>
                    <p class="sub">Sistema Integrado de Escalas, Presença e Viaturas</p>
                    <form id="form-login">
                        <div class="form-group">
                            <label for="login-user">Usuário</label>
                            <input type="text" id="login-user" required placeholder="Digite seu login">
                        </div>
                        <div class="form-group">
                            <label for="login-pass">Senha</label>
                            <input type="password" id="login-pass" required placeholder="Digite sua senha">
                        </div>
                        <p id="login-erro" style="color:var(--red); display:none; margin-bottom:10px; font-size:0.86rem;"></p>
                        <button type="submit" class="btn" style="width:100%;">Entrar no Sistema</button>
                    </form>
                    <div class="demo-hints">
                        <strong>Acessos de teste (senha <code>123</code>):</strong><br>
                        • <code>admin</code> (Administrador) | <code>chefe</code> (Chefe de Equipe)<br>
                        • <code>clt</code> (Bombeiro CLT) | <code>voluntario</code> (Voluntário Fixo) | <code>jaime</code> (Eventual)
                    </div>
                </div>
            </div>
        `;

        container.querySelector('#form-login').addEventListener('submit', (e) => {
            e.preventDefault();
            const err = container.querySelector('#login-erro');
            err.style.display = 'none';
            try {
                const usuario = CBV.Store.autenticar(
                    container.querySelector('#login-user').value,
                    container.querySelector('#login-pass').value
                );
                CBV.App.iniciarSessao(usuario);
            } catch (ex) {
                err.textContent = ex.message;
                err.style.display = 'block';
            }
        });
    }
};
