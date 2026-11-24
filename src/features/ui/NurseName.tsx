export function NurseName({ name }: { name: string }) {
  if (!name.startsWith('A-plus ')) return name
  return (
    <>
      A-plus
      <br />
      {name.slice('A-plus '.length)}
    </>
  )
}
