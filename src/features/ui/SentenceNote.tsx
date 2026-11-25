export function SentenceNote({ text, className, role }: { text: string; className?: string; role?: 'status' }) {
  const lines = text
    .split(/(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
  return (
    <p className={className ? `sentence-note ${className}` : 'sentence-note'} role={role}>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </p>
  )
}
