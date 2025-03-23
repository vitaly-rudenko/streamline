import { collapsePath } from './collapse-path'

describe('collapsePath()', () => {
  it('collapses the path', () => {
    // Keeps as is
    expect(collapsePath('/path/to/file.service.mjs', 50)).toEqual('/path/to/file.service.mjs')
    expect(collapsePath('/path/to/file.service.mjs', 25)).toEqual('/path/to/file.service.mjs')

    // Start collapsing from the longest part of the path
    expect(collapsePath('/path/to/file.service.mjs', 24)).toEqual('/path/to/⸱⸱⸱e.service.mjs')
    expect(collapsePath('/path/to/file.service.mjs', 22)).toEqual('/path/to/⸱⸱⸱e.service.mjs')

    expect(collapsePath('/path/to/file.service.mjs', 21)).toEqual('/path/to/⸱⸱⸱.service.mjs')
    expect(collapsePath('/path/to/file.service.mjs', 20)).toEqual('/path/to/⸱⸱⸱service.mjs')

    // Prioritize collapsing the last part of the path (basename)
    expect(collapsePath('/path/to/file.service.mjs', 13)).toEqual('/path/to/⸱⸱⸱.mjs')
    expect(collapsePath('/path/to/file.service.mjs', 12)).toEqual('/path/to/⸱⸱⸱mjs')
    expect(collapsePath('/path/to/file.service.mjs', 11)).toEqual('/p⸱⸱⸱/to/⸱⸱⸱mjs')
    expect(collapsePath('/path/to/file.service.mjs', 10)).toEqual('/p⸱⸱⸱/to/⸱⸱⸱mjs')
    expect(collapsePath('/path/to/file.service.mjs', 9)).toEqual('/p⸱⸱⸱/to/⸱⸱⸱mjs')

    // Collapse until everything is collapsed
    expect(collapsePath('/path/to/file.service.mjs', 8)).toEqual('/p⸱⸱⸱/to/⸱⸱⸱js')
    expect(collapsePath('/path/to/file.service.mjs', 6)).toEqual('/p⸱⸱⸱/⸱⸱⸱/⸱⸱⸱s')
    expect(collapsePath('/path/to/file.service.mjs', 5)).toEqual('/p⸱⸱⸱/⸱⸱⸱/⸱⸱⸱s')
    expect(collapsePath('/path/to/file.service.mjs', 4)).toEqual('/⸱⸱⸱/⸱⸱⸱/⸱⸱⸱s')
    expect(collapsePath('/path/to/file.service.mjs', 3)).toEqual('/⸱⸱⸱/⸱⸱⸱/⸱⸱⸱')
    expect(collapsePath('/path/to/file.service.mjs', 1)).toEqual('/⸱⸱⸱/⸱⸱⸱/⸱⸱⸱')
  })

  it('tries to keep the extension', () => {
    expect(collapsePath('/very-long-path/to/file.service.js', 22)).toEqual('/very-long-path/to/⸱⸱⸱.js')
    expect(collapsePath('/very-long-path/to/file.service.js', 21)).toEqual('/very-long-p⸱⸱⸱/to/⸱⸱⸱.js')
    expect(collapsePath('/very-long-path/to/file.service.js', 10)).toEqual('/ve⸱⸱⸱/to/⸱⸱⸱.js')
    expect(collapsePath('/very-long-path/to/file.service.js', 9)).toEqual('/ve⸱⸱⸱/to/⸱⸱⸱js')
    expect(collapsePath('/very-long-path/to/file.service.js', 8)).toEqual('/v⸱⸱⸱/to/⸱⸱⸱js')
    expect(collapsePath('/very-long-path/to/file.service.js', 7)).toEqual('/v⸱⸱⸱/to/⸱⸱⸱s')
    expect(collapsePath('/very-long-path/to/file.service.js', 6)).toEqual('/v⸱⸱⸱/⸱⸱⸱/⸱⸱⸱s')
    expect(collapsePath('/very-long-path/to/file.service.js', 5)).toEqual('/v⸱⸱⸱/⸱⸱⸱/⸱⸱⸱s')
    expect(collapsePath('/very-long-path/to/file.service.js', 4)).toEqual('/⸱⸱⸱/⸱⸱⸱/⸱⸱⸱s')
    expect(collapsePath('/very-long-path/to/file.service.js', 3)).toEqual('/⸱⸱⸱/⸱⸱⸱/⸱⸱⸱')
  })
})