import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Lock', message: 'Use imported Lock icon/component, or reference window.Lock if using Web Locks API.' },
        { name: 'Option', message: 'Use imported Option component, or reference window.Option if using native constructor.' },
        { name: 'Range', message: 'Use imported Range component, or reference window.Range if using selection ranges.' },
        { name: 'Audio', message: 'Use window.Audio if using native constructor.' },
        { name: 'Image', message: 'Use window.Image if using native constructor.' },
        { name: 'Notification', message: 'Use window.Notification if using native Notification API.' }
      ],
      'no-use-before-define': ['error', { functions: false, classes: false, variables: true }]
    }
  },
])
