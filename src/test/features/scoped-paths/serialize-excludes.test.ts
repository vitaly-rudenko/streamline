import assert from 'assert'
import { serializeExcludes } from '../../../features/scoped-paths/serialize-excludes'

suite('serializeExcludes()', () => {
  test('multiple files', () => {
    const excludedPaths = [
      'A/B',
      'A/F',
      'Q',
      'G/H/I',
      'G/H/N',
      'G/O',
    ]

    assert.deepStrictEqual(
      serializeExcludes({ excludedPaths }),
      {
        'B/**': true,
        'F/**': true,
        'H/I/**': true,
        'H/N/**': true,
        'O/**': true,
      }
    )
  })
})
