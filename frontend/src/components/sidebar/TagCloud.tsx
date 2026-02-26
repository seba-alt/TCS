import { useRef } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  LayoutGroup,
} from 'motion/react'
import { useExplorerStore } from '../../store'
import { TOP_TAGS } from '../../constants/tags'

// Per-pill hook: reads shared mouse position, measures own DOM rect, derives spring scale
function useProximityScale(
  mouseX: ReturnType<typeof useMotionValue<number>>,
  mouseY: ReturnType<typeof useMotionValue<number>>,
  ref: React.RefObject<HTMLButtonElement | null>,
) {
  const distance = useTransform([mouseX, mouseY], ([mx, my]) => {
    const x = mx as number
    const y = my as number
    if (!ref.current) return 999
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
  })
  // 1.4 at 0px, 1.15 at 60px, 1.0 at 120px+
  const scaleRaw = useTransform(distance, [0, 60, 120], [1.4, 1.15, 1.0], { clamp: true })
  return useSpring(scaleRaw, { stiffness: 200, damping: 20, mass: 0.5 })
}

function TagPill({
  tag,
  isSelected,
  mouseX,
  mouseY,
  onToggle,
}: {
  tag: string
  isSelected: boolean
  mouseX: ReturnType<typeof useMotionValue<number>>
  mouseY: ReturnType<typeof useMotionValue<number>>
  onToggle: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const scale = useProximityScale(mouseX, mouseY, ref)

  return (
    <motion.button
      ref={ref}
      layout="position"
      transition={{ layout: { duration: 0.18, ease: 'easeOut' } }}
      style={{ scale }}
      onClick={onToggle}
      aria-pressed={isSelected}
      className={`
        text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors origin-center
        ${isSelected
          ? 'bg-brand-purple text-white border-brand-purple'
          : 'bg-white/80 text-gray-700 border-gray-300 hover:border-brand-purple'
        }
      `}
    >
      {tag}
    </motion.button>
  )
}

export function TagCloud() {
  const toggleTag = useExplorerStore((s) => s.toggleTag)
  const tags = useExplorerStore((s) => s.tags)

  const mouseX = useMotionValue<number>(-999)
  const mouseY = useMotionValue<number>(-999)

  function handleMouseMove(e: React.MouseEvent) {
    mouseX.set(e.clientX)
    mouseY.set(e.clientY)
  }

  function handleMouseLeave() {
    mouseX.set(-999)
    mouseY.set(-999)
  }

  // Selected tags first, then up to 18 total — keeps cloud compact so "Everything is possible" is visible
  const selected = TOP_TAGS.filter((t) => tags.includes(t))
  const unselected = TOP_TAGS.filter((t) => !tags.includes(t))
  const visibleCount = Math.max(18, selected.length)
  const sortedTags = [...selected, ...unselected.slice(0, visibleCount - selected.length)]

  return (
    <LayoutGroup>
      <div
        className="flex flex-wrap gap-2"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="group"
        aria-label="Domain tags"
      >
        {sortedTags.map((tag) => (
          <TagPill
            key={tag}
            tag={tag}
            isSelected={tags.includes(tag)}
            mouseX={mouseX}
            mouseY={mouseY}
            onToggle={() => toggleTag(tag)}
          />
        ))}
      </div>
    </LayoutGroup>
  )
}
