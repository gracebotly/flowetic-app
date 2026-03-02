"use client";

import { useState, useRef, useEffect } from "react";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const nativeRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleInputChange = (raw: string) => {
    // Allow typing — add # prefix if missing
    let v = raw.trim();
    if (v && !v.startsWith("#")) v = `#${v}`;
    setInputValue(v);

    // Only propagate valid hex
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      onChange(v);
    }
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    setInputValue(hex);
    onChange(hex);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700 w-20">{label}</span>
      {/* Native color picker (the swatch) */}
      <button
        type="button"
        onClick={() => nativeRef.current?.click()}
        className="h-9 w-9 rounded-lg border border-gray-200 shadow-sm cursor-pointer"
        style={{ backgroundColor: value }}
      />
      <input
        ref={nativeRef}
        type="color"
        value={value}
        onChange={handleNativeChange}
        className="sr-only"
      />
      {/* Hex text input */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        maxLength={7}
        className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-900 shadow-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}
