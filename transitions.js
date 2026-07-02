// ============================================================
//  Barba.js page transitions
//  The WebGL canvas and nav live outside [data-barba="container"],
//  so they persist. Barba fetches the next page over AJAX, swaps
//  only the container, and we crossfade between the two.
// ============================================================

import barba from "@barba/core";
import { initFooterGlass } from "/footer-glass.js";

// The footer (and its glass "1367" canvas) is persistent — outside the
// Barba container — so we initialise it once for the whole session.
const footerCanvas = document.getElementById("footer-glass");
if (footerCanvas) initFooterGlass(footerCanvas);

// ---- Overlay wipe transition (Web Animations API, no extra library) ----
// A brand-orange panel slides up to cover the screen, the big "1367" pops
// in, then the panel slides off the top to reveal the next page.
const overlay = document.querySelector(".page-transition");
const overlayLabel = overlay?.querySelector(".page-transition__logo");
const EASE = "cubic-bezier(0.37, 0, 0.63, 1)"; // soft ease-in-out (sine)
const WIPE_MS = 720;

// The wipe panel cycles through these colors — a new one on every page
// change, looping forever.
const WIPE_COLORS = ["#ffffff", "#c7c7c7", "#f5390d"]; // white, grey, orange
let wipeIndex = 0;

// Cover the screen (bottom → up), then pop the label in.
async function coverScreen() {
  if (!overlay) return;
  // Advance to the next color for this transition.
  overlay.style.backgroundColor = WIPE_COLORS[wipeIndex % WIPE_COLORS.length];
  wipeIndex++;
  if (overlayLabel) overlayLabel.style.opacity = "0";
  await overlay.animate(
    [{ transform: "translateY(100%)" }, { transform: "translateY(0%)" }],
    { duration: WIPE_MS, easing: EASE, fill: "forwards" }
  ).finished;
  if (overlayLabel) {
    overlayLabel.animate(
      [
        { opacity: 0, transform: "translateY(18px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 300, easing: "ease-out", fill: "forwards" }
    );
  }
}

// Reveal the next page (overlay continues up and off the top), then park
// the panel back below the viewport for next time.
async function revealScreen() {
  if (!overlay) return;
  await overlay.animate(
    [{ transform: "translateY(0%)" }, { transform: "translateY(-100%)" }],
    { duration: WIPE_MS, easing: EASE, fill: "forwards" }
  ).finished;
  overlay.getAnimations().forEach((a) => a.cancel());
  overlay.style.transform = "translateY(100%)";
  if (overlayLabel) overlayLabel.style.opacity = "0";
}

barba.init({
  // Don't let Barba prefetch/transition cross-origin or asset links.
  prevent: ({ href }) => href.match(/\.(mp4|png|jpe?g|zip)$/i),
  transitions: [
    {
      name: "wipe",
      leave: () => coverScreen(), // cover before the DOM swaps
      enter: () => revealScreen(), // uncover the new page
    },
  ],
});

// Apply per-page "chrome": the WebGL canvas only belongs to the home
// experience, so hide it on real content pages like About. Also keep the
// document title in sync.
const canvas = document.getElementById("app");

// The About page has its own glass "1367" canvas. Unlike the footer it
// lives inside the (swapped) Barba container, so we mount a fresh WebGL
// instance when About enters and dispose it when we leave.
let aboutGlassDestroy = null;
function mountAboutGlass() {
  const c = document.getElementById("about-glass");
  if (c && !aboutGlassDestroy) aboutGlassDestroy = initFooterGlass(c);
}
function unmountAboutGlass() {
  if (aboutGlassDestroy) {
    aboutGlassDestroy();
    aboutGlassDestroy = null;
  }
}

function applyNamespace(ns) {
  const isHome = ns !== "about";
  if (canvas) canvas.style.display = isHome ? "block" : "none";
  document.title = isHome ? "Glass Ripple — Home" : "Glass Ripple — About";
  if (isHome) unmountAboutGlass();
  else mountAboutGlass();
}

// Set the correct state for the page we first loaded on...
applyNamespace(
  document.querySelector('[data-barba="container"]')?.dataset.barbaNamespace
);

// The wipe panel is fully covering the screen between leave and enter, so
// we swap all the "chrome" (canvas visibility, About glass, scroll, title)
// here in beforeEnter — invisibly, with no flash.
barba.hooks.beforeEnter(({ next }) => {
  window.scrollTo(0, 0);
  applyNamespace(next.namespace);
});
