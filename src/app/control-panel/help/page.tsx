"use client"

import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Sparkles, BookOpen, Mail } from "lucide-react"
import { WhatsNewTab } from "@/components/help/WhatsNewTab"
import { LearnTab } from "@/components/help/LearnTab"
import { ContactTab } from "@/components/help/ContactTab"

type TabKey = "whats-new" | "learn" | "contact"

const TABS: { key: TabKey; label: string; icon: typeof Sparkles }[] = [
  { key: "whats-new", label: "What's New", icon: Sparkles },
  { key: "learn", label: "Learn", icon: BookOpen },
  { key: "contact", label: "Contact", icon: Mail },
]

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("whats-new")

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Help & Updates"
        subtitle="Stay up to date, learn the platform, and get in touch."
      />

      <div className="px-8 pt-6">
        {/* Tab bar */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 border-b-2 px-1 py-3 text-sm font-medium transition ${
                    isActive
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab content */}
        <div className="mt-6 pb-12">
          {activeTab === "whats-new" && <WhatsNewTab />}
          {activeTab === "learn" && <LearnTab />}
          {activeTab === "contact" && <ContactTab />}
        </div>
      </div>
    </div>
  )
}
