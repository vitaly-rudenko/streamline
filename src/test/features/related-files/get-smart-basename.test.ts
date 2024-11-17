import assert from 'assert'
import { getSmartBasename } from '../../../features/related-files/get-smart-basename'

const excludedSuffixes = ['test', 'js']

suite('getSmartBasename()', () => {
    test('regular files', () => {
        assert.equal(getSmartBasename('/test/file.js', excludedSuffixes), 'file')
        assert.equal(getSmartBasename('/test/file.test.js', excludedSuffixes), 'file')
        assert.equal(getSmartBasename('/test/file.module.js', excludedSuffixes), 'file.module')
        assert.equal(getSmartBasename('/test/file.module.test.js', excludedSuffixes), 'file.module')
        assert.equal(getSmartBasename('/test/file.module.hello.js', excludedSuffixes), 'file.module.hello')

        assert.equal(getSmartBasename('/test/file.ts', excludedSuffixes), 'file.ts')
        assert.equal(getSmartBasename('/test/file.test.ts', excludedSuffixes), 'file.test.ts')
        assert.equal(getSmartBasename('/test/file.module.ts', excludedSuffixes), 'file.module.ts')
        assert.equal(getSmartBasename('/test/file.module.test.ts', excludedSuffixes), 'file.module.test.ts')
        assert.equal(getSmartBasename('/test/file.module.hello.ts', excludedSuffixes), 'file.module.hello.ts')
    })

    test('dot files', () => {
        assert.equal(getSmartBasename('/test/.file.js', excludedSuffixes), '.file')
        assert.equal(getSmartBasename('/test/.file.test.js', excludedSuffixes), '.file')
        assert.equal(getSmartBasename('/test/.file.module.js', excludedSuffixes), '.file.module')
        assert.equal(getSmartBasename('/test/.file.module.test.js', excludedSuffixes), '.file.module')

        assert.equal(getSmartBasename('/test/.file.ts', excludedSuffixes), '.file.ts')
        assert.equal(getSmartBasename('/test/.file.test.ts', excludedSuffixes), '.file.test.ts')
        assert.equal(getSmartBasename('/test/.file.module.ts', excludedSuffixes), '.file.module.ts')
        assert.equal(getSmartBasename('/test/.file.module.test.ts', excludedSuffixes), '.file.module.test.ts')
        assert.equal(getSmartBasename('/test/.file.module.hello.ts', excludedSuffixes), '.file.module.hello.ts')
    })
})