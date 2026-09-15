# Arquitetura de Notificações Push - GoPlay

Este documento descreve a implementação completa do sistema de notificações em tempo real para o aplicativo GoPlay, utilizando **Firebase Cloud Messaging (FCM)** e **Supabase Edge Functions**.

---

## 1. Fluxo de Funcionamento
1.  **Captura do Token**: O App Android (nativo) gera um `FCM Token` único para o dispositivo.
2.  **Sincronização**: Através de uma ponte JavaScript (`JavascriptInterface`), o Android envia o token para o site (Vercel).
3.  **Persistência**: O site salva o token na coluna `fcm_token` da tabela `usuarios` no Supabase.
4.  **Gatilho (Webhook)**: Quando um novo registro é inserido em `eventos`, `amizades` ou `mensagens`, o banco de dados dispara um Webhook.
5.  **Processamento (Edge Function)**: Uma função Deno no Supabase recebe o dado, identifica os destinatários (todos para eventos públicos ou membros do grupo para privados) e solicita o disparo ao Firebase.

---

## 2. Componentes Envolvidos

### A. Aplicativo Android (C:\Users\alanb\AndroidStudioProjects\GoPlay)
-   **`GoPlayMessagingService.kt`**: Serviço que estende `FirebaseMessagingService` para receber as mensagens em segundo plano e montar a notificação visual no Android.
-   **`MainActivity.kt`**: Contém a `AndroidInterface` que expõe o método `getFCMToken()` para o site.
-   **`google-services.json`**: Arquivo de configuração que vincula o app ao projeto Firebase `com-example-goplay-2d054`.
-   **Permissões**: `INTERNET` e `POST_NOTIFICATIONS` (Android 13+).

### B. Projeto Web (C:\Users\alanb\Projetos\GoPlay)
-   **`App.tsx`**: Contém o listener `handleFCMToken` que recebe o token do Android e faz o `update` na tabela `usuarios`.
-   **`Login.tsx`**: Integrado com o login nativo para garantir que o usuário esteja autenticado antes de vincular o token.

### C. Backend (Supabase)
-   **Tabela `usuarios`**: Adicionada coluna `fcm_token (TEXT)`.
-   **Edge Function `send-notification`**: Código em TypeScript/Deno que utiliza as credenciais do Firebase (Service Account) para disparar as mensagens.
    -   **Lógica de Eventos**: Busca o nome da modalidade na tabela `modalidades` via `modalidade_id`.
    -   **Privacidade**: Filtra destinatários por `grupo_id` em eventos privados.
-   **Database Webhooks**: Gatilhos configurados nas tabelas `eventos` e `amizades` apontando para a URL da Edge Function.

---

## 3. Configurações de Segurança
-   **Verify JWT**: Desativado na Edge Function para permitir chamadas automáticas via Webhook do banco de dados.
-   **SHA-1**: Certificado de debug do computador de desenvolvimento cadastrado no Google Cloud Console/Firebase para autorizar o Login Nativo e o FCM.
-   **Service Account**: JSON do Firebase configurado internamente na função para autenticação administrativa.

---

## 4. Tabelas Criadas (database_schema.sql)
-   `grupos`: Armazena os grupos de esportes.
-   `grupo_membros`: Relaciona usuários aos grupos (essencial para notificações privadas).
-   `eventos`: Contém `tipo` (publico/privado) e `modalidade_id`.
-   `amizades`: Gerencia as conexões e solicitações pendentes.
-   `notificacoes_log`: Tabela de histórico para consulta dentro do app.

---
**Status Atual**: Infraestrutura de conexão App <-> Banco 100% operacional. Tokens sendo salvos e Webhooks configurados para disparo.
