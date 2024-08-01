import { getConfig, initialConfig } from '../../config'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'
import { FeatureConfig } from '../feature-config'
import type { ViewRenderMode } from './types'

const defaultUseExcludes = true
const defaultUseStricterQuickOpenQuery = false
const defaultUseGlobalSearch = false
const defaultViewRenderMode = 'compact'
const defaultMaxLabelLength = 120
const defaultCollapsedIndicator = '⸱⸱⸱'

export class RelatedFilesConfig extends FeatureConfig {
  private _customExcludes: Record<string, unknown> = {}
  private _useExcludes: boolean = defaultUseExcludes
  private _useStricterQuickOpenQuery: boolean = defaultUseStricterQuickOpenQuery
  private _useGlobalSearch: boolean = defaultUseGlobalSearch
  private _viewRenderMode: ViewRenderMode = defaultViewRenderMode
  private _hiddenWorkspaceFoldersInGlobalSearch: string[] = []
  private _maxLabelLength: number = defaultMaxLabelLength
  private _collapsedIndicator: string = defaultCollapsedIndicator

  constructor() {
    super('RelatedFiles')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const customExcludes = config.get<Record<string, unknown>>('relatedFiles.exclude', {})
    const useExcludes = config.get<boolean>('relatedFiles.useExcludes', defaultUseExcludes)
    const useStricterQuickOpenQuery = config.get<boolean>('relatedFiles.useStricterQuickOpenQuery', defaultUseStricterQuickOpenQuery)
    const useGlobalSearch = config.get<boolean>('relatedFiles.useGlobalSearch', defaultUseGlobalSearch)
    const viewRenderMode = config.get<ViewRenderMode>('relatedFiles.viewRenderMode', defaultViewRenderMode)
    const hiddenWorkspaceFoldersInGlobalSearch = config.get<string[]>('relatedFiles.hiddenWorkspaceFoldersInGlobalSearch', [])
    const maxLabelLength = config.get<number>('relatedFiles.maxLabelLength', defaultMaxLabelLength)
    const collapsedIndicator = config.get<string>('relatedFiles.collapsedIndicator', defaultCollapsedIndicator)

    let hasChanged = false

    if (
      !areObjectsShallowEqual(this._customExcludes, customExcludes)
      || this._useExcludes !== useExcludes
      || this._useStricterQuickOpenQuery !== useStricterQuickOpenQuery
      || this._useGlobalSearch !== useGlobalSearch
      || this._viewRenderMode !== viewRenderMode
      || !areArraysShallowEqual(this._hiddenWorkspaceFoldersInGlobalSearch, hiddenWorkspaceFoldersInGlobalSearch)
      || this._maxLabelLength !== maxLabelLength
      || this._collapsedIndicator !== collapsedIndicator
    ) {
      this._customExcludes = customExcludes
      this._useExcludes = useExcludes
      this._useStricterQuickOpenQuery = useStricterQuickOpenQuery
      this._useGlobalSearch = useGlobalSearch
      this._viewRenderMode = viewRenderMode
      this._hiddenWorkspaceFoldersInGlobalSearch = hiddenWorkspaceFoldersInGlobalSearch
      this._maxLabelLength = maxLabelLength
      this._collapsedIndicator = collapsedIndicator

      hasChanged = true
    }

    console.debug('[RelatedFiles] Config has been loaded', { hasChanged, customExcludes, useExcludes, useStricterQuickOpenQuery, useGlobalSearch, viewRenderMode, maxLabelLength, collapsedIndicator })

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

    await config.update(
      'relatedFiles.hiddenWorkspaceFoldersInGlobalSearch',
      this._hiddenWorkspaceFoldersInGlobalSearch.length > 0 ? this._hiddenWorkspaceFoldersInGlobalSearch : undefined
    )

    console.debug('[RelatedFiles] Config has been saved')
  }

  getCustomExcludes() {
    return this._customExcludes
  }

  getUseStricterQuickOpenQuery() {
    return this._useStricterQuickOpenQuery
  }

  getMaxLabelLength() {
    return this._maxLabelLength
  }

  getCollapsedIndicator() {
    return this._collapsedIndicator
  }

  setHiddenWorkspaceFoldersInGlobalSearch(value: string[]) {
    this._hiddenWorkspaceFoldersInGlobalSearch = value
  }

  getHiddenWorkspaceFoldersInGlobalSearch() {
    return this._hiddenWorkspaceFoldersInGlobalSearch
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
