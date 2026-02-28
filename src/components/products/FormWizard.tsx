"use client";

// ============================================================================
// Level 4: FormWizard — Premium Typeform-style Multi-Step Form
// Features: step-by-step, keyboard nav, animated transitions, confetti, progress
// ============================================================================

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { InputField } from "@/lib/products/types";

interface FormWizardProps {
  productId: string;
  productName: string;
  productSlug: string;
  inputSchema: InputField[];
  designTokens: Record<string, any>;
}

type FormValues = Record<string, string | string[]>;

export function FormWizard({
  productId,
  productName,
  productSlug,
  inputSchema,
  designTokens,
}: FormWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  const fields = inputSchema ?? [];
  const totalSteps = fields.length;
  const currentField = fields[step];
  const progress = totalSteps > 0 ? ((step + 1) / totalSteps) * 100 : 0;

  // Design tokens
  const colors = designTokens?.colors ?? {};
  const primary = colors.primary ?? "#6366f1";
  const background = colors.background ?? "#ffffff";
  const text = colors.text ?? "#111827";
  const surface = colors.surface ?? "#f9fafb";

  // Auto-focus on step change
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [step]);

  const validateField = useCallback(
    (field: InputField, value: string | string[]): string | null => {
      const strVal = Array.isArray(value) ? value.join(",") : value;
      if (field.required && !strVal.trim()) return "This field is required";
      if (field.validation?.min && strVal.length < field.validation.min)
        return field.validation.message ?? `Must be at least ${field.validation.min} characters`;
      if (field.validation?.max && strVal.length > field.validation.max)
        return field.validation.message ?? `Must be at most ${field.validation.max} characters`;
      if (field.validation?.pattern && !new RegExp(field.validation.pattern).test(strVal))
        return field.validation.message ?? "Invalid format";
      if (field.type === "email" && strVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal))
        return "Please enter a valid email address";
      if (field.type === "url" && strVal && !/^https?:\/\/.+/.test(strVal))
        return "Please enter a valid URL (starting with http:// or https://)";
      return null;
    },
    [],
  );

  const goNext = useCallback(() => {
    if (!currentField) return;
    const val = values[currentField.name] ?? "";
    const error = validateField(currentField, val);
    if (error) {
      setErrors((prev) => ({ ...prev, [currentField.name]: error }));
      return;
    }
    setErrors((prev) => ({ ...prev, [currentField.name]: "" }));
    setDirection("forward");
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    }
  }, [currentField, values, validateField, step, totalSteps]);

  const goBack = useCallback(() => {
    if (step > 0) {
      setDirection("backward");
      setStep((s) => s - 1);
    }
  }, [step]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (step === totalSteps - 1) {
          handleSubmit();
        } else {
          goNext();
        }
      }
    },
    [goNext, step, totalSteps],
  );

  const handleSubmit = async () => {
    // Validate all fields
    for (const field of fields) {
      const val = values[field.name] ?? "";
      const error = validateField(field, val);
      if (error) {
        setErrors((prev) => ({ ...prev, [field.name]: error }));
        setStep(fields.indexOf(field));
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/products/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          email: values.email ?? values.customer_email ?? "",
          name: values.name ?? values.customer_name ?? "",
          inputs: values,
        }),
      });

      const data = await res.json();

      if (data.ok && data.executionId) {
        // Confetti burst
        fireConfetti(primary);
        // Navigate to results after brief delay
        setTimeout(() => {
          router.push(`/products/${productSlug}/results/${data.executionId}`);
        }, 1200);
      } else {
        setIsSubmitting(false);
        setErrors({ _form: data.message ?? "Something went wrong. Please try again." });
      }
    } catch {
      setIsSubmitting(false);
      setErrors({ _form: "Network error. Please check your connection and try again." });
    }
  };

  const setValue = (name: string, value: string | string[]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ── Submitting state ──────────────────────────────────────────────────
  if (isSubmitting) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6"
        style={{ backgroundColor: background, color: text }}
      >
        <div className="relative w-16 h-16">
          <div
            className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: `${primary}33`, borderTopColor: primary }}
          />
        </div>
        <p className="text-lg font-medium animate-pulse">Running your workflow...</p>
        <p className="text-sm opacity-50">This usually takes a few seconds</p>
      </div>
    );
  }

  // ── Empty schema guard ────────────────────────────────────────────────
  if (fields.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: background, color: text }}>
        <p className="opacity-60">This product has no input fields configured.</p>
      </div>
    );
  }

  // ── Form UI ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: background, color: text }}>
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1" style={{ backgroundColor: `${primary}20` }}>
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, backgroundColor: primary }}
        />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-medium opacity-70">{productName}</span>
        <span className="text-sm opacity-50">
          {step + 1} of {totalSteps}
        </span>
      </header>

      {/* Form body */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div
          className="w-full max-w-lg transition-all duration-300 ease-out"
          style={{
            transform: direction === "forward" ? "translateX(0)" : "translateX(0)",
            opacity: 1,
          }}
          key={step}
        >
          {/* Field label */}
          <label className="block text-2xl sm:text-3xl font-semibold mb-6 leading-snug">
            {currentField?.label}
            {currentField?.required && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </label>

          {/* Field input */}
          {renderField(currentField, values[currentField?.name ?? ""] ?? "", setValue, inputRef, handleKeyDown, primary, surface, text)}

          {/* Error */}
          {(errors[currentField?.name ?? ""] || errors._form) && (
            <p className="mt-3 text-sm text-red-500">
              {errors[currentField?.name ?? ""] || errors._form}
            </p>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-4 mt-10">
            {step > 0 && (
              <button
                onClick={goBack}
                className="px-6 py-3 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                style={{ backgroundColor: surface }}
              >
                ← Back
              </button>
            )}
            {step < totalSteps - 1 ? (
              <button
                onClick={goNext}
                className="px-8 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: primary }}
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-8 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: primary }}
              >
                Submit ✓
              </button>
            )}
          </div>

          {/* Keyboard hint */}
          <p className="mt-4 text-xs opacity-40">
            Press <kbd className="px-1.5 py-0.5 rounded border text-[10px]">Enter ↵</kbd> to continue
          </p>
        </div>
      </main>
    </div>
  );
}

