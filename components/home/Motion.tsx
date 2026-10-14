'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useReducedMotion } from 'framer-motion'

/** Fades and lifts its children in as they scroll into view. Renders plain for people who ask for reduced motion. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  style,
  className,
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  style?: React.CSSProperties
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** A number that counts up from zero the first time it is on screen. */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  signed = false,
  duration = 1.6,
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  signed?: boolean
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduce = useReducedMotion()
  // Starts at the real value so the server HTML, search engines and no-JS visitors all see the true number. Once it is
  // on screen the count-up restarts from zero.
  const [n, setN] = useState(value)

  useEffect(() => {
    if (reduce || !inView) return
    const controls = animate(0, value, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setN })
    return () => controls.stop()
  }, [inView, reduce, value, duration])

  const text = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Math.abs(n))
  const sign = n < 0 ? '-' : signed ? '+' : ''
  return <span ref={ref}>{`${sign}${prefix}${text}${suffix}`}</span>
}
