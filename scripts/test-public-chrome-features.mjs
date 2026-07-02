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

assert.doesNotMatch(source, /href\s*=\s*["']\?tab=posts["']/);
assert.match(layout, /data-site-home/);
assert.match(interactions, /siteFeatureContextEnabled/);
assert.match(interactions, /function updateHomeLinks[\s\S]*getHomeSlug[\s\S]*data-site-home/);

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
  /function buildCard\(\{ title, meta, translate, link, siteConfig, features \}\)[\s\S]*featureEnabled\(\{ features \}, 'tags'\) && meta \? renderTags\(meta\.tag\) : ''/,
  'index/search cards should hide tags when tags are disabled'
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
  /const showTags = featureEnabled\(\{ features \}, 'tags'\);[\s\S]*renderPostMetaCard\(title, postMetadata \|\| \{\}, markdown, \{ showTags \}\)/,
  'shared post meta card should receive the tags feature gate'
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
  /function renderNavLinks[\s\S]*const homeSlug = typeof getHomeSlug === 'function' \? getHomeSlug\(\) : 'posts';[\s\S]*updateHomeLinks\(nav\.ownerDocument \|\| defaultDocument, \{ \.\.\.params, getHomeSlug: \(\) => homeSlug \}\);/,
  'home links should preserve the same posts fallback used by nav rendering'
);
assert.match(
  interactions,
  /const renderFallbackToc = \(\) => \{[\s\S]*if \(!featureEnabled\(\{ features \}, 'toc'\)\) \{[\s\S]*clearArcusToc\(tocTarget\);[\s\S]*tocTarget\.hidden = true;[\s\S]*return;[\s\S]*showToc\(tocTarget, tocHtml, title\);[\s\S]*\};[\s\S]*catch \(_\) \{[\s\S]*renderFallbackToc\(\);[\s\S]*\}/,
  'post TOC fallback should respect the toc feature gate even without a utility renderer'
);

console.log('ok - Arcus public chrome feature gates');
