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

// A gentle fade using the Web Animations API (no extra library needed).
const fade = (el, from, to, duration = 450) =>
  el.animate([{ opacity: from }, { opacity: to }], {
    duration,
    easing: "ease",
    fill: "forwards",
  }).finished;

barba.init({
  // Don't let Barba prefetch/transition cross-origin or asset links.
  prevent: ({ href }) => href.match(/\.(mp4|png|jpe?g|zip)$/i),
  transitions: [
    {
      name: "fade",
      // Fade the outgoing page out.
      leave: ({ current }) => fade(current.container, 1, 0),
      // Fade the incoming page in.
      enter: ({ next }) => fade(next.container, 0, 1),
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
// While a transition runs, keep the canvas visible so there's no dark
// flash — the opaque About page covers it when heading there.
barba.hooks.beforeLeave(() => {
  if (canvas) canvas.style.display = "block";
});
// ...then settle the final state once the new page has entered.
barba.hooks.afterEnter(({ next }) => applyNamespace(next.namespace));

// Start each newly-entered page at the top (Barba keeps scroll otherwise).
barba.hooks.beforeEnter(() => window.scrollTo(0, 0));
