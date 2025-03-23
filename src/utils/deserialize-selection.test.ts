import { suite, test } from 'mocha'
import assert from 'assert'
import * as vscode from 'vscode'
import { deserializeSelection } from './deserialize-selection'

suite('deserializeSelection', () => {
  test('deserializes selection with same anchor and active positions', () => {
    const serialized = '10:5-10:5'
    const expected = new vscode.Selection(10, 5, 10, 5)

    const result = deserializeSelection(serialized)

    assert.deepStrictEqual(result, expected)
  })

  test('deserializes selection with different anchor and active positions', () => {
    const serialized = '10:5-12:20'
    const expected = new vscode.Selection(10, 5, 12, 20)

    const result = deserializeSelection(serialized)

    assert.deepStrictEqual(result, expected)
  })

  test('deserializes selection with zero values', () => {
    const serialized = '0:0-0:0'
    const expected = new vscode.Selection(0, 0, 0, 0)

    const result = deserializeSelection(serialized)

    assert.deepStrictEqual(result, expected)
  })

  test('deserializes selection with reversed positions (active before anchor)', () => {
    const serialized = '20:30-10:5'
    const expected = new vscode.Selection(20, 30, 10, 5)

    const result = deserializeSelection(serialized)

    assert.deepStrictEqual(result, expected)
  })
})