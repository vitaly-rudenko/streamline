import { Condition, ConditionContext, testWhen, When, whenSchema } from './when'

type Rule = {
  apply: string[]
  when: When
}

function createConditionContext(attributes?: Partial<ConditionContext>): ConditionContext {
  return {
    colorThemeKind: 'light',
    scopeEnabled: false,
    toggles: [],
    ...attributes,
  }
}

describe('testWhen()', () => {
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
      },
      {
        apply: ['untitled-javascript'],
        when: [{ untitled: true, languageId: 'javascript' }]
      }
    ]

    function getMatchingConfigNames(context: ConditionContext, rules: Rule[]): string[] {
      return rules
        .filter(rule => testWhen(context, rule.when))
        .flatMap(rule => rule.apply)
    }

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

    // AND conditions

    expect(
      getMatchingConfigNames({
        untitled: true,
        languageId: 'javascript',
        toggles: [],
        colorThemeKind: 'dark',
        scopeEnabled: false,
      }, rules)
    ).toContain('untitled-javascript')

    expect(
      getMatchingConfigNames({
        untitled: true,
        languageId: 'typescript',
        toggles: [],
        colorThemeKind: 'dark',
        scopeEnabled: false,
      }, rules)
    ).not.toContain('untitled-javascript')

    expect(
      getMatchingConfigNames({
        untitled: false,
        languageId: 'javascript',
        toggles: [],
        colorThemeKind: 'dark',
        scopeEnabled: false,
      }, rules)
    ).not.toContain('untitled-javascript')
  })

  it('supports basic negated conditions', () => {
    function testNegation(context: ConditionContext, condition: Condition) {
      expect(testWhen(context, [condition])).toBe(true)
      expect(testWhen(context, [{ not: condition }])).toBe(false)
    }

    testNegation(createConditionContext({ path: '/path/to/file.js' }), { basename: '\.js$' })
    testNegation(createConditionContext({ path: '/path/to/file.js' }), { path: '\/path\/to\/' })
    testNegation(createConditionContext({ colorThemeKind: 'high-contrast' }), { colorThemeKind: 'high-contrast' })
    testNegation(createConditionContext({ scopeSelected: 'Minimal', scopeEnabled: true }), { scope: 'Minimal' })
  })

  it('supports condition with added negation', () => {
    const when = [{ path: '\/path\/', not: { basename: '\.js' } }]

    expect(testWhen(createConditionContext({ path: '/path/to/file.ts' }), when)).toBe(true)
    expect(testWhen(createConditionContext({ path: '/path/to/file.js' }), when)).toBe(false)
  })

  it('returns true when conditions list is empty', () => {
    expect(testWhen({
      colorThemeKind: 'dark',
      scopeEnabled: false,
      toggles: [],
    }, [])).toBe(true)
  })

  it('validates "when" (schema)', () => {
    expect(whenSchema.safeParse([]).success).toBe(true)
    expect(whenSchema.safeParse([{ basename: 'file.mjs' }]).success).toBe(true)

    expect(whenSchema.safeParse([{}]).success).toBe(false)
    expect(whenSchema.safeParse([{ not: {} }]).success).toBe(false)
  })
})