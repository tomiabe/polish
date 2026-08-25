(function () {
  function track(name, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  }

  window.polishAnalytics = { track: track };

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-analytics-event]");
    if (!target) return;
    track(target.dataset.analyticsEvent, {
      placement: target.dataset.analyticsPlacement || "unknown"
    });
  });

  track("polish_page_view", {
    page_type: document.title.indexOf("preview") >= 0 ? "preview" : "homepage"
  });
})();
