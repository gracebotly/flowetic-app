"use client"

import { Copy, ExternalLink, HelpCircle, Key, CreditCard, BookOpen, Mail, Download, Building2, Settings, ShieldCheck, Globe, BarChart3 } from "lucide-react"
import { useState } from "react"

function RowButton({
  icon,
  label,
  right,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  right?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
    >
      <span className="flex items-center gap-2 text-gray-800">
        {icon}
        {label}
      </span>
      <span className="text-gray-500">
        {right ?? <ExternalLink size={16} className="opacity-0 transition-opacity group-hover:opacity-100" />}
      </span>
    </button>
  )
}

/**
 * AccountCardPanel - content-only card; render inside a Radix Popover.Content
 */
export function AccountCardPanel({
  email,
  plan = "Starter Plan",
  supportEmail = "support@getflowetic.com",
  docsUrl = "https://docs.getflowetic.com",
  statusUrl = "https://status.getflowetic.com",
  privacyUrl = "#",
  termsUrl = "#",
}: {
  email: string
  plan?: "Starter Plan" | "Premium Plan" | string
  supportEmail?: string
  docsUrl?: string
  statusUrl?: string
  privacyUrl?: string
  termsUrl?: string
}) {
  const [copied, setCopied] = useState(false)
  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  return (
    <div className="z-50 w-80 rounded-xl border border-gray-200 bg-white p-0 shadow-xl outline-none">
      {/* Header gradient */}
      <div className="rounded-t-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-600 p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/20 text-center font-bold leading-10">GF</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{plan}</span>
              {plan.toLowerCase().includes("premium") ? (
                <>
                  <ShieldCheck size={16} className="text-emerald-300" aria-hidden="true" />
                  <span className="sr-only">Premium</span>
                </>
              ) : null}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-white/90">
              <span className="truncate">{email}</span>
              <button onClick={copyEmail} className="rounded bg-white/10 px-1.5 py-0.5 hover:bg-white/20" aria-label="Copy email">
                <Copy size={14} />
              </button>
              {copied && <span className="text-emerald-200">Copied</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 p-3">
        <RowButton icon={<ShieldCheck size={16} />} label="Upgrade Plan" onClick={() => window.location.assign("/control-panel/settings")} />
        <RowButton icon={<CreditCard size={16} />} label="Billing" onClick={() => window.location.assign("/control-panel/settings")} />
        <RowButton icon={<BarChart3 size={16} />} label="Usage" onClick={() => window.location.assign("/control-panel/settings")} />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <RowButton icon={<BookOpen size={16} />} label="Documentation" onClick={() => window.open(docsUrl, "_blank")} />
          <RowButton icon={<HelpCircle size={16} />} label="Contact Support" onClick={() => (window.location.href = `mailto:${supportEmail}`)} right={<Mail size={16} />} />
          <RowButton icon={<Globe size={16} />} label="System Status" onClick={() => window.open(statusUrl, "_blank")} />
        </div>

        <div className="mt-3 space-y-2">
          <RowButton icon={<Settings size={16} />} label="Settings" onClick={() => window.location.assign("/control-panel/settings")} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-b-xl border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        <div className="space-x-2">
          <a href={privacyUrl} target="_blank" className="hover:underline">Privacy</a>
          <span>·</span>
          <a href={termsUrl} target="_blank" className="hover:underline">Terms</a>
        </div>
        <div className="flex items-center gap-2">
          <span>US</span>
          <span className="text-gray-400">•</span>
          <span>2025 © Getflowetic</span>
        </div>
      </div>
    </div>
  )
}