import { useEffect, useId, useRef, useState } from 'react'

export type PrettyOption = { value: string; label: string; hint?: string; detail?: readonly [string, string]; mark?: string }

function OptionText({ option }: { option: PrettyOption }) {
  return (
    <span className="pretty-value">
      <span className="pretty-name">
        <b>{option.label}</b>
        {option.mark ? <em className="pretty-mark">{option.mark}</em> : null}
        {option.hint ? (
          <>
            <span className="pretty-rule" aria-hidden="true" />
            <small className="pretty-hint">{option.hint}</small>
          </>
        ) : null}
      </span>
      {option.detail ? (
        <small className="pretty-detail">
          <span>{option.detail[0]}</span>
          <span className="pretty-sep" aria-hidden="true">|</span>
          <span>{option.detail[1]}</span>
        </small>
      ) : null}
    </span>
  )
}

export function PrettySelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: PrettyOption[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const labelId = useId()
  const current = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`pretty-select${open ? ' is-open' : ''}`} ref={root}>
      <span className="pretty-label" id={labelId}>
        {label}
      </span>
      <button
        type="button"
        className="pretty-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => setOpen((next) => !next)}
      >
        {current ? <OptionText option={current} /> : <span className="pretty-value"><b>선택</b></span>}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6.5 8 10.5 12 6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <ul className="pretty-menu" role="listbox" aria-labelledby={labelId}>
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? 'is-on' : undefined}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <OptionText option={option} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
