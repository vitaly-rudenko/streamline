import { Memento } from 'vscode'
import { defaultCurrentScope } from './common'

const defaultEnabled = false

export class ScopedPathsWorkspaceState {
  public onChange?: Function

  private _enabled: boolean = defaultEnabled
  private _currentScope: string = defaultCurrentScope
  private _quickUnscopePathsSnapshot: string[] | undefined = undefined

  constructor(
    private readonly workspaceState: Memento,
  ) {
    this.load()
  }

  private load() {
    const enabled = this.workspaceState.get<boolean>('streamline.scopedPaths.enabled', defaultEnabled)
    const currentScope = this.workspaceState.get<string>('streamline.scopedPaths.currentScope', defaultCurrentScope)
    const quickUnscopedPathsSnapshot = this.workspaceState.get<string[] | undefined>('streamline.scopedPaths.quickUnscopedPathsSnapshot', undefined)

    this._enabled = enabled
    this._currentScope = currentScope
    this._quickUnscopePathsSnapshot = quickUnscopedPathsSnapshot

    console.debug('[ScopedPaths] WorkspaceState has been loaded', { enabled, currentScope, quickUnscopedPathsSnapshot })
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

    await this.workspaceState.update(
      'streamline.scopedPaths.quickUnscopedPathsSnapshot',
      this._quickUnscopePathsSnapshot,
    )

    console.debug('[ScopedPaths] WorkspaceState has been saved')
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

  setQuickUnscopePathsSnapshot(value: string[] | undefined) {
    this._quickUnscopePathsSnapshot = value
    this.onChange?.()
  }

  getQuickUnscopePathsSnapshot() {
    return this._quickUnscopePathsSnapshot
  }

  getQuickUnscopeEnabled() {
    return this._quickUnscopePathsSnapshot !== undefined
  }
}