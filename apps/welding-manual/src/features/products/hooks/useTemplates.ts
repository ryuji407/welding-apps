'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { ProductTemplate, ProductTemplateFormData } from '../types/template'

export function useTemplates() {
  const [templates, setTemplates] = useState<ProductTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'product_templates'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductTemplate)))
      setLoading(false)
    })
    return () => unsub()
  }, [])

  async function addTemplate(data: ProductTemplateFormData): Promise<string> {
    const ref = await addDoc(collection(db, 'product_templates'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  async function updateTemplate(id: string, data: ProductTemplateFormData) {
    await updateDoc(doc(db, 'product_templates', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  async function deleteTemplate(id: string) {
    await deleteDoc(doc(db, 'product_templates', id))
  }

  return { templates, loading, addTemplate, updateTemplate, deleteTemplate }
}
