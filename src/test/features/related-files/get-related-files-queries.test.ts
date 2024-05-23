import assert from 'assert'
import { getRelatedFilesQueries } from '../../../features/related-files/get-related-files-queries'

suite('getPathQuery()', () => {
  test('returns a basename', () => {
    assert.deepStrictEqual(
      getRelatedFilesQueries('file'),
      { worst: '**/file*', best: '**/file*' }
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('file.js'),
      { worst: '**/file*', best: '**/file*' }
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello/world/file'),
      { worst: '**/file*', best: '**/world/file*' }
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello/world/file.js'),
      { worst: '**/file*', best: '**/world/file*' }
    )
  })

  test('returns a basename (paths with extra dots)', () => {
    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello.world/file.module.js'),
      { worst: '**/file*', best: '**/hello.world/file*' }
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello.world/.file.module.js'),
      { worst: '**/.file*', best: '**/hello.world/.file*' }
    )
  })

  test('returns a basename (dot files)', () => {
    assert.deepStrictEqual(
      getRelatedFilesQueries('.file'),
      { worst: '**/.file*', best: '**/.file*' }
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('.file.js'),
      { worst: '**/.file*', best: '**/.file*' }
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello/world/.file'),
      { worst: '**/.file*', best: '**/world/.file*' }
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello/world/.file.js'),
      { worst: '**/.file*', best: '**/world/.file*' }
    )
  })

  test('returns a basename (dot folders)', () => {
    assert.deepStrictEqual(
      getRelatedFilesQueries('/.hello-world/file'),
      { worst: '**/file*', best: '**/.hello-world/file*' }
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/.hello-world/file.js'),
      { worst: '**/file*', best: '**/.hello-world/file*' }
    )
  })
})