// ============================================================
//  Three.js — Glass Ripple Background
//  A full-screen image, seen through a pane of textured glass.
//  Moving the mouse drops "waves" that ripple across the glass,
//  refracting the image and glinting with light.
//
//  How it works:
//   - One flat plane fills the whole screen (orthographic camera).
//   - A fragment shader samples the image and bends the pixels
//     using a "height field" made of (a) static glass bumps and
//     (b) expanding ripples spawned wherever the mouse moves.
//   - The slope of that height field refracts the image and
//     drives a specular highlight, so it reads as real glass.
// ============================================================

import * as THREE from "three";

// The background video, seen through the glass.
const VIDEO_URL = "/public/cinematic-reflection.mp4";

// How many simultaneous ripples we can have on screen at once.
const MAX_RIPPLES = 12;

// 1. SCENE + CAMERA -----------------------------------------
// An orthographic camera looking straight at a 2x2 plane means
// the plane maps 1:1 to the screen — perfect for a fullscreen effect.
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// 2. RENDERER ------------------------------------------------
const canvas = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 3. VIDEO TEXTURE -------------------------------------------
// The video is NOT played — we scrub it by scroll. It stays paused
// and we set `currentTime` from the scroll position each frame.
const video = document.createElement("video");
video.src = VIDEO_URL;
video.muted = true;
video.playsInline = true;
video.preload = "auto";
video.crossOrigin = "anonymous";
video.pause();

let videoDuration = 0;

// Once the video's real dimensions are known, tell the shader so we
// can "cover"-fit it (fill the screen without stretching).
video.addEventListener("loadedmetadata", () => {
  videoDuration = video.duration;
  material.uniforms.uImageResolution.value.set(
    video.videoWidth,
    video.videoHeight
  );
});

// Prime the decoder: a video that has never played often won't render
// seeked frames to a texture. A quick muted play → pause fixes that.
video.addEventListener(
  "loadeddata",
  async () => {
    try {
      await video.play();
    } catch (e) {
      /* autoplay may be blocked; seeking still works once primed */
    }
    video.pause();
    video.currentTime = 0;
  },
  { once: true }
);

const texture = new THREE.VideoTexture(video);
texture.colorSpace = THREE.SRGBColorSpace;

// A paused video only produces a new frame after a seek completes, so
// push it to the GPU exactly then.
video.addEventListener("seeked", () => {
  texture.needsUpdate = true;
});

// 4. RIPPLE STATE --------------------------------------------
// Each ripple is a point on screen (uRipplePos) + the time it was
// born (uRippleTime). The shader ages them and fades them out.
const ripplePos = Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector2());
const rippleTime = new Float32Array(MAX_RIPPLES).fill(-1000); // all "dead"
let rippleIndex = 0;

