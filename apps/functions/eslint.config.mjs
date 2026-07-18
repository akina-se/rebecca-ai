import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'warn'
    }
  },
  {
    ignores: ['lib/**', 'node_modules/**', 'coverage/**', 'artifacts/**', 'scratch/**']
  }
);
