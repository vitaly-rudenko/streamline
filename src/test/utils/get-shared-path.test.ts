import assert from 'assert'
import { getSharedPath } from '../../utils/get-shared-path'

suite('getSharedPath()', () => {
  suite('[truly absolute]', () => {
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

  suite('[workspace absolute]', () => {
    test('returns the shared path for given paths', () => {
      assert.deepEqual(
        getSharedPath([
          'workspace-folder-1/project/package.json',
          'workspace-folder-1/another-project/package.json',
        ]),
        'workspace-folder-1',
      )
    })

    test('returns the shared path for given paths (root)', () => {
      assert.deepEqual(
        getSharedPath([
          'workspace-folder-1/project/package.json',
          'workspace-folder-2/another-project/package.json',
        ]),
        '',
      )
    })

    test('returns the shared path for given paths (single path)', () => {
      assert.deepEqual(
        getSharedPath([
          'workspace-folder-1/project/package.json',
        ]),
        'workspace-folder-1/project',
      )
    })
  })
})