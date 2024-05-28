import assert from 'assert'
import { formatPaths } from '../../utils/format-paths'

suite('formatPaths()', () => {
  test('formats tab paths', () => {
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
})