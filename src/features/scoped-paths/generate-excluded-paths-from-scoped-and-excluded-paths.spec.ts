import assert from 'assert'
import { DirectoryReader } from '../../utils/types'
import { generateExcludedPathsFromScopedAndExcludedPaths } from './generate-excluded-paths-from-scoped-and-excluded-paths'

function createFakeDirectoryReader(paths: string[]): DirectoryReader {
  return {
    exists: async (path: string): Promise<boolean> => {
      return paths.includes(path)
    },
    read: async (path: string): Promise<string[]> => {
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
}

describe('createFakeDirectoryReader()', () => {
  it('creates a valid fake directory reader', async () => {
    const paths = [
      'workspace-folder-1',
      'workspace-folder-1/folder-1',
      'workspace-folder-1/folder-1/file-1',
      'workspace-folder-1/folder-2',
      'workspace-folder-1/folder-2/file-1',
      'workspace-folder-1/folder-2/file-2',
      'workspace-folder-1/file-1',
      'workspace-folder-1/file-2',
      'workspace-folder-2',
      'workspace-folder-2/folder-2',
      'workspace-folder-2/folder-2/file-2',
      'workspace-folder-2/folder-2/file-3',
      'workspace-folder-2/folder-3',
      'workspace-folder-2/folder-3/file-1',
      'workspace-folder-2/folder-3/file-2',
      'workspace-folder-2/file-2',
      'workspace-folder-2/file-3',
      'workspace-folder-3',
      'workspace-folder-3/folder-3',
      'workspace-folder-3/folder-3/file-2',
      'workspace-folder-3/file-3',
      'workspace-folder-3/file-4',
    ]

    const directoryReader = createFakeDirectoryReader(paths)

    assert.deepStrictEqual(
      await directoryReader.read(''),
      [
        'workspace-folder-1',
        'workspace-folder-2',
        'workspace-folder-3',
      ]
    )

    assert.deepStrictEqual(
      await directoryReader.read('workspace-folder-3'),
      [
        'workspace-folder-3/folder-3',
        'workspace-folder-3/file-3',
        'workspace-folder-3/file-4',
      ]
    )

    assert.deepStrictEqual(
      await directoryReader.read('workspace-folder-1/folder-1'),
      [
        'workspace-folder-1/folder-1/file-1',
      ]
    )

    assert.deepStrictEqual(
      await directoryReader.read('workspace-folder-2/folder-3'),
      [
        'workspace-folder-2/folder-3/file-1',
        'workspace-folder-2/folder-3/file-2',
      ]
    )

    assert.deepStrictEqual(
      await directoryReader.read('workspace-folder-2/folder-2/file-2'),
      []
    )

    assert.deepStrictEqual(
      await directoryReader.read('non-existing-workspace-folder/folder-3'),
      []
    )

    assert.deepStrictEqual(
      await directoryReader.read('workspace-folder-1/non-existing-file'),
      []
    )
  })
})

describe('generateExcludedPathsFromScopedAndExcludedPaths()', () => {
  it('single workspace folder', async () => {
    const paths = [
      'workspace-folder-1',
      'workspace-folder-1/folder-1',
      'workspace-folder-1/folder-1/file-1',
      'workspace-folder-1/folder-2',
      'workspace-folder-1/folder-2/file-1',
      'workspace-folder-1/folder-2/file-2',
      'workspace-folder-1/file-1',
      'workspace-folder-1/file-2',
    ]

    assert.deepStrictEqual(
      await generateExcludedPathsFromScopedAndExcludedPaths([], createFakeDirectoryReader(paths)),
      []
    )

    assert.deepStrictEqual(
      await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-1',
      ], createFakeDirectoryReader(paths)),
      []
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-1/folder-2/file-1',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-1',
        'file-2',
        'folder-1',
        'folder-2/file-2',
      ]
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-1/folder-2',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-1',
        'file-2',
        'folder-1',
      ]
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-1/file-2',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-1',
        'folder-1',
        'folder-2',
      ]
    )
  })

  it('hides all files from other unscoped workspace folders', async () => {
    const paths = [
      'workspace-folder-1',
      'workspace-folder-1/folder-1',
      'workspace-folder-1/folder-1/file-1',
      'workspace-folder-1/file-1',
      'workspace-folder-2',
      'workspace-folder-2/folder-1',
      'workspace-folder-2/folder-1/file-1',
      'workspace-folder-2/folder-1/file-2',
      'workspace-folder-2/file-1',
      'workspace-folder-2/file-2',
      'workspace-folder-3',
      'workspace-folder-3/folder-2',
      'workspace-folder-3/folder-2/file-1',
      'workspace-folder-3/file-2',
      'workspace-folder-3/file-3',
    ]

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-1',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-2',
        'file-3',
        'folder-2',
      ]
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-1',
        'workspace-folder-2',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-3',
        'folder-2',
      ]
    )

    assert.deepStrictEqual(
      await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-2',
        'workspace-folder-3',
      ], createFakeDirectoryReader(paths)),
      []
    )
  })

  it('handles nested folders correctly', async () => {
    const paths = [
      'workspace-folder-1',
      'workspace-folder-1/file-a',
      'workspace-folder-1/file-b',
      'workspace-folder-1/folder',
      'workspace-folder-1/folder/file-c',
      'workspace-folder-1/folder/file-d',
      'workspace-folder-1/folder/sub-folder',
      'workspace-folder-1/folder/sub-folder/file-e',
      'workspace-folder-1/folder/sub-folder/file-f',
      'workspace-folder-1/folder/sub-folder/sub-sub-folder',
      'workspace-folder-2',
      'workspace-folder-2/file-b',
      'workspace-folder-2/file-c',
      'workspace-folder-2/folder',
      'workspace-folder-2/folder/file-d',
      'workspace-folder-2/folder/file-e',
      'workspace-folder-2/folder/sub-folder',
      'workspace-folder-2/folder/sub-folder/file-f',
      'workspace-folder-2/folder/sub-folder/file-g',
    ]

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-2',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-a',
      ]
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-1/folder',
        'workspace-folder-2/folder/sub-folder',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-a',
        'file-b',
        'file-c',
        'folder/file-e',
        // 'folder/file-d', // <-
      ]
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-1/folder/file-d',
        'workspace-folder-2/folder/sub-folder/file-g'
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-a',
        'file-b',
        'file-c',
        'folder/file-c',
        'folder/file-e',
        'folder/sub-folder/file-e',
        'folder/sub-folder/file-f',
        'folder/sub-folder/sub-sub-folder',
      ]
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-2/file-b',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-a',
        'file-c',
        'folder',
      ]
    )
  })

  describe('[excluded paths]', () => {
    it('handles excluded paths correctly', async () => {
      const paths = [
        'workspace-folder-1',
        'workspace-folder-1/folder-1',
        'workspace-folder-1/folder-1/file-a',
        'workspace-folder-1/folder-1/file-b',
        'workspace-folder-1/folder-2',
        'workspace-folder-1/folder-2/file-c',
        'workspace-folder-1/file-e',
        'workspace-folder-2',
        'workspace-folder-2/file-d',
        'workspace-folder-2/file-e',
      ]

      assert.deepStrictEqual(
        (await generateExcludedPathsFromScopedAndExcludedPaths([
          '!workspace-folder-1/folder-1',
          '!workspace-folder-2/file-d',
        ], createFakeDirectoryReader(paths))).sort(),
        [
          'file-d',
          'folder-1',
        ]
      )

      assert.deepStrictEqual(
        (await generateExcludedPathsFromScopedAndExcludedPaths([
          'workspace-folder-1/folder-1',
          '!workspace-folder-1/folder-1/file-b',
        ], createFakeDirectoryReader(paths))).sort(),
        [
          'file-d',
          'file-e',
          'folder-1/file-b',
          'folder-2',
        ]
      )
    })

    it('handles file existing in multiple workspace folders', async () => {
      const paths = [
        'workspace-folder-1',
        'workspace-folder-1/folder-1',
        'workspace-folder-1/folder-1/file-a',
        'workspace-folder-1/folder-1/file-b',
        'workspace-folder-1/folder-2',
        'workspace-folder-1/folder-2/file-c',
        'workspace-folder-1/file-e',
        'workspace-folder-2',
        'workspace-folder-2/file-d',
        'workspace-folder-2/file-e',
      ]

      // If file exists in multiple workspace folders, it should not be excluded
      assert.deepStrictEqual(
        (await generateExcludedPathsFromScopedAndExcludedPaths([
          '!workspace-folder-1/file-e',
        ], createFakeDirectoryReader(paths))).sort(),
        []
      )

      // ...unless it's excluded in all of them
      assert.deepStrictEqual(
        (await generateExcludedPathsFromScopedAndExcludedPaths([
          '!workspace-folder-1/file-e',
          '!workspace-folder-2/file-e',
        ], createFakeDirectoryReader(paths))).sort(),
        [
          'file-e'
        ]
      )
    })

    // it.todo('handles folder existing in multiple workspace folders (nested files must be hidden properly)')

    // it.todo('ignores the fact that file exists in another workspace folder if that workspace folder is excluded')

    it('handles excluded workspace folders', async () => {
      const paths = [
        'workspace-folder-1',
        'workspace-folder-1/folder-1',
        'workspace-folder-1/folder-1/file-a',
        'workspace-folder-1/folder-1/file-b',
        'workspace-folder-1/folder-2',
        'workspace-folder-1/folder-2/file-c',
        'workspace-folder-1/file-e',
        'workspace-folder-2',
        'workspace-folder-2/file-d',
        'workspace-folder-2/file-e',
      ]

      // It should hide all files in an excluded workspace folder
      assert.deepStrictEqual(
        (await generateExcludedPathsFromScopedAndExcludedPaths([
          '!workspace-folder-1',
        ], createFakeDirectoryReader(paths))).sort(),
        [
          'folder-1',
          'folder-2',
          // 'file-e', // <- not excluded because it exists in another workspace folder
        ]
      )

      // ...handles multiple workspace folders as well
      assert.deepStrictEqual(
        (await generateExcludedPathsFromScopedAndExcludedPaths([
          '!workspace-folder-1',
          '!workspace-folder-2',
        ], createFakeDirectoryReader(paths))).sort(),
        [
          'file-d',
          'file-e',
          'folder-1',
          'folder-2',
        ]
      )
    })
  })

  it('regression 1', async () => {
    const paths = [
      'workspace-folder-1',
      'workspace-folder-1/file-a',
      'workspace-folder-1/file-b',
      'workspace-folder-1/folder-1',
      'workspace-folder-1/folder-1/file-d',
      'workspace-folder-1/folder-2',
      'workspace-folder-1/folder-2/file-e',
      'workspace-folder-2',
      'workspace-folder-2/file-b',
      'workspace-folder-2/file-c',
      'workspace-folder-2/folder-2',
      'workspace-folder-2/folder-2/file-f',
      'workspace-folder-2/folder-3',
      'workspace-folder-2/folder-3/file-g',
    ]

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedAndExcludedPaths([
        'workspace-folder-2/folder-2/file-f',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-a',
        'file-b',
        'file-c',
        'folder-1',
        'folder-2/file-e',
        'folder-3',
      ]
    )
  })
})