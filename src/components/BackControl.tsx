import { ChevronLeft } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'

const MotionLink = motion.create(Link)

export function BackControl({ to, label }: { to: string; label: string }) {
  return (
    <MotionLink
      className="back-control"
      to={to}
      aria-label={label}
      whileTap={{ scale: 0.9, x: -2 }}
      transition={{ type: 'spring', stiffness: 520, damping: 28 }}
    >
      <ChevronLeft size={23} strokeWidth={2.25} aria-hidden="true" />
    </MotionLink>
  )
}
