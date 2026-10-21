(function () {
  if (!window.Lenis) return;

  var lenis = new window.Lenis({
    autoRaf: true,
    anchors: {
      offset: -72
    },
    stopInertiaOnNavigate: true,
    respectReducedMotion: true
  });

  window.polishLenis = lenis;
})();
