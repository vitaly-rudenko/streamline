import { Disposable } from 'vscode';

export function createDisposableInterval(fn: () => unknown, intervalMs: number): Disposable {
  const intervalId = setInterval(fn, intervalMs)
  return { dispose: () => clearInterval(intervalId) }
}
