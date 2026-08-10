import { useLayoutEffect, useRef } from 'react'

const DURATION = 180
const EASING = 'cubic-bezier(.2, .7, .2, 1)'

export function useFlipList(orderKey: string) {
  const containerRef = useRef<HTMLOListElement>(null)
  const previousPositions = useRef(new Map<string, DOMRect>())

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-flip-key]'))
    rows.forEach((row) => row.getAnimations().forEach((animation) => animation.cancel()))
    const nextPositions = new Map(rows.map((row) => [row.dataset.flipKey ?? '', row.getBoundingClientRect()]))
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!reduceMotion) {
      rows.forEach((row) => {
        const key = row.dataset.flipKey ?? ''
        const previous = previousPositions.current.get(key)
        const next = nextPositions.get(key)

        if (previous && next) {
          const deltaY = previous.top - next.top
          if (Math.abs(deltaY) > 0.5) {
            row.animate(
              [{ transform: `translateY(${deltaY}px)` }, { transform: 'translateY(0)' }],
              { duration: DURATION, easing: EASING },
            )
          }
        } else {
          row.animate(
            [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: DURATION, easing: EASING },
          )
        }
      })
    }

    previousPositions.current = nextPositions
  }, [orderKey])

  return containerRef
}
