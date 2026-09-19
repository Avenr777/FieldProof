/**
 * FieldProof dark theme — black surfaces, brand orange accents.
 * Layering: background (deepest) -> surface (cards) -> surfaceMuted/elevated (chips, insets).
 */
export const colors = {
  // Brand Orange & Amber
  orange: "#F2622A",
  orangeBright: "#FF7A3D", // lighter orange for text/icons on dark surfaces
  orangeDark: "#D94A14",
  orangeLight: "rgba(242, 98, 42, 0.14)", // translucent orange tint bg
  orangeBorder: "rgba(242, 98, 42, 0.38)",
  amber: "#FBBF6B",

  // Layered black surfaces
  black: "#0C0A09", // stone-950 — screen background
  dark: "#141211", // between black and dark
  darkSurface: "#1C1917", // stone-900 — cards
  darkElevated: "#292524", // stone-800 — chips, insets
  darkBorder: "#383432",

  // Compatibility aliases (mapped to black/orange theme)
  navy: "#0C0A09",
  navyLight: "#1C1917",
  blue: "#F2622A",
  blueDark: "#D94A14",
  teal: "#F2622A",

  // Canvas & Surfaces (dark equivalents)
  background: "#0C0A09",
  surface: "#1C1917",
  surfaceMuted: "#292524",

  // Typography (dark-tuned hierarchy)
  text: "#FAFAF9", // stone-50
  textSecondary: "#D6D3D1", // stone-300
  muted: "#A8A29E", // stone-400
  subtle: "#78716C", // stone-500
  border: "#383432",

  // Semantic Status Tones (translucent tints for dark surfaces)
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

/** Gradient pairs (start -> end) matching the website's orange-to-amber brand. */
export const gradients = {
  /** Buttons & CTAs: orange -> deep orange */
  brand: ["#FF7A3D", "#E8500F"] as const,
  /** Glows, washes & progress: orange -> amber */
  glow: ["#F2622A", "#FBBF6B"] as const,
  /** Subtle sheen for hero cards on black */
  sheen: ["#1C1917", "#292524"] as const
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999
};

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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5
  },
  orangeGlow: {
    shadowColor: "#F2622A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5
  }
};
