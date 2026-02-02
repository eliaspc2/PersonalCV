import * as examplePage from './example.page.js';
import * as highlightsPage from './highlights.page.js';
import * as overviewPage from './overview.page.js';
import * as foundationPage from './foundation.page.js';
import * as developmentPage from './development.page.js';
import * as mindsetPage from './mindset.page.js';
import * as nowPage from './now.page.js';
import * as contactPage from './contact.page.js';

export const pagesRegistry = {
    [examplePage.pageMeta.id]: examplePage,
    [overviewPage.pageMeta.id]: overviewPage,
    [developmentPage.pageMeta.id]: developmentPage,
    [foundationPage.pageMeta.id]: foundationPage,
    [highlightsPage.pageMeta.id]: highlightsPage,
    [mindsetPage.pageMeta.id]: mindsetPage,
    [nowPage.pageMeta.id]: nowPage,
    [contactPage.pageMeta.id]: contactPage
};
