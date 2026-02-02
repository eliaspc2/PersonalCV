import { pagesRegistry } from '../pages/pages-registry.js';
import { buildPageContext } from './page-context.js';
import { renderFullPage } from './page-orchestrator.js';

export function renderPageShadow({ pageId, data, container, lang, ui, assets, helpers, meta } = {}) {
    const pageModule = pagesRegistry[pageId];
    if (!pageModule) {
        throw new Error(`Page not registered: ${pageId}`);
    }
    const context = buildPageContext({ pageId, data, container, lang, ui, assets, helpers, meta });
    return renderFullPage(pageModule, context);
}
