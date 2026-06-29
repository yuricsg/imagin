# Prompt Para Claude: Design Do Dashboard Multi-Chatbot

Voce vai trabalhar no design do projeto Imagin, uma plataforma para administrar chatbots de captacao de leads que podem ser embutidos em sites de clientes via script + iframe.

## Contexto Do Produto

O dashboard nao e dedicado a um unico chatbot. Ele precisa administrar varios chatbots, varios clientes e os leads recebidos por cada bot. No momento existe apenas o bot `dra-renata-reis`, mas a arquitetura ja foi preparada para novos bots.

Fluxo atual:

- O site do cliente instala `dashboard/public/embed/widget.js`.
- O script recebe `data-bot-id`, `data-client-id` e `data-api-base-url`.
- O script busca a configuracao publica do bot no backend.
- O script abre um iframe em `/chatbots/[botId]/embed`.
- O iframe coleta dados do lead e envia para o backend Hono.
- A dashboard em `/` lista chatbots e leads.

## Estado Atual Do Codigo

- Dashboard Next.js: `dashboard/`
- Backend Hono: `backend/`
- Catalogo de bots: `backend/src/chatbots/catalog.ts`
- Definicao do bot atual: `backend/src/chatbots/renata-reis.ts`
- Dashboard atual: `dashboard/app/_components/dashboard-home.tsx`
- Iframe do bot: `dashboard/app/chatbots/[botId]/embed/embedded-chatbot.tsx`
- Loader embutivel: `dashboard/public/embed/widget.js`
- Arquitetura documentada: `ARCHITECTURE.md`

## Objetivo Do Seu Trabalho

Melhorar o design e a experiencia do dashboard multi-chatbot, sem transformar a tela em landing page e sem acoplar o produto ao bot da Dra. Renata Reis.

Prioridades:

1. Criar uma interface operacional clara para monitorar varios chatbots.
2. Melhorar hierarquia visual de metricas, lista de chatbots e tabela de leads.
3. Melhorar estados vazio, carregando e erro.
4. Melhorar o bloco de embed do bot selecionado.
5. Manter a tela densa, profissional e facil de escanear.

## Regras Importantes

- Nao tratar `dra-renata-reis` como dashboard inteiro; ele e apenas um item do catalogo.
- Evitar hero/landing page. A primeira tela deve ser a ferramenta operacional.
- Evitar UI decorativa demais. Isto e um produto operacional para agencia/clientes.
- Manter componentes responsivos.
- Nao quebrar os contratos de API atuais.
- Se alterar comportamento, atualizar testes e documentacao.
- Rodar validacao antes de finalizar:

```bash
cd dashboard && npm run lint && npm run build
cd backend && npm run test && npm run build
```

## Observacoes De Design

O dashboard precisa se preparar para:

- muitos bots;
- muitos clientes;
- filtros por bot, cliente, status e periodo;
- lead detail no futuro;
- bot detail/config no futuro;
- embed snippets por bot;
- status operacional de cada bot.

Comece pelo dashboard. O iframe do chatbot pode ser refinado depois, mas nao deve ser o foco principal agora.
