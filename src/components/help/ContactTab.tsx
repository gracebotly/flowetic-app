"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Send,
  CheckCircle,
  X,
  Upload,
  FileImage,
  FileVideo,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Category = "general" | "bug" | "billing" | "feature" | "other"

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "general", label: "General Question" },
  { value: "bug", label: "Bug Report" },
  { value: "billing", label: "Billing Issue" },
  { value: "feature", label: "Feature Request" },
  { value: "other", label: "Other" },
]

const MAX_FILES = 3
const MAX_FILE_SIZE = 25 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
])

interface UploadedFile {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  signedUrl: string | null
  storagePath: string
  status: "uploading" | "done" | "error"
  progress: number
  errorMessage?: string
  previewUrl?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileTypeIcon({ type }: { type: string }) {
  if (type.startsWith("video/")) {
    return <FileVideo className="h-4 w-4 text-slate-400" />
  }
  return <FileImage className="h-4 w-4 text-slate-400" />
}

export function ContactTab() {
  const [category, setCategory] = useState<Category>("general")
  const [description, setDescription] = useState("")
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user?.email) setEmail(user.email)
      } catch {}
    })()
  }, [])

  const uploadFile = useCallback(async (file: File) => {
    setUploadError(null)

    if (!ALLOWED_TYPES.has(file.type)) {
      setUploadError(`"${file.name}" is not a supported file type.`)
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`"${file.name}" exceeds the 25MB limit.`)
      return
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    let previewUrl: string | undefined
    if (file.type.startsWith("image/")) {
      previewUrl = URL.createObjectURL(file)
    }

    const uploadEntry: UploadedFile = {
      id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      signedUrl: null,
      storagePath: "",
      status: "uploading",
      progress: 0,
      previewUrl,
    }

    setFiles((prev) => [...prev, uploadEntry])

    const progressInterval = setInterval(() => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id && f.status === "uploading" && f.progress < 90
            ? { ...f, progress: f.progress + 10 }
            : f
        )
      )
    }, 200)

    try {
      const VERCEL_BODY_LIMIT = 4 * 1024 * 1024 // 4MB (safe margin under 4.5MB)

      let resultJson: any

      if (file.size > VERCEL_BODY_LIMIT) {
        // Large file: get a signed upload URL and upload directly to Supabase
        const params = new URLSearchParams({
          fileName: file.name,
          fileType: file.type,
          fileSize: String(file.size),
        })
        const urlRes = await fetch(`/api/support/upload?${params.toString()}`)
        const urlJson = await urlRes.json()

        if (!urlRes.ok || !urlJson.ok) {
          clearInterval(progressInterval)
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? { ...f, status: "error", progress: 0, errorMessage: urlJson.message || "Upload preparation failed." }
                : f
            )
          )
          return
        }

        // Upload directly to Supabase Storage using the signed URL
        const uploadRes = await fetch(urlJson.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        })

        if (!uploadRes.ok) {
          clearInterval(progressInterval)
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? { ...f, status: "error", progress: 0, errorMessage: "Direct upload failed. Please try a smaller file or try again." }
                : f
            )
          )
          return
        }

        // Get a signed download URL for the attachment
        const supabase = createClient()
        const { data: signedData } = await supabase.storage
          .from("support-attachments")
          .createSignedUrl(urlJson.storagePath, 60 * 60 * 24 * 7)

        resultJson = {
          ok: true,
          signedUrl: signedData?.signedUrl || null,
          storagePath: urlJson.storagePath,
        }
      } else {
        // Small file: upload through the serverless function
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch("/api/support/upload", {
          method: "POST",
          body: formData,
        })

        resultJson = await res.json().catch(() => ({}))

        if (!res.ok || !resultJson.ok) {
          clearInterval(progressInterval)
          setFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? { ...f, status: "error", progress: 0, errorMessage: resultJson.message || "Upload failed." }
                : f
            )
          )
          return
        }
      }

      clearInterval(progressInterval)

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: "done",
                progress: 100,
                signedUrl: resultJson.signedUrl,
                storagePath: resultJson.storagePath,
              }
            : f
        )
      )
    } catch (err: unknown) {
      clearInterval(progressInterval)
      const message = err instanceof Error && err.message.includes("413")
        ? "File is too large for upload. Maximum is 25MB."
        : "Upload failed. Please check your connection and try again."
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: "error", progress: 0, errorMessage: message }
            : f
        )
      )
    }
  }, [])

  const handleFilesSelected = useCallback(
    (selectedFiles: FileList | File[]) => {
      const currentCount = files.filter((f) => f.status !== "error").length
      const remaining = MAX_FILES - currentCount
      if (remaining <= 0) {
        setUploadError(`Maximum ${MAX_FILES} files allowed.`)
        return
      }
      const toUpload = Array.from(selectedFiles).slice(0, remaining)
      for (const file of toUpload) {
        uploadFile(file)
      }
    },
    [files, uploadFile]
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        handleFilesSelected(e.dataTransfer.files)
      }
    },
    [handleFilesSelected]
  )

  const completedFiles = files.filter((f) => f.status === "done")
  const anyUploading = files.some((f) => f.status === "uploading")
  const activeFileCount = files.filter((f) => f.status !== "error").length

  async function handleSubmit() {
    if (!description.trim()) return

    setSending(true)
    setSendError(null)

    try {
      const res = await fetch("/api/support/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description: description.trim(),
          attachments: completedFiles.map((f) => ({
            fileName: f.fileName,
            signedUrl: f.signedUrl,
            storagePath: f.storagePath,
          })),
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.ok) {
        setSendError(json.error || "Failed to send. Please try again.")
        setSending(false)
        return
      }

      setSent(true)
      setSending(false)
    } catch {
      setSendError("Network error. Please try again.")
      setSending(false)
    }
  }

  // ── Success state: simple inline confirmation ──
  if (sent) {
    return (
      <div className="max-w-lg">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle className="mx-auto h-8 w-8 text-emerald-500" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            Message sent
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            We received your message and will respond within 24 hours to{" "}
            <span className="font-medium">{email}</span>.
          </p>
          <button
            onClick={() => {
              setSent(false)
              setDescription("")
              setCategory("general")
              setFiles([])
              setUploadError(null)
              setSendError(null)
            }}
            className="mt-4 text-sm font-medium text-blue-600 transition-colors duration-200 hover:text-blue-700"
          >
            Send another message
          </button>
        </div>
      </div>
    )
  }

  // ── Form ──
  return (
    <div className="max-w-lg">
      <div className="space-y-5">
        {/* Category */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 transition-colors duration-200 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Tell us more about what you need help with..."
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 transition-colors duration-200 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
            Attachments
            <span className="ml-1 normal-case tracking-normal font-normal text-slate-300">
              (optional — screenshots or screen recordings)
            </span>
          </label>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => activeFileCount < MAX_FILES && fileInputRef.current?.click()}
            className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors duration-200 ${
              dragOver
                ? "border-blue-400 bg-blue-50"
                : activeFileCount >= MAX_FILES
                  ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Upload className={`h-5 w-5 ${dragOver ? "text-blue-500" : "text-slate-400"}`} />
            <p className="mt-2 text-sm text-slate-600">
              {activeFileCount >= MAX_FILES ? (
                "Maximum files reached"
              ) : (
                <>
                  <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              PNG, JPEG, GIF, WebP, MP4, WebM, MOV · Max 25MB per file · Up to 3 files
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFilesSelected(e.target.files)
              e.target.value = ""
            }}
          />

          {uploadError && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-xs text-red-700">{uploadError}</p>
              <button
                onClick={() => setUploadError(null)}
                className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((f) => (
                <div
                  key={f.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                    f.status === "error"
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  {f.previewUrl ? (
                    <img
                      src={f.previewUrl}
                      alt=""
                      className="h-9 w-9 flex-shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-slate-100">
                      <FileTypeIcon type={f.fileType} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{f.fileName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{formatFileSize(f.fileSize)}</span>
                      {f.status === "uploading" && (
                        <span className="text-xs text-blue-500">Uploading...</span>
                      )}
                      {f.status === "done" && (
                        <span className="text-xs text-emerald-600">Uploaded</span>
                      )}
                      {f.status === "error" && (
                        <span className="text-xs text-red-600">{f.errorMessage || "Failed"}</span>
                      )}
                    </div>

                    {f.status === "uploading" && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-1 rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${f.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {f.status === "uploading" ? (
                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-400" />
                  ) : (
                    <button
                      onClick={() => removeFile(f.id)}
                      className="flex-shrink-0 rounded p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600"
                      aria-label={`Remove ${f.fileName}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Email (read-only) */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
            Your email
          </label>
          <input
            type="email"
            value={email}
            readOnly
            className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-slate-500"
          />
          <p className="mt-1 text-[11px] text-slate-400">Pre-filled from your account.</p>
        </div>

        {/* Send error */}
        {sendError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <p className="text-xs text-red-700">{sendError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!description.trim() || sending || anyUploading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-slate-800 disabled:opacity-50"
        >
          {anyUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading files...
            </>
          ) : sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send message
            </>
          )}
        </button>

        <p className="text-xs text-slate-400">
          We typically respond within 24 hours.
        </p>
      </div>
    </div>
  )
}
