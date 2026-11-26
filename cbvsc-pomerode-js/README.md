# CBVSC Pomerode — Sistema em JavaScript (Telas Separadas)

Projeto reestruturado em **JavaScript modular**, com cada tela em seu próprio arquivo dentro de `js/telas/`, atendendo integralmente aos requisitos funcionais (`RF01` a `RF17`) e não funcionais (`RNF01` a `RNF10`).

## Como rodar e testar agora no VS Code (sem precisar do banco ainda)

1. Extraia o arquivo `cbvsc-pomerode-js.zip` e abra a pasta `cbvsc-pomerode-js` no **VS Code**.
2. Clique com o botão direito em `index.html` e selecione **Open with Live Server** (extensão Live Server do VS Code), ou abra `index.html` diretamente no navegador.
3. Faça login com qualquer um dos usuários de teste (senha padrão: **`123`**):
   - `admin` — Administrador (acesso total + cadastro de bombeiros + backup/retenção)
   - `chefe` — Chefe de Equipe (escala, faltas, viaturas, auditoria)
   - `clt` — Bombeiro CLT (escala, faltas, viaturas, operacional)
   - `voluntario` — Voluntário Fixo (`Ana Luisa`, código biométrico: `BIO-ANA`)
   - `jaime` — Voluntário Eventual (LGPD pendente para testar primeiro consentimento biométrico)

## Estrutura de Telas Separadas

- `js/telas/telaLogin.js` — Login e controle de perfis (RF17 / RNF05)
- `js/telas/telaEscala.js` — Escala em tempo real, alertas laranja/roxo e faltas (RF07, RF11, RF12, RF13, RF15)
- `js/telas/telaAgendamento.js` — Agendamento, cancelamento com prazo limite e biometria + LGPD (RF03, RF08, RF09, RF10, RNF06)
- `js/telas/telaViaturas.js` — Viaturas disponíveis/em ocorrência, motorista habilitado e guarnição (RF02, RF14)
- `js/telas/telaOperacional.js` — Escala fixa, escala 12x36 CLT, limites por turno e quadro de faltas (RF04, RF05, RF06, RF08, RF09, RF11)
- `js/telas/telaBombeiros.js` — Cadastro de voluntários fixos/eventuais/CLTs, capacitações e NRs (RF01, RF02, RF17)
- `js/telas/telaAuditoria.js` — Trilha de auditoria, retenção de 30 dias e backup/restauração JSON (RF16, RNF07, RNF08, RNF09)

## Conexão futura com o Banco de Dados MySQL

- O arquivo `database/schema.sql` já contém todas as tabelas para o banco `bombeiros` no MySQL.
- O arquivo `database/db.example.js` traz a configuração pronta de conexão via `mysql2` em Node.js.
- Toda a persistência do frontend está isolada em `js/store.js` (e sinalizada em `js/config.js`), facilitando substituir as chamadas de `localStorage` por `fetch()` para sua API sem precisar alterar o código das telas.
