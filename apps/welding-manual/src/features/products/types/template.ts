import type { Timestamp } from 'firebase/firestore'

export type TemplateFieldType = 'text' | 'photo' | 'video' | 'select' | 'checkbox'

export interface TemplateField {
  id: string
  type: TemplateFieldType
  label: string
  options?: string[]
  width?: 'full' | 'half'
}

export interface ProductTemplate {
  id: string
  name: string
  fields: TemplateField[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ProductTemplateFormData {
  name: string
  fields: TemplateField[]
}
