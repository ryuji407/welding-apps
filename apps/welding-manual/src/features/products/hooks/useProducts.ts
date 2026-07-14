'use client'

// 旧 Firebase Firestore 依存を廃止し、SQLite(Prisma) の server action を呼ぶ。
// リアルタイム購読(onSnapshot)は廃止し、初回取得＋書込後の再取得に置き換える。

import { useCallback, useEffect, useState } from 'react'
import type { Product, ProductFormData, ProductDefect, ProductDefectFormData } from '../types/product'
import {
  listProductsAction,
  getProductAction,
  getProductByProcessCodeAction,
  createProductAction,
  updateProductAction,
  listDefectsAction,
  addDefectAction,
} from '@/app/actions/products'

// 書き込み専用。一覧購読が不要な画面（新規作成・CSVインポート等）から使う
export async function addProduct(data: ProductFormData, photoUrls: string[]) {
  return createProductAction(data, photoUrls)
}

export async function updateProduct(id: string, data: Partial<Product>) {
  await updateProductAction(id, data as never)
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      setProducts(await listProductsAction())
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

  const addAndRefetch = useCallback(
    async (data: ProductFormData, photoUrls: string[]) => {
      const id = await addProduct(data, photoUrls)
      await refetch()
      return id
    },
    [refetch],
  )
  const updateAndRefetch = useCallback(
    async (id: string, data: Partial<Product>) => {
      await updateProduct(id, data)
      await refetch()
    },
    [refetch],
  )

  return { products, loading, error, addProduct: addAndRefetch, updateProduct: updateAndRefetch, refetch }
}

// 製品詳細画面用：該当1件を取得（書込後は再取得）
export function useProduct(id: string | undefined) {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!id) {
      setProduct(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setProduct(await getProductAction(id))
    setLoading(false)
  }, [id])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const updateAndRefetch = useCallback(
    async (pid: string, data: Partial<Product>) => {
      await updateProduct(pid, data)
      await refetch()
    },
    [refetch],
  )

  return { product, loading, updateProduct: updateAndRefetch, refetch }
}

// 工程コード解決画面用：processCodes に一致する1件を取得
export function useProductByProcessCode(processCode: string) {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!processCode) {
      setProduct(null)
      setLoading(false)
      return
    }
    setLoading(true)
    getProductByProcessCodeAction(processCode).then((p) => {
      if (!cancelled) {
        setProduct(p)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [processCode])

  return { product, loading }
}

export function useProductDefects(productId: string) {
  const [defects, setDefects] = useState<ProductDefect[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!productId) {
      setDefects([])
      setLoading(false)
      return
    }
    setDefects(await listDefectsAction(productId))
    setLoading(false)
  }, [productId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const addDefect = useCallback(
    async (data: ProductDefectFormData, productName: string, photoUrls: string[]) => {
      await addDefectAction(
        productId,
        productName,
        data.occurredAt,
        data.reportedBy,
        data.description,
        photoUrls,
      )
      await refetch()
    },
    [productId, refetch],
  )

  return { defects, loading, addDefect }
}
