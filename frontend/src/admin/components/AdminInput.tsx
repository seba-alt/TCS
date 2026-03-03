interface AdminInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function AdminInput(props: AdminInputProps) {
  const { className, ...rest } = props
  return (
    <input
      {...rest}
      className={`w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg
                  px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500
                  placeholder-slate-500 ${className ?? ''}`}
    />
  )
}
