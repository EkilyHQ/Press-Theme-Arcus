import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
function resolvePressRoot() {
  const candidates = [];
  if (process.env.PRESS_ROOT) candidates.push(resolve(root, process.env.PRESS_ROOT));
  candidates.push(resolve(root, '.press'));
  candidates.push(resolve(root, '..', 'Press'));
  const found = candidates.find((candidate) => existsSync(resolve(candidate, 'assets/js/site-features.js')));
  if (found) return found;
  throw new Error(`Press checkout not found for behavior probes. Set PRESS_ROOT or place Press at ../Press. Checked: ${candidates.join(', ')}`);
}
const pressRoot = resolvePressRoot();

const layout = read('theme/modules/layout.js');
const interactions = read('theme/modules/interactions.js');
const source = `${layout}\n${interactions}`;
const css = read('theme/theme.css');
const manifest = JSON.parse(read('theme/theme.json'));
const releaseExample = JSON.parse(read('theme-release.example.json'));
const semverPattern = /^[0-9]+\.[0-9]+\.[0-9]+$/;

assert.equal(manifest.contractVersion, 4);
assert.equal(manifest.engines.press, '>=3.4.130 <4.0.0');
assert.match(manifest.version, semverPattern);
assert.equal(releaseExample.contractVersion, manifest.contractVersion);
assert.deepEqual(releaseExample.engines, manifest.engines);
assert.match(releaseExample.version, semverPattern);
assert.equal(manifest.configSchema.type, 'object');
assert.equal(manifest.configSchema.additionalProperties, false);
[
  'accentColor',
  'backgroundStyle',
  'radiusScale',
  'cardDensity',
  'mediaStyle'
].forEach((key) => {
  assert.ok(manifest.configSchema.properties[key], `configSchema should declare ${key}`);
});
assert.equal(manifest.configSchema.properties.accentColor['x-press'].control, 'color');
assert.equal(manifest.configSchema.properties.accentColor['x-press'].cssVariable, '--arcus-user-accent');
assert.equal(manifest.configSchema.properties.radiusScale['x-press'].control, 'range');
assert.equal(manifest.configSchema.properties.radiusScale['x-press'].cssVariable, '--arcus-radius-scale');
assert.match(css, /--arcus-user-accent/);
assert.match(css, /--arcus-radius-scale/);
assert.match(css, /\[data-arcus-background="plain"\]/);
assert.match(css, /\[data-arcus-density="compact"\]/);
assert.match(css, /\[data-arcus-media="minimal"\]/);
assert.match(interactions, /function reflectArcusThemeSettings[\s\S]*getArcusThemeSettings/);
assert.match(interactions, /ctx[\s\S]*theme[\s\S]*settings/);
assert.doesNotMatch(source, /[?&](?:tab|id)=/, 'v4 packaged source should use router href helpers for public routes');
assert.doesNotMatch(source, /getRouteHref[\s\S]{0,160}\|\|\s*'#'/, 'v4 route helper null results should not become hash dead links');
assert.doesNotMatch(layout, /<a[^>]*href="#"[^>]*data-site-home|<a[^>]*data-site-home[^>]*href="#"/, 'brand home link should not start as a hash dead link');
assert.match(layout, /data-site-home/);
assert.match(interactions, /siteFeatureContextEnabled/);
assert.match(interactions, /function getRouter[\s\S]*ctx\.router/);
assert.match(interactions, /function getRouteHref[\s\S]*routerFunction\(params, name\)/);
assert.match(interactions, /function updateHomeLinks[\s\S]*getRouteHref\(params, 'getHomeHref'\)[\s\S]*data-site-home/);
assert.match(interactions, /getRouteHref\(params, 'getSearchHref'\)/, 'footer search links should use the v4 router search href helper');
assert.doesNotMatch(interactions, /renderDefaultTags/);

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
  /function buildCard\(\{ title, meta, translate, link, siteConfig, features \}\)[\s\S]*if \(!link\) return '';[\s\S]*const showTags = featureEnabled\(\{ features \}, 'tags'\) && featureEnabled\(\{ features \}, 'search'\);[\s\S]*const tags = showTags && meta \? renderTags\(meta\.tag\) : ''/,
  'index/search cards should hide tags when tags or search are disabled'
);
assert.match(
  interactions,
  /function buildPagination\([\s\S]*renderPageControl[\s\S]*<span class="\$\{`\$\{className\} is-disabled`\.trim\(\)\}" aria-disabled="true">/,
  'pagination should render disabled spans rather than hash links when route helpers return null'
);
assert.match(
  interactions,
  /hydrateArcusCardExcerpts\(filterEntriesWithPostHref\(params\.entries \|\| \[\], params\),/,
  'excerpt hydration should use the same route-helper reachability as rendered cards'
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
  /function renderNavLinks[\s\S]*getRouteHref\(params, 'getPostsHref'\)[\s\S]*getRouteHref\(params, 'getTabHref', slug\)/,
  'nav rendering should use v4 posts and tab href helpers'
);
assert.match(
  interactions,
  /function updateHomeLinks[\s\S]*getRouteHref\(params, 'getHomeHref'\)[\s\S]*setHomeLinkHref\(link, href\)/,
  'identity refresh should use the v4 home href helper and disable home links when no href is available'
);
assert.match(
  interactions,
  /const renderFallbackToc = \(\) => \{[\s\S]*if \(!featureEnabled\(\{ features \}, 'toc'\)\) \{[\s\S]*clearArcusToc\(tocTarget\);[\s\S]*tocTarget\.hidden = true;[\s\S]*return;[\s\S]*showToc\(tocTarget, tocHtml, title\);[\s\S]*\};[\s\S]*catch \(_\) \{[\s\S]*renderFallbackToc\(\);[\s\S]*\}/,
  'post TOC fallback should respect the toc feature gate even without a utility renderer'
);

const updateHomeLinksSource = interactions.slice(
  interactions.indexOf('function setHomeLinkHref'),
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
  attributes: new Map([['href', '?tab=about']]),
  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
    if (name === 'href') this.href = value;
  },
  removeAttribute(name) {
    this.attributes.delete(String(name));
    if (name === 'href') delete this.href;
  },
  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }
};
const fakeDocument = {
  defaultView: {},
  querySelectorAll(selector) {
    return selector === '[data-site-home]' ? [homeLink] : [];
  }
};
assert.equal(updateHomeLinks(fakeDocument, {}), false, 'identity refresh without home helper should not create a home href');
assert.equal(homeLink.getAttribute('href'), null, 'identity refresh without home helper should remove stale home hrefs');
assert.equal(homeLink.getAttribute('aria-disabled'), 'true', 'identity refresh without home helper should disable home links');
assert.equal(homeLink.getAttribute('tabindex'), '-1', 'identity refresh without home helper should remove home links from tab order');
const receiverRouter = {
  homeHref: '?tab=product&lang=en',
  getHomeHref() {
    return this.homeHref;
  }
};
assert.equal(updateHomeLinks(fakeDocument, { ctx: { router: receiverRouter } }), true, 'ctx.router home href helper should update home links');
assert.equal(homeLink.getAttribute('href'), '?tab=product&lang=en', 'ctx.router withLangParam should write the resolved home href');
assert.equal(homeLink.getAttribute('aria-disabled'), null, 'valid home helper should clear disabled state');
assert.equal(homeLink.getAttribute('tabindex'), null, 'valid home helper should restore normal focus behavior');
assert.equal(updateHomeLinks(fakeDocument, { ctx: { router: { getHomeHref: () => null } } }), false, 'null home helper should disable home links');
assert.equal(homeLink.getAttribute('href'), null, 'null home helper should remove stale home hrefs');

class TestElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.className = '';
    this.hidden = false;
    this.textContent = '';
    this._innerHTML = '';
    this.style = {
      setProperty(name, value) {
        this[String(name)] = String(value);
      },
      removeProperty(name) {
        delete this[String(name)];
      }
    };
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || '');
  }

  setAttribute(name, value = '') {
    const key = String(name);
    const str = String(value);
    this.attributes.set(key, str);
    if (key === 'class') this.className = str;
    if (key === 'hidden') this.hidden = true;
  }

  getAttribute(name) {
    const key = String(name);
    if (this.attributes.has(key)) return this.attributes.get(key);
    if (key === 'class' && this.className) return this.className;
    return null;
  }

  removeAttribute(name) {
    const key = String(name);
    this.attributes.delete(key);
    if (key === 'hidden') this.hidden = false;
  }

  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  addEventListener() {}
  removeEventListener() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { width: 1000, height: 1000, top: 0, left: 0 }; }
}

