'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Plus, Package, AlertCircle, FileText, Edit2,
  Check, X, LayoutTemplate, ChevronRight, Trash2,
} from 'lucide-react'

import { useProduct, useProductDefects } from '../../hooks/useProducts'
import { useTemplates } from '../../hooks/useTemplates'
import { useImageUpload } from '../../hooks/useImageUpload'
import DefectCard from '../../components/products/DefectCard'
import DefectForm from '../../components/products/DefectForm'
import ImageAnnotator from '../../components/ui/ImageAnnotator'
import TemplateValueField from '../../components/products/TemplateValueField'
import TemplateApplySheet from '../../components/products/TemplateApplySheet'
import type { TemplateFieldValue } from '../../types/product'
import type { ProductDefectFormData } from '../../types/product'
import type { ProductTemplate, TemplateField } from '../../types/template'
import { generateId } from '../../utils/generateId'



type Tab = 'info' | 'defects'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { product, loading: productLoading, updateProduct } = useProduct(id)
  const { defects, loading: defectsLoading, addDefect } = useProductDefects(id!)
  const { templates } = useTemplates()
  const { uploadImages, uploadVideo, uploading } = useImageUpload()

  const [tab, setTab] = useState<Tab>('info')
  const [showDefectForm, setShowDefectForm] = useState(false)
  const [showApplySheet, setShowApplySheet] = useState(false)
  const [annotatingFieldId, setAnnotatingFieldId] = useState<string | null>(null)

  // 編集モード
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  // 工程コード（複数はカンマ区切りで編集）
  const [editProcessCodes, setEditProcessCodes] = useState('')
  // 適用テンプレートのリスト：instanceId を持たせる
  const [editAppliedTemplates, setEditAppliedTemplates] = useState<{ instanceId: string, templateId: string }[]>([])
  const [editValues, setEditValues] = useState<TemplateFieldValue[]>([])
  // 写真フィールドの pending ファイル（instanceId + fieldId → File）
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, File>>({})
  // 動画フィールドの pending ファイル（instanceId + fieldId → File）
  const [pendingVideos, setPendingVideos] = useState<Record<string, File>>({})
  const [saving, setSaving] = useState(false)

  if (productLoading) {
    return <p className="p-8 text-center text-sm text-slate-400">読み込み中...</p>
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-slate-400">
        <Package size={36} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">製品が見つかりません</p>
      </div>
    )
  }

  // レガシーデータ互換：appliedTemplateIds を appliedTemplateInstances に変換
  const appliedInstances = product.appliedTemplateInstances ??
    (product.appliedTemplateIds ?? []).map(tid => ({ instanceId: `legacy-${tid}`, templateId: tid }))

  const templateValues = product.templateValues ?? []

  function startEdit() {
    setEditName(product!.name)
    setEditProcessCodes((product!.processCodes ?? []).join(', '))
    setEditAppliedTemplates(appliedInstances)
    setEditValues(product!.templateValues ?? [])
    setPendingPhotos({})
    setPendingVideos({})
    setEditing(true)
  }

  // テンプレート適用変更時：追加分は空 value を生成、削除分は values から除去
  function applyTemplates(ids: string[]) {
    // 現在のインスタンスリストと新しいIDリストを突き合わせる
    // シンプルにするため、基本的には新しいリストに合わせて再構成するが、
    // 既存の instanceId が維持できる場合は維持する
    const newApplied: typeof editAppliedTemplates = []
    const newValues: TemplateFieldValue[] = []

    // どのデータを引き継ぐかのマップ（templateId単位だと重複時に困るので工夫が必要だが、
    // ここでは新しい構成として組み直す）
    for (const tid of ids) {
      const tmpl = templates.find((t) => t.id === tid)
      if (!tmpl) continue

      // 既存の同一テンプレート由来のインスタンスがあれば、まだ使っていないものを一つ拾う
      const existingInstance = editAppliedTemplates.find(prev =>
        prev.templateId === tid && !newApplied.some(n => n.instanceId === prev.instanceId)
      )

      const instanceId = existingInstance?.instanceId ?? generateId()
      newApplied.push({ instanceId, templateId: tid })

      for (const field of tmpl.fields) {
        const existingVal = editValues.find((v) =>
          v.templateId === tid &&
          v.fieldId === field.id &&
          v.instanceId === instanceId
        )
        newValues.push(
          existingVal ?? {
            templateId: tid,
            instanceId: instanceId,
            fieldId: field.id,
            label: field.label,
            type: field.type,
          }
        )
      }
    }

    setEditAppliedTemplates(newApplied)
    setEditValues(newValues)
  }

  function updateValue(updated: TemplateFieldValue) {
    setEditValues((prev) => {
      const exists = prev.some(v => v.instanceId === updated.instanceId && v.fieldId === updated.fieldId)
      if (exists) {
        return prev.map((v) =>
          v.instanceId === updated.instanceId && v.fieldId === updated.fieldId ? updated : v
        )
      }
      return [...prev, updated]
    })
  }

  function handlePhotoSelect(fieldId: string, instanceId: string, templateId: string, file: File, fieldType = 'photo' as import('../../types/template').TemplateFieldType) {
    const previewUrl = URL.createObjectURL(file)
    const key = `${instanceId}-${fieldId}`
    setPendingPhotos((prev) => ({ ...prev, [key]: file }))
    setPendingVideos((prev) => { const n = { ...prev }; delete n[key]; return n })
    const existing = editValues.find((v) => v.fieldId === fieldId && v.instanceId === instanceId)
    updateValue(existing
      ? { ...existing, photoUrl: previewUrl, videoUrl: undefined }
      : { templateId, instanceId, fieldId, label: '', type: fieldType, photoUrl: previewUrl }
    )
  }

  function handleVideoSelect(fieldId: string, instanceId: string, templateId: string, file: File, fieldType = 'video' as import('../../types/template').TemplateFieldType) {
    const previewUrl = URL.createObjectURL(file)
    const key = `${instanceId}-${fieldId}`
    setPendingVideos((prev) => ({ ...prev, [key]: file }))
    setPendingPhotos((prev) => { const n = { ...prev }; delete n[key]; return n })
    const existing = editValues.find((v) => v.fieldId === fieldId && v.instanceId === instanceId)
    updateValue(existing
      ? { ...existing, videoUrl: previewUrl, photoUrl: undefined }
      : { templateId, instanceId, fieldId, label: '', type: fieldType, videoUrl: previewUrl }
    )
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const resolvedValues = await Promise.all(
        editValues.map(async (v) => {
          const key = `${v.instanceId}-${v.fieldId}`
          const photoFile = pendingPhotos[key]
          if (photoFile && v.photoUrl) {
            const [url] = await uploadImages([photoFile], `products/${id}/templates`)
            return { ...v, photoUrl: url }
          }
          const videoFile = pendingVideos[key]
          if (videoFile && v.videoUrl) {
            const url = await uploadVideo(videoFile, `products/${id}/templates`)
            return { ...v, videoUrl: url }
          }
          return v
        })
      )
      // Firestoreはundefinedを受け付けないため保存前に除去する
      const cleanValues = resolvedValues.map(
        (v) => Object.fromEntries(Object.entries(v).filter(([, val]) => val !== undefined)) as typeof v
      )
      await updateProduct(id!, {
        name: editName.trim(),
        processCodes: editProcessCodes.split(/[,、\s]+/).map((c) => c.trim()).filter(Boolean),
        appliedTemplateIds: editAppliedTemplates.map(t => t.templateId),
        appliedTemplateInstances: editAppliedTemplates,
        templateValues: cleanValues,
      })
      setEditing(false)
    } catch (err) {
      alert(`保存に失敗しました。\n${err instanceof Error ? err.message : '不明なエラー'}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`「${product!.name}」を削除しますか？`)) return
    await updateProduct(id!, { isActive: false })
    router.replace('/products')
  }

  async function handleAnnotationSave(blob: Blob) {
    if (!annotatingFieldId) return
    // 注釈時は instanceId も考慮した特定が必要
    // ここでは簡易化のため annotation 側も instanceId 対応が必要だが、
    // まずは annotatingFieldId を Unique なもの（instanceId + fieldId）にする
    const [instanceId, fieldId] = annotatingFieldId.split(':::')
    const file = new File([blob], `annotated_${Date.now()}.jpg`, { type: 'image/jpeg' })
    const [newUrl] = await uploadImages([file], `products/${id}/templates`)
    const updated = templateValues.map((v) =>
      v.fieldId === fieldId && (v.instanceId === instanceId || (!v.instanceId && instanceId === `legacy-${v.templateId}`)) ? { ...v, photoUrl: newUrl } : v
    )
    await updateProduct(id!, { templateValues: updated })
    setAnnotatingFieldId(null)
  }

  async function handleAddDefect(data: ProductDefectFormData, photos: File[]) {
    const photoUrls =
      photos.length > 0 ? await uploadImages(photos, `products/${id}/defects/${Date.now()}`) : []
    await addDefect(data, product!.name, photoUrls)
  }

  function hasValue(val: TemplateFieldValue): boolean {
    if (val.textValue?.trim()) return true
    if (val.photoUrl) return true
    if (val.videoUrl) return true
    if (val.boolValue !== undefined) return true
    return false
  }

  // 閲覧モード用：適用テンプレートとそのフィールド値を取得
  const appliedTemplates = appliedInstances
    .map((inst) => {
      const tmpl = templates.find((t) => t.id === inst.templateId)
      return tmpl ? { ...tmpl, instanceId: inst.instanceId } : null
    })
    .filter(Boolean) as (ProductTemplate & { instanceId: string })[]

  // 注釈対象の写真URL
  const annotatingValue = annotatingFieldId
    ? (() => {
        const [instId, fId] = annotatingFieldId.split(':::')
        return templateValues.find((v) => v.fieldId === fId && (v.instanceId === instId || (!v.instanceId && instId === `legacy-${v.templateId}`)))
      })()
    : null

  return (
    <>
      <div>
        {/* ヘッダー */}
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-5 pt-6 pb-10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/products')}
              className="flex items-center gap-1.5 text-emerald-300 active:opacity-70"
            >
              <ArrowLeft size={18} />
              <span className="text-sm">一覧</span>
            </button>
            {!editing ? (
              <div className="flex items-center gap-3">
                <button onClick={handleDelete} className="text-red-300 active:opacity-70">
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 text-emerald-300 active:opacity-70"
                >
                  <Edit2 size={16} />
                  <span className="text-sm">編集</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="text-emerald-300 active:opacity-70 disabled:opacity-40"
                >
                  <X size={20} />
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving || uploading}
                  className="text-emerald-300 active:opacity-70 disabled:opacity-40"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-emerald-300/30 border-t-emerald-300 rounded-full animate-spin" />
                  ) : (
                    <Check size={20} />
                  )}
                </button>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight truncate">{product.name}</h1>
          {(product.processCodes ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {product.processCodes!.map((code) => (
                <span
                  key={code}
                  className="text-xs font-mono font-semibold bg-white/15 text-emerald-100 rounded-full px-2.5 py-0.5"
                >
                  {code}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 保存中バナー */}
        {saving && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin shrink-0" />
            <span className="text-xs font-semibold text-amber-700">
              保存中です。動画がある場合は時間がかかることがあります...
            </span>
          </div>
        )}

        {/* タブ */}
        <div className="flex bg-white shadow-sm -mt-4 mx-4 rounded-2xl overflow-hidden">
          <button
            onClick={() => setTab('info')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors ${
              tab === 'info' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'
            }`}
          >
            <FileText size={15} />
            製品情報
          </button>
          <button
            onClick={() => setTab('defects')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold transition-colors ${
              tab === 'defects' ? 'text-red-600 bg-red-50' : 'text-slate-400'
            }`}
          >
            <AlertCircle size={15} />
            不良履歴
            {defects.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {defects.length}
              </span>
            )}
          </button>
        </div>

        <div className="px-4 mt-4 pb-8 space-y-4">
          {/* 製品情報タブ */}
          {tab === 'info' && (
            <>
              {/* 製品名編集（編集モードのみ） */}
              {editing && (
                <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">製品名</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">工程コード（複数はカンマ区切り）</label>
                    <input
                      type="text"
                      value={editProcessCodes}
                      onChange={(e) => setEditProcessCodes(e.target.value)}
                      placeholder="例：C123456, C234567"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* 編集モード: テンプレート変更ボタン */}
              {editing && (
                <button
                  type="button"
                  onClick={() => setShowApplySheet(true)}
                  className="w-full bg-white rounded-2xl shadow-md p-4 flex items-center justify-between active:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <LayoutTemplate size={16} className="text-emerald-600" />
                    <span className="text-sm font-semibold text-slate-700">テンプレートを変更</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {editAppliedTemplates.length === 0
                        ? '未選択'
                        : editAppliedTemplates
                            .map((t) => templates.find((tmp) => tmp.id === t.templateId)?.name ?? '')
                            .filter(Boolean)
                            .join(', ')}
                    </span>
                    <ChevronRight size={15} className="text-slate-300" />
                  </div>
                </button>
              )}

              {/* テンプレートフィールド（編集モード） */}
              {editing && editAppliedTemplates.length > 0 && (
                <>
                  {editAppliedTemplates.map((inst, idx) => {
                    const tmpl = templates.find((t) => t.id === inst.templateId)
                    if (!tmpl) return null
                    const fields = tmpl.fields
                    if (fields.length === 0) return null
                    return (
                      <div key={`${inst.instanceId}-${idx}`} className="bg-white rounded-2xl shadow-md p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h2 className="font-bold text-slate-700 text-sm">
                            {tmpl.name}
                          </h2>
                          <span className="text-[10px] font-bold text-slate-300">#{idx + 1}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                          {fields.map((field) => {
                            const val = editValues.find(
                              (v) => (v.instanceId === inst.instanceId || (!v.instanceId && inst.instanceId === `legacy-${v.templateId}`)) && v.fieldId === field.id
                            ) ?? { templateId: inst.templateId, instanceId: inst.instanceId, fieldId: field.id, label: field.label, type: field.type }
                            return (
                              <div key={field.id} className={(field.width ?? 'full') === 'full' ? 'col-span-1 sm:col-span-2' : 'col-span-1'}>
                                <TemplateValueField
                                  value={val}
                                  editing={true}
                                  options={field.options}
                                  onChange={updateValue}
                                  onPhotoSelect={(file) => handlePhotoSelect(field.id, inst.instanceId, inst.templateId, file, field.type)}
                                  onVideoSelect={(file) => handleVideoSelect(field.id, inst.instanceId, inst.templateId, file, field.type)}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {/* テンプレートフィールド（閲覧モード） */}
              {!editing && (
                <>
                  {appliedTemplates.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-md p-6 text-center">
                      <LayoutTemplate size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="text-sm text-slate-500 mb-3">テンプレートが適用されていません</p>
                      <button
                        onClick={startEdit}
                        className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold mx-auto active:opacity-70"
                      >
                        <Edit2 size={14} />
                        テンプレートを適用する
                      </button>
                    </div>
                  ) : (
                    appliedTemplates.map((tmpl, idx) => {
                      if (!tmpl) return null
                      const filledFields = tmpl.fields.filter((field: TemplateField) => {

                        const val = templateValues.find(
                          (v) => (v.instanceId === tmpl.instanceId || (!v.instanceId && tmpl.instanceId === `legacy-${v.templateId}`)) && v.fieldId === field.id
                        )
                        return val ? hasValue(val) : false
                      })
                      if (filledFields.length === 0) return null
                      return (
                        <div key={`${tmpl.id}-${tmpl.instanceId}`} className="bg-white rounded-2xl shadow-md p-4 space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <h2 className="font-bold text-slate-700 text-sm">
                              {tmpl.name}
                            </h2>
                            <span className="text-[10px] font-bold text-slate-300">#{idx + 1}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                            {filledFields.map((field: TemplateField) => {


                              const val = templateValues.find(
                                (v) => (v.instanceId === tmpl.instanceId || (!v.instanceId && tmpl.instanceId === `legacy-${v.templateId}`)) && v.fieldId === field.id
                              )!
                              return (
                                <div key={field.id} className={(field.width ?? 'full') === 'full' ? 'col-span-1 sm:col-span-2' : 'col-span-1'}>
                                  <TemplateValueField
                                    value={val}
                                    editing={false}
                                    options={field.options}
                                    onAnnotate={() => setAnnotatingFieldId(`${tmpl.instanceId}:::${field.id}`)}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })
                  )}
                </>
              )}
            </>
          )}

          {/* 不良履歴タブ */}
          {tab === 'defects' && (
            <>
              <button
                onClick={() => setShowDefectForm(true)}
                className="w-full bg-red-500 text-white font-bold rounded-2xl py-4 shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Plus size={18} />
                不良を記録
              </button>

              <section className="bg-white rounded-2xl shadow-md overflow-hidden">
                {defectsLoading ? (
                  <p className="text-sm text-slate-400 p-4">読み込み中...</p>
                ) : defects.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <AlertCircle size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">不良履歴はありません</p>
                  </div>
                ) : (
                  <ul>
                    {defects.map((d) => (
                      <DefectCard key={d.id} defect={d} />
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {showDefectForm && (
        <DefectForm onSubmit={handleAddDefect} onClose={() => setShowDefectForm(false)} />
      )}

      {showApplySheet && (
        <TemplateApplySheet
          templates={templates}
          appliedIds={editAppliedTemplates.map(t => t.templateId)}
          onApply={applyTemplates}
          onClose={() => setShowApplySheet(false)}
        />
      )}

      {annotatingFieldId && annotatingValue?.photoUrl && (
        <ImageAnnotator
          imageUrl={annotatingValue.photoUrl}
          onSave={handleAnnotationSave}
          onClose={() => setAnnotatingFieldId(null)}
        />
      )}
    </>
  )
}
