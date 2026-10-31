function channels(color) {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length <= 4) {
      hex = [...hex].map((digit) => digit + digit).join('');
    }
    if (hex.length === 6) {
      hex += 'ff';
    }
    return [0, 2, 4, 6].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  }
  const values = color
    .slice(5, -1)
    .split(',')
    .map((value) => value.trim());
  return values.map((value, index) => (index < 3 ? parseFloat(value) / 100 : Number(value)));
}

function mix(first, second, amount) {
  return first.map((value, index) => value * (1 - amount) + second[index] * amount);
}

function luminance(color) {
  return color
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

function css(color) {
  return `rgb(${color.map((value) => Math.round(value * 255)).join(' ')})`;
}

function palette(color, dark) {
  const surface = dark ? [32 / 255, 32 / 255, 32 / 255] : [246 / 255, 248 / 255, 250 / 255];
  const target = dark ? [1, 1, 1] : [0, 0, 0];
  const base = mix(surface, color.slice(0, 3), color[3]);
  const background = mix(surface, base, 0.16);
  const border = mix(surface, base, 0.55);
  let text = base;
  for (let step = 0; step < 100 && contrast(text, background) < 4.55; step++) {
    text = mix(text, target, 0.08);
  }
  if (contrast(text, background) < 4.55) {
    text = target;
  }
  return [css(text), css(background), css(border)];
}

export function customTagPalette(color) {
  const value = channels(color);
  return {
    dark: palette(value, true),
    light: palette(value, false)
  };
}