// ── Field Renderer ──────────────────────────────────────────────────────
function renderField(
  field: InputField | undefined,
  value: string | string[],
  setValue: (name: string, value: string | string[]) => void,
  inputRef: React.MutableRefObject<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>,
  onKeyDown: (e: React.KeyboardEvent) => void,
  primary: string,
  surface: string,
  textColor: string,
) {
  if (!field) return null;
  const strValue = Array.isArray(value) ? value.join(",") : (value ?? "");

  const baseInputClass =
    "w-full bg-transparent border-b-2 border-gray-300 focus:outline-none text-xl py-3 transition-colors placeholder:opacity-40";

  switch (field.type) {
    case "textarea":
      return (
        <textarea
          ref={inputRef as React.MutableRefObject<HTMLTextAreaElement>}
          value={strValue}
          onChange={(e) => setValue(field.name, e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={field.placeholder ?? "Type your answer..."}
          rows={4}
          className={`${baseInputClass} resize-none`}
          style={{ borderColor: `${primary}30`, color: textColor }}
        />
      );

    case "select":
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setValue(field.name, opt.value)}
              className="w-full text-left px-5 py-3 rounded-lg border-2 transition-all hover:scale-[1.01]"
              style={{
                borderColor: strValue === opt.value ? primary : `${primary}20`,
                backgroundColor: strValue === opt.value ? `${primary}10` : "transparent",
              }}
            >
              <span className="text-lg">{opt.label}</span>
            </button>
          ))}
        </div>
      );

    case "multi_select":
      const selected = strValue ? strValue.split(",") : [];
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => {
                  const next = isSelected
                    ? selected.filter((v) => v !== opt.value)
                    : [...selected, opt.value];
                  setValue(field.name, next);
                }}
                className="w-full text-left px-5 py-3 rounded-lg border-2 transition-all hover:scale-[1.01]"
                style={{
                  borderColor: isSelected ? primary : `${primary}20`,
                  backgroundColor: isSelected ? `${primary}10` : "transparent",
                }}
              >
                <span className="text-lg">
                  {isSelected ? "✓ " : ""}
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      );

    default:
      return (
        <input
          ref={inputRef as React.MutableRefObject<HTMLInputElement>}
          type={field.type === "email" ? "email" : field.type === "number" ? "number" : field.type === "url" ? "url" : field.type === "phone" ? "tel" : "text"}
          value={strValue}
          onChange={(e) => setValue(field.name, e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={field.placeholder ?? "Type your answer..."}
          className={baseInputClass}
          style={{ borderColor: `${primary}30`, color: textColor }}
          autoComplete={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "off"}
        />
      );
  }
}

// ── Confetti (canvas, zero deps) ────────────────────────────────────────
function fireConfetti(color: string) {
  if (typeof window === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;z-index:99999;pointer-events:none";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const particles: {
    x: number; y: number; vx: number; vy: number;
    size: number; color: string; rotation: number; rotV: number; life: number;
  }[] = [];

  const palette = [color, "#fbbf24", "#34d399", "#f472b6", "#60a5fa", "#a78bfa"];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 15 - 5,
      size: Math.random() * 8 + 4,
      color: palette[Math.floor(Math.random() * palette.length)],
      rotation: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.3,
      life: 1,
    });
  }

  let frame = 0;
  function animate() {
    if (!ctx || frame > 90) {
      canvas.remove();
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4;
      p.vx *= 0.99;
      p.rotation += p.rotV;
      p.life -= 0.012;
      if (p.life <= 0) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    frame++;
    requestAnimationFrame(animate);
  }
  animate();
}
