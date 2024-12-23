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
        when: [{ path: '\/src\/' }, { basename: '\\.js$' }]
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
      },
      {
        apply: ['minimal-mode'],
        when: [{ scopeSelected: 'Minimal' }]
      },
      {
        apply: ['strict-minimal-mode'],
        when: [{ scope: 'Minimal' }]
      },
      {
        apply: ['scoped-in'],
        when: [{ scopeEnabled: true }]
      }
    ]

    expect(
      getMatchingConfigNames({
        languageId: 'javascript',
        path: '/path/to/file.test.js',
        toggles: [],
        colorThemeKind: 'dark',
        scopeEnabled: false,
      }, rules)
    ).toEqual(['test-config', 'copilot', 'js-config', 'dark-theme'])

    expect(
      getMatchingConfigNames({
        languageId: 'typescriptreact',
        path: '/path/to/file.test.tsx',
        toggles: [],
        colorThemeKind: 'high-contrast',
        scopeEnabled: false,
      }, rules)
    ).toEqual(['test-config', 'copilot', 'dark-theme'])

    expect(
      getMatchingConfigNames({
        languageId: 'javascript',
        path: '/path/to/file.js',
        toggles: [],
        colorThemeKind: 'dark',
        scopeEnabled: false,
      }, rules)
    ).toEqual(['js-config', 'dark-theme'])

    expect(
      getMatchingConfigNames({
        languageId: 'typescript',
        path: '/path/to/file.ts',
        toggles: [],
        colorThemeKind: 'high-contrast-light',
        scopeEnabled: false,
      }, rules)
    ).toEqual(['light-theme'])

    expect(
      getMatchingConfigNames({
        toggles: [],
        colorThemeKind: 'high-contrast-light',
        scopeEnabled: false,
      }, rules)
    ).toEqual(['light-theme'])

    expect(
      getMatchingConfigNames({
        languageId: 'markdown',
        path: '/path/to/file.md',
        toggles: ['Copilot', 'Focus'],
        colorThemeKind: 'light',
        scopeEnabled: false,
      }, rules)
    ).toEqual(['copilot', 'focus-mode', 'light-theme'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.txt',
        toggles: ['Copilot', 'Focus'],
        colorThemeKind: 'light',
        languageId: 'plaintext',
        scopeSelected: 'Maximum',
        scopeEnabled: false,
      }, rules)
    ).toEqual(['copilot', 'focus-mode', 'light-theme', 'plain-text'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.rb',
        toggles: [],
        colorThemeKind: 'light',
        languageId: 'ruby',
        scopeSelected: 'Minimal',
        scopeEnabled: true,
      }, rules)
    ).toEqual(['light-theme', 'minimal-mode', 'strict-minimal-mode', 'scoped-in'])

    expect(
      getMatchingConfigNames({
        path: '/path/to/file.rb',
        toggles: [],
        colorThemeKind: 'light',
        languageId: 'ruby',
        scopeSelected: 'Minimal',
        scopeEnabled: false,
      }, rules)
    ).toEqual(['light-theme', 'minimal-mode'])
  })
})