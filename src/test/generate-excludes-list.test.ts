import assert from 'assert';
import { generateExcludesList } from '../generate-excludes-list';

const paths = [
  'A/',
    'A/B/',
    'A/C/',
      'A/C/D/',
      'A/C/E',
    'A/F',
  'G/',
    'G/H/',
      'G/H/I/',
      'G/H/J/',
        'G/H/J/K',
        'G/H/J/L',
      'G/H/M/',
      'G/H/N',
    'G/O',
    'G/P',
  'Q',
];

async function readDirectory(path: string): Promise<string[]> {
  return paths.filter((p) => {
    if (!p.startsWith(path)) {
      return false;
    }
    if (p.endsWith('/')) {
      return p.split('/').length === path.split('/').length + 1;
    }
    return p.split('/').length === path.split('/').length;
  });
}

suite('generateExcludesList()', () => {
  test('generates exclude list (empty)', async () => {
    assert.deepStrictEqual(
      await generateExcludesList(
        [],
        readDirectory
      ),
      []
    );
  });

  test('generates exclude list (single directory)', async () => {
    assert.deepStrictEqual(
      await generateExcludesList(
        ["A/"],
        readDirectory
      ),
      [
        'G/',
        'Q',
      ]
    );

    assert.deepStrictEqual(
      await generateExcludesList(
        ["G/H/J/"],
        readDirectory
      ),
      [
        'G/H/I/',
        'G/H/M/',
        'G/H/N',
        'G/O',
        'G/P',
        'A/',
        'Q',
      ]
    );
  });

  test('generates exclude list (single file)', async () => {
    assert.deepStrictEqual(
      await generateExcludesList(
        ["A/F"],
        readDirectory
      ),
      [
        'A/B/',
        'A/C/',
        'G/',
        'Q',
      ]
    );
  });

  test('generates exclude list (multiple directories)', async () => {
    assert.deepStrictEqual(
      await generateExcludesList(
        ["A/C/D/", "A/C/", "G/H/J/", "G/H/M/"],
        readDirectory
      ),
      [
        'A/B/',
        'A/F',
        'Q',
        'G/H/I/',
        'G/H/N',
        'G/O',
        'G/P',
      ]
    );
  });
});
