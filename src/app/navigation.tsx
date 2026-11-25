import { useEffect, useState } from 'react'

const NAVIGATE = 'app-navigate'

export function normalizeBase(base: string) {
  if (!base || base === '/' || base === './' || base === '.') return ''
  const withLead = base.startsWith('/') ? base : `/${base}`
  return withLead.endsWith('/') ? withLead.slice(0, -1) : withLead
}

export function toAppPath(pathname: string, base = import.meta.env.BASE_URL) {
  const prefix = normalizeBase(base)
  let path = pathname || '/'
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) path = path.slice(prefix.length) || '/'
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path
}

export function toLocationPath(appPath: string, base = import.meta.env.BASE_URL) {
  const prefix = normalizeBase(base)
  const path = appPath.startsWith('/') ? appPath : `/${appPath}`
  if (!prefix) return path
  return path === '/' ? `${prefix}/` : `${prefix}${path}`
}

function currentAppPath() {
  return toAppPath(window.location.pathname)
}

export function usePath() {
  const [path, setPath] = useState(currentAppPath)

  useEffect(() => {
    const sync = () => setPath(currentAppPath())
    window.addEventListener('popstate', sync)
    window.addEventListener(NAVIGATE, sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener(NAVIGATE, sync)
    }
  }, [])

  return path
}

export function isVer2(path = currentAppPath()) {
  return path === '/ver2' || path.startsWith('/ver2/')
}

export function go(path: string) {
  const next = toLocationPath(path)
  if (window.location.pathname === next) return
  window.history.pushState(null, '', next)
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
