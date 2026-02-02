export function renderFullPage(pageModule, context) {
    if (!pageModule || typeof pageModule.renderPage !== 'function') {
        throw new Error('pageModule.renderPage(context) is required');
    }
    return pageModule.renderPage(context);
}
