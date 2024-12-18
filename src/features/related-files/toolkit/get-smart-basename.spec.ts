import assert from 'assert'
import { getSmartBasename } from './get-smart-basename'

const excludedSuffixes = ['test']

describe('getSmartBasename()', () => {
    it('regular files', () => {
        assert.strictEqual(getSmartBasename('/test/file.js', excludedSuffixes), 'file')
        assert.strictEqual(getSmartBasename('/test/file.test.js', excludedSuffixes), 'file')
        assert.strictEqual(getSmartBasename('/test/file.module.js', excludedSuffixes), 'file.module')
        assert.strictEqual(getSmartBasename('/test/file.module.test.js', excludedSuffixes), 'file.module')
        assert.strictEqual(getSmartBasename('/test/file.module.hello.js', excludedSuffixes), 'file.module.hello')

        assert.strictEqual(getSmartBasename('/test/file.ts', excludedSuffixes), 'file')
        assert.strictEqual(getSmartBasename('/test/file.test.ts', excludedSuffixes), 'file')
        assert.strictEqual(getSmartBasename('/test/file.module.ts', excludedSuffixes), 'file.module')
        assert.strictEqual(getSmartBasename('/test/file.module.test.ts', excludedSuffixes), 'file.module')
        assert.strictEqual(getSmartBasename('/test/file.module.hello.ts', excludedSuffixes), 'file.module.hello')
    })

    it('dot files', () => {
        assert.strictEqual(getSmartBasename('/test/.file.js', excludedSuffixes), '.file')
        assert.strictEqual(getSmartBasename('/test/.file.test.js', excludedSuffixes), '.file')
        assert.strictEqual(getSmartBasename('/test/.file.module.js', excludedSuffixes), '.file.module')
        assert.strictEqual(getSmartBasename('/test/.file.module.test.js', excludedSuffixes), '.file.module')

        assert.strictEqual(getSmartBasename('/test/.file.ts', excludedSuffixes), '.file')
        assert.strictEqual(getSmartBasename('/test/.file.test.ts', excludedSuffixes), '.file')
        assert.strictEqual(getSmartBasename('/test/.file.module.ts', excludedSuffixes), '.file.module')
        assert.strictEqual(getSmartBasename('/test/.file.module.test.ts', excludedSuffixes), '.file.module')
        assert.strictEqual(getSmartBasename('/test/.file.module.hello.ts', excludedSuffixes), '.file.module.hello')
    })
})