// colors.ts - Color helpers for ARGB integers stored by FitNotes.

// ARGB Integer Color -> CSS rgb() string.
export const intColorToHex = (num: number): string => {
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgb(${r}, ${g}, ${b})`;
};
