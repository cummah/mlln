'use client'

import React, { ReactNode, useState, useContext, createContext } from 'react'

interface TabsContextType {
  value: string
  onChange: (value: string) => void
}

const TabsContext = createContext<TabsContextType | null>(null)

interface TabsProps {
  children: ReactNode
  defaultValue?: string
  className?: string
}

interface TabsListProps {
  children: ReactNode
  className?: string
}

interface TabsTriggerProps {
  value: string
  children: ReactNode
}

interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function Tabs({ children, defaultValue = '', className = '' }: TabsProps) {
  const [value, onChange] = useState(defaultValue)

  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div className={`inline-flex gap-2 bg-[var(--surface)] p-1 rounded-lg ${className}`}>
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children }: TabsTriggerProps) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsTrigger must be used within Tabs')

  const isActive = context.value === value

  return (
    <button
      onClick={() => context.onChange(value)}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
        isActive
          ? 'bg-[var(--bg)] text-[var(--text)] shadow-sm'
          : 'text-[var(--text-2)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsContent must be used within Tabs')

  if (context.value !== value) return null

  return <div className={className}>{children}</div>
}
