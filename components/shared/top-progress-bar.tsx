'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function TopProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  const prevKey = useRef('')
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach((t) => {
      clearTimeout(t)
      clearInterval(t)
    })
    timers.current = []
  }

  const finish = () => {
    clearTimers()
    setProgress(100)
    timers.current.push(
      window.setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
    )
  }

  const start = () => {
    clearTimers()
    setVisible(true)
    setProgress(12)
    timers.current.push(
      window.setInterval(() => {
        setProgress((p) => Math.min(90, p + (90 - p) * 0.15))
      }, 200)
    )
    timers.current.push(window.setTimeout(finish, 5000)) // never get stuck
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )  return
      const el = (e.target as Element | null)?.closest?.('a')
      if (!el) return

      const href = el.getAttribute('href') || ''

      const url = new URL(el.href, window.location.origin)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      const isInternal =
        href.startsWith('/') &&
        !href.startsWith('/#') &&
        el.target !== '_blank' &&
        !el.hasAttribute('download')
      if (isInternal) start()
    }
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const key = `${pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`
  useEffect(() => {
    if (!prevKey.current) {
      prevKey.current = key
      return
    }
    if (prevKey.current !== key) {
      prevKey.current = key
      finish()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!visible) return null

  return (
    <div
      aria-hidden
      className='pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]'
    >
      <div
        className='h-full bg-primary transition-[width] duration-200 ease-out'
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}