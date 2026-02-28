"use client";
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, BookOpen, MessageSquare, AlignLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RendererProps } from "../componentRegistry";
import { buildCardStyle, buildCardHoverStyle, isColorDark } from "../componentRegistry";

const CONTENT_ICONS: Record<string, LucideIcon> = {
  "file-text": FileText,
  "book-open": BookOpen,
  "message-square": MessageSquare,
  "align-left": AlignLeft,
  default: FileText,
};

/**
 * ContentCard — Renders rich text content from a single record field.
 *
 * Props (from hybridBuilder):
 *   title: string          — Field display name
 *   contentField: string   — Field key to read content from
 *   content: string        — Pre-enriched content text (set by enrichContentCard)
 *   renderAs: "rich-text" | "plain" | "markdown"
 *   maxHeight: number      — Max container height in px (default 400)
 *   icon: string           — Lucide icon name
 *
 * Enrichment: enrichContentCard() reads the first event's contentField value
 * and sets props.content. If content is empty, shows empty state.
 */
export function ContentCardRenderer({
  component,
  designTokens: dt,
  deviceMode,
  isEditing,
  onClick,
}: RendererProps) {
  const primary = dt.colors?.primary ?? "#3b82f6";
  const accent = dt.colors?.accent ?? "#14B8A6";
  const textColor = dt.colors?.text ?? "#111827";
  const bgColor = dt.colors?.background ?? "#ffffff";
  const headingFont = dt.fonts?.heading;
  const bodyFont = dt.fonts?.body;
  const cardStyle = buildCardStyle(dt);
  const cardHoverStyle = buildCardHoverStyle(dt);
  const [isHovered, setIsHovered] = useState(false);

  const { props, id } = component;
  const title = (props?.title as string) ?? "Content";
  const content = (props?.content as string) ?? "";
  const renderAs = (props?.renderAs as string) ?? "plain";
  const maxHeight = (props?.maxHeight as number) ?? 400;
  const iconName = (props?.icon as string) ?? "file-text";
  const IconComponent = CONTENT_ICONS[iconName] ?? CONTENT_ICONS.default;

  const isDark = isColorDark(bgColor);
  const hasContent = content.trim().length > 0;

  // Simple markdown-ish rendering: bold, italic, line breaks
  const renderedContent = useMemo(() => {
    if (!hasContent) return null;
    if (renderAs === "plain") {
      return content.split("\n").map((line, i) => (
        <p key={i} className="mb-2 last:mb-0" style={{ color: `${textColor}cc`, fontFamily: bodyFont || undefined, fontSize: deviceMode === "mobile" ? "12px" : "13px", lineHeight: 1.7 }}>
          {line || "\u00A0"}
        </p>
      ));
    }
    // rich-text / markdown: basic bold/italic support
    return content.split("\n").map((line, i) => {
      const processed = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code style="background:' + textColor + '08;padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>');
      return (
        <p key={i} className="mb-2 last:mb-0" style={{ color: `${textColor}cc`, fontFamily: bodyFont || undefined, fontSize: deviceMode === "mobile" ? "12px" : "13px", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: processed || "&nbsp;" }} />
      );
    });
  }, [content, renderAs, textColor, bodyFont, deviceMode, hasContent]);

  return (
    <motion.div
      className={`h-full transition-all duration-200 ${isEditing ? "cursor-pointer" : ""}`}
      style={{
        ...cardStyle,
        ...(isHovered ? cardHoverStyle : {}),
        borderLeft: `4px solid ${accent}`,
      }}
      data-component-type="ContentCard"
      onClick={isEditing ? onClick : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={deviceMode === "mobile" ? "p-3" : "p-5"}>
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${accent}15` }}
          >
            <IconComponent size={14} style={{ color: accent }} />
          </div>
          <h3
            className="text-sm font-semibold"
            style={{ color: textColor, fontFamily: headingFont || undefined }}
          >
            {title}
          </h3>
        </div>

        {/* Content body */}
        {hasContent ? (
          <div
            className="overflow-y-auto pr-1"
            style={{
              maxHeight: `${maxHeight}px`,
              scrollbarWidth: "thin",
              scrollbarColor: `${textColor}20 transparent`,
            }}
          >
            {renderedContent}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText size={32} style={{ color: `${textColor}20` }} />
            <p className="mt-2 text-xs" style={{ color: `${textColor}44`, fontFamily: bodyFont || undefined }}>
              No content available
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ContentCardRenderer;
