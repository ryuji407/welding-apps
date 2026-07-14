'use client'

// 旧 Firebase Firestore 依存を廃止し、SQLite(Prisma) の server action を呼ぶ。

import { useCallback, useEffect, useState } from 'react'
import type { ProductTemplate, ProductTemplateFormData } from '../types/template'
import {
  listTemplatesAction,
  createTemplateAction,
  updateTemplateAction,
  deleteTemplateAction,
} from '@/app/actions/products'

export function useTemplates() {
  const [templates, setTemplates] = useState<ProductTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setTemplates(await listTemplatesAction())
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const addTemplate = useCallback(
    async (data: ProductTemplateFormData): Promise<string> => {
      const id = await createTemplateAction(data)
      await refetch()
      return id
    },
    [refetch],
  )

  const updateTemplate = useCallback(
    async (id: string, data: ProductTemplateFormData) => {
      await updateTemplateAction(id, data)
      await refetch()
    },
    [refetch],
  )

  const deleteTemplate = useCallback(
    async (id: string) => {
      await deleteTemplateAction(id)
      await refetch()
    },
    [refetch],
  )

  return { templates, loading, addTemplate, updateTemplate, deleteTemplate }
}
