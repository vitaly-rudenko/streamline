import assert from 'assert'
import { getSharedPath } from '../../utils/get-shared-path'

suite('getSharedPaths()', () => {
  test('returns the shared path for given paths', () => {
    assert.deepEqual(
      getSharedPath([
        '/Users/user/project/package.json',
        '/Users/user/another-project/package.json',
      ]),
      '/Users/user',
    )
  })

  test('returns the shared path for given paths (root)', () => {
    assert.deepEqual(
      getSharedPath([
        '/Users/user/project/package.json',
        '/Another-User/user/another-project/package.json',
      ]),
      '',
    )
  })

  test('returns the shared path for given paths (single path)', () => {
    assert.deepEqual(
      getSharedPath([
        '/Users/user/project/package.json',
      ]),
      '/Users/user/project',
    )
  })
})