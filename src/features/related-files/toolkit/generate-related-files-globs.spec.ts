import { generateRelatedFilesGlobs } from './generate-related-files-globs'

describe('generateRelatedFilesGlobs()', () => {
  it('generates glob queries for finding Related Files', () => {
    expect(
      generateRelatedFilesGlobs('/file.ts'),
    ).toEqual([
      '**/file*',
    ])

    expect(
      generateRelatedFilesGlobs('/path/to/file.ts'),
    ).toEqual([
      '**/to/file*',
      '**/file*',
    ])

    expect(
      generateRelatedFilesGlobs('/file.service.ts'),
    ).toEqual([
      '**/file.service*',
      '**/file*',
    ])

    expect(
      generateRelatedFilesGlobs('/path/to/file.service.test.ts'),
    ).toEqual([
      '**/to/file.service.test*',
      '**/file.service.test*',
      '**/to/file.service*',
      '**/file.service*',
      '**/to/file*',
      '**/file*',
    ])
  })

  it.skip('splits basename by dots, underscores, dashes and case changes', () => {
    expect(
      generateRelatedFilesGlobs('/my-ABFancyFile_helloWorld.theService.super-test.ts'),
    ).toEqual([
      '**/my-ABFancyFile_helloWorld.theService.super-test*',
      '**/my-ABFancyFile_helloWorld.theService.super*',
      '**/my-ABFancyFile_helloWorld.theService*',
      '**/my-ABFancyFile_helloWorld.the*',
      '**/my-ABFancyFile_helloWorld*',
      '**/my-ABFancyFile_hello*',
      '**/my-ABFancyFile*',
      '**/my-ABFancy*',
      '**/my-AB*',
      '**/my*',
    ])
  })

  it('correctly handles files that start with a dot', () => {
    expect(
      generateRelatedFilesGlobs('/.path/.to/.file.service.test.ts'),
    ).toEqual([
      '**/.to/.file.service.test*',
      '**/.file.service.test*',
      '**/.to/.file.service*',
      '**/.file.service*',
      '**/.to/.file*',
      '**/.file*',
    ])
  })
})