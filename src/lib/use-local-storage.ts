"use client"
import { useEffect, useState } from "react"
export function useLocalStorageBoolean(key: string, initial: boolean) {
  const [value, setValue] = useState<boolean>(initial)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === "true" || raw === "false") setValue(raw === "true")
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    try { localStorage.setItem(key, String(value)) } catch {}
  }, [key, value])
  return [value, setValue] as const
}