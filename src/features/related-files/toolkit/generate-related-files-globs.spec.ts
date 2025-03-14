import { generateRelatedFilesGlobs } from './generate-related-files-globs'

describe('generateRelatedFilesGlobs()', () => {
  it('generates glob queries for finding Related Files', () => {
    expect(
      generateRelatedFilesGlobs('/file.ts'),
    ).toEqual([
      '**/file*',
      '**/*file*',
    ])

    expect(
      generateRelatedFilesGlobs('/path/to/file.ts'),
    ).toEqual([
      '**/to/file*',
      '**/file*',
      '**/to/*file*',
      '**/*file*',
    ])

    expect(
      generateRelatedFilesGlobs('/file.service.ts'),
    ).toEqual([
      '**/file.service*',
      '**/*file.service*',
      '**/file*',
      '**/*file*',
    ])

    expect(
      generateRelatedFilesGlobs('/path/to/file.service.test.ts'),
    ).toEqual([
      '**/to/file.service.test*',
      '**/file.service.test*',
      '**/to/*file.service.test*',
      '**/*file.service.test*',
      '**/to/file.service*',
      '**/file.service*',
      '**/to/*file.service*',
      '**/*file.service*',
      '**/to/file*',
      '**/file*',
      '**/to/*file*',
      '**/*file*',
    ])
  })

  it('correctly handles files that start with a dot', () => {
    expect(
      generateRelatedFilesGlobs('/.path/.to/.file.service.test.ts'),
    ).toEqual([
      '**/.to/.file.service.test*',
      '**/.file.service.test*',
      '**/.to/*.file.service.test*',
      '**/*.file.service.test*',
      '**/.to/.file.service*',
      '**/.file.service*',
      '**/.to/*.file.service*',
      '**/*.file.service*',
      '**/.to/.file*',
      '**/.file*',
      '**/.to/*.file*',
      '**/*.file*',
    ])
  })
})