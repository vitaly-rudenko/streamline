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
        '**/.git': true,
        '**/.svn': true,
        '**/.hg': true,
        '**/CVS': true,
        '**/.DS_Store': true,
        '**/Thumbs.db': true,
        'B/**': true,
        'F/**': true,
        'H/I/**': true,
        'H/N/**': true,
        'O/**': true,
      }
    )
  })
})
