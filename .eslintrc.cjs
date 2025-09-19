module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2020: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    '.eslintrc.cjs',
    'vite.config.ts',
    'tailwind.config.js',
    'postcss.config.js',
    'functions/**/*' // Cloudflare workers functions
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [
    'react-refresh',
    '@typescript-eslint',
    'react',
    'react-hooks'
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // React specific rules
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    'react/prop-types': 'off', // Using TypeScript for type checking
    'react/jsx-uses-react': 'off', // Not needed with new JSX transform
    'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
    
    // TypeScript specific rules - relaxed for OCR/AI project
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off', // AI/OCR apps often need any
    
    // General code quality rules - relaxed for rapid development
    'no-unused-vars': 'off', // Using @typescript-eslint/no-unused-vars instead
    'no-console': 'off', // Allow console for debugging in development
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'warn',
    'prefer-template': 'warn',
    'no-useless-escape': 'warn',
    
    // Import/export rules
    'no-duplicate-imports': 'error',
    
    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // Accessibility and best practices
    'react/jsx-key': 'error',
    'react/jsx-no-target-blank': 'error',
    'react/no-array-index-key': 'warn',
    'react/no-unescaped-entities': 'warn',
  },
  overrides: [
    {
      files: ['*.test.ts', '*.test.tsx', '**/__tests__/**/*'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'prefer-const': 'off',
      }
    },
    {
      files: ['src/services/**/*.ts', 'src/utils/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off', // Services and utils often need any
        'prefer-template': 'off', // Performance considerations
      }
    },
    {
      files: ['src/types/**/*.d.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off', // Type definitions
      }
    },
    {
      files: ['functions/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off', // Cloudflare workers
        'no-console': 'off',
      }
    }
  ]
};