/*!
 * liquid-glass.js — Apple-style liquid glass refraction for any element.
 * Source: https://github.com/deepika-builds/liquid-glass (MIT)
 */
(function (global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  let uid = 0;
  let svgDefs = null;

  const supported = (() => {
    const ua = navigator.userAgent;
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
    const isFirefox = /Firefox/.test(ua);
    if (isSafari || isFirefox) return false;
    if (!CSS.supports("backdrop-filter", "url(#lg)")) return false;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 4;
      canvas.getContext("2d").getImageData(0, 0, 1, 1);
      return true;
    } catch (_) {
      return false;
    }
  })();

  function ensureDefs() {
    if (svgDefs) return svgDefs;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svgDefs = document.createElementNS(SVG_NS, "defs");
    svg.appendChild(svgDefs);
    document.body.appendChild(svg);
    return svgDefs;
  }

  function makeMap(width, height, radius, border, mapBlur) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    const horizontalGradient = context.createLinearGradient(0, 0, width, 0);
    horizontalGradient.addColorStop(0, "rgb(0,0,0)");
    horizontalGradient.addColorStop(1, "rgb(255,0,0)");
    context.fillStyle = horizontalGradient;
    context.fillRect(0, 0, width, height);

    const verticalGradient = context.createLinearGradient(0, 0, 0, height);
    verticalGradient.addColorStop(0, "rgb(0,0,0)");
    verticalGradient.addColorStop(1, "rgb(0,0,255)");
    context.globalCompositeOperation = "difference";
    context.fillStyle = verticalGradient;
    context.fillRect(0, 0, width, height);

    context.globalCompositeOperation = "source-over";
    const inset = border * Math.min(width, height);
    context.filter = "blur(" + mapBlur + "px)";
    context.fillStyle = "rgba(128,128,128,0.93)";
    context.beginPath();
    context.roundRect(
      inset,
      inset,
      width - inset * 2,
      height - inset * 2,
      Math.max(radius - inset, 2),
    );
    context.fill();
    context.filter = "none";
    return canvas.toDataURL();
  }

  function buildFilter(id, scales) {
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", "100%");
    filter.setAttribute("height", "100%");
    filter.setAttribute("color-interpolation-filters", "sRGB");

    const image = document.createElementNS(SVG_NS, "feImage");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("result", "map");
    image.setAttribute("preserveAspectRatio", "none");
    filter.appendChild(image);

    const keep = [
      "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
      "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
      "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
    ];
    const channels = [];

    for (let index = 0; index < 3; index += 1) {
      const displacement = document.createElementNS(SVG_NS, "feDisplacementMap");
      displacement.setAttribute("in", "SourceGraphic");
      displacement.setAttribute("in2", "map");
      displacement.setAttribute("scale", scales[index]);
      displacement.setAttribute("xChannelSelector", "R");
      displacement.setAttribute("yChannelSelector", "B");
      displacement.setAttribute("result", "d" + index);
      filter.appendChild(displacement);

      const colorMatrix = document.createElementNS(SVG_NS, "feColorMatrix");
      colorMatrix.setAttribute("in", "d" + index);
      colorMatrix.setAttribute("type", "matrix");
      colorMatrix.setAttribute("values", keep[index]);
      colorMatrix.setAttribute("result", "c" + index);
      filter.appendChild(colorMatrix);
      channels.push("c" + index);
    }

    const firstBlend = document.createElementNS(SVG_NS, "feBlend");
    firstBlend.setAttribute("in", channels[0]);
    firstBlend.setAttribute("in2", channels[1]);
    firstBlend.setAttribute("mode", "screen");
    firstBlend.setAttribute("result", "c01");
    filter.appendChild(firstBlend);

    const secondBlend = document.createElementNS(SVG_NS, "feBlend");
    secondBlend.setAttribute("in", "c01");
    secondBlend.setAttribute("in2", channels[2]);
    secondBlend.setAttribute("mode", "screen");
    filter.appendChild(secondBlend);

    ensureDefs().appendChild(filter);
    return { filter, image };
  }

  function resolveRadius(element, width, height, override) {
    if (override != null) return override;
    const raw = getComputedStyle(element).borderTopLeftRadius || "0px";
    const value = parseFloat(raw) || 0;
    return raw.trim().endsWith("%") ? (value / 100) * Math.min(width, height) : value;
  }

  function liquidGlass(element, options) {
    const settings = Object.assign(
      {
        scale: -112,
        chroma: 6,
        border: 0.07,
        mapBlur: 12,
        blur: 3,
        saturate: 1.5,
        radius: null,
        fallbackBlur: 16,
      },
      options,
    );

    if (!supported) {
      const frosted = "blur(" + settings.fallbackBlur + "px) saturate(" + settings.saturate + ")";
      element.style.backdropFilter = frosted;
      element.style.webkitBackdropFilter = frosted;
      element.classList.add("lg-fallback");
      return {
        supported: false,
        refresh: function () {},
        destroy: function () {
          element.style.backdropFilter = "";
          element.style.webkitBackdropFilter = "";
          element.classList.remove("lg-fallback");
        },
      };
    }

    const id = "lg-filter-" + (++uid);
    const scales = [settings.scale, settings.scale + settings.chroma, settings.scale + 2 * settings.chroma];
    const parts = buildFilter(id, scales);

    function refresh() {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      if (!width || !height) return;
      const radius = resolveRadius(element, width, height, settings.radius);
      parts.image.setAttribute("href", makeMap(width, height, radius, settings.border, settings.mapBlur));
      parts.image.setAttribute("width", width);
      parts.image.setAttribute("height", height);
    }

    refresh();
    element.style.backdropFilter = "url(#" + id + ") blur(" + settings.blur + "px) saturate(" + settings.saturate + ")";

    let timer = null;
    const resizeObserver = new ResizeObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(refresh, 120);
    });
    resizeObserver.observe(element);

    return {
      supported: true,
      refresh,
      destroy: function () {
        resizeObserver.disconnect();
        clearTimeout(timer);
        parts.filter.remove();
        element.style.backdropFilter = "";
      },
    };
  }

  global.liquidGlass = liquidGlass;
})(window);
