import assert from 'assert'
import { getSharedPath } from './get-shared-path'

describe('getSharedPath()', () => {
  describe('[truly absolute]', () => {
    it('returns the shared path for given paths', () => {
      assert.deepEqual(
        getSharedPath([
          '/Users/user/project/package.json',
          '/Users/user/another-project/package.json',
        ]),
        '/Users/user',
      )
    })

    it('returns the shared path for given paths (root)', () => {
      assert.deepEqual(
        getSharedPath([
          '/Users/user/project/package.json',
          '/Another-User/user/another-project/package.json',
        ]),
        '',
      )
    })

    it('returns the shared path for given paths (single path)', () => {
      assert.deepEqual(
        getSharedPath([
          '/Users/user/project/package.json',
        ]),
        '/Users/user/project',
      )
    })
  })

  describe('[workspace absolute]', () => {
    it('returns the shared path for given paths', () => {
      assert.deepEqual(
        getSharedPath([
          'workspace-folder-1/project/package.json',
          'workspace-folder-1/another-project/package.json',
        ]),
        'workspace-folder-1',
      )
    })

    it('returns the shared path for given paths (root)', () => {
      assert.deepEqual(
        getSharedPath([
          'workspace-folder-1/project/package.json',
          'workspace-folder-2/another-project/package.json',
        ]),
        '',
      )
    })

    it('returns the shared path for given paths (single path)', () => {
      assert.deepEqual(
        getSharedPath([
          'workspace-folder-1/project/package.json',
        ]),
        'workspace-folder-1/project',
      )
    })
  })
})