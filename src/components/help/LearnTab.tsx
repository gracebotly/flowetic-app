"use client"

import { ExternalLink } from "lucide-react"

type VideoResource = {
  title: string
  description: string
  youtubeId: string
}

type GuideLink = {
  title: string
  description: string
  href: string
}

const VIDEOS: VideoResource[] = [
  {
    title: "How to White Label Your Vapi Voice Agent in 60 Seconds",
    description:
      "Take your existing Vapi voice agent and give your clients a professional, white-labeled analytics portal — branded with your logo, your colors, and connected to Stripe so you can charge for it.",
    youtubeId: "l-2JSK8OkQQ",
  },
  {
    title: "How to White Label Your Retell AI Voice Agent (Client Portal)",
    description:
      "Build a white-labeled Retell AI client dashboard with Stripe billing in about 60 seconds. No n8n. No Google Sheets. No Lovable.",
    youtubeId: "_mIKPUgM4gA",
  },
  {
    title: "How to Turn Your Make Workflow Into a SaaS",
    description:
      "Turn your Make.com automation into a branded SaaS product your clients pay monthly to access — with Stripe billing built in. No more delivering results through Google Sheets.",
    youtubeId: "_5Mr51jKSiM",
  },
]

const GUIDES: GuideLink[] = [
  {
    title: "Connecting Vapi or Retell",
    description: "Step-by-step guide to connecting your voice AI platform and importing call data.",
    href: "https://www.youtube.com/watch?v=l-2JSK8OkQQ",
  },
  {
    title: "Creating Your First Client Portal",
    description: "How to turn a connected workflow into a shareable analytics dashboard or sellable product.",
    href: "https://www.youtube.com/watch?v=_5Mr51jKSiM",
  },
  {
    title: "Managing Clients & Magic Links",
    description: "Add clients, assign portals, and share branded portal links.",
    href: "https://www.youtube.com/@Getflowetic",
  },
]

export function LearnTab() {
  return (
    <div className="max-w-3xl space-y-10">
      {/* Video Section */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Video Tutorials</h2>
        <div className="mt-4 space-y-4">
          {VIDEOS.map((video) => (
            <div
              key={video.youtubeId}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white"
            >
              <div className="aspect-video bg-gray-900">
                <iframe
                  src={`https://www.youtube.com/embed/${video.youtubeId}`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-semibold text-gray-900">{video.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{video.description}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          More tutorials coming soon.{" "}
          <a
            href="https://www.youtube.com/@Getflowetic"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Subscribe on YouTube
          </a>{" "}
          to get notified.
        </p>
      </div>

      {/* Written Guides */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Written Guides</h2>
        <div className="mt-4 space-y-2">
          {GUIDES.map((guide) => (
            <a
              key={guide.title}
              href={guide.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/30"
            >
              <div>
                <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                  {guide.title}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">{guide.description}</p>
              </div>
              <ExternalLink
                size={14}
                className="mt-0.5 shrink-0 text-gray-300 transition group-hover:text-blue-400"
              />
            </a>
          ))}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Documentation is growing — check back regularly for new guides and tips.
        </p>
      </div>
    </div>
  )
}
