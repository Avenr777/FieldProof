/**
 * FieldProof dark theme — black surfaces, brand orange accents.
 * Layering: background (deepest) -> surface (cards) -> surfaceMuted/elevated (chips, insets).
 *
 * Glassmorphism variants: translucent surfaces with backdrop blur for a premium,
 * layered feel. Used on headers, modals, and key cards.
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
  black: "#0C0A09",       // stone-950 — screen background
  dark: "#141211",        // between black and dark
  darkSurface: "#1C1917", // stone-900 — cards
  darkElevated: "#292524",// stone-800 — chips, insets
  darkBorder: "#383432",

  // Glassmorphism surfaces (translucent with subtle border)
  glass: "rgba(28, 25, 23, 0.72)",        // frosted card / header
  glassBorder: "rgba(56, 52, 50, 0.50)",  // subtle glass edge
  glassHighlight: "rgba(255, 255, 255, 0.04)", // top-edge glass shine

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
  /** Subtle warm tint for card headers / headers */
  warmTint: ["rgba(242, 98, 42, 0.06)", "rgba(242, 98, 42, 0.01)"] as const,
  /** Glass sheen — white at low opacity, top to bottom */
  glassSheen: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"] as const
};

export const radius = {
  sm: 10,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
  pill: 999
};

/** Consistent spacing scale (4px base). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32
};

export const shadows = {
  /** Subtle lift for cards */
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5
  },
  /** Orange-tinted lift on hover/press */
  cardHover: {
    shadowColor: "#F2622A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8
  },
  /** Premium orange glow for primary CTAs */
  orangeGlow: {
    shadowColor: "#F2622A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 14,
    elevation: 8
  },
  /** Subtle glow for secondary elements */
  softGlow: {
    shadowColor: "#F2622A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3
  },
  /** Floating/popover shadow for modals */
  float: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.50,
    shadowRadius: 20,
    elevation: 10
  }
};

/** Animation timing constants (ms) — keeps motion consistent across the app. */
export const timing = {
  fast: 150,   // button press, micro-interactions
  normal: 250, // screen transitions, card expands
  slow: 400,   // modals, big reveals
  slower: 600  // page-level transitions
};

