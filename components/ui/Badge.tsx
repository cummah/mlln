import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'buy' | 'hold' | 'watch'
  className?: string
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variantClasses = {
    default: 'bg-neutral-500',
    buy: 'bg-green-500',
    hold: 'bg-neutral-500',
    watch: 'bg-amber-500',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
