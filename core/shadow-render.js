import { buildPageContext } from './page-context.js';
import { renderFullPage } from './page-orchestrator.js';

export async function renderPageShadow({ pageId, data, container, lang, ui, assets, helpers, meta } = {}) {
    const { pagesRegistry } = await import('../pages/pages-registry.js');
    const pageModule = pagesRegistry[pageId];
    if (!pageModule) {
        return false;
    }
    const context = buildPageContext({ pageId, data, container, lang, ui, assets, helpers, meta });
    return renderFullPage(pageModule, context);
}
