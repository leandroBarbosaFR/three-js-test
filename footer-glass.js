// ============================================================
//  Footer glass — the giant "1367" number seen through the same
//  textured glass as the hero. Transparent background so the orange
//  footer shows through; the white number ripples/refracts under the
//  cursor and catches a specular glint.
// ============================================================

import * as THREE from "three";

const NUMBER_URL = "/public/1367%201.png"; // note: the file has a space
const MAX_RIPPLES = 10;

export function initFooterGlass(canvasEl) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    alpha: true, // transparent — let the orange footer show through
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const sizeToEl = () => {
    const w = canvasEl.clientWidth || 1;
    const h = canvasEl.clientHeight || 1;
    renderer.setSize(w, h, false);
    material.uniforms.uResolution.value.set(w, h);
  };

  const texture = new THREE.TextureLoader().load(NUMBER_URL, (tex) => {
    material.uniforms.uImageResolution.value.set(
      tex.image.width,
      tex.image.height
    );
  });
  texture.colorSpace = THREE.SRGBColorSpace;

  const ripplePos = Array.from(
    { length: MAX_RIPPLES },
    () => new THREE.Vector2()
  );
  const rippleTime = new Float32Array(MAX_RIPPLES).fill(-1000);
  let rippleIndex = 0;

  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTexture: { value: texture },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uImageResolution: { value: new THREE.Vector2(1440, 327) },
      uRipplePos: { value: ripplePos },
      uRippleTime: { value: rippleTime },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader:
      `#define MAX_RIPPLES ${MAX_RIPPLES}\n` +
      /* glsl */ `
      precision highp float;
      varying vec2 vUv;

      uniform sampler2D uTexture;
      uniform float uTime;
      uniform vec2  uResolution;
      uniform vec2  uImageResolution;
      uniform vec2  uRipplePos[MAX_RIPPLES];
      uniform float uRippleTime[MAX_RIPPLES];

      float height(vec2 p) {
        float aspect = uResolution.x / uResolution.y;
        vec2 ap = vec2(p.x * aspect, p.y);

        // Subtle resting glass bumps.
        float h = 0.0;
        h += sin(ap.x * 8.0 + ap.y * 5.0 + uTime * 0.3) * 0.5;
        h += sin(ap.x * -5.0 + ap.y * 9.0 - uTime * 0.2) * 0.5;
        h *= 0.05;

        // Cursor ripples.
        for (int k = 0; k < MAX_RIPPLES; k++) {
          float age = uTime - uRippleTime[k];
          if (age < 0.0 || age > 2.2) continue;
          vec2 rp = uRipplePos[k];
          float d = distance(ap, vec2(rp.x * aspect, rp.y));
          float fade = exp(-age * 3.0);
          float ring = sin(d * 30.0 - age * 11.0);
          float falloff = exp(-d * 5.0);
          h += ring * fade * falloff * 0.5;
        }
        return h;
      }

      void main() {
        vec2 uv = vUv;
        vec2 px = 2.0 / uResolution;

        // Fit the number to the canvas width, anchored to the top so the
        // bottom of the digits bleeds off the edge (like the design).
        float cA = uResolution.x / uResolution.y;
        float iA = uImageResolution.x / uImageResolution.y;
        float fitH = cA / iA; // fraction of canvas height the number spans
        vec2 nuv = vec2(uv.x, uv.y / fitH);

        // Glass slope.
        float hL = height(uv - vec2(px.x, 0.0));
        float hR = height(uv + vec2(px.x, 0.0));
        float hD = height(uv - vec2(0.0, px.y));
        float hU = height(uv + vec2(0.0, px.y));
        vec2 grad = vec2(hR - hL, hU - hD);

        vec2 refracted = nuv - grad * 0.35;

        // Outside the number's mapped area → fully transparent.
        if (refracted.y < 0.0 || refracted.y > 1.0 ||
            refracted.x < 0.0 || refracted.x > 1.0) {
          discard;
        }

        vec4 tex = texture2D(uTexture, refracted);
        float a = tex.a;
        if (a < 0.01) discard;

        // Specular glint along the rippled surface, on the number only.
        vec3 normal = normalize(vec3(-grad * 40.0, 1.0));
        vec3 lightDir = normalize(vec3(0.5, 0.8, 0.7));
        float spec = pow(max(dot(normal, lightDir), 0.0), 20.0);

        vec3 color = tex.rgb + spec * 0.5;
        gl_FragColor = vec4(color, a);
      }
    `,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);
  sizeToEl();

  // Cursor ripples — only when the pointer is over the number canvas.
  function onPointerMove(e) {
    const r = canvasEl.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      return;
    const nx = (e.clientX - r.left) / r.width;
    const ny = 1.0 - (e.clientY - r.top) / r.height;
    ripplePos[rippleIndex].set(nx, ny);
    rippleTime[rippleIndex] = material.uniforms.uTime.value;
    rippleIndex = (rippleIndex + 1) % MAX_RIPPLES;
  }
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("resize", sizeToEl);

  const start = performance.now();
  let running = true;
  function loop() {
    if (!running) return;
    material.uniforms.uTime.value = (performance.now() - start) / 1000;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  // Cleanup handle (in case we ever tear it down).
  return () => {
    running = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", sizeToEl);
    texture.dispose();
    material.dispose();
    quad.geometry.dispose();
    renderer.dispose();
  };
}
