import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react'
import { useEffect, useState, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { useHeaderSearch } from '../hooks/useHeaderSearch'

export default function Header() {
  const {
    localValue,
    handleChange,
    handleKeyDown,
    handleSelectSuggestion,
    handleClear,
    handleBlur,
    placeholderIndex,
    placeholders,
    total,
    isStreaming,
    tiltActive,
    showParticles,
    suggestions,
    showDropdown,
    selectedIndex,
  } = useHeaderSearch()

  // Expert count spring
  const rawCount = useMotionValue(total)
  const springCount = useSpring(rawCount, { stiffness: 200, damping: 25 })
  const [displayCount, setDisplayCount] = useState(total)

  useEffect(() => {
    rawCount.set(total)
  }, [total, rawCount])

  useEffect(() => {
    const unsub = springCount.on('change', (v) => setDisplayCount(Math.round(v)))
    return unsub
  }, [springCount])

  // Tilt spring for easter egg
  const rotateX = useMotionValue(0)
  const rotate = useSpring(rotateX, { stiffness: 300, damping: 20 })

  useEffect(() => {
    rotateX.set(tiltActive ? 3 : 0)
  }, [tiltActive, rotateX])

  // Particle positions pre-generated (stable across renders)
  const particlePositions = useRef(
    ['⭐', '✨', '🌟', '💫', '⭐', '✨', '🌟'].map(() => ({
      x: (Math.random() - 0.5) * 100,
      y: -50 - Math.random() * 50,
    }))
  )

  const logoRef = useRef<HTMLImageElement>(null)

  // Focus state for search bar scale
  const [isFocused, setIsFocused] = useState(false)

  return (
    <motion.header
      style={{
        rotate,
        background: 'radial-gradient(circle at top right, rgba(139,92,246,0.09) 0%, transparent 60%)',
      }}
      className="flex items-center gap-3 md:gap-6 px-3 md:px-6 py-2 md:py-3 sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-white/20"
    >
      {/* Logo section with particle burst — hidden on mobile to allow full-width search bar */}
      <div className="relative shrink-0 hidden md:block">
        <img
          ref={logoRef}
          src="/logo.png"
          alt="Tinrate"
          className="h-6 md:h-8 w-auto"
          style={{ filter: 'drop-shadow(0 0 15px rgba(139,92,246,0.30))' }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        {/* Particle burst */}
        <AnimatePresence>
          {showParticles &&
            particlePositions.current.map((pos, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 1, x: 0, y: 0, scale: 1.2 }}
                animate={{ opacity: 0, x: pos.x, y: pos.y, scale: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, delay: i * 0.06, ease: 'easeOut' }}
                className="absolute top-0 left-4 pointer-events-none text-base z-50 select-none"
                aria-hidden="true"
              >
                {(['⭐', '✨', '🌟', '💫', '⭐', '✨', '🌟'] as const)[i]}
              </motion.span>
            ))}
        </AnimatePresence>
      </div>

      {/* Search bar wrapper — relative for dropdown positioning; full-width on mobile */}
      <div className="relative flex-1 max-w-full md:max-w-2xl">
        <motion.div
          animate={{ scale: isFocused ? 1.02 : 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="relative"
        >
          {/* Sage in-flight pulse dot — left of search icon */}
          <motion.div
            animate={{ opacity: isStreaming ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-purple animate-pulse"
            aria-hidden="true"
          />
          {/* Search icon */}
          <Search
            className="absolute left-8 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          {/* Animated placeholder overlay — shown only when no input */}
          <AnimatePresence mode="wait">
            {!localValue && (
              <motion.span
                key={placeholderIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute left-14 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none select-none truncate max-w-[calc(100%-4rem)]"
                aria-hidden="true"
              >
                {placeholders[placeholderIndex]}
              </motion.span>
            )}
          </AnimatePresence>
          {/* Controlled input */}
          <input
            type="text"
            value={localValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false)
              handleBlur()
            }}
            className="w-full pl-14 pr-8 py-2.5 rounded-xl text-sm bg-white/50 border border-slate-200/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple/40 transition-colors"
            aria-label="Search experts"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls="search-suggestions"
          />
          {/* X clear button — shown when input has text */}
          {localValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </motion.div>

        {/* Autocomplete dropdown */}
        <AnimatePresence>
          {showDropdown && suggestions.length > 0 && (
            <motion.ul
              id="search-suggestions"
              role="listbox"
              aria-label="Search suggestions"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden"
            >
              {suggestions.map((suggestion, i) => (
                <li
                  key={suggestion}
                  role="option"
                  aria-selected={i === selectedIndex}
                  onMouseDown={(e) => {
                    // Prevent input blur before click registers
                    e.preventDefault()
                    handleSelectSuggestion(suggestion)
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                    i === selectedIndex
                      ? 'bg-purple-50 text-brand-purple'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {suggestion}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Expert count */}
      <div className="hidden md:block shrink-0 text-sm text-slate-500 tabular-nums">
        <span className="font-semibold text-slate-700">{displayCount.toLocaleString()}</span>
        {' experts'}
      </div>
    </motion.header>
  )
}
