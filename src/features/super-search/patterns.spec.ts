import assert from 'assert'
import { patterns } from './patterns'

const words = ['foo', 'bar', 'baz']
const escapableWords = ['function', 'foo.bar()']
const input = `\
1. foo bar baz
2. foobar qux baz
3. foo bar\nbaz
4. foo, bar and baz!
5. foo\n bar baz
6. Hello Foo! Hi bar. Bye BAZ...
7. F oo B ar B az
8. Bar-foo-Baz!
9. Hi bar, baz and foo
10. bar\nfoo\nbaz
11. foo\nbar\nbaz
12. foo-bar-baz
13. foo_bar_baz
14. FooBarBaz
15. fooBarBaz
16. FOO_BAR_BAZ
17. foo-bar
18. foo-bar-qux
19. foo bar baz
20. foo.bar.baz`

function testPattern(pattern: string, input: string) {
  return new RegExp(pattern, 'ig').test(input)
}

const options = {
  matchWholeWord: false,
  escapeRegex: true,
}

describe('patterns', () => {
  it('findLinesWithAllWordsInProvidedOrder()', () => {
    const pattern = patterns.findLinesWithAllWordsInProvidedOrder(words)

    assert.deepEqual(input.match(new RegExp(pattern, 'ig')), [
      'foo bar baz',
      'foobar qux baz',
      'foo, bar and baz',
      'Foo! Hi bar. Bye BAZ',
      'foo-bar-baz',
      'foo_bar_baz',
      'FooBarBaz',
      'fooBarBaz',
      'FOO_BAR_BAZ',
      'foo bar baz',
      'foo.bar.baz',
    ])

    assert.ok(!testPattern(pattern, 'foo\nbar\nbaz'))

    const escapedPattern = patterns.findLinesWithAllWordsInProvidedOrder(escapableWords, options)
    assert.ok(testPattern(escapedPattern, 'function foo.bar()'))
    assert.ok(!testPattern(escapedPattern, 'function foo_bar()'))
    assert.ok(!testPattern(escapedPattern, 'function foo.bar[]'))
  })

  it('findLinesWithAllWordsInAnyOrder()', () => {
    const pattern = patterns.findLinesWithAllWordsInProvidedOrder(words)

    assert.deepEqual(input.match(new RegExp(pattern, 'ig')), [
      'foo bar baz',
      'foobar qux baz',
      'foo, bar and baz',
      'Foo! Hi bar. Bye BAZ',
      'foo-bar-baz',
      'foo_bar_baz',
      'FooBarBaz',
      'fooBarBaz',
      'FOO_BAR_BAZ',
      'foo bar baz',
      'foo.bar.baz',
    ])

    assert.ok(!testPattern(pattern, 'foo\nbar\nbaz'))

    const escapedPattern = patterns.findLinesWithAllWordsInProvidedOrder(escapableWords, options)
    assert.ok(testPattern(escapedPattern, 'function foo.bar()'))
    assert.ok(!testPattern(escapedPattern, 'function foo_bar()'))
    assert.ok(!testPattern(escapedPattern, 'function foo.bar[]'))
  })

  it('findFilesWithAllWordsInProvidedOrder()', () => {
    const pattern = patterns.findFilesWithAllWordsInProvidedOrder(words)

    assert.ok(testPattern(pattern, input))

    assert.ok(testPattern(pattern, 'foo-barbaz'))
    assert.ok(testPattern(pattern, 'foo\nbar_baz'))
    assert.ok(testPattern(pattern, 'Hello foo!\nHi bar. Bye baz...'))

    assert.ok(!testPattern(pattern, 'foo-bar'))
    assert.ok(!testPattern(pattern, 'bar baz'))
    assert.ok(!testPattern(pattern, 'barbaz-foo'))
    assert.ok(!testPattern(pattern, 'bar \n bazfoo'))
    assert.ok(!testPattern(pattern, 'Hello bar!\n Hi foo. Bye baz...'))
    assert.ok(!testPattern(pattern, 'f oo bar baz'))

    assert.ok(testPattern(pattern, 'foo\nbar\nbaz'))

    const escapedPattern = patterns.findFilesWithAllWordsInProvidedOrder(escapableWords, options)
    assert.ok(testPattern(escapedPattern, 'function foo.bar()'))
    assert.ok(!testPattern(escapedPattern, 'function foo_bar()'))
    assert.ok(!testPattern(escapedPattern, 'function foo.bar[]'))
  })

  it('findFilesWithAllWordsInAnyOrder()', () => {
    const pattern = patterns.findFilesWithAllWordsInAnyOrder(words)

    assert.ok(testPattern(pattern, input))

    assert.ok(testPattern(pattern, 'foo-barbaz'))
    assert.ok(testPattern(pattern, 'foo \nbar_baz'))
    assert.ok(testPattern(pattern, 'Hello foo!\nHi bar. Bye baz...'))
    assert.ok(testPattern(pattern, 'bazbar-fooqux'))
    assert.ok(testPattern(pattern, 'bar \nbazfoo'))
    assert.ok(testPattern(pattern, 'Hello bar!\nHi foo. Bye baz...'))

    assert.ok(!testPattern(pattern, 'foo-bar'))
    assert.ok(!testPattern(pattern, 'bar baz'))
    assert.ok(!testPattern(pattern, 'f oo bar baz'))

    assert.ok(testPattern(pattern, 'foo\nbar\nbaz'))

    const escapedPattern = patterns.findFilesWithAllWordsInAnyOrder(escapableWords, options)
    assert.ok(testPattern(escapedPattern, 'function foo.bar()'))
    assert.ok(!testPattern(escapedPattern, 'function foo_bar()'))
    assert.ok(!testPattern(escapedPattern, 'function foo.bar[]'))
  })
})