export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-10 bg-white px-6 py-4 flex items-end gap-3 border-b border-neutral-100 shadow-sm">
      <img
        src="/logo.png"
        alt="Tinrate"
        className="h-10 w-auto"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none'
        }}
      />
      <p className="text-xs text-neutral-400 hidden sm:block leading-none mb-0.5">
        Find the right expert, instantly
      </p>
    </header>
  )
}
