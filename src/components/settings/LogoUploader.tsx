"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Trash2, Loader2, ImageIcon } from "lucide-react";

interface LogoUploaderProps {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}

export function LogoUploader({ currentUrl, onUploaded, onRemoved }: LogoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);

      // Client-side validation
      const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setError("File must be PNG, JPG, SVG, or WebP.");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError("File must be under 2MB.");
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/settings/branding/logo", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (json.ok && json.logo_url) {
        onUploaded(json.logo_url);
      } else {
        setError(json.code || "Upload failed.");
      }
      setUploading(false);
    },
    [onUploaded]
  );

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);
    const res = await fetch("/api/settings/branding/logo", { method: "DELETE" });
    const json = await res.json();
    if (json.ok) {
      onRemoved();
    } else {
      setError("Failed to remove logo.");
    }
    setRemoving(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  // ── Has a logo ────────────────────────────────────────────
  if (currentUrl) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
          <img
            src={currentUrl}
            alt="Agency logo"
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Replace
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Remove
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ── No logo — drop zone ───────────────────────────────────
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 transition ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
        }`}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        ) : (
          <ImageIcon className="h-8 w-8 text-gray-400" />
        )}
        <p className="text-sm text-gray-600">
          {uploading ? "Uploading..." : "Drag & drop your logo, or click to browse"}
        </p>
        <p className="text-xs text-gray-400">PNG, JPG, SVG, or WebP. Max 2MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
