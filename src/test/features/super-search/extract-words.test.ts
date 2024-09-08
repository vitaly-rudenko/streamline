import assert from 'assert'
import { extractWords } from '../../../features/super-search/extract-words'

suite('extractWords()', () => {
  test('extracts words from a string with special characters', () => {
    assert.deepEqual(extractWords('superSearch.quickSearch()'), ['super', 'search.quick', 'search()'])
    assert.deepEqual(extractWords('do_something().when_done()'), ['do', 'something().when', 'done()'])
    assert.deepEqual(extractWords('hello-world.hello-there.good-bye!'), ['hello', 'world.hello', 'there.good', 'bye!'])
  })

  test('extracts words from a simple string', () => {
    assert.deepEqual(extractWords('camelCase'), ['camel', 'case'])
    assert.deepEqual(extractWords('PascalCase'), ['pascal', 'case'])
    assert.deepEqual(extractWords('kebab-case'), ['kebab', 'case'])
    assert.deepEqual(extractWords('snake_case'), ['snake', 'case'])
  })

  test('extracts words from a string with numbers', () => {
    assert.deepEqual(extractWords('string123With456Numbers'), ['string', '123', 'with', '456', 'numbers'])
  })

  test('extracts camelCase properly with abbreviations', () => {
    assert.deepEqual(extractWords('APascalHTMLString'), ['a', 'pascal', 'html', 'string'])
  })

  test('returns input as is for input with only one word', () => {
    assert.deepEqual(extractWords('hello'), ['hello'])
    assert.deepEqual(extractWords('123'), ['123'])
    assert.deepEqual(extractWords('function()'), ['function()'])
  })

  test('returns empty array for input with no words', () => {
    assert.deepEqual(extractWords(''), [])
    assert.deepEqual(extractWords('-_-'), [])
  })
})