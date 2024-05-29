import { getParents } from '../../utils/get-parents'

export class ScopedPathsStorage {
  private readonly _scopedPaths
  private _parentsOfScopedPaths

  constructor(scopedPaths: string[]) {
    this._scopedPaths = new Set(scopedPaths)
    this._parentsOfScopedPaths = new Set(scopedPaths.flatMap(scopedPath => getParents(scopedPath)))
  }

  has(path: string) {
    return this._scopedPaths.has(path)
  }

  add(path: string) {
    this._scopedPaths.add(path)
    for (const parent of getParents(path)) {
      this._parentsOfScopedPaths.add(parent)
    }
  }

  remove(path: string) {
    this._scopedPaths.delete(path)
    this._parentsOfScopedPaths = new Set([...this._scopedPaths].flatMap(scopedPath => getParents(scopedPath)))
  }

  isScoped(path: string) {
    return this._scopedPaths.has(path)
  }

  isParentOfScoped(path: string) {
    return this._parentsOfScopedPaths.has(path)
  }

  export() {
    return [...this._scopedPaths]
  }
}
