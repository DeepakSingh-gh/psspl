/**
 * PssplLogo — official PSSPL horizontal brand mark as an inline SVG.
 *
 * Transparent background — blends seamlessly with whatever sidebar colour
 * sits behind it, exactly like the logo on progressivesurfacesystems.com.
 *
 * Usage:
 *   <PssplLogo />               // sidebar default (width 180)
 *   <PssplLogo width={140} />   // compact / login
 */
export function PssplLogo({ width = 180 }: { width?: number }) {
  // Preserve the 406:102 viewBox aspect ratio
  const height = Math.round(width * (102 / 406));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 406 102"
      width={width}
      height={height}
      style={{ flex: "none", display: "block" }}
      aria-label="Progressive Surface Systems"
    >
      {/* No background rect — transparent so the logo blends with the sidebar colour */}

      {/* Flask / Hexagon Icon */}
      <g stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round">
        <path d="M58 15 L72 23 V40 L58 48 L44 40 V23 Z" fill="none" />
        <path d="M53 26 H63 L62 29 V37 L70 49 Q72 52 68 54 Q58 58 48 54 Q44 52 46 49 L54 37 V29 Z" fill="none" />
      </g>

      {/* Flask Liquid */}
      <path
        d="M50 43 Q54 40 58 43 Q62 45 66 42 L70 49 Q72 52 68 54 Q58 58 48 54 Q44 52 46 49 Z"
        fill="#8DD3F0"
      />

      {/* PSSPL Text below icon */}
      <text
        x="58"
        y="77"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="19"
        fontWeight="700"
        textAnchor="middle"
        fill="#FFFFFF"
        textLength="49"
        lengthAdjust="spacingAndGlyphs"
      >
        PSSPL
      </text>

      {/* Main Company Name */}
      <text
        x="98"
        y="53"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="40"
        fontWeight="800"
        letterSpacing="0.2"
        fill="#FFFFFF"
        textLength="266"
        lengthAdjust="spacingAndGlyphs"
      >
        PROGRESSIVE
      </text>

      {/* Tagline */}
      <text
        x="98"
        y="78"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="16"
        fontWeight="500"
        letterSpacing="7.1"
        fill="#FFFFFF"
      >
        SURFACE SYSTEMS
      </text>
    </svg>
  );
}
