import assert from 'assert'
import { getPathQuery } from '../../../features/related-files/get-path-query'

suite('getPathQuery()', () => {
  test('returns a basename', () => {
    assert.strictEqual(
      getPathQuery('file', { includeSingleFolder: false }),
      'file'
    )

    assert.strictEqual(
      getPathQuery('file.js', { includeSingleFolder: false }),
      'file'
    )

    assert.strictEqual(
      getPathQuery('/hello/world/file', { includeSingleFolder: false }),
      'file'
    )

    assert.strictEqual(
      getPathQuery('/hello/world/file.js', { includeSingleFolder: false }),
      'file'
    )
  })

  test('returns a basename (paths with extra dots)', () => {
    assert.strictEqual(
      getPathQuery('/hello.world/file.module.js', { includeSingleFolder: false }),
      'file'
    )

    assert.strictEqual(
      getPathQuery('/hello.world/.file.module.js', { includeSingleFolder: false }),
      '.file'
    )
  })

  test('returns a basename (dot files)', () => {
    assert.strictEqual(
      getPathQuery('.file', { includeSingleFolder: false }),
      '.file'
    )

    assert.strictEqual(
      getPathQuery('.file.js', { includeSingleFolder: false }),
      '.file'
    )

    assert.strictEqual(
      getPathQuery('/hello/world/.file', { includeSingleFolder: false }),
      '.file'
    )

    assert.strictEqual(
      getPathQuery('/hello/world/.file.js', { includeSingleFolder: false }),
      '.file'
    )
  })

  test('returns a basename (dot folders)', () => {
    assert.strictEqual(
      getPathQuery('/.hello-world/file', { includeSingleFolder: false }),
      'file'
    )

    assert.strictEqual(
      getPathQuery('/.hello-world/file.js', { includeSingleFolder: false }),
      'file'
    )
  })

  suite('includeSingleFolder = true', () => {
    test('returns a basename', () => {
      assert.strictEqual(
        getPathQuery('file', { includeSingleFolder: true }),
        'file'
      )

      assert.strictEqual(
        getPathQuery('file.js', { includeSingleFolder: true }),
        'file'
      )

      assert.strictEqual(
        getPathQuery('/hello/world/file', { includeSingleFolder: true }),
        'world/file'
      )

      assert.strictEqual(
        getPathQuery('/hello/world/file.js', { includeSingleFolder: true }),
        'world/file'
      )
    })

    test('returns a basename (paths with extra dots)', () => {
      assert.strictEqual(
        getPathQuery('/hello.world/file.module.js', { includeSingleFolder: true }),
        'hello.world/file'
      )

      assert.strictEqual(
        getPathQuery('/hello.world/.file.module.js', { includeSingleFolder: true }),
        'hello.world/.file'
      )
    })

    test('returns a basename (dot files)', () => {
      assert.strictEqual(
        getPathQuery('.file', { includeSingleFolder: true }),
        '.file'
      )

      assert.strictEqual(
        getPathQuery('.file.js', { includeSingleFolder: true }),
        '.file'
      )

      assert.strictEqual(
        getPathQuery('/hello/world/.file', { includeSingleFolder: true }),
        'world/.file'
      )

      assert.strictEqual(
        getPathQuery('/hello/world/.file.js', { includeSingleFolder: true }),
        'world/.file'
      )
    })

    test('returns a basename (dot folders)', () => {
      assert.strictEqual(
        getPathQuery('/.hello-world/file', { includeSingleFolder: true }),
        '.hello-world/file'
      )

      assert.strictEqual(
        getPathQuery('/.hello-world/file.js', { includeSingleFolder: true }),
        '.hello-world/file'
      )
    })
  })
})