"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Send,
  CheckCircle,
  Paperclip,
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
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
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
    return <FileVideo className="h-4 w-4 text-purple-500" />
  }
  return <FileImage className="h-4 w-4 text-blue-500" />
}

export function ContactTab() {
  const [category, setCategory] = useState<Category>("general")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [extraField, setExtraField] = useState("")
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Pre-fill email from session
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

  const extraFieldLabel: Record<string, string> = {
    bug: "Steps to Reproduce",
    billing: "Transaction or Plan Details",
    feature: "How would this help you?",
  }

  const uploadFile = useCallback(async (file: File) => {
    setUploadError(null)

    // Validate type
    if (!ALLOWED_TYPES.has(file.type)) {
      setUploadError(`"${file.name}" is not a supported file type. Use PNG, JPEG, GIF, WebP, MP4, WebM, or MOV.`)
      return
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`"${file.name}" is ${formatFileSize(file.size)}. Maximum file size is 25MB.`)
      return
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Create preview for images
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

    // Simulate progress (real progress not available with fetch)
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
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/support/upload", {
        method: "POST",
        body: formData,
      })

      const json = await res.json()

      clearInterval(progressInterval)

      if (!res.ok || !json.ok) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? { ...f, status: "error", progress: 0, errorMessage: json.message || "Upload failed" }
              : f
          )
        )
        return
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: "done",
                progress: 100,
                signedUrl: json.signedUrl,
                storagePath: json.storagePath,
              }
            : f
        )
      )
    } catch (err) {
      clearInterval(progressInterval)
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: "error", progress: 0, errorMessage: "Network error. Please try again." }
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

  // Drag and drop handlers
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
    if (!subject.trim() || !description.trim()) return

    setSending(true)

    // Build attachment links section
    const attachmentLines =
      completedFiles.length > 0
        ? [
            "",
            "--- Attachments ---",
            ...completedFiles.map(
              (f, i) =>
                `${i + 1}. ${f.fileName} (${formatFileSize(f.fileSize)})${
                  f.signedUrl ? `
   View: ${f.signedUrl}` : `
   Path: ${f.storagePath}`
                }`
            ),
            "",
            "Note: Attachment links expire in 7 days.",
          ]
        : []

    const body = [
      `Category: ${CATEGORIES.find((c) => c.value === category)?.label}`,
      `Email: ${email}`,
      "",
      `Subject: ${subject}`,
      "",
      `Description:`,
      description,
      extraField ? `
${extraFieldLabel[category] || "Additional Info"}:
${extraField}` : "",
      ...attachmentLines,
    ]
      .filter(Boolean)
      .join("\n")

    const mailtoUrl = `mailto:support@getflowetic.com?subject=${encodeURIComponent(
      `[${CATEGORIES.find((c) => c.value === category)?.label}] ${subject}`
    )}&body=${encodeURIComponent(body)}`

    window.location.href = mailtoUrl

    setTimeout(() => {
      setSending(false)
      setSent(true)
    }, 500)
  }

  if (sent) {
    return (
      <div className="max-w-lg rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle className="mx-auto h-10 w-10 text-emerald-500" />
        <h3 className="mt-3 text-sm font-semibold text-gray-900">Message prepared!</h3>
        <p className="mt-1 text-sm text-gray-600">
          Your email client should have opened with the message pre-filled.
          {completedFiles.length > 0 && " Attachment links are included in the email body."}
          {" "}If it didn&apos;t open, you can email us directly at{" "}
          <a
            href="mailto:support@getflowetic.com"
            className="font-medium text-blue-600 hover:underline"
          >
            support@getflowetic.com
          </a>
        </p>
        <button
          onClick={() => {
            setSent(false)
            setSubject("")
            setDescription("")
            setExtraField("")
            setCategory("general")
            setFiles([])
            setUploadError(null)
          }}
          className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <div className="space-y-5">
        {/* Category */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as Category)
              setExtraField("")
            }}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of your question or issue"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Tell us more about what you need help with..."
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Conditional extra field */}
        {extraFieldLabel[category] && (
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
              {extraFieldLabel[category]}
            </label>
            <textarea
              value={extraField}
              onChange={(e) => setExtraField(e.target.value)}
              rows={3}
              placeholder={
                category === "bug"
                  ? "1. Go to...\n2. Click on...\n3. See error..."
                  : category === "billing"
                    ? "Plan name, transaction date, amount..."
                    : "Describe the use case and expected impact..."
              }
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}

        {/* File Upload Zone */}
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
            Attachments
            <span className="ml-1 normal-case tracking-normal font-normal text-gray-300">
              (optional — screenshots or screen recordings)
            </span>
          </label>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => activeFileCount < MAX_FILES && fileInputRef.current?.click()}
            className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
              dragOver
                ? "border-blue-400 bg-blue-50"
                : activeFileCount >= MAX_FILES
                  ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Upload className={`h-5 w-5 ${dragOver ? "text-blue-500" : "text-gray-400"}`} />
            <p className="mt-2 text-sm text-gray-600">
              {activeFileCount >= MAX_FILES ? (
                "Maximum files reached"
              ) : (
                <>
                  <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-gray-400">
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
              e.target.value = "" // Reset so same file can be re-selected
            }}
          />

          {/* Upload error */}
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

          {/* File list */}
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
                  {/* Preview or icon */}
                  {f.previewUrl ? (
                    <img
                      src={f.previewUrl}
                      alt=""
                      className="h-9 w-9 flex-shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-gray-100">
                      <FileTypeIcon type={f.fileType} />
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{f.fileName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{formatFileSize(f.fileSize)}</span>
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

                    {/* Progress bar */}
                    {f.status === "uploading" && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-1 rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${f.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {f.status === "uploading" ? (
                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-400" />
                  ) : (
                    <button
                      onClick={() => removeFile(f.id)}
                      className="flex-shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
            Your Email
          </label>
          <input
            type="email"
            value={email}
            readOnly
            className="mt-1 w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
          <p className="mt-1 text-[11px] text-gray-400">Pre-filled from your account.</p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!subject.trim() || !description.trim() || sending || anyUploading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          {anyUploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Uploading files...
            </>
          ) : (
            <>
              <Send size={16} />
              {sending ? "Opening email..." : "Send Message"}
            </>
          )}
        </button>

        <p className="text-xs text-gray-400">
          This will open your email client with the message pre-filled.
          {completedFiles.length > 0 && " Attachment links will be included in the email body (valid for 7 days)."}
          {" "}We typically respond within 24 hours.
        </p>
      </div>
    </div>
  )
}
