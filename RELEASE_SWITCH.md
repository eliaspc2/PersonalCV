# Release Switch (index2 -> index)

## Objetivo
Promover `index2.html` (novo pipeline) para produção sem quebrar o site atual.

## Passos de lançamento
1) Confirmar que `index2.html` está funcional no GitHub Pages:
   - Navegação, labels e CTAs OK
   - Todas as páginas migradas renderizam
   - Sem erros de console
2) Renomear ficheiros:
   - `index.html` -> `index.fallback.html`
   - `index2.html` -> `index.html`
3) Commit + push
4) Aguardar deploy do GitHub Pages

## Rollback rápido
1) Reverter os nomes:
   - `index.html` -> `index2.html`
   - `index.fallback.html` -> `index.html`
2) Commit + push

## Notas
- `index2.html` usa o novo pipeline por detecção do entrypoint.
- O site antigo permanece intacto até ao rename.
