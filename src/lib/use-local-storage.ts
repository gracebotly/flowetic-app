"use client"

import { useState, useEffect } from "react"

export function useLocalStorageBoolean(key: string, defaultValue: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultValue
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) === true : defaultValue
    } catch (error) {
      return defaultValue
    }
  })

  const setStoredValue = (value: boolean) => {
    try {
      setValue(value)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(value))
      }
    } catch (error) {
      console.error(error)
    }
  }

  return [value, setStoredValue]
}