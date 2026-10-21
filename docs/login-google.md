# Login com Google e Meu perfil

## Como funciona

- O botão **Continuar com Google** aparece em *Entrar* e em *Criar conta*, **só se** o Google estiver ligado no Supabase
  (o site pergunta a `/auth/v1/settings`). Antes da configuração, nada aparece quebrado.
- A plataforma continua fechada: quem entra pelo Google sem turma vê apenas o campo para digitar o código.
- No cadastro, o botão só libera depois de um código de turma válido; ao voltar do Google a pessoa cai em `/convite/CÓDIGO`,
  que registra o pedido de entrada para a professora aprovar.
- A migração `0017` faz o nome vir do Google (`full_name`/`name`) quando não há o campo `nome`.

## Meu perfil (`/perfil`)

Nome editável, e-mail só para leitura, foto (a do Google, ou as iniciais), troca de senha (só para quem tem senha) e atalho
para as notificações. Acesso pelo cartão da pessoa no menu lateral.

## Configuração (uma vez)

1. Google Cloud Console → **APIs e serviços → Credenciais → Criar ID do cliente OAuth** (tipo *Aplicativo da Web*).
2. Em *URIs de redirecionamento autorizados*, coloque: `https://<seu-projeto>.supabase.co/auth/v1/callback`.
3. Tela de consentimento: nome do app, e-mail de suporte, escopos padrão (e-mail, perfil).
4. Supabase → **Authentication → Providers → Google**: ligue e cole o *Client ID* e o *Client secret* **só ali** (nunca no código).
5. Supabase → **Authentication → URL Configuration**: confira o *Site URL* e adicione o endereço do site e `http://localhost:5173/**` em *Redirect URLs*.
6. Rode a migração `0017` no SQL Editor.
