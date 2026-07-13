'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  getDoc,
  setDoc,

} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { ProductNote } from '../types/product'

export function useProductNotes() {
  const [notes, setNotes] = useState<ProductNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'product_notes'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductNote)))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  async function addProductNote(componentOfficialName: string) {
    const docId = encodeURIComponent(componentOfficialName)
    await setDoc(doc(db, 'product_notes', docId), {
      componentOfficialName,
      warnings: [],
      instructionSteps: [],
      notes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docId
  }

  async function updateProductNote(id: string, data: Partial<Omit<ProductNote, 'id' | 'createdAt'>>) {
    await updateDoc(doc(db, 'product_notes', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  return { notes, loading, error, addProductNote, updateProductNote }
}

export async function getProductNote(componentOfficialName: string): Promise<ProductNote | null> {
  const docId = encodeURIComponent(componentOfficialName)
  const snap = await getDoc(doc(db, 'product_notes', docId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as ProductNote
}
