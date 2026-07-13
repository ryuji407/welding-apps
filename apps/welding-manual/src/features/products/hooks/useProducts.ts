'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Product, ProductFormData, ProductDefect, ProductDefectFormData } from '../types/product'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // where + orderBy の複合インデックスを避けるため、orderBy のみで取得して JS でフィルタ
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product))
        setProducts(all.filter((p) => p.isActive !== false))
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  async function addProduct(data: ProductFormData, photoUrls: string[]) {
    const ref = await addDoc(collection(db, 'products'), {
      ...data,
      photoUrls,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  }

  async function updateProduct(id: string, data: Partial<Product>) {
    await updateDoc(doc(db, 'products', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  return { products, loading, error, addProduct, updateProduct }
}

export function useProductDefects(productId: string) {
  const [defects, setDefects] = useState<ProductDefect[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // where のみ（単一フィールド、自動インデックス）で取得して JS でソート
    const q = query(
      collection(db, 'product_defects'),
      where('productId', '==', productId)
    )
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductDefect))
      all.sort((a, b) => b.occurredAt.toMillis() - a.occurredAt.toMillis())
      setDefects(all)
      setLoading(false)
    })
    return () => unsub()
  }, [productId])

  async function addDefect(data: ProductDefectFormData, productName: string, photoUrls: string[]) {
    await addDoc(collection(db, 'product_defects'), {
      productId,
      productName,
      occurredAt: Timestamp.fromDate(new Date(data.occurredAt)),
      reportedBy: data.reportedBy,
      description: data.description,
      photoUrls,
      createdAt: serverTimestamp(),
    })
  }

  return { defects, loading, addDefect }
}
