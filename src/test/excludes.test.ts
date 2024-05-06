import assert from 'assert';
import { deserializeExcludes, serializeExcludes } from '../excludes';

suite('excludes', () => {
  test('symmetrical serialization', () => {
    const includedPaths = ["A/C/D/", "A/C/", "G/P", "G/H/J/", "G/H/M/"];
    const excludedPaths = [
      'A/B/',
      'A/F',
      'Q',
      'G/H/I/',
      'G/H/N',
      'G/O',
    ];

    assert.deepStrictEqual(
      deserializeExcludes(serializeExcludes(includedPaths, excludedPaths)),
      { includedPaths, excludedPaths }
    );
  });

  test('serialization', () => {
    const includedPaths = ["A/C/D/", "A/C/", "G/P", "G/H/J/", "G/H/M/"];
    const excludedPaths = [
      'A/B/',
      'A/F',
      'Q',
      'G/H/I/',
      'G/H/N',
      'G/O',
    ];

    assert.deepStrictEqual(
      serializeExcludes(includedPaths, excludedPaths),
      {
        'A/C/D/**': false,
        'A/C/**': false,
        'G/P': false,
        'G/H/J/**': false,
        'G/H/M/**': false,
        'A/B/**': true,
        'A/F': true,
        'Q': true,
        'G/H/I/**': true,
        'G/H/N': true,
        'G/O': true,
      }
    );
  });
});