// 5. SHADER MATERIAL -----------------------------------------
const material = new THREE.ShaderMaterial({
  uniforms: {
    uTexture: { value: texture },
    uTime: { value: 0 },
    uResolution: {
      value: new THREE.Vector2(window.innerWidth, window.innerHeight),
    },
    uImageResolution: { value: new THREE.Vector2(1600, 1000) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uRipplePos: { value: ripplePos },
    uRippleTime: { value: rippleTime },
    // Intro reveal: 0 = small (whole frame visible), 1 = fills screen.
    uReveal: { value: 0 },
    // How small the video starts, as a fraction of its final size.
    uStartScale: { value: 0.3 },
    // The color shown around the video before it fills the screen.
    uMarginColor: { value: new THREE.Color(0x0f1020) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  // The MAX_RIPPLES count is injected as a GLSL #define (in a separate,
  // untagged string) so the shader body below stays valid GLSL with no
  // JS interpolation for editor linters to trip over.
  fragmentShader:
    `#define MAX_RIPPLES ${MAX_RIPPLES}\n` +
    /* glsl */ `
    precision highp float;

    varying vec2 vUv;

    uniform sampler2D uTexture;
    uniform float uTime;
    uniform vec2  uResolution;
    uniform vec2  uImageResolution;
    uniform vec2  uMouse;
    uniform vec2  uRipplePos[MAX_RIPPLES];
    uniform float uRippleTime[MAX_RIPPLES];
    uniform float uReveal;      // 0 = small, 1 = fills screen
    uniform float uStartScale;  // starting size as a fraction of final
    uniform vec3  uMarginColor;

    // The height field: how "high" the glass is at point p.
    // Slope of this surface is what bends the light.
    float height(vec2 p) {
      float aspect = uResolution.x / uResolution.y;
      vec2 ap = vec2(p.x * aspect, p.y); // keep circles round

      // (a) Static frosted-glass bumps — a couple of slow sine layers.
      float h = 0.0;
      h += sin(ap.x * 9.0  + ap.y * 6.0  + uTime * 0.3) * 0.5;
      h += sin(ap.x * -6.0 + ap.y * 11.0 - uTime * 0.2) * 0.5;
      h *= 0.06; // keep the resting glass subtle

      // (b) Mouse ripples — each one is a ring that expands and fades.
      for (int k = 0; k < MAX_RIPPLES; k++) {
        float age = uTime - uRippleTime[k];
        if (age < 0.0 || age > 2.2) continue;      // skip dead ripples
        vec2 rp = uRipplePos[k];
        float d = distance(ap, vec2(rp.x * aspect, rp.y));
        float fade = exp(-age * 3.0);              // fade over time
        float ring = sin(d * 42.0 - age * 12.0);   // travels outward
        float falloff = exp(-d * 7.0);             // strongest near drop
        h += ring * fade * falloff * 0.28;         // subtle: was 0.9
      }
      return h;
    }

    void main() {
      vec2 uv = vUv;
      vec2 px = 2.0 / uResolution;

      // --- Intro reveal: the WHOLE video frame is shown (never cropped)
      // at a small size, then uniformly scaled up until it fills the
      // screen. "fit" is how much of the screen the full frame covers
      // when shown intact (contain); scaling past that = fullscreen cover.
      float screenAspect = uResolution.x / uResolution.y;
      float videoAspect  = uImageResolution.x / uImageResolution.y;
      vec2 fit = videoAspect > screenAspect
        ? vec2(1.0, screenAspect / videoAspect)   // letterbox top/bottom
        : vec2(videoAspect / screenAspect, 1.0);  // pillarbox left/right

      float coverScale = 1.0 / min(fit.x, fit.y);          // fills screen
      float scale = mix(coverScale * uStartScale, coverScale, uReveal);
      vec2 drawn = fit * scale;                            // frame size (0..1)

      // Map screen uv → video-frame uv (0..1 across the intact frame).
      vec2 cuv = (uv - 0.5) / drawn + 0.5;

      // Margin mask: outside the drawn frame we show the margin color.
      vec2 edge = abs(uv - 0.5) - drawn * 0.5;
      float dist = max(edge.x, edge.y) * min(uResolution.x, uResolution.y);
      float mask = 1.0 - smoothstep(0.0, 1.5, dist);

      // Slope (gradient) of the glass via central differences.
      float hL = height(uv - vec2(px.x, 0.0));
      float hR = height(uv + vec2(px.x, 0.0));
      float hD = height(uv - vec2(0.0, px.y));
      float hU = height(uv + vec2(0.0, px.y));
      vec2 grad = vec2(hR - hL, hU - hD);

      // Refract: bend the image UVs along the slope.
      vec2 refracted = cuv - grad * 0.35;

      // Chromatic aberration — split the colors a touch for a glassy edge.
      vec2 ca = grad * 0.010;
      float r = texture2D(uTexture, refracted + ca).r;
      float g = texture2D(uTexture, refracted).g;
      float b = texture2D(uTexture, refracted - ca).b;
      vec3 color = vec3(r, g, b);

      // Specular glint: shine a light off the tilted glass surface.
      vec3 normal = normalize(vec3(-grad * 40.0, 1.0));
      vec3 lightDir = normalize(vec3(0.6, 0.8, 0.7));
      float spec = pow(max(dot(normal, lightDir), 0.0), 24.0);
      color += spec * 0.45;

      // A faint tint in the troughs so the glass has some body.
      color = mix(color, color * vec3(0.9, 0.95, 1.05), 0.15);

      // Blend content over the margin color using the rectangle mask.
      color = mix(uMarginColor, color, mask);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
});

const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(quad);

// 6. MOUSE → RIPPLES -----------------------------------------
// Spawn a new ripple whenever the pointer has moved far enough,
// so dragging the mouse leaves a trail of waves.
const lastSpawn = new THREE.Vector2(-1, -1);

function spawnRipple(x, y) {
  const nx = x / window.innerWidth;
  const ny = 1.0 - y / window.innerHeight; // flip: screen y is top-down
  material.uniforms.uMouse.value.set(nx, ny);

  // Throttle by distance so we don't flood the pool.
  if (lastSpawn.x >= 0) {
    const dx = nx - lastSpawn.x;
    const dy = ny - lastSpawn.y;
    if (Math.hypot(dx, dy) < 0.012) return;
  }
  lastSpawn.set(nx, ny);

  ripplePos[rippleIndex].set(nx, ny);
  rippleTime[rippleIndex] = material.uniforms.uTime.value;
  rippleIndex = (rippleIndex + 1) % MAX_RIPPLES;
}

window.addEventListener("pointermove", (e) => spawnRipple(e.clientX, e.clientY));
// Touch: a tap/drag also drops ripples.
window.addEventListener(
  "touchmove",
  (e) => {
    const t = e.touches[0];
    if (t) spawnRipple(t.clientX, t.clientY);
  },
  { passive: true }
);

// 7. SCROLL → VIDEO FRAME ------------------------------------
// The canvas is fixed & fullscreen, so native page scrolling is
// unreliable here. Instead we track a virtual scroll progress (0..1)
// driven directly by wheel + touch, which always works.
let scrollProgress = 0; // 0 = first frame, 1 = last frame

function addScroll(deltaPx) {
  // Larger divisor = slower scrub. ~4000px of scrolling covers the clip.
  scrollProgress = Math.min(1, Math.max(0, scrollProgress + deltaPx / 4000));
}

window.addEventListener("wheel", (e) => addScroll(e.deltaY), { passive: true });

// Touch drag also scrubs (separate from the ripple touch handler).
let lastTouchY = null;
window.addEventListener("touchstart", (e) => {
  lastTouchY = e.touches[0]?.clientY ?? null;
});
window.addEventListener(
  "touchmove",
  (e) => {
    const y = e.touches[0]?.clientY;
    if (y != null && lastTouchY != null) addScroll(lastTouchY - y);
    lastTouchY = y ?? lastTouchY;
  },
  { passive: true }
);

// 8. ANIMATION LOOP ------------------------------------------
const INTRO_DURATION = 2.6; // seconds for the reveal (slower)
const startTime = performance.now();

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function animate() {
  const t = (performance.now() - startTime) / 1000;
  material.uniforms.uTime.value = t;

  // Intro reveal: grow the video from small (full frame) to fullscreen.
  const introT = Math.min(t / INTRO_DURATION, 1);
  material.uniforms.uReveal.value = easeInOutCubic(introT);
  const introDone = introT >= 1;

  // Scrub the video from scroll — only after the reveal has finished.
  // IMPORTANT: only start a new seek once the previous one has finished
  // (video.seeking === false). Setting currentTime every frame cancels
  // the in-flight seek, so the decoder never settles and the frame
  // appears frozen. We ease toward the target between accepted seeks.
  if (videoDuration > 0 && introDone && !video.seeking) {
    const targetTime = scrollProgress * videoDuration;
    const current = video.currentTime;
    const next = current + (targetTime - current) * 0.25; // smooth ease
    if (Math.abs(next - current) > 0.02) {
      video.currentTime = next; // 'seeked' handler uploads the frame
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// 9. RESIZE --------------------------------------------------
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.uResolution.value.set(
    window.innerWidth,
    window.innerHeight
  );
});
