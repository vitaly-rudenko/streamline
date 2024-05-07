import assert from 'assert'
import { getParents } from '../../utils/get-parents'

suite('getParents()', () => {
  test('returns parents of the given file', () => {
    assert.deepStrictEqual(
      getParents('A/B/C/D'),
      [
        'A/B/C',
        'A/B',
        'A',
        '',
      ]
    )
  })
})