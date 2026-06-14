(function () {
  function applyToolStyles(tools) {
    tools.style.setProperty("position", "fixed", "important");
    tools.style.setProperty("right", "max(14px, env(safe-area-inset-right))", "important");
    tools.style.setProperty("bottom", "max(70px, calc(env(safe-area-inset-bottom) + 16px))", "important");
    tools.style.setProperty("z-index", "2147483647", "important");
    tools.style.setProperty("display", "flex", "important");
    tools.style.setProperty("flex-direction", "column", "important");
    tools.style.setProperty("gap", "8px", "important");
    tools.style.setProperty("visibility", "visible", "important");
    tools.style.setProperty("opacity", "1", "important");
    tools.style.setProperty("pointer-events", "auto", "important");
  }

  function applyButtonStyles(button) {
    button.style.setProperty("display", "inline-flex", "important");
    button.style.setProperty("width", "40px", "important");
    button.style.setProperty("height", "40px", "important");
    button.style.setProperty("min-width", "40px", "important");
    button.style.setProperty("min-height", "40px", "important");
    button.style.setProperty("align-items", "center", "important");
    button.style.setProperty("justify-content", "center", "important");
    button.style.setProperty("visibility", "visible", "important");
    button.style.setProperty("opacity", "1", "important");
    button.style.setProperty("pointer-events", "auto", "important");
  }

  function scrollToEdge(top) {
    var scrollingElement = document.scrollingElement || document.documentElement;
    var target = top ? 0 : scrollingElement.scrollHeight;
    window.scrollTo({ top: target, behavior: "smooth" });
  }

  function makeButton(label, path, top) {
    var button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      path +
      "</svg>";
    button.addEventListener("click", function () {
      scrollToEdge(top);
    });
    applyButtonStyles(button);
    return button;
  }

  function mount() {
    var tools = document.getElementById("geoip-scroll-tools");
    if (!tools) {
      tools = document.createElement("div");
      tools.id = "geoip-scroll-tools";
      tools.className = "geoip-scroll-tools";
      tools.appendChild(makeButton("回到顶部", '<path d="m18 15-6-6-6 6"/><path d="M12 9v12"/><path d="M5 3h14"/>', true));
      tools.appendChild(makeButton("滚动到底部", '<path d="m6 9 6 6 6-6"/><path d="M12 15V3"/><path d="M5 21h14"/>', false));
      document.body.appendChild(tools);
    }
    applyToolStyles(tools);
    Array.prototype.forEach.call(tools.querySelectorAll("button"), applyButtonStyles);
  }

  function scheduleMount() {
    mount();
    window.setTimeout(mount, 250);
    window.setTimeout(mount, 1000);
    window.setTimeout(mount, 2500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleMount, { once: true });
  } else {
    scheduleMount();
  }

  window.addEventListener("load", scheduleMount, { once: true });

  new MutationObserver(function () {
    if (!document.getElementById("geoip-scroll-tools")) {
      mount();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
