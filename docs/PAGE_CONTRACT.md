# Page Contract (Projeto CV)

Este documento define o contrato obrigatório de uma página do site.

## 1) Interface obrigatória

Cada página **tem de exportar**:

### `pageMeta` (obrigatório)
Campos mínimos:
- `id` (string) — identificador único e estável da página.
- `title` (string) — título lógico da página (não necessariamente o título do site).

Exemplo:
```js
export const pageMeta = {
  id: 'overview',
  title: 'Identidade'
};
```

### `renderPage(context)` (obrigatório)
Assinatura:
```js
export function renderPage(context) { ... }
```

## 2) `context` — o que a página recebe

O core/orquestrador fornece **tudo** via `context`.  
A página **não** busca dados por conta própria.

Campos esperados (mínimo):
- `data` — dados da página (já resolvidos e normalizados pelo core).
- `container` — elemento DOM onde a página deve renderizar.
- `sectionId` — id da página (pode ser igual a `pageMeta.id`).
- `lang` — idioma atual (string).
- `ui` — labels/strings de UI já resolvidas (se aplicável).
- `assets` — paths resolvidos (ex.: fotos/downloads).
- `helpers` — funções utilitárias injetadas pelo core (ex.: formatadores, renderers).

## 3) O que a página PODE fazer
- Renderizar **apenas** dentro de `context.container`.
- Invocar componentes/blocos recebidos por argumento.
- Usar `context.data` para gerar a UI.
- Usar `context.helpers` para tarefas neutras (formatar, mapear, renderizar blocos).

## 4) O que a página NÃO PODE fazer
- **Não** ler configuração global (`config.json`, `constants`, etc.).
- **Não** aceder diretamente a `cv.json` nem a dados globais.
- **Não** decidir regras transversais (ex.: CTA global, layout, snap, tema).
- **Não** executar side effects globais (storage, navegação, listeners globais).
- **Não** modificar o DOM fora de `context.container`.

## 5) Imports proibidos (diretos)
Uma página **nunca deve importar diretamente**:
- `data/config.json` ou `data/cv.json`
- `js/constants.js` (ou qualquer “global constants”)
- `js/cv-render.js` (ou renderers globais)
- `validators/*`, `schema/*`
- Qualquer módulo de storage, fetch, routing global

Se precisar de algo, deve vir via `context`.

## 6) Regra de fronteira
Se uma regra global precisar de mudança, **só o core/orquestrador** pode ser alterado.  
Nenhuma página deve ter lógica global.

