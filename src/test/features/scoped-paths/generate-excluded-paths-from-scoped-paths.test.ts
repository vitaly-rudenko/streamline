import assert from 'assert'
import { generateExcludedPathsFromScopedPaths } from '../../../features/scoped-paths/generate-excluded-paths-from-scoped-paths'
import type { DirectoryReader } from '../../../utils/types'

function createFakeDirectoryReader(paths: string[]): DirectoryReader {
  return {
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

suite('createFakeDirectoryReader()', () => {
  test('creates a valid fake directory reader', async () => {
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

suite('generateExcludedPathsFromScopedPaths()', () => {
  test('single workspace folder', async () => {
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
      await generateExcludedPathsFromScopedPaths([], createFakeDirectoryReader(paths)),
      []
    )

    assert.deepStrictEqual(
      await generateExcludedPathsFromScopedPaths([
        'workspace-folder-1',
      ], createFakeDirectoryReader(paths)),
      []
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedPaths([
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
      (await generateExcludedPathsFromScopedPaths([
        'workspace-folder-1/folder-2',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-1',
        'file-2',
        'folder-1',
      ]
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedPaths([
        'workspace-folder-1/file-2',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-1',
        'folder-1',
        'folder-2',
      ]
    )
  })

  test('hides all files from other unscoped workspace folders', async () => {
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
      (await generateExcludedPathsFromScopedPaths([
        'workspace-folder-1',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-2',
        'file-3',
        'folder-2',
      ]
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedPaths([
        'workspace-folder-1',
        'workspace-folder-2',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-3',
        'folder-2',
      ]
    )

    assert.deepStrictEqual(
      await generateExcludedPathsFromScopedPaths([
        'workspace-folder-2',
        'workspace-folder-3',
      ], createFakeDirectoryReader(paths)),
      []
    )
  })

  test('handles nested folders correctly', async () => {
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
      (await generateExcludedPathsFromScopedPaths([
        'workspace-folder-2',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-a',
      ]
    )

    assert.deepStrictEqual(
      (await generateExcludedPathsFromScopedPaths([
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
      (await generateExcludedPathsFromScopedPaths([
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
      (await generateExcludedPathsFromScopedPaths([
        'workspace-folder-2/file-b',
      ], createFakeDirectoryReader(paths))).sort(),
      [
        'file-a',
        'file-c',
        'folder',
      ]
    )
  })

  test('regression 1', async () => {
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
      (await generateExcludedPathsFromScopedPaths([
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