import assert from 'assert'
import { patterns } from '../../../features/super-search/patterns'

suite('patterns', () => {
  test('findInAllNamingConventions()', () => {
    const pattern = patterns.findInAllNamingConventions(['foo', 'bar', 'baz'])
    assert.strictEqual(pattern, 'foo[-_]?bar[-_]?baz')

    const regex = new RegExp(pattern, 'i')
    assert.ok(regex.test('foo-bar-baz'))
    assert.ok(regex.test('foo_bar_baz'))
    assert.ok(regex.test('FooBarBaz'))
    assert.ok(regex.test('fooBarBaz'))
    assert.ok(regex.test('FOO_BAR_BAZ'))
  })

  test('findLinesWithAllWordsInProvidedOrder()', () => {
    const pattern = patterns.findLinesWithAllWordsInProvidedOrder(['foo', 'bar', 'baz'])
    assert.strictEqual(pattern, 'foo.*bar.*baz')

    const regex = new RegExp(pattern, 'i')
    assert.ok(regex.test('foo bar baz'))
    assert.ok(regex.test('foo bar baz qux'))
    assert.ok(regex.test('foo qux bar baz'))
  })

  test('findLinesWithAllWordsInAnyOrder()', () => {
    const pattern = patterns.findLinesWithAllWordsInAnyOrder(['foo', 'bar', 'baz'])
    assert.strictEqual(pattern, '^(?=[\\s\\S]*(foo))(?=[\\s\\S]*(bar))(?=[\\s\\S]*(baz))[\\s\\S]*$')

    const regex = new RegExp(pattern, 'i')
    assert.ok(regex.test('foo bar baz'))
    assert.ok(regex.test('foo baz bar'))
    assert.ok(regex.test('bar foo baz'))
    assert.ok(regex.test('bar baz foo'))
    assert.ok(regex.test('baz foo bar'))
    assert.ok(regex.test('baz bar foo'))
  })

  test('findFilesWithAllWordsInProvidedOrder()', () => {
    const pattern = patterns.findFilesWithAllWordsInProvidedOrder(['foo', 'bar', 'baz'])
    assert.strictEqual(pattern, 'foo.*bar.*baz')

    const regex = new RegExp(pattern, 'i')
    assert.ok(regex.test('foo bar baz'))
    assert.ok(regex.test('foo bar baz qux'))
    assert.ok(regex.test('foo qux bar baz'))
  })

  test('findFilesWithAllWordsInAnyOrder()', () => {
    const pattern = patterns.findFilesWithAllWordsInAnyOrder(['foo', 'bar', 'baz'])
    assert.strictEqual(pattern, '^(?=[\\s\\S\\n]*(foo))(?=[\\s\\S\\n]*(bar))(?=[\\s\\S\\n]*(baz))[\\s\\S\\n]*$')

    const regex = new RegExp(pattern, 'i')
    assert.ok(regex.test('foo bar baz'))
    assert.ok(regex.test('foo baz bar'))
    assert.ok(regex.test('bar foo baz'))
    assert.ok(regex.test('bar baz foo'))
    assert.ok(regex.test('baz foo bar'))
    assert.ok(regex.test('baz bar foo'))
  })
})