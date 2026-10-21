/* vibe-free: theme, nav, copy receipts, sample toggles, tells counter, tabs */
(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- theme ---------- */
  var themeChoice = localStorage.getItem("vibe-free-theme") || "system";
  var mq = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(choice) {
    themeChoice = choice;
    var mode = choice === "system" ? (mq.matches ? "dark" : "light") : choice;
    document.documentElement.setAttribute("data-color-mode", mode);
    $$(".theme-switch button").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.theme === choice));
    });
    localStorage.setItem("vibe-free-theme", choice);
  }
  $$(".theme-switch button").forEach(function (btn) {
    btn.addEventListener("click", function () { applyTheme(btn.dataset.theme); });
  });
  mq.addEventListener("change", function () {
    if (themeChoice === "system") applyTheme("system");
  });
  applyTheme(themeChoice);

  /* ---------- burger ---------- */
  var burger = $(".nav-burger");
  var menu = $("#nav-menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
      menu.classList.toggle("open", !open);
    });
    $$("a", menu).forEach(function (link) {
      link.addEventListener("click", function () {
        burger.setAttribute("aria-expanded", "false");
        menu.classList.remove("open");
      });
    });
  }

  /* ---------- copy receipts ---------- */
  var COPY_ICON = '<i class="hgi-stroke hgi-copy"></i>';
  var CHECK_ICON = '<i class="hgi-stroke hgi-tick-01"></i>';

  function sourceText(selector) {
    var el = $(selector);
    if (!el) return "";
    return (el.textContent || "").replace(/^\n/, "").replace(/\s+$/, "");
  }

  function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); resolve(); }
      catch (err) { reject(err); }
      finally { document.body.removeChild(ta); }
    });
  }

  $$("[data-copy]").forEach(function (btn) {
    var original = btn.innerHTML;
    var busy = false;
    btn.addEventListener("click", function () {
      if (busy) return;
      var target = btn.dataset.copy === "self"
        ? (btn.parentElement.querySelector("pre") || {}).textContent
        : sourceText(btn.dataset.copy);
      if (!target) return;
      busy = true;
      writeClipboard(target.trim()).then(function () {
        btn.innerHTML = CHECK_ICON + "Copied";
        setTimeout(function () {
          btn.innerHTML = original;
          busy = false;
        }, 1600);
      }).catch(function () {
        btn.innerHTML = COPY_ICON + "Press copy";
        setTimeout(function () {
          btn.innerHTML = original;
          busy = false;
        }, 1600);
      });
    });
  });

  /* ---------- hero panel tabs ---------- */
  var heroCode = $("#hero-code");
  var panelCopy = $("#panel-copy");
  $$(".panel-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      $$(".panel-tab").forEach(function (t) { t.setAttribute("aria-pressed", "false"); });
      tab.setAttribute("aria-pressed", "true");
      var src = tab.dataset.source;
      if (heroCode) heroCode.textContent = sourceText(src);
      if (panelCopy) panelCopy.dataset.copy = src;
    });
  });
  if (heroCode) heroCode.textContent = sourceText("#src-prompt");

  /* ---------- sample toggles (before / after) ---------- */
  $$(".sample").forEach(function (sample) {
    var buttons = $$("[data-state-btn]", sample);
    function setState(state) {
      sample.setAttribute("data-state", state);
      buttons.forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.stateBtn === state));
      });
      $$("[data-unprompted][data-free]", sample).forEach(function (el) {
        el.textContent = state === "free" ? el.dataset.free : el.dataset.unprompted;
      });
    }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () { setState(b.dataset.stateBtn); });
    });
    setState(sample.getAttribute("data-state") || "unprompted");
  });

  /* ---------- tells counter ---------- */
  var tellCount = $("#tell-n");
  var tellCta = $("#tell-cta");
  var tellButtons = $$(".tell");
  function updateTells() {
    var found = tellButtons.filter(function (t) {
      return t.getAttribute("aria-pressed") === "true";
    }).length;
    if (tellCount) tellCount.textContent = String(found);
    if (tellCta) tellCta.classList.toggle("show", found > 0);
  }
  tellButtons.forEach(function (t) {
    t.addEventListener("click", function () {
      t.setAttribute("aria-pressed", String(t.getAttribute("aria-pressed") !== "true"));
      updateTells();
    });
  });
  updateTells();

  /* ---------- use tabs ---------- */
  var tabs = $$('[role="tab"]');
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", String(on));
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.classList.toggle("active", on);
    });
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { selectTab(tab); });
    tab.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      selectTab(next);
    });
  });

  /* ---------- back to top ---------- */
  var toTop = $("#to-top");
  if (toTop) {
    window.addEventListener("scroll", function () {
      toTop.classList.toggle("visible", window.scrollY > 640);
    }, { passive: true });
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- active nav link ---------- */
  var sections = ["tell", "rules", "use", "loop", "origin"]
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    var navLinks = $$('.nav-links a[href^="#"]');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { observer.observe(s); });
  }
})();
