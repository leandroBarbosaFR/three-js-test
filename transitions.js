// ============================================================
//  Barba.js page transitions
//  The WebGL canvas and nav live outside [data-barba="container"],
//  so they persist. Barba fetches the next page over AJAX, swaps
//  only the container, and we crossfade between the two.
// ============================================================

import barba from "@barba/core";

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
function applyNamespace(ns) {
  const isHome = ns !== "about";
  if (canvas) canvas.style.display = isHome ? "block" : "none";
  document.title = isHome ? "Glass Ripple — Home" : "Glass Ripple — About";
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
