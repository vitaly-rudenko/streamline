import assert from 'assert'
import { generateExcludedPaths } from '../../../features/scoped-paths/generate-excluded-paths'

const paths = [
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

async function readDirectory(path: string): Promise<string[]> {
  if (path === '') {
    return paths.filter((p) => !p.includes('/'))
  }

  return paths.filter((p) =>
    p.startsWith(path)
      ? p.split('/').length === path.split('/').length + 1
      : false,
  )
}

suite('generateExcludedPaths()', () => {
  test('empty', async () => {
    assert.deepStrictEqual(
      await generateExcludedPaths(
        [],
        readDirectory
      ),
      []
    )
  })

  test('single directory', async () => {
    assert.deepStrictEqual(
      await generateExcludedPaths(
        ['A'],
        readDirectory
      ),
      [
        'G',
        'Q',
      ]
    )

    assert.deepStrictEqual(
      await generateExcludedPaths(
        ['G/H/J'],
        readDirectory
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
        readDirectory
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
        readDirectory
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
})
