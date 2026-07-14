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
  createdAt: number
  updatedAt: number
}

export interface ProductTemplateFormData {
  name: string
  fields: TemplateField[]
}
