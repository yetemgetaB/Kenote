export function applyAccentColor(hex: string) {
  // Convert hex to rgb components
  const cleanedHex = hex.replace("#", "");
  let r = 3, g = 153, b = 247;
  if (cleanedHex.length === 6) {
    r = parseInt(cleanedHex.substring(0, 2), 16);
    g = parseInt(cleanedHex.substring(2, 4), 16);
    b = parseInt(cleanedHex.substring(4, 6), 16);
  }

  const root = document.documentElement;
  root.style.setProperty("--accent-color", hex);
  root.style.setProperty("--accent-rgb", `${r}, ${g}, ${b}`);
  root.style.setProperty("--accent-hover", `rgba(${r}, ${g}, ${b}, 0.85)`);
  root.style.setProperty("--accent-muted", `rgba(${r}, ${g}, ${b}, 0.15)`);
  root.style.setProperty("--accent-glow", `rgba(${r}, ${g}, ${b}, 0.35)`);
}
