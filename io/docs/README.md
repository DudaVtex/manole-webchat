# Assistente Manole (WebChat)

Painel de WebChat da Weni com a marca Manole, como pixel app VTEX IO. Ele
aparece em todas as páginas da loja pelo slot `pixels > pixel`.

## O que faz

- Ícone da Manole no canto inferior direito, na mesma posição do widget atual
  (acima do botão de WhatsApp). Ao clicar, abre o painel lateral.
- Abre o próprio socket em `wss://websocket.weni.ai/ws` com o canal configurado.
- Produtos do agente em carrossel. Se o agente responder com links de produto em
  texto, o painel busca os produtos no catálogo da loja e monta o carrossel.
- Mensagens rápidas acima do ícone **só nas páginas de produto** (`/<produto>/p`),
  geradas pela Weni para aquele produto (`get_pdp_starters`). Home, PLP e as
  demais páginas não mostram mensagens rápidas.
- Envia a sessão VTEX para o contato (`vtex_account`, `segment`, `orderform`,
  `session`), como o widget oficial.
- O botão do card adiciona ao carrinho VTEX da loja.

## Configuração (Admin > Apps > Assistente Manole)

| Campo | Padrão |
|---|---|
| UUID do canal WebChat | `7d8b4ce9-ebf0-4532-a723-f18db53ec6b6` |
| Título do painel | Assistente Manole |
| Subtítulo do painel | Livros, e-books e cursos para a sua área |
| Desativar o painel | não |

O UUID é o `channelUuid` de dentro do `script.js` do canal, não o id que aparece
no caminho `apptypes/wwc/<id>/script.js`. Com o id errado o painel fica em
"Conectando"/"Offline".

## Canal novo x canal antigo

Em todos os workspaces, inclusive o master, o canal novo tem prioridade. O app
espera o widget antigo (`manole.pixel-app-wenichat`) montar em `#wwc` e chama
`window.WebChat.destroy()` (weni-ai/webchat-react v3), que desmonta o widget e
fecha o socket dele. Se o widget remontar, ele é destruído de novo. Para voltar
ao widget antigo sem desinstalar, marque "Desativar o painel" nas configurações
do app.

O slot `pixels` da VTEX só carrega o módulo do pixel, sem renderizar o
componente React. Por isso `react/index.tsx` monta o painel na própria raiz
(`#webchat-assistant-host`) assim que o módulo carrega.

A regra está em `react/legacyWidget.ts`.

## Antes de instalar em produção

Desinstale ou desative o widget atual (`manole.pixel-app-wenichat`). O painel
esconde o `#wwc`, mas o widget antigo ainda conecta o próprio socket nas
páginas de produto, e dois sockets do mesmo visitante se derrubam.

## Desenvolvimento

O código do painel fica em `../manole-webchat-demo/src/webchat` (o mesmo da
demo na Vercel). Antes de linkar ou publicar:

```sh
./scripts/sync-from-demo.sh
vtex use <workspace>
vtex link
```