class TestDocument {
  constructor() {
    this.body = new TestElement('body', this);
    this.documentElement = new TestElement('html', this);
    this.defaultView = {
      location: { href: 'https://example.test/', origin: 'https://example.test', pathname: '/' },
      matchMedia: () => ({ matches: false }),
      requestAnimationFrame: (fn) => setTimeout(fn, 0),
      cancelAnimationFrame: (id) => clearTimeout(id),
      scrollTo() {},
      addEventListener() {},
      removeEventListener() {}
    };
  }

  createElement(tagName) {
    return new TestElement(tagName, this);
  }

  querySelector() { return null; }
  querySelectorAll() { return []; }
  getElementById() { return null; }
}

async function importArcusModule() {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'arcus-feature-test-'));
  const tempModuleDir = resolve(tempRoot, 'assets/themes/arcus/modules');
  mkdirSync(tempModuleDir, { recursive: true });
  mkdirSync(resolve(tempRoot, 'assets'), { recursive: true });
  symlinkSync(resolve(pressRoot, 'assets/js'), resolve(tempRoot, 'assets/js'), 'dir');
  writeFileSync(resolve(tempModuleDir, 'interactions.js'), interactions);
  return import(`${pathToFileURL(resolve(tempModuleDir, 'interactions.js')).href}?feature-test=${Date.now()}-${Math.random()}`);
}

