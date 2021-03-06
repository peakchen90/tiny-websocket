module.exports = {
  extends: [
    'alloy',
    'alloy/typescript',
    'plugin:prettier/recommended'
  ],
  env: {
    browser: true,
    node: true,
    jest: true
  },
  globals: {
    __VERSION__: 'readonly'
  },
  rules: {
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/member-ordering': 'off',
    '@typescript-eslint/consistent-type-assertions': 'off',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-useless-constructor': 'error',
    '@typescript-eslint/prefer-for-of': 'off',
    '@typescript-eslint/unified-signatures': 'off',
    'no-useless-constructor': 'off',
    'no-param-reassign': 'off',
    'prefer-template': 'error',
    'eqeqeq': 'off',
    'no-new': 'off',
    'no-eq-null': 'off',
    'max-params': 'off',
    'no-return-assign': 'off',
    'max-nested-callbacks': 'off',
    'no-undef': 'off',
    'one-var': 'off'
  }
};
