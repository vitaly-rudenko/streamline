import assert from 'assert'
import { getParents } from './get-parents'

describe('getParents()', () => {
  it('returns parents of the given file', () => {
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