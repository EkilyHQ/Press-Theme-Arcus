import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const eslint = new ESLint({ cwd: REPO_ROOT });
const probePath = path.join(REPO_ROOT, 'scripts', 'fixtures', 'eslint-policy', 'inline-disable-probe.mjs');
const rootModuleProbePath = path.join(REPO_ROOT, 'root-policy-probe.mjs');
const rootCommonProbePath = path.join(REPO_ROOT, 'root-policy-probe.js');
const interactionsPath = path.join(REPO_ROOT, 'theme', 'modules', 'interactions.js');
const legacyInertDirective = '// eslint-disable-line no-restricted-globals';

const projectConfig = await eslint.calculateConfigForFile(probePath);
assert.equal(
  projectConfig.linterOptions?.noInlineConfig,
  true,
  'the real project config must reject inline directives'
);
const rootConfig = await eslint.calculateConfigForFile(path.join(REPO_ROOT, 'eslint.config.mjs'));
assert.equal(
  rootConfig.rules?.['no-unused-vars']?.[0],
  2,
  'root-level ESM tooling, including eslint.config.mjs, must receive recommended rules'
);

const [rootModuleDebt] = await eslint.lintText(
  `
    export const ready = true;
    const unusedRootTooling = 1;
  `,
  { filePath: rootModuleProbePath }
);
assert.equal(
  rootModuleDebt.messages.filter(({ ruleId, severity }) => ruleId === 'no-unused-vars' && severity === 2).length,
  1,
  'root-level .mjs tooling debt must fail the recommended-rule gate'
);
const [rootCommonClean] = await eslint.lintText(
  `
    module.exports = function add(left, right) {
      return left + right;
    };
  `,
  { filePath: rootCommonProbePath }
);
assert.equal(rootCommonClean.errorCount, 0, 'root-level CommonJS tooling must receive Node globals');
assert.equal(rootCommonClean.warningCount, 0, 'clean root-level CommonJS tooling must retain zero warnings');

const [disabledResult] = await eslint.lintText(
  `
    // eslint-disable-next-line no-undef -- policy probe: this directive must have no effect
    missingInlineDisableTarget();
  `,
  { filePath: probePath }
);
const noUndefinedMessages = disabledResult.messages.filter(({ ruleId }) => ruleId === 'no-undef');
assert.equal(noUndefinedMessages.length, 1, 'the used inline directive must not hide the no-undef diagnostic');
assert.equal(noUndefinedMessages[0].severity, 2, 'no-undef must remain a severity-2 error');
assert.equal(
  disabledResult.suppressedMessages.some(({ ruleId }) => ruleId === 'no-undef'),
  false,
  'no-undef must not enter ESLint suppressedMessages'
);

const interactionsSource = await readFile(interactionsPath, 'utf8');
assert.equal(
  interactionsSource.split(legacyInertDirective).length - 1,
  1,
  'the measured Arcus inert directive must remain an exact one-occurrence legacy baseline'
);
const [legacyResult] = await eslint.lintText(interactionsSource, { filePath: interactionsPath });
assert.equal(legacyResult.errorCount, 0, 'the real Arcus theme source must retain zero enforced-rule errors');
assert.equal(legacyResult.warningCount, 0, 'the exact inert-comment mask must retain the zero-warning lint gate');
assert.equal(legacyResult.suppressedMessages.length, 0, 'the inert legacy comment must not suppress diagnostics');
const [duplicateResult] = await eslint.lintText(`${interactionsSource}\n${legacyInertDirective}\n`, {
  filePath: interactionsPath
});
assert.ok(
  duplicateResult.messages.some(
    ({ fatal, message }) => fatal && /legacy inert ESLint directive unexpectedly grew/u.test(message)
  ),
  'duplicating the historical comment must fail the real project processor'
);
const [relocatedResult] = await eslint.lintText(
  interactionsSource.replace(
    `location.href = href; ${legacyInertDirective}`,
    `location.assign(href); ${legacyInertDirective}`
  ),
  { filePath: interactionsPath }
);
assert.ok(
  relocatedResult.messages.some(
    ({ fatal, message }) => fatal && /legacy inert ESLint directive moved outside its reviewed context/u.test(message)
  ),
  'moving the historical comment outside its reviewed statement must fail the real project processor'
);

const [cleanResult] = await eslint.lintText(
  `
    export function add(left, right) {
      return left + right;
    }
  `,
  { filePath: probePath }
);
assert.equal(cleanResult.errorCount, 0, 'the clean project-config sample must have zero errors');
assert.equal(cleanResult.warningCount, 0, 'the clean project-config sample must have zero warnings');
assert.equal(cleanResult.suppressedMessages.length, 0, 'the clean sample must not carry suppressed diagnostics');

process.stdout.write(
  'ESLint inline-policy self-test passed: no-undef remains severity 2, Arcus legacy comment stays inert, and clean samples are 0/0.\n'
);
