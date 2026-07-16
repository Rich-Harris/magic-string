// @ts-check
import { antfu } from '@antfu/eslint-config'

export default antfu().append(
  {
    ignores: ['benchmark/**', 'example/app*.js'],
  },
)