const doc = new TestDocument();
globalThis.document = doc;
globalThis.window = doc.defaultView;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const arcusModule = await importArcusModule();
const allFeatures = { isEnabled: () => true };
const nullRouter = {
  getPostHref: () => null,
  getPostsHref: () => null,
  getSearchHref: () => null
};
const api = arcusModule.mount({
  document: doc,
  window: doc.defaultView,
  features: allFeatures,
  router: nullRouter,
  i18n: {
    t: (key) => key,
    withLangParam: (href) => href
  }
});
assert.equal(doc.documentElement.getAttribute('data-arcus-background'), null, 'default Arcus settings should not write a background attribute');
assert.equal(doc.documentElement.getAttribute('data-arcus-density'), null, 'default Arcus settings should not write a density attribute');
assert.equal(doc.documentElement.getAttribute('data-arcus-media'), null, 'default Arcus settings should not write a media attribute');
api.effects.reflectThemeConfig({
  siteConfig: { themePack: 'arcus' },
  ctx: {
    theme: {
      settings: {
        backgroundStyle: 'plain',
        cardDensity: 'compact',
        mediaStyle: 'minimal'
      }
    }
  }
});
assert.equal(doc.documentElement.getAttribute('data-arcus-background'), 'plain', 'Arcus should reflect backgroundStyle from ctx.theme.settings');
assert.equal(doc.documentElement.getAttribute('data-arcus-density'), 'compact', 'Arcus should reflect cardDensity from ctx.theme.settings');
assert.equal(doc.documentElement.getAttribute('data-arcus-media'), 'minimal', 'Arcus should reflect mediaStyle from ctx.theme.settings');
api.effects.reflectThemeConfig({
  siteConfig: { themePack: 'arcus' },
  ctx: {
    theme: {
      settings: {
        backgroundStyle: 'soft',
        cardDensity: 'comfortable',
        mediaStyle: 'immersive'
      }
    }
  }
});
assert.equal(doc.documentElement.getAttribute('data-arcus-background'), null, 'Arcus should remove default backgroundStyle attributes');
assert.equal(doc.documentElement.getAttribute('data-arcus-density'), null, 'Arcus should remove default cardDensity attributes');
assert.equal(doc.documentElement.getAttribute('data-arcus-media'), null, 'Arcus should remove default mediaStyle attributes');
const indexMain = doc.createElement('main');
api.effects.renderIndexView({
  container: indexMain,
  ctx: { router: nullRouter },
  features: allFeatures,
  pageEntries: [['Product', { location: 'product.md' }]],
  page: 1,
  totalPages: 2,
  siteConfig: {}
});
assert.doesNotMatch(indexMain.innerHTML, /href="(?:#|)"/, 'null index route helpers should not render empty or hash links');
assert.match(indexMain.innerHTML, /aria-disabled="true"/, 'null index pagination helpers should render disabled text controls');

const searchMain = doc.createElement('main');
api.effects.renderSearchResults({
  container: searchMain,
  ctx: { router: nullRouter },
  features: allFeatures,
  entries: [['Product', { location: 'product.md' }]],
  query: 'Product',
  page: 2,
  totalPages: 3,
  siteConfig: {}
});
assert.doesNotMatch(searchMain.innerHTML, /href="(?:#|)"/, 'null search route helpers should not render empty or hash links');
assert.match(searchMain.innerHTML, /aria-disabled="true"/, 'null search pagination helpers should render disabled text controls');

console.log('ok - Arcus public chrome feature gates');
