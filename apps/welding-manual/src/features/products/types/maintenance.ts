// tube-manual の types/maintenance.ts から製品情報機能が使う型のみ抽出
export type MaintenanceDueStatus = 'ok' | 'soon' | 'overdue' | 'unknown'

export interface InstructionStep {
  text: string
  photoUrl?: string
}
