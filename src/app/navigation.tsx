import { useEffect, useState } from 'react'

const NAVIGATE = 'app-navigate'

export function usePath() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync)
    window.addEventListener(NAVIGATE, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(NAVIGATE, sync)
    }
  }, [])

  return path
}

export function isVer2(path = window.location.pathname) {
  return path === '/ver2' || path.startsWith('/ver2/')
}

export function go(path: string) {
  if (window.location.pathname === path) return
  window.history.pushState(null, '', path)
  window.dispatchEvent(new Event(NAVIGATE))
}

export function VersionSwitch() {
  const ver2 = isVer2(usePath())
  return (
    <nav className="ver-switch" aria-label="화면 안">
      <button type="button" className={ver2 ? undefined : 'is-on'} onClick={() => go('/')}>
        1안
      </button>
      <button type="button" className={ver2 ? 'is-on' : undefined} onClick={() => go('/ver2')}>
        2안
      </button>
    </nav>
  )
}
