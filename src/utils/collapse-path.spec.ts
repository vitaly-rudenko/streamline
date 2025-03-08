import { collapsePath } from './collapse-path'

describe('collapsePath()', () => {
  it('collapses the path', () => {
    // Keeps as is
    expect(collapsePath('/path/to/file.service.mjs', 50)).toEqual('/path/to/file.service.mjs')
    expect(collapsePath('/path/to/file.service.mjs', 25)).toEqual('/path/to/file.service.mjs')

    // Start collapsing from the longest part of the path
    expect(collapsePath('/path/to/file.service.mjs', 24)).toEqual('/path/to/…e.service.mjs')
    expect(collapsePath('/path/to/file.service.mjs', 22)).toEqual('/path/to/…e.service.mjs')

    expect(collapsePath('/path/to/file.service.mjs', 21)).toEqual('/path/to/….service.mjs')
    expect(collapsePath('/path/to/file.service.mjs', 20)).toEqual('/path/to/…service.mjs')

    // Prioritize collapsing the last part of the path (basename)
    expect(collapsePath('/path/to/file.service.mjs', 13)).toEqual('/path/to/….mjs')
    expect(collapsePath('/path/to/file.service.mjs', 12)).toEqual('/path/to/…mjs')
    expect(collapsePath('/path/to/file.service.mjs', 10)).toEqual('/p…/to/…mjs')

    // Collapse until everything is collapsed
    expect(collapsePath('/path/to/file.service.mjs', 9)).toEqual('/p…/to/…mjs')
    expect(collapsePath('/path/to/file.service.mjs', 8)).toEqual('/p…/to/…js')
    expect(collapsePath('/path/to/file.service.mjs', 7)).toEqual('/p…/to/…s')
    expect(collapsePath('/path/to/file.service.mjs', 6)).toEqual('/p…/to/…')
    expect(collapsePath('/path/to/file.service.mjs', 5)).toEqual('/p…/…/…')
    expect(collapsePath('/path/to/file.service.mjs', 4)).toEqual('/p…/…/…')
    expect(collapsePath('/path/to/file.service.mjs', 3)).toEqual('/…/…/…')
    expect(collapsePath('/path/to/file.service.mjs', 1)).toEqual('/…/…/…')
  })
})