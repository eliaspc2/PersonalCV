export const SITE_CONFIG_PATH = 'data/site-config.json';

export async function loadSiteConfig(fetcher = fetch) {
    const response = await fetcher(SITE_CONFIG_PATH, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load site-config.json: ${response.status}`);
    }
    return response.json();
}
