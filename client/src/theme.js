// Theme manager to dynamically generate and apply tenant brand colors
function hexToRgb(hex) {
  let c = (hex || '#e11d24').replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return { r: 225, g: 29, b: 36 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function adjustBrightness(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = Math.round(r + (t - r) * p);
  const G = Math.round(g + (t - g) * p);
  const B = Math.round(b + (t - b) * p);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

export function applyTheme(primaryHex) {
  if (!primaryHex) return;
  const hex = primaryHex.startsWith('#') ? primaryHex : `#${primaryHex}`;
  const { r, g, b } = hexToRgb(hex);

  const dark = adjustBrightness(hex, -18);
  const deep = adjustBrightness(hex, -36);
  const light = adjustBrightness(hex, 18);
  const tint = `rgba(${r}, ${g}, ${b}, 0.08)`;
  const border = `rgba(${r}, ${g}, ${b}, 0.24)`;
  const glow = `rgba(${r}, ${g}, ${b}, 0.25)`;

  const root = document.documentElement;
  root.style.setProperty('--empire-red', hex);
  root.style.setProperty('--accent-primary', hex);
  root.style.setProperty('--empire-red-dark', dark);
  root.style.setProperty('--accent-primary-dark', dark);
  root.style.setProperty('--empire-red-deep', deep);
  root.style.setProperty('--empire-red-light', light);
  root.style.setProperty('--accent-primary-light', light);
  root.style.setProperty('--empire-red-tint', tint);
  root.style.setProperty('--accent-primary-subtle', tint);
  root.style.setProperty('--empire-red-border', border);
  root.style.setProperty('--accent-primary-glow', glow);
  root.style.setProperty('--border-active', hex);
}
