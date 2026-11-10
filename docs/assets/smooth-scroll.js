(function () {
  if (!window.Lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  window.polishLenis = new window.Lenis({
    autoRaf: true,
    anchors: { offset: -72 },
    duration: 1.05
  });
})();
