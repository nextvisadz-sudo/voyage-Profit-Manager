/**
 * DOM Polyfills for Node.js
 *
 * pdfjs-dist (used internally by pdf-parse v2+) requires certain browser-native
 * globals (DOMMatrix, ImageData, Path2D) that do not exist in Node.js.
 *
 * This module must be imported FIRST, before pdf-parse or any pdfjs-dist code
 * is loaded, to prevent the "ReferenceError: DOMMatrix is not defined" crash.
 *
 * We first try to load @napi-rs/canvas (native, high-performance). If it's not
 * available (e.g., not installed or native binary missing), we fall back to
 * lightweight stub implementations that satisfy pdfjs-dist's type checks.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function installStubs() {
  const g = globalThis as any;

  // --- DOMMatrix stub ---
  if (!g.DOMMatrix) {
    g.DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true; isIdentity = true;
      constructor(_init?: string | number[]) {}
      multiply(other?: DOMMatrix) { return new (g.DOMMatrix)(); }
      translate(tx?: number, ty?: number, tz?: number) { return new (g.DOMMatrix)(); }
      scale(sx?: number, sy?: number, sz?: number) { return new (g.DOMMatrix)(); }
      rotate(rx?: number, ry?: number, rz?: number) { return new (g.DOMMatrix)(); }
      inverse() { return new (g.DOMMatrix)(); }
      transformPoint(point?: any) { return { x: 0, y: 0, z: 0, w: 1 }; }
      toFloat32Array() { return new Float32Array(16); }
      toFloat64Array() { return new Float64Array(16); }
      toString() { return "matrix(1, 0, 0, 1, 0, 0)"; }
      static fromMatrix(other?: any) { return new (g.DOMMatrix)(); }
      static fromFloat32Array(array32: Float32Array) { return new (g.DOMMatrix)(); }
      static fromFloat64Array(array64: Float64Array) { return new (g.DOMMatrix)(); }
    };
    console.warn("[dom-polyfill] Stubbed DOMMatrix (pdfjs-dist compatibility)");
  }

  // --- DOMMatrixReadOnly (alias) ---
  if (!g.DOMMatrixReadOnly) {
    g.DOMMatrixReadOnly = g.DOMMatrix;
  }

  // --- DOMPoint stub ---
  if (!g.DOMPoint) {
    g.DOMPoint = class DOMPoint {
      x: number; y: number; z: number; w: number;
      constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
      static fromPoint(other?: any) { return new (g.DOMPoint)(); }
      matrixTransform(matrix?: any) { return new (g.DOMPoint)(); }
    };
  }

  // --- DOMRect stub ---
  if (!g.DOMRect) {
    g.DOMRect = class DOMRect {
      x: number; y: number; width: number; height: number;
      get top() { return this.y; }
      get right() { return this.x + this.width; }
      get bottom() { return this.y + this.height; }
      get left() { return this.x; }
      constructor(x = 0, y = 0, width = 0, height = 0) { this.x = x; this.y = y; this.width = width; this.height = height; }
      static fromRect(other?: any) { return new (g.DOMRect)(); }
      toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height, top: this.top, right: this.right, bottom: this.bottom, left: this.left }; }
    };
  }

  // --- ImageData stub ---
  if (!g.ImageData) {
    g.ImageData = class ImageData {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      colorSpace: string = "srgb";
      constructor(widthOrData: number | Uint8ClampedArray, height: number, width?: number) {
        if (typeof widthOrData === "number") {
          this.width = widthOrData;
          this.height = height;
          this.data = new Uint8ClampedArray(widthOrData * height * 4);
        } else {
          this.data = widthOrData;
          this.width = width ?? (widthOrData.length / 4 / height);
          this.height = height;
        }
      }
    };
    console.warn("[dom-polyfill] Stubbed ImageData (pdfjs-dist compatibility)");
  }

  // --- Path2D stub ---
  if (!g.Path2D) {
    g.Path2D = class Path2D {
      constructor(_path?: string | Path2D) {}
      addPath(_path: Path2D, _transform?: any) {}
      closePath() {}
      moveTo(_x: number, _y: number) {}
      lineTo(_x: number, _y: number) {}
      bezierCurveTo(_cp1x: number, _cp1y: number, _cp2x: number, _cp2y: number, _x: number, _y: number) {}
      quadraticCurveTo(_cpx: number, _cpy: number, _x: number, _y: number) {}
      arc(_x: number, _y: number, _radius: number, _startAngle: number, _endAngle: number, _anticlockwise?: boolean) {}
      arcTo(_x1: number, _y1: number, _x2: number, _y2: number, _radius: number) {}
      ellipse(_x: number, _y: number, _radiusX: number, _radiusY: number, _rotation: number, _startAngle: number, _endAngle: number, _anticlockwise?: boolean) {}
      rect(_x: number, _y: number, _w: number, _h: number) {}
    };
    console.warn("[dom-polyfill] Stubbed Path2D (pdfjs-dist compatibility)");
  }

  // --- OffscreenCanvas stub (used by some pdfjs versions) ---
  if (!g.OffscreenCanvas) {
    g.OffscreenCanvas = class OffscreenCanvas {
      width: number; height: number;
      constructor(width: number, height: number) { this.width = width; this.height = height; }
      getContext(_contextId: string, _options?: any) {
        return {
          fillRect: () => {}, clearRect: () => {}, getImageData: (x: number, y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
          putImageData: () => {}, createImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
          setTransform: () => {}, drawImage: () => {}, save: () => {}, fillText: () => {}, restore: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {}, stroke: () => {}, translate: () => {}, scale: () => {}, rotate: () => {}, arc: () => {}, fill: () => {}, transform: () => {}, rect: () => {}, clip: () => {},
          canvas: this, globalAlpha: 1, globalCompositeOperation: "source-over", fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, lineCap: "butt", lineJoin: "miter", miterLimit: 10, shadowBlur: 0, shadowColor: "rgba(0,0,0,0)", shadowOffsetX: 0, shadowOffsetY: 0, font: "10px sans-serif", textAlign: "start", textBaseline: "alphabetic",
        };
      }
      convertToBlob(_options?: any) { return Promise.resolve(new Blob()); }
      transferToImageBitmap() { return {} as any; }
      addEventListener() {}
      removeEventListener() {}
      dispatchEvent() { return false; }
    };
  }
}

// Attempt to load @napi-rs/canvas (native implementation, preferred).
// If it's not available, the stubs above will handle pdfjs-dist's requirements.
async function tryLoadNativeCanvas() {
  try {
    const canvas = await import("@napi-rs/canvas");
    const g = globalThis as any;
    if (canvas.DOMMatrix && !g.DOMMatrix) g.DOMMatrix = canvas.DOMMatrix;
    if (canvas.ImageData && !g.ImageData) g.ImageData = canvas.ImageData;
    if (canvas.Path2D && !g.Path2D) g.Path2D = canvas.Path2D;
    console.info("[dom-polyfill] Loaded @napi-rs/canvas native implementation");
  } catch {
    // Not available - stubs are already installed above, no action needed
  }
}

// Install stubs synchronously so they are available before any module
// that uses pdf-parse is evaluated
installStubs();

// Optionally try to upgrade to native implementation
tryLoadNativeCanvas().catch(() => {});
