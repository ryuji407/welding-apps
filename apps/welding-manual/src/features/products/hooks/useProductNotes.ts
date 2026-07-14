'use client'

// 旧 Firebase Firestore 依存を廃止し、SQLite(Prisma) の server action を呼ぶ。

import { useCallback, useEffect, useState } from 'react'
import type { ProductNote } from '../types/product'
import {
  listProductNotesAction,
  createProductNoteAction,
  updateProductNoteAction,
} from '@/app/actions/products'

export function useProductNotes() {
  const [notes, setNotes] = useState<ProductNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      setNotes((await listProductNotesAction()) as ProductNote[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const addProductNote = useCallback(
    async (componentOfficialName: string) => {
      const id = await createProductNoteAction(componentOfficialName)
      await refetch()
      return id
    },
    [refetch],
  )

  const updateProductNote = useCallback(
    async (id: string, data: Partial<Omit<ProductNote, 'id' | 'createdAt'>>) => {
      await updateProductNoteAction(id, data)
      await refetch()
    },
    [refetch],
  )

  return { notes, loading, error, addProductNote, updateProductNote }
}

export async function getProductNote(componentOfficialName: string): Promise<ProductNote | null> {
  const id = encodeURIComponent(componentOfficialName)
  const notes = (await listProductNotesAction()) as ProductNote[]
  return notes.find((n) => n.id === id) ?? null
}
