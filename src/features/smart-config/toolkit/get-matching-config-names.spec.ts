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
      {
        apply: ['light-theme'],
        when: [{ colorThemeKind: 'light' }, { colorThemeKind: 'high-contrast-light' }]
      },
      {
        apply: ['dark-theme'],
        when: [{ colorThemeKind: 'dark' }, { colorThemeKind: 'high-contrast' }]
      }
    ]

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.test.js',
        toggles: [],
        colorThemeKind: 'dark',
      }, rules)
    ).toEqual(['test-config', 'copilot', 'js-config', 'dark-theme'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.test.ts',
        toggles: [],
        colorThemeKind: 'high-contrast',
      }, rules)
    ).toEqual(['test-config', 'copilot', 'dark-theme'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.js',
        toggles: [],
        colorThemeKind: 'dark',
      }, rules)
    ).toEqual(['js-config', 'dark-theme'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.ts',
        toggles: [],
        colorThemeKind: 'high-contrast-light',
      }, rules)
    ).toEqual(['light-theme'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.txt',
        toggles: ['Copilot', 'Focus'],
        colorThemeKind: 'light',
      }, rules)
    ).toEqual(['copilot', 'focus-mode', 'light-theme'])
  })
})