import assert from 'assert'
import { generateExcludedPaths } from '../../../features/scoped-paths/generate-excluded-paths'

const defaultPaths = [
  'A',
    'A/B',
    'A/C',
      'A/C/D',
      'A/C/E',
    'A/F',
  'G',
    'G/H',
      'G/H/I',
      'G/H/J',
        'G/H/J/K',
        'G/H/J/L',
      'G/H/M',
      'G/H/N',
    'G/O',
    'G/P',
  'Q',
]

function createDirectoryReader(paths = defaultPaths) {
  return async (path: string): Promise<string[]> => {
    if (path === '') {
      return paths.filter((p) => !p.includes('/'))
    }

    return paths.filter((p) =>
      p.startsWith(path)
        ? p.split('/').length === path.split('/').length + 1
        : false,
    )
  }
}

suite('generateExcludedPaths()', () => {
  test('empty', async () => {
    assert.deepStrictEqual(
      await generateExcludedPaths(
        [],
        createDirectoryReader()
      ),
      []
    )
  })

  test('single directory', async () => {
    assert.deepStrictEqual(
      await generateExcludedPaths(
        ['A'],
        createDirectoryReader()
      ),
      [
        'G',
        'Q',
      ]
    )

    assert.deepStrictEqual(
      await generateExcludedPaths(
        ['G/H/J'],
        createDirectoryReader()
      ),
      [
        'G/H/I',
        'G/H/M',
        'G/H/N',
        'G/O',
        'G/P',
        'A',
        'Q',
      ]
    )
  })

  test('single file', async () => {
    assert.deepStrictEqual(
      await generateExcludedPaths(
        ['A/F'],
        createDirectoryReader()
      ),
      [
        'A/B',
        'A/C',
        'G',
        'Q',
      ]
    )
  })

  test('multiple directories', async () => {
    assert.deepStrictEqual(
      await generateExcludedPaths(
        ['A/C/D', 'A/C', 'G/H/J', 'G/H/M'],
        createDirectoryReader()
      ),
      [
        'A/B',
        'A/F',
        'Q',
        'G/H/I',
        'G/H/N',
        'G/O',
        'G/P',
      ]
    )
  })

  suite('edge cases', () => {
    test('handles files with similar names correctly', async () => {
      const paths = [
        'A',
          'A/B',
            'A/B/C',
          'A/B.js',
          'A/BC',
          'A/AB',
      ]

      assert.deepStrictEqual(
        await generateExcludedPaths(
          ['A/B'],
          createDirectoryReader(paths)
        ),
        [
          'A/B.js',
          'A/BC',
          'A/AB',
        ]
      )
    })
  })
})
