/**
 * FieldProof dark theme — black surfaces, brand orange accents, glassmorphism.
 * Layering: background (deepest) -> surface (cards) -> glass (translucent) -> elevated (chips).
 */
export const colors = {
  // ── Brand Orange & Amber ──
  orange: "#F2622A",
  orangeBright: "#FF7A3D",
  orangeDark: "#D94A14",
  orangeLight: "rgba(242, 98, 42, 0.14)",
  orangeBorder: "rgba(242, 98, 42, 0.38)",
  amber: "#FBBF6B",
  amberLight: "rgba(251, 191, 107, 0.10)",

  // ── Layered black surfaces ──
  black: "#0C0A09",
  dark: "#141211",
  darkSurface: "#1C1917",
  darkElevated: "#292524",
  darkBorder: "#383432",

  // ── Glassmorphism ──
  glass: "rgba(28, 25, 23, 0.74)",
  glassBorder: "rgba(56, 52, 50, 0.50)",
  glassHighlight: "rgba(255,255,255,0.04)",

  // ── Compatibility aliases ──
  navy: "#0C0A09",
  navyLight: "#1C1917",
  blue: "#F2622A",
  blueDark: "#D94A14",
  teal: "#F2622A",

  // ── Canvas & Surfaces ──
  background: "#0C0A09",
  surface: "#1C1917",
  surfaceMuted: "#292524",

  // ── Typography ──
  text: "#FAFAF9",
  textSecondary: "#D6D3D1",
  muted: "#A8A29E",
  subtle: "#78716C",
  border: "#383432",

  // ── Semantic Status Tones ──
  success: "#34D399",
  successLight: "rgba(52, 211, 153, 0.12)",
  successBorder: "rgba(52, 211, 153, 0.35)",

  warning: "#FBBF6B",
  warningLight: "rgba(251, 191, 107, 0.12)",
  warningBorder: "rgba(251, 191, 107, 0.35)",

  danger: "#F87171",
  dangerLight: "rgba(248, 113, 113, 0.12)",
  dangerBorder: "rgba(248, 113, 113, 0.35)",

  info: "#60A5FA",
  infoLight: "rgba(96, 165, 250, 0.12)",
  infoBorder: "rgba(96, 165, 250, 0.35)",

  white: "#FFFFFF"
};

/** Gradient pairs matching the orange-to-amber brand. */
export const gradients = {
  brand: ["#FF7A3D", "#E8500F"] as const,
  glow: ["#F2622A", "#FBBF6B"] as const,
  sheen: ["#1C1917", "#292524"] as const,
  warmTint: ["rgba(242, 98, 42, 0.06)", "rgba(242, 98, 42, 0.01)"] as const,
  glassSheen: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"] as const
};

/** Consistent border radii. */
export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
  pill: 999
};

/** Consistent 4px-base spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
};

/** Shadow presets — from subtle lift to premium orange glow. */
export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5
  },
  cardHover: {
    shadowColor: "#F2622A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8
  },
  orangeGlow: {
    shadowColor: "#F2622A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 14,
    elevation: 8
  },
  softGlow: {
    shadowColor: "#F2622A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3
  },
  float: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.50,
    shadowRadius: 20,
    elevation: 10
  }
};

/** Animation timing constants (ms). */
export const timing = {
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600
};
