// Persistent top header — always visible, sticks to top of viewport.
// Logo: served from /logo.png (user places PNG at frontend/public/logo.png).
// If logo.png is missing, the alt text "Tinrate" renders as fallback.

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-10 bg-brand-black px-4 py-3 flex items-center gap-3 border-b border-neutral-800">
      <img
        src="/logo.png"
        alt="Tinrate"
        className="h-8 w-auto"
        onError={(e) => {
          // Hide broken image icon if logo.png is not yet placed
          (e.target as HTMLImageElement).style.display = 'none'
        }}
      />
      <p className="text-sm text-neutral-400 hidden sm:block">
        Find the right expert, instantly
      </p>
    </header>
  )
}
