import assert from 'assert'
import { extractWords } from '../../../features/super-search/extract-words'

suite('extractWords()', () => {
  test('extracts words from a camelCase string', () => {
    assert.deepEqual(extractWords('camelCaseString'), ['camel', 'case', 'string'])
  })

  test('extracts words from a snake_case string', () => {
    assert.deepEqual(extractWords('snake_case_string'), ['snake', 'case', 'string'])
  })

  test('extracts words from a kebab-case string', () => {
    assert.deepEqual(extractWords('kebab-case-string'), ['kebab', 'case', 'string'])
  })

  test('extracts words from a PascalCase string', () => {
    assert.deepEqual(extractWords('PascalCaseString'), ['pascal', 'case', 'string'])
    assert.deepEqual(extractWords('APascalHTMLString'), ['a', 'pascal', 'html', 'string'])
  })

  test('extracts words from a string with mixed separators', () => {
    assert.deepEqual(extractWords('mixed-separators_string'), ['mixed', 'separators', 'string'])
  })

  test('extracts words from a string with numbers', () => {
    assert.deepEqual(extractWords('string123With456Numbers'), ['string', '123', 'with', '456', 'numbers'])
  })

  test('extracts words from a string with special characters', () => {
    assert.deepEqual(extractWords('string!@#$%^&*()WithSpecialChars'), ['string', 'with', 'special', 'chars'])
    assert.deepEqual(extractWords('first.last@example.com'), ['first', 'last', 'example', 'com'])
  })

  test('extracts words from a string with leading and trailing separators', () => {
    assert.deepEqual(extractWords('_leading_and_trailing_'), ['leading', 'and', 'trailing'])
  })

  test('extracts words from a string with multiple consecutive separators', () => {
    assert.deepEqual(extractWords('multiple__consecutive___separators'), ['multiple', 'consecutive', 'separators'])
  })

  test('returns empty array for empty input', () => {
    assert.deepEqual(extractWords(''), [])
  })

  test('returns empty array for input with no words', () => {
    assert.deepEqual(extractWords('---__#$@!%-!@'), [])
  })
})