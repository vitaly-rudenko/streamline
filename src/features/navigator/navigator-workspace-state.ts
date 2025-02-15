import z from 'zod'
import { Memento, Uri } from 'vscode'
import { NavigatorRecord, SerializedNavigatorRecord, serializedNavigatorRecordSchema } from './common'
import { deserializeSelection } from '../bookmarks/toolkit/deserialize-bookmark'
import { serializeSelection } from '../bookmarks/toolkit/serialize-bookmark'

export class NavigatorWorkspaceState {
  private _navigatorRecords: NavigatorRecord[] = []
  private _index: number = -1

  constructor(
    private readonly workspaceState: Memento
  ) {
    this.load()
  }

  private load() {
    const serializedNavigatorRecords = this.workspaceState.get<unknown>('streamline.navigator.navigatorRecords', [])
    const index = this.workspaceState.get<number>('streamline.navigator.index', -1)

    let navigatorRecords: NavigatorRecord[] = []
    try {
      navigatorRecords =  z.array(serializedNavigatorRecordSchema)
        .parse(serializedNavigatorRecords)
        .map(serializedNavigatorRecord => deserializeNavigatorRecord(serializedNavigatorRecord))
    } catch (error) {
      console.warn('[Navigator] Could not load records', error)
    }

    if (isValidIndex(index, navigatorRecords)) {
      this._navigatorRecords = navigatorRecords
      this._index = index
    }

    console.debug('[Navigator] WorkspaceState has been loaded', {
      navigatorRecords: this._navigatorRecords,
      index: this._index,
    })
  }

  async save() {
    await this.workspaceState.update(
      'streamline.navigator.navigatorRecords',
      this._navigatorRecords.length > 0
        ? this._navigatorRecords.map(navigatorRecord => serializeNavigatorRecord(navigatorRecord))
        : undefined
    )

    await this.workspaceState.update(
      'streamline.navigator.index',
      this._index !== -1 ? this._index : undefined
    )
  }

  replaceNavigationRecordAt(index: number, navigatorRecord: NavigatorRecord) {
    if (isValidIndex(index, this._navigatorRecords)) {
      this._navigatorRecords[index] = navigatorRecord
    }
  }

  getNavigatorRecordAt(index: number): NavigatorRecord | undefined {
    return isValidIndex(index, this._navigatorRecords)
      ? this._navigatorRecords[index]
      : undefined
  }

  setNavigatorRecords(value: NavigatorRecord[]) {
    this._navigatorRecords = value
  }

  getNavigatorRecords(): NavigatorRecord[] {
    return this._navigatorRecords
  }

  setIndex(value: number) {
    this._index = value
  }

  getIndex(): number {
    return this._index
  }
}

function serializeNavigatorRecord(navigatorRecord: NavigatorRecord): SerializedNavigatorRecord {
  return {
    uri: navigatorRecord.uri.path,
    selection: serializeSelection(navigatorRecord.selection),
    value: navigatorRecord.value,
  }
}

function deserializeNavigatorRecord(serializedNavigatorRecord: SerializedNavigatorRecord): NavigatorRecord {
  return {
    uri: Uri.file(serializedNavigatorRecord.uri),
    selection: deserializeSelection(serializedNavigatorRecord.selection),
    value: serializedNavigatorRecord.value,
  }
}

function isValidIndex(index: number, array: unknown[]) {
  return index === -1 || (index >= 0 && index <= array.length - 1)
}
