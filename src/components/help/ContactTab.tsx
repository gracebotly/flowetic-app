"use client"

import { useState, useEffect } from "react"
import { Send, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Category = "general" | "bug" | "billing" | "feature" | "other"

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "general", label: "General Question" },
  { value: "bug", label: "Bug Report" },
  { value: "billing", label: "Billing Issue" },
  { value: "feature", label: "Feature Request" },
  { value: "other", label: "Other" },
]

export function ContactTab() {
  const [category, setCategory] = useState<Category>("general")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [extraField, setExtraField] = useState("")
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

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

  async function handleSubmit() {
    if (!subject.trim() || !description.trim()) return

    setSending(true)

    // Build mailto body for MVP (replace with Resend API route later)
    const body = [
      `Category: ${CATEGORIES.find((c) => c.value === category)?.label}`,
      `Email: ${email}`,
      "",
      `Subject: ${subject}`,
      "",
      `Description:`,
      description,
      extraField ? `\n${extraFieldLabel[category] || "Additional Info"}:\n${extraField}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    const mailtoUrl = `mailto:support@getflowetic.com?subject=${encodeURIComponent(
      `[${CATEGORIES.find((c) => c.value === category)?.label}] ${subject}`
    )}&body=${encodeURIComponent(body)}`

    window.location.href = mailtoUrl

    // Show success state after a brief delay
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
          Your email client should have opened with the message pre-filled. If it didn&apos;t, you can
          email us directly at{" "}
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
          disabled={!subject.trim() || !description.trim() || sending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={16} />
          {sending ? "Opening email..." : "Send Message"}
        </button>

        <p className="text-xs text-gray-400">
          This will open your email client with the message pre-filled. We typically respond within 24 hours.
        </p>
      </div>
    </div>
  )
}
