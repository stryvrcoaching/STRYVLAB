export function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocalStorage(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeLocalStorage(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function listLocalStorageKeys(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return Object.keys(window.localStorage)
  } catch {
    return []
  }
}

export function readSessionStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSessionStorage(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.sessionStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
