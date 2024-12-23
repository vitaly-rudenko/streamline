import { Memento } from 'vscode'
import { defaultCurrentScope, QUICK_SCOPE_PREFIX } from './common'

const defaultEnabled = false

export class ScopedPathsWorkspaceState {
  public onChange?: Function

  private _enabled: boolean = defaultEnabled
  private _currentScope: string = defaultCurrentScope

  constructor(
    private readonly workspaceState: Memento,
  ) {
    this.load()
  }

  private load() {
    const enabled = this.workspaceState.get<boolean>('streamline.scopedPaths.enabled', defaultEnabled)
    const currentScope = this.workspaceState.get<string>('streamline.scopedPaths.currentScope', defaultCurrentScope)

    this._enabled = enabled
    this._currentScope = currentScope

    console.debug('[ScopedPaths] WorkspaceState has been loaded', { enabled, currentScope })
  }

  async save() {
    await this.workspaceState.update(
      'streamline.scopedPaths.enabled',
      this._enabled !== defaultEnabled ? this._enabled : undefined,
    )

    await this.workspaceState.update(
      'streamline.scopedPaths.currentScope',
      this._currentScope !== defaultCurrentScope ? this._currentScope : undefined,
    )

    console.debug('[ScopedPaths] WorkspaceState has been saved')
  }

  getDynamicIsInQuickScope() {
    return this._currentScope.startsWith(QUICK_SCOPE_PREFIX)
  }

  setEnabled(value: boolean) {
    this._enabled = value
    this.onChange?.()
  }

  getEnabled() {
    return this._enabled
  }

  setCurrentScope(value: string) {
    this._currentScope = value
    this.onChange?.()
  }

  getCurrentScope() {
    return this._currentScope
  }

  getDynamicQuickScopePath() {
    if (!this.getDynamicIsInQuickScope()) {
      throw new Error('Tried to access Quick Scope path when not in Quick Scope')
    }

    return this.getCurrentScope().slice(QUICK_SCOPE_PREFIX.length)
  }
}