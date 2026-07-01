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

// Keep the document title in sync with the page we land on.
barba.hooks.afterEnter(({ next }) => {
  const ns = next.namespace;
  document.title = ns === "about" ? "Glass Ripple — About" : "Glass Ripple — Home";
});
