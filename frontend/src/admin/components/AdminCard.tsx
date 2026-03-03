interface AdminCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function AdminCard({ children, className = '', onClick }: AdminCardProps) {
  return (
    <div
      className={`bg-slate-800/60 border border-slate-700/60 rounded-xl ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  )
}
