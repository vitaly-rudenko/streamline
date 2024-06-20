import { getConfig } from '../../config'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'
import { FeatureConfig } from '../feature-config'
import type { ViewRenderMode } from './types'

const defaultUseExcludes = true
const defaultUseStricterQuickOpenQuery = false
const defaultUseGlobalSearch = false
const defaultViewRenderMode = 'compact'

export class RelatedFilesConfig extends FeatureConfig {
  private _customExcludes: Record<string, unknown> = {}
  private _useExcludes: boolean = defaultUseExcludes
  private _useStricterQuickOpenQuery: boolean = defaultUseStricterQuickOpenQuery
  private _useGlobalSearch: boolean = defaultUseGlobalSearch
  private _viewRenderMode: ViewRenderMode = defaultViewRenderMode

  constructor() { super('RelatedFiles') }

  load() {
    const config = getConfig()
    const customExcludes = config.get<Record<string, unknown>>('relatedFiles.exclude', {})
    const useExcludes = config.get<boolean>('relatedFiles.useExcludes', defaultUseExcludes)
    const useStricterQuickOpenQuery = config.get<boolean>('relatedFiles.useStricterQuickOpenQuery', defaultUseStricterQuickOpenQuery)
    const useGlobalSearch = config.get<boolean>('relatedFiles.useGlobalSearch', defaultUseGlobalSearch)
    const viewRenderMode = config.get<ViewRenderMode>('relatedFiles.viewRenderMode', defaultViewRenderMode)

    let hasChanged = false

    if (
      !areObjectsShallowEqual(this._customExcludes, customExcludes)
      || this._useExcludes !== useExcludes
      || this._useStricterQuickOpenQuery !== useStricterQuickOpenQuery
      || this._useGlobalSearch !== useGlobalSearch
      || this._viewRenderMode !== viewRenderMode
    ) {
      this._customExcludes = customExcludes
      this._useExcludes = useExcludes
      this._useStricterQuickOpenQuery = useStricterQuickOpenQuery
      this._useGlobalSearch = useGlobalSearch
      this._viewRenderMode = viewRenderMode

      hasChanged = true
    }

    console.debug('[RelatedFiles] Config has been loaded', { hasChanged, customExcludes, useExcludes, useStricterQuickOpenQuery, useGlobalSearch, viewRenderMode })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await config.update(
      'relatedFiles.viewRenderMode',
      this._viewRenderMode !== defaultViewRenderMode ? this._viewRenderMode : undefined
    )

    await config.update(
      'relatedFiles.useExcludes',
      this._useExcludes !== defaultUseExcludes ? this._useExcludes : undefined
    )

    await config.update(
      'relatedFiles.useGlobalSearch',
      this._useGlobalSearch !== defaultUseGlobalSearch ? this._useGlobalSearch : undefined
    )

    console.debug('[RelatedFiles] Config has been saved')
  }

  getCustomExcludes() {
    return this._customExcludes
  }

  getUseStricterQuickOpenQuery() {
    return this._useStricterQuickOpenQuery
  }

  setViewRenderMode(value: ViewRenderMode) {
    this._viewRenderMode = value
  }

  getViewRenderMode() {
    return this._viewRenderMode
  }

  setUseGlobalSearch(value: boolean) {
    this._useGlobalSearch = value
  }

  getUseGlobalSearch() {
    return this._useGlobalSearch
  }

  setUseExcludes(value: boolean) {
    this._useExcludes = value
  }

  getUseExcludes() {
    return this._useExcludes
  }
}
