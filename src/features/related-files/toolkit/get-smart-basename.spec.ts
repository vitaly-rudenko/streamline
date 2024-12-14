import assert from 'assert'
import { getSmartBasename } from './get-smart-basename'

const excludedSuffixes = ['test', 'js']

describe('getSmartBasename()', () => {
    it('regular files', () => {
        assert.strictEqual(getSmartBasename('/test/file.js', excludedSuffixes), 'file')
        assert.strictEqual(getSmartBasename('/test/file.test.js', excludedSuffixes), 'file')
        assert.strictEqual(getSmartBasename('/test/file.module.js', excludedSuffixes), 'file.module')
        assert.strictEqual(getSmartBasename('/test/file.module.test.js', excludedSuffixes), 'file.module')
        assert.strictEqual(getSmartBasename('/test/file.module.hello.js', excludedSuffixes), 'file.module.hello')

        assert.strictEqual(getSmartBasename('/test/file.ts', excludedSuffixes), 'file.ts')
        assert.strictEqual(getSmartBasename('/test/file.test.ts', excludedSuffixes), 'file.test.ts')
        assert.strictEqual(getSmartBasename('/test/file.module.ts', excludedSuffixes), 'file.module.ts')
        assert.strictEqual(getSmartBasename('/test/file.module.test.ts', excludedSuffixes), 'file.module.test.ts')
        assert.strictEqual(getSmartBasename('/test/file.module.hello.ts', excludedSuffixes), 'file.module.hello.ts')
    })

    it('dot files', () => {
        assert.strictEqual(getSmartBasename('/test/.file.js', excludedSuffixes), '.file')
        assert.strictEqual(getSmartBasename('/test/.file.test.js', excludedSuffixes), '.file')
        assert.strictEqual(getSmartBasename('/test/.file.module.js', excludedSuffixes), '.file.module')
        assert.strictEqual(getSmartBasename('/test/.file.module.test.js', excludedSuffixes), '.file.module')

        assert.strictEqual(getSmartBasename('/test/.file.ts', excludedSuffixes), '.file.ts')
        assert.strictEqual(getSmartBasename('/test/.file.test.ts', excludedSuffixes), '.file.test.ts')
        assert.strictEqual(getSmartBasename('/test/.file.module.ts', excludedSuffixes), '.file.module.ts')
        assert.strictEqual(getSmartBasename('/test/.file.module.test.ts', excludedSuffixes), '.file.module.test.ts')
        assert.strictEqual(getSmartBasename('/test/.file.module.hello.ts', excludedSuffixes), '.file.module.hello.ts')
    })
})