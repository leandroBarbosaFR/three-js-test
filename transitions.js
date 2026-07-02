// ============================================================
//  Barba.js page transitions — "grow from center"
//  The incoming page starts as a small centered box and scales up to
//  fill the screen; the outgoing page sits behind (or shrinks away).
//  Both containers are stacked full-screen during the transition
//  (see .is-transitioning in styles.css).
// ============================================================

import barba from "@barba/core";
import { initFooterGlass } from "/footer-glass.js";

// The footer (and its glass "1367") is persistent — init once.
const footerCanvas = document.getElementById("footer-glass");
if (footerCanvas) initFooterGlass(footerCanvas);

const canvas = document.getElementById("app");
const nav = document.querySelector(".nav");
const EASE = "cubic-bezier(0.65, 0, 0.35, 1)"; // smooth ease-in-out (cubic)
const GROW_MS = 900;

// ---- About's glass "1367" lives inside the swapped container ----
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

// Nav color + title for the page we're on.
function applyChrome(ns) {
  const isHome = ns !== "about";
  document.body.classList.toggle("theme-light", isHome);
  document.body.classList.toggle("theme-dark", !isHome);
  document.title = isHome ? "1367 — Home" : "1367 — About";
}

// Scale + fade a container.
const scaleAnim = (el, fromS, toS, fromO, toO) =>
  el.animate(
    [
      { transform: `scale(${fromS})`, opacity: fromO },
      { transform: `scale(${toS})`, opacity: toO },
    ],
    { duration: GROW_MS, easing: EASE, fill: "forwards" }
  ).finished;

const fadeNav = (to) =>
  nav?.animate([{ opacity: to === 1 ? 0 : 1 }, { opacity: to }], {
    duration: to === 1 ? 320 : 180,
    easing: "ease",
    fill: "forwards",
  });

// ---- Initial page state ----
const initialNs = document.querySelector('[data-barba="container"]')?.dataset
  .barbaNamespace;
applyChrome(initialNs);
if (initialNs === "about") mountAboutGlass();
if (canvas) canvas.style.display = initialNs === "about" ? "none" : "block";

barba.init({
  prevent: ({ href }) => href.match(/\.(mp4|png|svg|jpe?g|zip)$/i),
  transitions: [
    {
      name: "grow",
      sync: true, // keep both containers mounted so they can overlap
      before() {
        document.documentElement.classList.add("is-transitioning");
        if (canvas) canvas.style.display = "block"; // video visible around the box
        fadeNav(0); // hide nav during the wipe (background is mixed)
      },
      beforeEnter({ next }) {
        window.scrollTo(0, 0);
        applyChrome(next.namespace);
        if (next.namespace === "about") mountAboutGlass();
        // Pre-set the incoming container so there's no full-size flash
        // before the enter animation's first frame.
        if (next.container) {
          if (next.namespace === "about") {
            // Opaque box that grows from the center (no fade).
            next.container.style.transform = "scale(0.12)";
            next.container.style.opacity = "1";
          } else {
            next.container.style.transform = "scale(1.06)";
            next.container.style.opacity = "0";
          }
        }
      },
      leave({ current }) {
        // Going to About: Home stays put and About grows over it.
        // Going to Home: About shrinks away toward the center, revealing Home.
        if (current.namespace === "about")
          return scaleAnim(current.container, 1, 0.12, 1, 0);
        return Promise.resolve();
      },
      enter({ next }) {
        if (next.namespace === "about")
          return scaleAnim(next.container, 0.12, 1, 1, 1); // opaque grow
        return scaleAnim(next.container, 1.06, 1, 0, 1); // gentle settle-in
      },
      after({ next }) {
        document.documentElement.classList.remove("is-transitioning");
        if (next.container) {
          next.container.getAnimations().forEach((a) => a.cancel());
          next.container.style.transform = "";
          next.container.style.opacity = "";
        }
        const isHome = next.namespace !== "about";
        if (canvas) canvas.style.display = isHome ? "block" : "none";
        if (isHome) unmountAboutGlass();
        fadeNav(1); // bring the nav back in the new page's color
      },
    },
  ],
});
