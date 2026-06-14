(function () {
  function dashboardLoginUrl() {
    return new URL("/dashboard/login", window.location.origin).href;
  }

  function isDashboardEntry(link) {
    if (!link || !link.href) return false;

    try {
      var url = new URL(link.href, window.location.href);
      return url.origin === window.location.origin && (url.pathname === "/dashboard" || url.pathname === "/dashboard/");
    } catch (_e) {
      return false;
    }
  }

  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest && event.target.closest("a[href]");

    if (!isDashboardEntry(link)) return;

    event.preventDefault();
    event.stopPropagation();
    window.location.assign(dashboardLoginUrl());
  }, true);
})();
