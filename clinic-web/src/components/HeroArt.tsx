// The picture on the public home page: a paw print with a heart, drawn in the
// organization's colors (it follows the main and accent colors from Settings).

const navy = { fill: 'var(--navy)' }
const coral = { fill: 'var(--coral)' }

function Paw({ x, y, scale, style }: { x: number; y: number; scale: number; style: React.CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} style={style}>
      <path d="M0 -18c-46 0-104 52-104 96 0 30 22 44 50 44 22 0 34-12 54-12s32 12 54 12c28 0 50-14 50-44 0-44-58-96-104-96z" />
      <ellipse cx="-96" cy="-46" rx="30" ry="40" transform="rotate(-24 -96 -46)" />
      <ellipse cx="-34" cy="-96" rx="30" ry="42" transform="rotate(-8 -34 -96)" />
      <ellipse cx="34" cy="-96" rx="30" ry="42" transform="rotate(8 34 -96)" />
      <ellipse cx="96" cy="-46" rx="30" ry="40" transform="rotate(24 96 -46)" />
    </g>
  )
}

export default function HeroArt() {
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="Paw print">
      <circle cx="200" cy="200" r="190" style={{ fill: 'var(--navy-light)' }} />
      <circle cx="200" cy="200" r="150" style={{ fill: 'white', opacity: 0.75 }} />
      <Paw x={200} y={212} scale={0.82} style={navy} />
      {/* Heart */}
      <path
        d="M340 50c-10-14-34-12-38 8-14-18-40-8-36 14 4 18 30 30 40 42 10-12 38-28 42-46 2-8-2-14-8-18z"
        style={coral}
      />
      {/* Little paw trail */}
      <Paw x={74} y={330} scale={0.16} style={{ ...coral, opacity: 0.7 }} />
      <Paw x={112} y={366} scale={0.13} style={{ ...coral, opacity: 0.5 }} />
    </svg>
  )
}
