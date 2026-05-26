/**
 * LoadingSpinner — animated circular border spinner in brand-blue.
 *
 * Props:
 *   size: 'sm' | 'md' | 'lg'  (default: 'md')
 *   fullPage: boolean           (default: false) — centers on the viewport
 *   label: string               — optional aria-label
 */
export default function LoadingSpinner({ size = 'md', fullPage = false, label = 'Loading…' }) {
  const sizeMap = {
    sm: { outer: 20, border: 2 },
    md: { outer: 40, border: 3 },
    lg: { outer: 64, border: 4 },
  }

  const { outer, border } = sizeMap[size] ?? sizeMap.md

  const spinner = (
    <div
      role="status"
      aria-label={label}
      className="spinner"
      style={{
        width: outer,
        height: outer,
        borderWidth: border,
      }}
    />
  )

  if (fullPage) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(240, 247, 255, 0.8)',
          zIndex: 9999,
        }}
      >
        {spinner}
      </div>
    )
  }

  return spinner
}
