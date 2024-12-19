import { Rule } from '../common'
import { getMatchingConfigNames } from './get-matching-config-names'

describe('getMatchingConfigNames()', () => {
  it('returns matching config names', () => {
    const rules: Rule[] = [
      {
        apply: ['test-config', 'copilot'],
        when: [{ basename: '\\.test\\.(js|ts)$' }]
      },
      {
        apply: ['copilot'],
        when: [{ toggle: 'Copilot' }]
      },
      {
        apply: ['js-config'],
        when: [
          { path: '\/src\/' },
          { basename: '\\.js$' },
        ]
      },
      {
        apply: ['focus-mode'],
        when: [{ toggle: 'Focus' }]
      },
    ]

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.test.js',
        toggles: [],
      }, rules)
    ).toEqual(['test-config', 'copilot', 'js-config'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.test.ts',
        toggles: [],
      }, rules)
    ).toEqual(['test-config', 'copilot'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.js',
        toggles: [],
      }, rules)
    ).toEqual(['js-config'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.ts',
        toggles: [],
      }, rules)
    ).toEqual([])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.txt',
        toggles: ['Copilot', 'Focus'],
      }, rules)
    ).toEqual(['copilot', 'focus-mode'])
  })
})