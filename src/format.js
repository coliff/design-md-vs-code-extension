"use strict";

/**
 * @param {{ value: number, unit: string } | undefined} dimension
 * @returns {string}
 */
function formatDimension(dimension) {
  return dimension ? `${dimension.value}${dimension.unit}` : "";
}

/**
 * Human-readable summary of a resolved token value.
 * @param {unknown} value
 * @returns {string}
 */
function describeValue(value) {
  if (value === null || typeof value !== "object") {
    return String(value);
  }
  if (value.type === "color") {
    return value.hex;
  }
  if (value.type === "dimension") {
    return formatDimension(value);
  }
  if (value.type === "typography") {
    return [
      value.fontFamily,
      formatDimension(value.fontSize),
      value.fontWeight,
      value.lineHeight ? `/ ${formatDimension(value.lineHeight)}` : "",
    ]
      .filter((part) => part !== undefined && part !== "")
      .join(" ");
  }
  return JSON.stringify(value);
}

/**
 * Parse #RGB, #RGBA, #RRGGBB or #RRGGBBAA into 0..1 channels.
 * @param {string} hex
 * @returns {{ red: number, green: number, blue: number, alpha: number }}
 */
function parseHex(hex) {
  let digits = hex.replace(/^#/u, "");
  if (digits.length <= 4) {
    digits = [...digits].map((digit) => digit + digit).join("");
  }
  const channel = (index) =>
    Number.parseInt(digits.slice(index, index + 2), 16) / 255;
  return {
    red: channel(0),
    green: channel(2),
    blue: channel(4),
    alpha: digits.length === 8 ? channel(6) : 1,
  };
}

/**
 * Format 0..1 channels as #RRGGBB, or #RRGGBBAA when translucent.
 * @param {{ red: number, green: number, blue: number, alpha: number }} color
 * @returns {string}
 */
function toHex(color) {
  const part = (channel) =>
    Math.round(channel * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  const alpha = color.alpha < 1 ? part(color.alpha) : "";
  return `#${part(color.red)}${part(color.green)}${part(color.blue)}${alpha}`;
}

/**
 * A small rounded square filled with the color, as an SVG data URI for use as
 * a Markdown image in hovers. The faint outline keeps white and black swatches
 * visible on light and dark themes.
 * @param {string} hex
 * @returns {string}
 */
function swatchDataUri(hex) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14'><rect x='0.5' y='0.5' width='13' height='13' rx='3' fill='${hex}' stroke='#8888' /></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

module.exports = {
  describeValue,
  formatDimension,
  parseHex,
  swatchDataUri,
  toHex,
};
