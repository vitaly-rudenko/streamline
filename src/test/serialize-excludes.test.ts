import assert from 'assert'
import { serializeExcludes } from '../serialize-excludes'

suite('serializeExcludes()', () => {
  test('multiple files', () => {
    const includedPaths = ['A/C/D/', 'A/C/', 'G/P', 'G/H/J/', 'G/H/M/']
    const excludedPaths = [
      'A/B/',
      'A/F',
      'Q',
      'G/H/I/',
      'G/H/N',
      'G/O',
    ]

    assert.deepStrictEqual(
      serializeExcludes({ includedPaths, excludedPaths }),
      {
        'A/B/**': true,
        'A/F': true,
        'Q': true,
        'G/H/I/**': true,
        'G/H/N': true,
        'G/O': true,
      }
    )
  })
})
