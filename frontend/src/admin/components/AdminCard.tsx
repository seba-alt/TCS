interface AdminCardProps {
  children: React.ReactNode
  className?: string
}

export function AdminCard({ children, className = '' }: AdminCardProps) {
  return (
    <div className={`bg-slate-800/60 border border-slate-700/60 rounded-xl ${className}`}>
      {children}
    </div>
  )
}
