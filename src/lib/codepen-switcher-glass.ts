type SwitcherGlassConfig = {
  glassThickness: number;
  bezelWidth: number;
  ior: number;
  scaleRatio: number;
  blur: number;
  specularOpacity: number;
  specularSat: number;
  tintColor: string;
  tintOpacity: number;
  innerShadow: string;
  innerShadowBlur: number;
  innerShadowSpread: number;
  balancedSpecular: boolean;
};

const SWITCHER_CONFIG: SwitcherGlassConfig = {
  glassThickness: 30,
  bezelWidth: 40,
  ior: 1.4,
  scaleRatio: 1,
  blur: 0,
  specularOpacity: 0.5,
  specularSat: 0,
  tintColor: "255,255,255",
  tintOpacity: 0,
  innerShadow: "rgba(255,255,255,0)",
  innerShadowBlur: 0,
  innerShadowSpread: 0,
  balancedSpecular: true,
};

const NAV_CONFIG: SwitcherGlassConfig = {
  glassThickness: 80,
  bezelWidth: 40,
  ior: 1.4,
  scaleRatio: 1,
  blur: 1,
  specularOpacity: 0.6,
  specularSat: 0,
  tintColor: "255,255,255",
  tintOpacity: 0,
  innerShadow: "rgba(255,255,255,0)",
  innerShadowBlur: 0,
  innerShadowSpread: 0,
  balancedSpecular: false,
};

let defs: SVGDefsElement | null = null;

function surfaceFn(x: number) {
  return Math.pow(1 - Math.pow(1 - x, 4), 0.25);
}

function calcRefractionProfile(
  glassThickness: number,
  bezelWidth: number,
  ior: number,
  samples = 128,
) {
  const eta = 1 / ior;
  const profile = new Float64Array(samples);
  const refract = (nx: number, ny: number) => {
    const dot = ny;
    const k = 1 - eta * eta * (1 - dot * dot);
    if (k < 0) return null;
    const root = Math.sqrt(k);
    return [-(eta * dot + root) * nx, eta - (eta * dot + root) * ny];
  };
  for (let index = 0; index < samples; index += 1) {
    const x = index / samples;
    const y = surfaceFn(x);
    const dx = x < 1 ? 0.0001 : -0.0001;
    const derivative = (surfaceFn(x + dx) - y) / dx;
    const magnitude = Math.sqrt(derivative * derivative + 1);
    const refraction = refract(-derivative / magnitude, -1 / magnitude);
    profile[index] = refraction
      ? refraction[0] * ((y * bezelWidth + glassThickness) / refraction[1])
      : 0;
  }
  return profile;
}

function canvasContext(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable");
  return { canvas, context };
}

