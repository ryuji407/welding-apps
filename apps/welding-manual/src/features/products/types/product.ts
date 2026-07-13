import type { Timestamp } from 'firebase/firestore'
import type { TemplateFieldType } from './template'
import type { InstructionStep } from './maintenance'

export interface Specification {
  label: string
  value: string
  photoUrl?: string
}

export interface TemplateFieldValue {
  templateId: string
  instanceId?: string // 複数インスタンス対応用
  fieldId: string
  label: string
  type: TemplateFieldType
  textValue?: string
  photoUrl?: string
  videoUrl?: string
  boolValue?: boolean
}

export interface Product {
  id: string
  name: string
  processCodes?: string[] // 工程コード（工程表からのリンクキー。複数可）
  processingNotes: string
  photoUrls: string[]
  specifications: Specification[]
  appliedTemplateIds?: string[] // レガシー互換用
  appliedTemplateInstances?: { instanceId: string, templateId: string }[] // 新形式
  templateValues?: TemplateFieldValue[]
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ProductFormData {
  name: string
  processCodes?: string[]
  processingNotes: string
  specifications: Specification[]
  appliedTemplateIds?: string[]
  templateValues?: TemplateFieldValue[]
}

export interface ProductDefect {
  id: string
  productId: string
  productName: string
  occurredAt: Timestamp
  reportedBy: string
  description: string
  photoUrls: string[]
  createdAt: Timestamp
}

export interface ProductDefectFormData {
  occurredAt: string
  reportedBy: string
  description: string
}

export interface ProductWarning {
  level: 'info' | 'caution' | 'danger'
  text: string
}

export interface ProductNote {
  id: string
  componentOfficialName: string
  warnings: ProductWarning[]
  instructionSteps?: InstructionStep[]
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type { InstructionStep }

