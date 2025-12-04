import { useState, useEffect, useRef } from 'react'

function AutocompleteInput({ 
  value, 
  onChange, 
  placeholder, 
  suggestions, 
  icon,
  className = '',
  required = false 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    // Só mostrar sugestões se o usuário estiver digitando ou focou no campo
    if (suggestions.length > 0) {
      if (value && value.length > 0) {
        // Filtrar sugestões baseado no valor digitado
        const filtered = suggestions
          .filter(s => s.toLowerCase().includes(value.toLowerCase()))
          .slice(0, 5)
        
        setFilteredSuggestions(filtered)
        setIsOpen(filtered.length > 0 && filtered.some(s => s.toLowerCase() !== value.toLowerCase()))
      } else {
        // Se não houver valor, não mostrar sugestões automaticamente
        setFilteredSuggestions([])
        setIsOpen(false)
      }
    } else {
      setFilteredSuggestions([])
      setIsOpen(false)
    }
  }, [value, suggestions])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    onChange(e.target.value)
    setSelectedIndex(-1)
  }

  const handleSelect = (suggestion) => {
    onChange(suggestion)
    setIsOpen(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (!isOpen || filteredSuggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSelect(filteredSuggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            // Só mostrar sugestões se houver valor digitado
            if (suggestions.length > 0 && value && value.length > 0) {
              const filtered = suggestions
                .filter(s => s.toLowerCase().includes(value.toLowerCase()))
                .slice(0, 5)
              if (filtered.length > 0) {
                setFilteredSuggestions(filtered)
                setIsOpen(true)
              }
            }
          }}
          placeholder={placeholder}
          className={`modern-input w-full px-4 py-3 rounded-xl bg-gray-50 focus:bg-white focus:outline-none ${icon ? 'pl-10' : ''} ${className}`}
          required={required}
        />
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-fade-in">
          <div className="max-h-60 overflow-y-auto">
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className={`w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors ${
                  index === selectedIndex ? 'bg-indigo-50' : ''
                } ${index === 0 ? '' : 'border-t border-gray-100'}`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm text-gray-700 font-medium">{suggestion}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default AutocompleteInput

