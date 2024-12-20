import { Rule } from '../common'
import { getMatchingConfigNames } from './get-matching-config-names'

describe('getMatchingConfigNames()', () => {
  it('returns matching config names', () => {
    const rules: Rule[] = [
      {
        apply: ['test-config', 'copilot'],
        when: [{ basename: '\\.test\\.(js|tsx?)$' }]
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
      },
      {
        apply: ['plain-text'],
        when: [{ languageId: 'plaintext' }]
      }
    ]

    expect(
      getMatchingConfigNames({
        languageId: 'javascript',
        path: '/path/to/file.test.js',
        toggles: [],
        colorThemeKind: 'dark',
      }, rules)
    ).toEqual(['test-config', 'copilot', 'js-config', 'dark-theme'])

    expect(
      getMatchingConfigNames({
        languageId: 'typescriptreact',
        path: '/path/to/file.test.tsx',
        toggles: [],
        colorThemeKind: 'high-contrast',
      }, rules)
    ).toEqual(['test-config', 'copilot', 'dark-theme'])

    expect(
      getMatchingConfigNames({
        languageId: 'javascript',
        path: '/path/to/file.js',
        toggles: [],
        colorThemeKind: 'dark',
      }, rules)
    ).toEqual(['js-config', 'dark-theme'])

    expect(
      getMatchingConfigNames({
        languageId: 'typescript',
        path: '/path/to/file.ts',
        toggles: [],
        colorThemeKind: 'high-contrast-light',
      }, rules)
    ).toEqual(['light-theme'])

    expect(
      getMatchingConfigNames({
        toggles: [],
        colorThemeKind: 'high-contrast-light',
      }, rules)
    ).toEqual(['light-theme'])

    expect(
      getMatchingConfigNames({
        languageId: 'markdown',
        path: '/path/to/file.md',
        toggles: ['Copilot', 'Focus'],
        colorThemeKind: 'light',
      }, rules)
    ).toEqual(['copilot', 'focus-mode', 'light-theme'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.txt',
        toggles: ['Copilot', 'Focus'],
        colorThemeKind: 'light',
        languageId: 'plaintext'
      }, rules)
    ).toEqual(['copilot', 'focus-mode', 'light-theme', 'plain-text'])
  })
})