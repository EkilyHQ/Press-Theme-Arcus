import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const layout = read('theme/modules/layout.js');
const interactions = read('theme/modules/interactions.js');
const source = `${layout}\n${interactions}`;
const manifest = JSON.parse(read('theme/theme.json'));
const releaseExample = JSON.parse(read('theme-release.example.json'));

assert.equal(manifest.contractVersion, 3);
assert.equal(manifest.engines.press, '>=3.4.127 <4.0.0');
assert.equal(releaseExample.contractVersion, 3);
assert.equal(releaseExample.engines.press, '>=3.4.127 <4.0.0');
assert.doesNotMatch(source, /href\s*=\s*["']\?tab=posts["']/);
assert.match(layout, /data-site-home/);
assert.match(interactions, /siteFeatureContextEnabled/);
assert.match(interactions, /function getRouter[\s\S]*ctx\.router/);
assert.match(interactions, /function makeRuntimeHref[\s\S]*routerFunction\(params, 'withLangParam'\)/);
assert.match(interactions, /function updateHomeLinks[\s\S]*getHomeSlug[\s\S]*data-site-home/);
assert.match(interactions, /routerFunction\(params, 'searchEnabled'\)/, 'footer search links should use the v3 router search helper');

[
  'visitorThemeControls',
  'footerNav',
  'profileLinks',
  'search',
  'tags',
  'toc',
  'postMeta'
].forEach((key) => {
  assert.match(interactions, new RegExp(`featureEnabled\\([\\s\\S]*['"]${key}['"]`), `${key} should be gated`);
});

assert.match(interactions, /mountThemeControls\(\{ host: panel, variant: 'arcus', themeContext \}\)/);
assert.match(interactions, /setChromeHidden\(search, true\)/);
assert.match(
  interactions,
  /if \(!featureEnabled\(\{ features \}, 'tags'\) \|\| !featureEnabled\(\{ features \}, 'search'\)\) \{/,
  'tag sidebar should hide when either tags or search is disabled'
);
assert.match(layout, /tagBand\.hidden = true;/, 'layout should keep tag band hidden until runtime renders it');
assert.match(
  interactions,
  /featureEnabled\(params, 'tags'\) && featureEnabled\(params, 'search'\) && typeof params\.renderTagSidebar === 'function'/,
  'index enhancement should only render tag sidebar when both tags and search are enabled'
);
assert.match(
  interactions,
  /featureEnabled\(params, 'tags'\) && featureEnabled\(params, 'search'\) && typeof params\.renderTagSidebar === 'function'\) \{[\s\S]*setChromeHidden\(getTagsRegion\(documentRef\), false\);[\s\S]*params\.renderTagSidebar/,
  'index enhancement should unhide tags before delegating tag sidebar rendering'
);
assert.match(
  interactions,
  /else \{[\s\S]*const tags = getTagsRegion\(documentRef\);[\s\S]*tags\.innerHTML = '';[\s\S]*setChromeHidden\(tags, true\);[\s\S]*\}/,
  'index enhancement should clear and hide tags when tags or search are disabled'
);
assert.match(
  interactions,
  /function buildCard\(\{ title, meta, translate, link, siteConfig, features \}\)[\s\S]*const showTags = featureEnabled\(\{ features \}, 'tags'\) && featureEnabled\(\{ features \}, 'search'\);[\s\S]*const tags = showTags && meta \? renderTags\(meta\.tag\) : ''/,
  'index/search cards should hide tags when tags or search are disabled'
);
assert.match(
  interactions,
  /function buildCard\(\{ title, meta, translate, link, siteConfig, features \}\)[\s\S]*const showPostMeta = featureEnabled\(\{ features \}, 'postMeta'\);[\s\S]*const date = showPostMeta && meta && meta\.date \? formatDisplayDate\(meta\.date\) : '';/,
  'index/search cards should hide date metadata when postMeta is disabled'
);
assert.match(
  interactions,
  /const showPostMeta = featureEnabled\(\{ features \}, 'postMeta'\);[\s\S]*const date = showPostMeta && postMetadata && postMetadata\.date/,
  'post date line should respect postMeta'
);
assert.match(
  interactions,
  /const showTags = featureEnabled\(\{ features \}, 'tags'\) && featureEnabled\(\{ features \}, 'search'\);[\s\S]*renderPostMetaCard\(title, postMetadata \|\| \{\}, markdown, \{ showTags \}\)/,
  'shared post meta card should receive the tags and search feature gates'
);
assert.match(
  interactions,
  /if \(!featureEnabled\(\{ features \}, 'toc'\)\) \{[\s\S]*clearArcusToc\(toc\);[\s\S]*toc\.hidden = true;/,
  'static tab TOC should respect toc'
);
assert.match(
  interactions,
  /utilities\.renderPostTOC\(\{ tocElement: tocTarget, tocHtml, articleTitle: title, features \}\)/,
  'post TOC utility calls should forward the feature context'
);
assert.match(
  interactions,
  /function renderNavLinks[\s\S]*routerFunction\(params, 'getHomeSlug'\)[\s\S]*routerFunction\(params, 'postsEnabled'\)[\s\S]*updateHomeLinks\(nav\.ownerDocument \|\| defaultDocument, \{ \.\.\.params, getHomeSlug: \(\) => homeSlug \}\);/,
  'nav rendering should prefer ctx.router home/posts helpers before updating home links'
);
assert.match(
  interactions,
  /function updateHomeLinks[\s\S]*routerFunction\(params, 'getHomeSlug'\)[\s\S]*__press_get_home_slug[\s\S]*if \(!homeSlug\) return false;[\s\S]*makeRuntimeHref\(params, `\?tab=\$\{encodeURIComponent\(homeSlug\)\}`\);/,
  'identity refresh should prefer ctx.router home helpers or preserve existing home hrefs'
);
assert.match(
  interactions,
  /const renderFallbackToc = \(\) => \{[\s\S]*if \(!featureEnabled\(\{ features \}, 'toc'\)\) \{[\s\S]*clearArcusToc\(tocTarget\);[\s\S]*tocTarget\.hidden = true;[\s\S]*return;[\s\S]*showToc\(tocTarget, tocHtml, title\);[\s\S]*\};[\s\S]*catch \(_\) \{[\s\S]*renderFallbackToc\(\);[\s\S]*\}/,
  'post TOC fallback should respect the toc feature gate even without a utility renderer'
);

const updateHomeLinksSource = interactions.slice(
  interactions.indexOf('function updateHomeLinks'),
  interactions.indexOf('\n\nfunction getRegion')
);
const routerHelpersSource = interactions.slice(
  interactions.indexOf('function getRouter'),
  interactions.indexOf('\n\nfunction setChromeHidden')
);
assert.ok(updateHomeLinksSource.includes('function updateHomeLinks'), 'updateHomeLinks source should be available for behavior probe');
assert.ok(routerHelpersSource.includes('function routerFunction'), 'router helper source should be available for behavior probe');
const updateHomeLinks = new Function(
  'defaultWindow',
  'withLangParam',
  `const activeThemeContext = null; ${routerHelpersSource}\n${updateHomeLinksSource}; return updateHomeLinks;`
)(undefined, (href) => href);
const homeLink = {
  href: '?tab=about',
  setAttribute(name, value) {
    if (name === 'href') this.href = value;
  }
};
const fakeDocument = {
  defaultView: {},
  querySelectorAll(selector) {
    return selector === '[data-site-home]' ? [homeLink] : [];
  }
};
assert.equal(updateHomeLinks(fakeDocument, {}), false, 'identity refresh without home helper should not rewrite home links');
assert.equal(homeLink.href, '?tab=about', 'identity refresh without home helper should preserve existing home href');
assert.equal(updateHomeLinks(fakeDocument, { ctx: { router: { getHomeSlug: () => 'product', withLangParam: (href) => `${href}&lang=en` } } }), true, 'ctx.router home helper should update home links');
assert.equal(homeLink.href, '?tab=product&lang=en', 'ctx.router withLangParam should write the resolved home href');
assert.equal(updateHomeLinks(fakeDocument, { window: { __press_get_home_slug: () => 'landing' } }), true, 'runtime home helper should update home links');
assert.equal(homeLink.href, '?tab=landing', 'runtime home helper should write the resolved home href');

console.log('ok - Arcus public chrome feature gates');
