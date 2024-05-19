import assert from 'assert'
import { formatTabPaths } from '../../../features/tab-history/format-tab-paths'
import type { Tab } from '../../../features/tab-history/types'

function tab(partial: Partial<Tab>): Tab {
  return { path: '/test.json', openedAt: Date.now(), ...partial }
}

suite('formatTabPaths()', () => {
  test('formats tab paths', () => {
    const tabs = [
      tab({ path: '/Users/user/project-1/index.js' }),
      tab({ path: '/Users/user/project-1/package.json' }),
      tab({ path: '/Users/user/project-1/package-lock.json' }),
      tab({ path: '/Users/user/project-2/package.json' }),
      tab({ path: '/Users/another-user/project-1/package-lock.json' }),
      tab({ path: '/Users/user/project-1/dist/index.js' }),
    ]

    assert.deepEqual(
      formatTabPaths(tabs),
      [
        [tabs[0], 'index.js'],
        [tabs[1], 'project-1/package.json'],
        [tabs[2], 'user/project-1/package-lock.json'],
        [tabs[3], 'project-2/package.json'],
        [tabs[4], 'another-user/project-1/package-lock.json'],
        [tabs[5], 'dist/index.js'],
      ]
    )
  })
})