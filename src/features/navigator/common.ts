import type * as vscode from 'vscode'
import z from 'zod'

export type NavigatorRecord = {
  uri: vscode.Uri
  selection: vscode.Selection
  value: string
}

export const serializedNavigatorRecordSchema = z.object({
  uri: z.string(),
  selection: z.string(),
  value: z.string(),
})

export type SerializedNavigatorRecord = z.infer<typeof serializedNavigatorRecordSchema>

export function areNavigatorRecordsEqual(navigatorRecord1: NavigatorRecord, navigatorRecord2: NavigatorRecord) {
  return navigatorRecord1.uri.path === navigatorRecord2.uri.path
}
