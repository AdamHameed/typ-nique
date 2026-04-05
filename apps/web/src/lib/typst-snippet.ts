const MATRIX_TRANSFORM_REGEX = /transform="matrix\(([^)]+)\)"/g;
const VIEWBOX_REGEX = /viewBox="([^"]+)"/;
const WIDTH_ATTR_REGEX = /\swidth="[^"]*"/;
const HEIGHT_ATTR_REGEX = /\sheight="[^"]*"/;
const PRESERVE_ASPECT_RATIO_REGEX = /\spreserveAspectRatio="[^"]*"/;

export function optimizeTypstSvgForSnippet(svg: string) {
  const trimmed = svg.trim();

  if (!trimmed.includes('class="typst-doc"')) {
    return trimmed;
  }

  const positions = extractTransformPositions(trimmed);

  if (positions.length === 0) {
    return trimmed;
  }

  const xs = positions.map((position) => position.x);
  const ys = positions.map((position) => position.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const cropWidth = Math.max(140, maxX - minX + 40);
  const cropHeight = Math.max(72, maxY - minY + 36);
  const cropX = (minX + maxX) / 2 - cropWidth / 2;
  const cropY = Math.max(0, minY - 18);

  let nextSvg = trimmed;

  if (VIEWBOX_REGEX.test(nextSvg)) {
    nextSvg = nextSvg.replace(VIEWBOX_REGEX, `viewBox="${cropX} ${cropY} ${cropWidth} ${cropHeight}"`);
  }

  nextSvg = nextSvg.replace(WIDTH_ATTR_REGEX, ` width="${cropWidth}"`);
  nextSvg = nextSvg.replace(HEIGHT_ATTR_REGEX, ` height="${cropHeight}"`);

  if (PRESERVE_ASPECT_RATIO_REGEX.test(nextSvg)) {
    nextSvg = nextSvg.replace(PRESERVE_ASPECT_RATIO_REGEX, ' preserveAspectRatio="xMidYMid meet"');
  } else {
    nextSvg = nextSvg.replace("<svg ", '<svg preserveAspectRatio="xMidYMid meet" ');
  }

  return nextSvg;
}

function extractTransformPositions(svg: string) {
  const positions: Array<{ x: number; y: number }> = [];

  for (const match of svg.matchAll(MATRIX_TRANSFORM_REGEX)) {
    const rawMatrix = match[1];

    if (!rawMatrix) {
      continue;
    }

    const numbers = rawMatrix
      .trim()
      .split(/\s+/)
      .map((value) => Number.parseFloat(value))
      .filter((value) => Number.isFinite(value));

    if (numbers.length < 6) {
      continue;
    }

    positions.push({
      x: numbers[4] ?? 0,
      y: numbers[5] ?? 0
    });
  }

  return positions;
}
