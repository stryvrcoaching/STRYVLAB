'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

interface DropdownOption {
  value: string | number
  label: string
  description?: string
}

interface DropdownProps {
  value: string | number
  onChange: (value: string | number) => void
  options: DropdownOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  disabled = false
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      })
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      updatePosition()
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      const handleScroll = () => updatePosition()
      const handleResize = () => updatePosition()
      
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [isOpen])

  const selectedOption = options.find((opt) => opt.value === value)
  const displayText = selectedOption?.label || placeholder || 'Sélectionner...'

  const dropdownContent = isOpen && !disabled && mounted ? (
    createPortal(
      <div
        ref={dropdownRef}
        className="fixed bg-[rgba(15,35,52,0.98)] backdrop-blur-xl border border-[rgba(255,255,255,0.35)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[9999] overflow-hidden"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
        }}
      >
        <div className="max-h-64 overflow-y-auto scrollbar-hide">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className={`w-full flex flex-col items-start gap-1 px-4 py-3 text-left transition-colors min-h-[44px] touch-manipulation ${
                value === option.value
                  ? 'bg-[#19D4FF]/30 border-l-4 border-l-[#19D4FF] text-white font-medium'
                  : 'hover:bg-white/15 active:bg-white/20 text-white/95'
              }`}
            >
              <span className={`text-sm flex-1 ${
                value === option.value ? 'text-white font-medium' : 'text-white/95 font-normal'
              }`}>
                {option.label}
              </span>
              {option.description && (
                <span className={`text-xs ${
                  value === option.value ? 'text-white/80' : 'text-white/60'
                } font-normal`}>
                  {option.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>,
      document.body
    )
  ) : null

  return (
    <div className={`relative z-10 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen)
            if (!isOpen) {
              setTimeout(updatePosition, 0)
            }
          }
        }}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-4 py-3 min-h-[44px] rounded-card border border-white/20 bg-white/5 text-white focus:border-[#19D4FF] focus:outline-none transition-all font-sans font-normal text-base touch-manipulation ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-white/10 active:bg-white/15 cursor-pointer'
        } ${isOpen ? 'border-[#19D4FF]' : ''}`}
        aria-label="Select option"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="flex-1 text-left truncate">{displayText}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {dropdownContent}
    </div>
  )
}

