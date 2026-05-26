/**
 * Avatar component
 *
 * Props:
 *   src    — image URL (optional)
 *   name   — full name used to generate initials when no src
 *   size   — 'sm' | 'md' | 'lg'  (default: 'md')
 *   online — boolean, shows green dot indicator bottom-right
 *   className — extra CSS classes
 */
export default function Avatar({ src, name = '', size = 'md', online = false, className = '' }) {
  const sizeMap = {
    sm: { wh: 28, font: 10, dot: 8 },
    md: { wh: 36, font: 13, dot: 10 },
    lg: { wh: 56, font: 20, dot: 13 },
  }

  const { wh, font, dot } = sizeMap[size] ?? sizeMap.md

  /** Generate 1-2 char initials from full name */
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join('')

  return (
    <div
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: wh, height: wh }}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          style={{
            width: wh,
            height: wh,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid #DBEAFE',
          }}
        />
      ) : (
        <div
          aria-label={`${name} avatar`}
          style={{
            width: wh,
            height: wh,
            borderRadius: '50%',
            backgroundColor: '#00AEEF',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: font,
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.02em',
            userSelect: 'none',
            border: '2px solid rgba(0,174,239,0.3)',
          }}
        >
          {initials || '?'}
        </div>
      )}

      {online && (
        <span
          aria-label="Online"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dot,
            height: dot,
            borderRadius: '50%',
            backgroundColor: '#10B981',
            border: '2px solid #FFFFFF',
          }}
        />
      )}
    </div>
  )
}
