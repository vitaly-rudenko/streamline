import assert from 'assert'
import { TabHistoryStorage } from '../../../features/tab-history/tab-history-storage'

suite('TabHistoryStorage', () => {
  test('lists empty storage', () => {
    const tabHistoryStorage = new TabHistoryStorage(100)

    assert.deepEqual(tabHistoryStorage.list(), [])
    assert.deepEqual(tabHistoryStorage.export(100), {})
  })

  test('puts tab to the front and cuts off using the limit', () => {
    const tabHistoryStorage = new TabHistoryStorage(3)

    tabHistoryStorage.put({ path: '1', openedAt: 10 })
    tabHistoryStorage.put({ path: '2', openedAt: 20 })
    tabHistoryStorage.put({ path: '3', openedAt: 30 })
    tabHistoryStorage.put({ path: '4', openedAt: 40 })

    assert.deepEqual(
      tabHistoryStorage.list().map(tab => tab.path),
      ['4', '3', '2']
    )
  })

  test('removes the oldest tab', () => {
    const tabHistoryStorage = new TabHistoryStorage(3)

    tabHistoryStorage.put({ path: '1', openedAt: 40 })
    tabHistoryStorage.put({ path: '2', openedAt: 30 })
    tabHistoryStorage.put({ path: '3', openedAt: 20 })
    tabHistoryStorage.put({ path: '4', openedAt: 10 })

    assert.deepEqual(
      tabHistoryStorage.list().map(tab => tab.path),
      ['3', '2', '1']
    )
  })

  test('updates existing tabs', () => {
    const tabHistoryStorage = new TabHistoryStorage(3)

    tabHistoryStorage.put({ path: '1', openedAt: 10 })
    tabHistoryStorage.put({ path: '2', openedAt: 20 })
    tabHistoryStorage.put({ path: '3', openedAt: 30 })
    tabHistoryStorage.put({ path: '1', openedAt: 40 })
    tabHistoryStorage.put({ path: '4', openedAt: 50 })

    assert.deepEqual(
      tabHistoryStorage.list().map(tab => tab.path),
      ['4', '3', '1']
    )
  })

  test('sorts tabs', () => {
    const tabHistoryStorage = new TabHistoryStorage(3)

    tabHistoryStorage.put({ path: '1', openedAt: 40 })
    tabHistoryStorage.put({ path: '2', openedAt: 30 })
    tabHistoryStorage.put({ path: '3', openedAt: 20 })

    tabHistoryStorage.sort()

    assert.deepEqual(
      tabHistoryStorage.list().map(tab => tab.path),
      ['1', '2', '3']
    )
  })

  test('imports tabs into empty storage and sort them', () => {
    const tabHistoryStorage = new TabHistoryStorage(3)

    tabHistoryStorage.import({
      '1': 40,
      '2': 20,
      '3': 30,
      '4': 10,
      '5': 50,
    })

    assert.deepEqual(
      tabHistoryStorage.list().map(tab => tab.path),
      ['5', '1', '3']
    )
  })

  test('imports tabs into non-empty storage without changing existing tabs or sorting them', () => {
    const tabHistoryStorage = new TabHistoryStorage(5)

    tabHistoryStorage.put({ path: '1', openedAt: 50 })
    tabHistoryStorage.put({ path: '2', openedAt: 30 })
    tabHistoryStorage.put({ path: '3', openedAt: 40 })

    tabHistoryStorage.import({
      '1': 40,
      '2': 20,
      '3': 30,
      '4': 0,
      '5': 60,
      '6': 10,
      '7': 70,
    })

    assert.deepEqual(
      tabHistoryStorage.list(),
      [
        { path: '3', openedAt: 40 },
        { path: '2', openedAt: 30 },
        { path: '1', openedAt: 50 },
        { path: '7', openedAt: 70 },
        { path: '5', openedAt: 60 },
      ]
    )
  })

  test('exports tabs from empty storage', () => {
    const tabHistoryStorage = new TabHistoryStorage(5)

    assert.deepEqual(tabHistoryStorage.export(100), {})
  })

  test('exports tabs from non-empty storage by sorting them and limiting their size as specified', () => {
    const tabHistoryStorage = new TabHistoryStorage(5)

    tabHistoryStorage.put({ path: '1', openedAt: 40 })
    tabHistoryStorage.put({ path: '2', openedAt: 30 })
    tabHistoryStorage.put({ path: '3', openedAt: 50 })
    tabHistoryStorage.put({ path: '4', openedAt: 20 })
    tabHistoryStorage.put({ path: '5', openedAt: 10 })

    assert.deepEqual(
      tabHistoryStorage.export(3),
      {
        '3': 50,
        '1': 40,
        '2': 30,
      }
    )

    assert.deepEqual(
      tabHistoryStorage.export(10),
      {
        '1': 40,
        '2': 30,
        '3': 50,
        '4': 20,
        '5': 10,
      }
    )
  })

  test('clears tabs', () => {
    const tabHistoryStorage = new TabHistoryStorage(3)

    tabHistoryStorage.put({ path: '1', openedAt: 10 })
    tabHistoryStorage.put({ path: '2', openedAt: 20 })
    tabHistoryStorage.put({ path: '3', openedAt: 30 })
    tabHistoryStorage.put({ path: '4', openedAt: 40 })

    tabHistoryStorage.clear()

    assert.deepEqual(tabHistoryStorage.list(), [])
    assert.deepEqual(tabHistoryStorage.export(100), {})
  })

  test('returns true/false depending on whether the tab is new or updated', () => {
    const tabHistoryStorage = new TabHistoryStorage(3)

    assert.equal(tabHistoryStorage.put({ path: '1', openedAt: 10 }), true)
    assert.equal(tabHistoryStorage.put({ path: '2', openedAt: 20 }), true)
    assert.equal(tabHistoryStorage.put({ path: '3', openedAt: 30 }), true)
    assert.equal(tabHistoryStorage.put({ path: '4', openedAt: 40 }), true)

    assert.equal(tabHistoryStorage.put({ path: '1', openedAt: 50 }), true) // new, because old one was removed due to limit
    assert.equal(tabHistoryStorage.put({ path: '3', openedAt: 60 }), false)
    assert.equal(tabHistoryStorage.put({ path: '4', openedAt: 70 }), false)
  })
})