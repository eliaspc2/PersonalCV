export function buildPageContext({ pageId, data, container, lang, ui, assets, helpers, meta } = {}) {
    return {
        pageId,
        data,
        container,
        lang,
        ui,
        assets,
        helpers,
        meta
    };
}
