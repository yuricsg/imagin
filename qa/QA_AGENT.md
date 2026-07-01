# Imagin QA Agent

## Objetivo

O agente QA valida se a plataforma Imagin esta pronta para operar chatbots embutidos em sites de clientes. Ele deve testar API, dashboard, embed, captura de origem, criacao de chatbots, fluxos de conversa e exposicao segura de credenciais.

## Padrao De Qualidade

Um build so deve ser considerado pronto quando:

- API `/health` responde 200.
- Dashboard carrega HTML util e nao exibe tela vazia.
- Embed `/chatbots/[botId]/embed` carrega HTML util.
- Config publica do bot responde 200.
- Config publica nunca expoe `accessToken`, `apiSecret`, `metaAccessToken`, `gaApiSecret` ou valores semelhantes.
- Cada bot publico informa `flowKey`, `conversationFlow` e `integrationStatus`.
- O fluxo escolhido limita as opcoes visiveis no chatbot.
- A API rejeita leads com intent desabilitada pelo fluxo do bot.
- Leads criados preservam `botId`, `clientId`, campos estruturados e origem (`utm`, click IDs, cookies quando enviados).
- O dashboard lista leads por todos os bots e permite filtrar por bot.
- Campos de integracao explicam onde encontrar cada chave e deixam claro que segredos ficam no backend.
- Alteracoes de banco possuem migration e teste contra banco real antes de release.

## Comandos Recomendados

Rodada local obrigatoria:

```bash
cd backend && npm run test && npm run build
cd ../dashboard && npm run lint && npm run build
```

Smoke read-only contra producao:

```bash
node qa/qa-agent.mjs \
  --dashboard-url=https://imagin-virid.vercel.app \
  --api-url=https://imagin-v587.onrender.com \
  --bot-id=dra-renata-reis
```

Smoke com escrita deve ser usado apenas em ambiente local, staging ou producao com autorizacao explicita:

```bash
QA_ALLOW_WRITES=true node qa/qa-agent.mjs \
  --dashboard-url=http://localhost:3002 \
  --api-url=http://localhost:4000 \
  --bot-id=dra-renata-reis
```

## Fluxos Criticos

- Fluxo completo: nome, escolha entre exame, consulta e urgencia, lead salvo, WhatsApp gerado.
- Fluxo de exames: multi-select de exames, solicitacao medica, lead salvo.
- Fluxo de consulta: necessidade, decisao, lead salvo.
- Fluxo urgente: sintomas graves, lead salvo sem perguntas adicionais.
- Criacao de chatbot: fluxo selecionado, listas salvas, chaves Meta/GA4 salvas server-side e ocultas na config publica.
- Atribuicao: `utm_source`, `utm_medium`, `utm_campaign`, `fbclid`, `gclid`, `_fbp`, `_fbc` e `_ga` chegam ao lead quando presentes.

## Regras Do Agente

- Nao use dados reais de pacientes em testes.
- Nao cole segredos em logs, screenshots ou docs.
- Em producao, prefira verificacoes read-only. Quando escrita for necessaria, use IDs com prefixo `qa-` e limpe os registros diretamente no banco depois.
- Falha de audit transitive conhecida deve ser registrada, nao mascarada.
- Se qualquer check critico falhar, a entrega nao esta pronta.
