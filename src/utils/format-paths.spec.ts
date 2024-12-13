import assert from 'assert'
import { formatPaths } from './format-paths'

describe('formatPaths()', () => {
  it('formats paths (truly absolute)', () => {
    const paths = [
      '/Users/user/project-1/index.js',
      '/Users/user/project-1/package.json',
      '/Users/user/project-1/package-lock.json',
      '/Users/user/project-2/package.json',
      '/Users/another-user/project-1/package-lock.json',
      '/Users/user/project-1/dist/index.js',
    ]

    assert.deepEqual(
      [...formatPaths(paths).entries()],
      [
        [paths[0], 'index.js'],
        [paths[1], 'project-1/package.json'],
        [paths[2], 'user/project-1/package-lock.json'],
        [paths[3], 'project-2/package.json'],
        [paths[4], 'another-user/project-1/package-lock.json'],
        [paths[5], 'dist/index.js'],
      ]
    )
  })

  it('formats paths (workspace absolute)', () => {
    const paths = [
      'workspace-folder-1/project-1/index.js',
      'workspace-folder-1/project-1/package.json',
      'workspace-folder-1/project-1/package-lock.json',
      'workspace-folder-1/project-2/package.json',
      'workspace-folder-2/project-1/package-lock.json',
      'workspace-folder-1/project-1/dist/index.js',
    ]

    assert.deepEqual(
      [...formatPaths(paths).entries()],
      [
        [paths[0], 'index.js'],
        [paths[1], 'project-1/package.json'],
        [paths[2], 'workspace-folder-1/project-1/package-lock.json'],
        [paths[3], 'project-2/package.json'],
        [paths[4], 'workspace-folder-2/project-1/package-lock.json'],
        [paths[5], 'dist/index.js'],
      ]
    )
  })
})