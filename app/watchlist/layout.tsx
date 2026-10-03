import { ReactNode } from 'react'
import { DashboardTopbar } from '@/components/layout/DashboardTopbar'

export default function WatchlistLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DashboardTopbar />
      {children}
    </>
  )
}
