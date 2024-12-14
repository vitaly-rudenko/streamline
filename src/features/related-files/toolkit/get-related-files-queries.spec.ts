import assert from 'assert'
import { getRelatedFilesQueries } from './get-related-files-queries'

const excludedSuffixes = ['test', 'js']

describe('getPathQuery()', () => {
  it('returns a basename', () => {
    assert.deepStrictEqual(
      getRelatedFilesQueries('file', excludedSuffixes),
      ['**/file*', '**/*file*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('file.js', excludedSuffixes),
      ['**/file*', '**/*file*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello/world/file', excludedSuffixes),
      ['**/world/file*', '**/*file*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello/world/file.js', excludedSuffixes),
      ['**/world/file*', '**/*file*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello/world/file.module.js', excludedSuffixes),
      ['**/world/file.module*', '**/world/file*', '**/*file.module*']
    )
  })

  it('returns a basename (paths with extra dots)', () => {
    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello.world/file.module.js', excludedSuffixes),
      ['**/hello.world/file.module*', '**/hello.world/file*', '**/*file.module*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello.world/.file.module.test.js', excludedSuffixes),
      ['**/hello.world/.file.module*', '**/hello.world/.file*', '**/*.file.module*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello.world/.file.module.js', excludedSuffixes),
      ['**/hello.world/.file.module*', '**/hello.world/.file*', '**/*.file.module*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello.world/.file.module.test.js', excludedSuffixes),
      ['**/hello.world/.file.module*', '**/hello.world/.file*', '**/*.file.module*']
    )
  })

  it('returns a basename (dot files)', () => {
    assert.deepStrictEqual(
      getRelatedFilesQueries('.file', excludedSuffixes),
      ['**/.file*', '**/*.file*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('.file.js', excludedSuffixes),
      ['**/.file*', '**/*.file*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello/world/.file', excludedSuffixes),
      ['**/world/.file*', '**/*.file*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/hello/world/.file.js', excludedSuffixes),
      ['**/world/.file*', '**/*.file*']
    )
  })

  it('returns a basename (dot folders)', () => {
    assert.deepStrictEqual(
      getRelatedFilesQueries('/.hello-world/file', excludedSuffixes),
      ['**/.hello-world/file*', '**/*file*']
    )

    assert.deepStrictEqual(
      getRelatedFilesQueries('/.hello-world/file.js', excludedSuffixes),
      ['**/.hello-world/file*', '**/*file*']
    )
  })
})