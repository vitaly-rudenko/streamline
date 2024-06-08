import { getConfig } from '../../config'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'

export class RelatedFilesConfig {
  private _customExcludes: Record<string, unknown> = {}
  private _useRelativePaths: boolean = true
  private _useExcludes: boolean = true

  load(): boolean {
    const config = getConfig()
    const customExcludes = config.get<Record<string, unknown>>('relatedFiles.exclude', {})
    const useRelativePaths = config.get<boolean>('relatedFiles.useRelativePaths', true)
    const useExcludes = config.get<boolean>('relatedFiles.useExcludes', true)

    let hasChanged = false

    if (
      !areObjectsShallowEqual(this._customExcludes, customExcludes) ||
      this._useRelativePaths !== useRelativePaths ||
      this._useExcludes !== useExcludes
    ) {
      this._customExcludes = customExcludes
      this._useRelativePaths = useRelativePaths
      this._useExcludes = useExcludes

      hasChanged = true
    }

    console.debug('[RelatedFiles] Config has been loaded', { hasChanged })

    return hasChanged
  }

  async save() {
    const config = getConfig()
    await config.update('relatedFiles.useRelativePaths', this._useRelativePaths)
    await config.update('relatedFiles.useExcludes', this._useExcludes)

    console.debug('[RelatedFiles] Config has been saved')
  }

  get customExcludes() {
    return this._customExcludes
  }

  set useRelativePaths(value: boolean) {
    this._useRelativePaths = value
  }

  get useRelativePaths() {
    return this._useRelativePaths
  }

  set useExcludes(value: boolean) {
    this._useExcludes = value
  }

  get useExcludes() {
    return this._useExcludes
  }
}
