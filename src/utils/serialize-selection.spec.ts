import { serializeSelection } from './serialize-selection'

describe('serializeSelection', () => {
  it('serializes selection with same anchor and active positions', () => {
    const selection = {
      anchor: { line: 10, character: 5 },
      active: { line: 10, character: 5 }
    }

    expect(serializeSelection(selection as any)).toBe('10:5-10:5')
  })

  it('serializes selection with different anchor and active positions', () => {
    const selection = {
      anchor: { line: 10, character: 5 },
      active: { line: 12, character: 20 }
    }

    expect(serializeSelection(selection as any)).toBe('10:5-12:20')
  })

  it('serializes selection with zero values', () => {
    const selection = {
      anchor: { line: 0, character: 0 },
      active: { line: 0, character: 0 }
    }

    expect(serializeSelection(selection as any)).toBe('0:0-0:0')
  })

  it('serializes selection with reversed positions (active before anchor)', () => {
    const selection = {
      anchor: { line: 20, character: 30 },
      active: { line: 10, character: 5 }
    }

    expect(serializeSelection(selection as any)).toBe('20:30-10:5')
  })
})