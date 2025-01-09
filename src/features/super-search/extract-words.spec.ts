import assert from 'assert'
import { extractWords } from './extract-words'

describe('extractWords()', () => {
  it('extracts words from a string with special characters', () => {
    assert.deepEqual(extractWords('superSearch.quickSearch()'), ['super', 'Search.quick', 'Search()'])
    assert.deepEqual(extractWords('do_something().when_done()'), ['do', 'something().when', 'done()'])
    assert.deepEqual(extractWords('hello-world.hello-there.good-bye!'), ['hello', 'world.hello', 'there.good', 'bye!'])
  })

  it('extracts words from a simple string', () => {
    assert.deepEqual(extractWords('camelCase'), ['camel', 'Case'])
    assert.deepEqual(extractWords('PascalCase'), ['Pascal', 'Case'])
    assert.deepEqual(extractWords('kebab-case'), ['kebab', 'case'])
    assert.deepEqual(extractWords('snake_case'), ['snake', 'case'])
  })

  it('extracts words from a string with numbers', () => {
    assert.deepEqual(extractWords('string123With456Numbers'), ['string', '123', 'With', '456', 'Numbers'])
  })

  it('extracts camelCase properly with abbreviations', () => {
    assert.deepEqual(extractWords('APascalHTMLString'), ['A', 'Pascal', 'HTML', 'String'])
  })

  it('returns input as is for input with only one word', () => {
    assert.deepEqual(extractWords('hello'), ['hello'])
    assert.deepEqual(extractWords('123'), ['123'])
    assert.deepEqual(extractWords('function()'), ['function()'])
  })

  it('returns empty array for input with no words', () => {
    assert.deepEqual(extractWords(''), [])
    assert.deepEqual(extractWords('-_-'), [])
  })
})