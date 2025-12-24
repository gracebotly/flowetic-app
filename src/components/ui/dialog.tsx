"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import { Button } from "./button"

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/25" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-4 shadow-xl",
          className
        )}
        {...props}
      />
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? <p className="text-sm text-foreground/70">{description}</p> : null}
    </div>
  )
}

export function DialogFooter({ onClose }: { onClose?: () => void }) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <DialogClose asChild>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogClose>
    </div>
  )
}