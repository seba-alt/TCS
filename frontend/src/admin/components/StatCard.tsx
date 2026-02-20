interface StatCardProps {
  label: string
  value: string | number
  sub?: string   // Optional sub-label (e.g., "of 120 total")
  highlight?: boolean  // true → brand-purple accent border
}

export default function StatCard({ label, value, sub, highlight }: StatCardProps) {
  return (
    <div className={`bg-white rounded-lg border p-6 shadow-sm ${highlight ? 'border-brand-purple' : 'border-gray-200'}`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}
