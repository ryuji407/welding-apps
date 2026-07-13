'use client'

import { useState } from 'react'
import { compressImage } from '../lib/imageCompression'

export function useImageUpload() {
  const [uploading, setUploading] = useState(false)

  async function uploadImages(files: File[], folder: string): Promise<string[]> {
    if (files.length === 0) return []
    setUploading(true)
    try {
      const formData = new FormData()
      for (const file of files) {
        const compressed = await compressImage(file)
        formData.append('photos', compressed)
      }
      const res = await fetch(`/api/product-upload?folder=${encodeURIComponent(folder)}`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'アップロード失敗')
      }
      const data = await res.json()
      return data.urls as string[]
    } finally {
      setUploading(false)
    }
  }

  async function uploadVideo(file: File, folder: string): Promise<string> {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('video', file)
      let res: Response
      try {
        res = await fetch(`/api/product-upload-video?folder=${encodeURIComponent(folder)}`, {
          method: 'POST',
          body: formData,
        })
      } catch {
        throw new Error('サーバーに接続できません。サーバーが起動しているか確認してください。')
      }
      if (res.status === 404) {
        throw new Error('動画アップロードAPIが見つかりません。サーバーを再起動してください。')
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let detail = text
        try { detail = JSON.parse(text).error || text } catch {}
        throw new Error(`動画アップロード失敗 (HTTP ${res.status})${detail ? ': ' + detail : ''}`)
      }
      const data = await res.json()
      return data.url as string
    } finally {
      setUploading(false)
    }
  }

  return { uploadImages, uploadVideo, uploading, progress: [] as number[] }
}