function generateDisplacementMap(
  width: number,
  height: number,
  radius: number,
  bezelWidth: number,
  profile: Float64Array,
  maxDisplacement: number,
) {
  const { canvas, context } = canvasContext(width, height);
  const image = context.createImageData(width, height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 128;
    data[index + 1] = 128;
    data[index + 2] = 0;
    data[index + 3] = 255;
  }
  const radiusSquared = radius * radius;
  const outerSquared = (radius + 1) ** 2;
  const innerSquared = Math.max(radius - bezelWidth, 0) ** 2;
  const widthBody = width - radius * 2;
  const heightBody = height - radius * 2;
  const samples = profile.length;
  for (let y1 = 0; y1 < height; y1 += 1) {
    for (let x1 = 0; x1 < width; x1 += 1) {
      const x = x1 < radius ? x1 - radius : x1 >= width - radius ? x1 - radius - widthBody : 0;
      const y = y1 < radius ? y1 - radius : y1 >= height - radius ? y1 - radius - heightBody : 0;
      const distanceSquared = x * x + y * y;
      if (distanceSquared > outerSquared || distanceSquared < innerSquared) continue;
      const distance = Math.sqrt(distanceSquared);
      const fromSide = radius - distance;
      const opacity = distanceSquared < radiusSquared
        ? 1
        : 1 - (distance - Math.sqrt(radiusSquared)) / (Math.sqrt(outerSquared) - Math.sqrt(radiusSquared));
      if (opacity <= 0 || distance === 0) continue;
      const cosine = x / distance;
      const sine = y / distance;
      const bandIndex = Math.min(((fromSide / bezelWidth) * samples) | 0, samples - 1);
      const displacement = profile[bandIndex] || 0;
      const dx = (-cosine * displacement) / maxDisplacement;
      const dy = (-sine * displacement) / maxDisplacement;
      const pixel = (y1 * width + x1) * 4;
      data[pixel] = (128 + dx * 127 * opacity + 0.5) | 0;
      data[pixel + 1] = (128 + dy * 127 * opacity + 0.5) | 0;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

function generateSpecularMap(
  width: number,
  height: number,
  radius: number,
  bezelWidth: number,
  balanced: boolean,
) {
  const angle = Math.PI / 3;
  const { canvas, context } = canvasContext(width, height);
  const image = context.createImageData(width, height);
  const data = image.data;
  data.fill(0);
  const radiusSquared = radius * radius;
  const outerSquared = (radius + 1) ** 2;
  const innerSquared = Math.max(radius - bezelWidth, 0) ** 2;
  const widthBody = width - radius * 2;
  const heightBody = height - radius * 2;
  const light = [Math.cos(angle), Math.sin(angle)];
  for (let y1 = 0; y1 < height; y1 += 1) {
    for (let x1 = 0; x1 < width; x1 += 1) {
      const x = x1 < radius ? x1 - radius : x1 >= width - radius ? x1 - radius - widthBody : 0;
      const y = y1 < radius ? y1 - radius : y1 >= height - radius ? y1 - radius - heightBody : 0;
      const distanceSquared = x * x + y * y;
      if (distanceSquared > outerSquared || distanceSquared < innerSquared) continue;
      const distance = Math.sqrt(distanceSquared);
      const fromSide = radius - distance;
      const opacity = distanceSquared < radiusSquared
        ? 1
        : 1 - (distance - Math.sqrt(radiusSquared)) / (Math.sqrt(outerSquared) - Math.sqrt(radiusSquared));
      if (opacity <= 0 || distance === 0) continue;
      const cosine = x / distance;
      const sine = -y / distance;
      const dot = balanced ? 1 : Math.abs(cosine * light[0] + sine * light[1]);
      const edge = Math.sqrt(Math.max(0, 1 - (1 - fromSide) ** 2));
      const coefficient = dot * edge;
      const colour = (255 * coefficient) | 0;
      const alpha = (colour * coefficient * opacity) | 0;
      const pixel = (y1 * width + x1) * 4;
      data[pixel] = colour;
      data[pixel + 1] = colour;
      data[pixel + 2] = colour;
      data[pixel + 3] = alpha;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function ensureDefs() {
  const existing = document.getElementById("pack-go-codepen-glass-defs");
  if (existing instanceof SVGDefsElement && document.documentElement.contains(existing)) {
    defs = existing;
    return existing;
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:-1";
  defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.id = "pack-go-codepen-glass-defs";
  svg.appendChild(defs);
  document.documentElement.appendChild(svg);
  return defs;
}

function buildFilter(
  id: string,
  width: number,
  height: number,
  radius: number,
  config: SwitcherGlassConfig,
) {
  const bezel = Math.min(config.bezelWidth, radius - 1, Math.min(width, height) / 2 - 1);
  const profile = calcRefractionProfile(config.glassThickness, bezel, config.ior);
  const maxDisplacement = Math.max(...Array.from(profile).map(Math.abs)) || 1;
  const displacementUrl = generateDisplacementMap(width, height, radius, bezel, profile, maxDisplacement);
  const specularUrl = generateSpecularMap(width, height, radius, bezel * 2.5, config.balancedSpecular);
  const padding = config.balancedSpecular ? 0.36 : 0;
  const filter = svgElement("filter", {
    id,
    x: Math.round(-width * padding),
    y: Math.round(-height * padding),
    width: Math.round(width * (1 + padding * 2)),
    height: Math.round(height * (1 + padding * 2)),
    filterUnits: "userSpaceOnUse",
    primitiveUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });
  const blur = svgElement("feGaussianBlur", { in: "SourceGraphic", stdDeviation: config.blur, result: "blurred" });
  const image = svgElement("feImage", { href: displacementUrl, x: 0, y: 0, width, height, result: "disp_map" });
  const displacement = svgElement("feDisplacementMap", {
    in: "blurred",
    in2: "disp_map",
    scale: maxDisplacement * config.scaleRatio,
    xChannelSelector: "R",
    yChannelSelector: "G",
    result: "displaced",
  });
  const saturation = svgElement("feColorMatrix", { in: "displaced", type: "saturate", values: config.specularSat, result: "displaced_sat" });
  const specular = svgElement("feImage", { href: specularUrl, x: 0, y: 0, width, height, result: "spec_layer" });
  const composite = svgElement("feComposite", { in: "displaced_sat", in2: "spec_layer", operator: "in", result: "spec_masked" });
  const transfer = svgElement("feComponentTransfer", { in: "spec_layer", result: "spec_faded" });
  transfer.appendChild(svgElement("feFuncA", { type: "linear", slope: config.specularOpacity }));
  const firstBlend = svgElement("feBlend", { in: "spec_masked", in2: "displaced", mode: "normal", result: "with_sat" });
  const secondBlend = svgElement("feBlend", { in: "spec_faded", in2: "with_sat", mode: "normal" });
  filter.append(blur, image, displacement, saturation, specular, composite, transfer, firstBlend, secondBlend);
  return filter;
}

function attachCodepenGlass(element: HTMLElement, config: SwitcherGlassConfig) {
  element.dataset.glassEngine = "svg-refraction";
  const refract = document.createElement("span");
  refract.className = "codepen-switcher-refract";
  const tint = document.createElement("span");
  tint.className = "codepen-switcher-tint";
  element.prepend(tint);
  element.prepend(refract);
  let filterNode: SVGFilterElement | null = null;
  let rebuildFrame = 0;

  const elevateContents = () => {
    Array.from(element.children).forEach((child) => {
      if (child === refract || child === tint || !(child instanceof HTMLElement)) return;
      if (getComputedStyle(child).position === "static") child.style.position = "relative";
      if (!child.style.zIndex) child.style.zIndex = "1";
    });
  };

  const rebuild = () => {
    const width = Math.round(element.offsetWidth);
    const height = Math.round(element.offsetHeight);
    if (width < 4 || height < 4) return;
    filterNode?.remove();
    filterNode = null;
    const id = `pack-go-switcher-${Math.random().toString(36).slice(2, 10)}`;
    filterNode = buildFilter(id, width, height, Math.max(2, Math.min(width / 2, height / 2)), config);
    ensureDefs().appendChild(filterNode);
    refract.style.backdropFilter = `url(#${id})`;
    refract.style.setProperty("-webkit-backdrop-filter", `url(#${id})`);
    tint.style.backgroundColor = `rgba(${config.tintColor},${config.tintOpacity})`;
    tint.style.boxShadow = `inset 0 0 ${config.innerShadowBlur}px ${config.innerShadowSpread}px ${config.innerShadow}`;
    elevateContents();
  };

  const scheduleRebuild = () => {
    cancelAnimationFrame(rebuildFrame);
    rebuildFrame = requestAnimationFrame(rebuild);
  };

  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleRebuild);
  observer?.observe(element);

  rebuild();
  return {
    rebuild,
    destroy() {
      cancelAnimationFrame(rebuildFrame);
      observer?.disconnect();
      filterNode?.remove();
      refract.remove();
      tint.remove();
      delete element.dataset.glassEngine;
    },
  };
}

export function attachCodepenSwitcherGlass(element: HTMLElement) {
  return attachCodepenGlass(element, SWITCHER_CONFIG);
}

export function attachCodepenNavGlass(element: HTMLElement) {
  return attachCodepenGlass(element, NAV_CONFIG);
}
