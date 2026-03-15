"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Settings, HelpCircle, LogOut, Copy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function AccountCardPanel({
  email,
  plan = "Agency",
}: {
  email: string
  plan?: string
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="w-72 rounded-xl border border-gray-200 bg-white shadow-xl outline-none">
      {/* Header — clean, no gradient */}
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            {email?.charAt(0)?.toUpperCase() || "A"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">{plan}</p>
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs text-gray-500">{email}</p>
              <button
                onClick={copyEmail}
                className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Copy email"
              >
                <Copy size={12} />
              </button>
              {copied && (
                <span className="text-[10px] font-medium text-emerald-600">Copied</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-1.5">
        <button
          onClick={() => router.push("/control-panel/settings")}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Settings size={16} className="text-gray-400" />
          Settings
        </button>
        <button
          onClick={() => router.push("/control-panel/help")}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <HelpCircle size={16} className="text-gray-400" />
          Help & Updates
        </button>
      </div>

      {/* Log Out */}
      <div className="border-t border-gray-100 p-1.5">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={16} className="text-gray-400" />
          Log Out
        </button>
      </div>
    </div>
  )
}
