import js from '@eslint/js';
import globals from 'globals';

const RECOMMENDED_RULES = js.configs.recommended.rules;
const LEGACY_INERT_DIRECTIVE = '// eslint-disable-line no-restricted-globals';
const LEGACY_INERT_CONTEXT = `location.href = href; ${LEGACY_INERT_DIRECTIVE}`;

const legacyInertDirectiveProcessor = {
  preprocess(source) {
    const occurrences = source.split(LEGACY_INERT_DIRECTIVE).length - 1;
    if (occurrences > 1) {
      throw new Error('Arcus legacy inert ESLint directive unexpectedly grew');
    }
    if (occurrences !== source.split(LEGACY_INERT_CONTEXT).length - 1) {
      throw new Error('Arcus legacy inert ESLint directive moved outside its reviewed context');
    }
    return [source.replace(LEGACY_INERT_DIRECTIVE, ' '.repeat(LEGACY_INERT_DIRECTIVE.length))];
  },
  postprocess(messageLists) {
    return messageLists.flat();
  }
};

export default [
  {
    ignores: ['.press/**', 'artifacts-worktree/**', 'dist/**', 'node_modules/**', 'press-theme-*/**']
  },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error'
    }
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node
    },
    rules: RECOMMENDED_RULES
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node
    },
    rules: RECOMMENDED_RULES
  },
  {
    files: ['theme/modules/interactions.js'],
    processor: legacyInertDirectiveProcessor
  },
  {
    files: ['theme/**/*.js', 'theme/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser
    },
    rules: {
      ...RECOMMENDED_RULES,
      'no-empty': 'off',
      'no-unused-vars': 'off',
      'no-useless-assignment': 'off'
    }
  }
];
