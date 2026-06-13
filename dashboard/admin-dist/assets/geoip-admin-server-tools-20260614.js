(function () {
  var STORAGE_KEY = "geoip-admin-server-tools";
  var state = loadState();
  var servers = [];
  var toolbar = null;
  var observer = null;
  var applying = false;
  var fetchTimer = 0;

  var sortFields = [
    ["default", "默认"],
    ["name", "名称"],
    ["uptime", "运行时间"],
    ["system", "系统"],
    ["cpu", "CPU"],
    ["mem", "内存"],
    ["disk", "磁盘"],
    ["up", "上传"],
    ["down", "下载"],
    ["up_total", "总上传"],
    ["down_total", "总下载"],
    ["mem_total", "内存总量"],
    ["cpu_cores", "CPU核心数量"],
    ["disk_total", "硬盘总量"],
    ["country", "国家"],
    ["organization", "组织"]
  ];

  function loadState() {
    try {
      return Object.assign({
        country: "",
        organization: "",
        system: "",
        sort: "default",
        direction: "desc"
      }, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch (_) {
      return { country: "", organization: "", system: "", sort: "default", direction: "desc" };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalize(value) {
    return String(value == null ? "" : value).trim();
  }

  function lower(value) {
    return normalize(value).toLowerCase();
  }

  function number(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function percent(used, total) {
    total = number(total);
    return total > 0 ? number(used) / total * 100 : 0;
  }

  function cpuCores(cpu) {
    var list = Array.isArray(cpu) ? cpu : cpu ? [cpu] : [];
    if (list.length > 1) return list.length;
    for (var i = 0; i < list.length; i += 1) {
      var matches = String(list[i]).match(/\d{1,3}/g);
      if (matches && matches.length) {
        var n = Number(matches[matches.length - 1]);
        if (n > 0 && n < 1024) return n;
      }
    }
    return 0;
  }

  function getCountry(server) {
    return normalize(server && server.geoip && server.geoip.country_code).toUpperCase();
  }

  function getOrganization(server) {
    return normalize(server && server.geoip && server.geoip.organization);
  }

  function getSystem(server) {
    return normalize(server && server.host && server.host.platform);
  }

  function sortValue(server, field) {
    var host = server.host || {};
    var state = server.state || {};
    switch (field) {
      case "name": return normalize(server.name);
      case "uptime": return number(state.uptime);
      case "system": return getSystem(server);
      case "cpu": return number(state.cpu);
      case "mem": return percent(state.mem_used, host.mem_total);
      case "disk": return percent(state.disk_used, host.disk_total);
      case "up": return number(state.net_out_speed);
      case "down": return number(state.net_in_speed);
      case "up_total": return number(state.net_out_transfer);
      case "down_total": return number(state.net_in_transfer);
      case "mem_total": return number(host.mem_total);
      case "cpu_cores": return cpuCores(host.cpu);
      case "disk_total": return number(host.disk_total);
      case "country": return getCountry(server);
      case "organization": return getOrganization(server);
      default: return number(server.__geoipOriginalIndex);
    }
  }

  function compareServers(a, b) {
    if (state.sort === "default") {
      return number(a.__geoipOriginalIndex) - number(b.__geoipOriginalIndex);
    }
    var av = sortValue(a, state.sort);
    var bv = sortValue(b, state.sort);
    var result;
    if (typeof av === "string" || typeof bv === "string") {
      result = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
    } else {
      result = av - bv;
    }
    if (result === 0) result = number(a.__geoipOriginalIndex) - number(b.__geoipOriginalIndex);
    return state.direction === "asc" ? result : -result;
  }

  function matches(server) {
    if (!server) return false;
    if (state.country && getCountry(server) !== state.country) return false;
    if (state.organization && getOrganization(server) !== state.organization) return false;
    if (state.system && getSystem(server) !== state.system) return false;
    return true;
  }

  function uniqueOptions(getter) {
    var values = [];
    var seen = new Set();
    servers.forEach(function (server) {
      var value = getter(server);
      if (!value || seen.has(value)) return;
      seen.add(value);
      values.push(value);
    });
    return values.sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });
  }

  function fillSelect(select, label, values, selected) {
    var previous = select.value;
    select.innerHTML = "";
    select.appendChild(new Option(label, ""));
    values.forEach(function (value) {
      select.appendChild(new Option(value, value));
    });
    select.value = selected || previous || "";
    if (select.value && select.selectedIndex < 0) select.value = "";
  }

  function createField(label, name, wide) {
    var field = document.createElement("label");
    field.className = "geoip-admin-server-tools__field" + (wide ? " geoip-admin-server-tools__field--wide" : "");
    var text = document.createElement("span");
    text.className = "geoip-admin-server-tools__label";
    text.textContent = label;
    var select = document.createElement("select");
    select.name = name;
    field.appendChild(text);
    field.appendChild(select);
    return { field: field, select: select };
  }

  function buildToolbar() {
    var root = document.createElement("div");
    root.id = "geoip-admin-server-tools";
    root.className = "geoip-admin-server-tools";
    root.hidden = true;

    var country = createField("国家", "country");
    var organization = createField("组织", "organization", true);
    var system = createField("系统", "system");
    var sort = createField("排序", "sort");
    var direction = document.createElement("button");
    var reset = document.createElement("button");
    var summary = document.createElement("div");

    direction.type = "button";
    direction.className = "geoip-admin-server-tools__direction";
    reset.type = "button";
    reset.className = "geoip-admin-server-tools__reset";
    reset.textContent = "清除";
    summary.className = "geoip-admin-server-tools__summary";

    sortFields.forEach(function (item) {
      sort.select.appendChild(new Option(item[1], item[0]));
    });

    root.appendChild(country.field);
    root.appendChild(organization.field);
    root.appendChild(system.field);
    root.appendChild(sort.field);
    root.appendChild(direction);
    root.appendChild(reset);
    root.appendChild(summary);

    root._controls = { country: country.select, organization: organization.select, system: system.select, sort: sort.select, direction: direction, reset: reset, summary: summary };

    country.select.addEventListener("change", function () { state.country = this.value; persistAndApply(); });
    organization.select.addEventListener("change", function () { state.organization = this.value; persistAndApply(); });
    system.select.addEventListener("change", function () { state.system = this.value; persistAndApply(); });
    sort.select.addEventListener("change", function () { state.sort = this.value; persistAndApply(); });
    direction.addEventListener("click", function () {
      state.direction = state.direction === "asc" ? "desc" : "asc";
      persistAndApply();
    });
    reset.addEventListener("click", function () {
      state.country = "";
      state.organization = "";
      state.system = "";
      state.sort = "default";
      state.direction = "desc";
      persistAndApply();
    });

    return root;
  }

  function persistAndApply() {
    saveState();
    syncToolbar();
    applyTable();
  }

  function syncToolbar() {
    if (!toolbar || !toolbar._controls) return;
    var controls = toolbar._controls;
    fillSelect(controls.country, "全部国家", uniqueOptions(getCountry), state.country);
    fillSelect(controls.organization, "全部组织", uniqueOptions(getOrganization), state.organization);
    fillSelect(controls.system, "全部系统", uniqueOptions(getSystem), state.system);
    controls.sort.value = state.sort || "default";
    controls.direction.textContent = state.direction === "asc" ? "升序" : "降序";
  }

  function isServerPage() {
    var path = location.pathname.replace(/\/+$/, "");
    return path === "/dashboard";
  }

  function findContainer() {
    if (!isServerPage()) return null;
    var headings = Array.from(document.querySelectorAll("#root h1"));
    var heading = headings.find(function (node) {
      var text = normalize(node.textContent);
      return text === "服务器" || text === "Server";
    });
    return heading ? heading.closest(".px-3") : null;
  }

  function findTable(container) {
    if (!container) return null;
    var tables = Array.from(container.querySelectorAll("table"));
    return tables.find(function (table) {
      var headers = Array.from(table.querySelectorAll("thead th")).map(function (th) { return normalize(th.textContent); });
      return headers.indexOf("ID") >= 0 && headers.indexOf("IP") >= 0;
    }) || null;
  }

  function idColumnIndex(table) {
    var headers = Array.from(table.querySelectorAll("thead th")).map(function (th) { return normalize(th.textContent); });
    var index = headers.indexOf("ID");
    return index >= 0 ? index : 1;
  }

  function mountToolbar() {
    var container = findContainer();
    if (!container) {
      if (toolbar) toolbar.hidden = true;
      return;
    }
    if (!toolbar) toolbar = buildToolbar();
    var table = findTable(container);
    if (!table) return;
    var wrapper = table.closest(".rounded-md.border") || table.parentElement;
    if (toolbar.parentElement !== container) container.insertBefore(toolbar, wrapper);
    else if (toolbar.nextElementSibling !== wrapper) container.insertBefore(toolbar, wrapper);
    toolbar.hidden = false;
    syncToolbar();
  }

  function rowId(row, idIndex) {
    var cell = row.cells && row.cells[idIndex];
    var match = cell && normalize(cell.textContent).match(/^\d+/);
    return match ? Number(match[0]) : null;
  }

  function ensureEmptyRow(tbody, colSpan, visibleCount) {
    var existing = tbody.querySelector(".geoip-admin-server-tools__empty");
    if (visibleCount > 0) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      existing = document.createElement("tr");
      existing.className = "geoip-admin-server-tools__empty";
      var cell = document.createElement("td");
      cell.textContent = "没有符合条件的服务器";
      existing.appendChild(cell);
      tbody.appendChild(existing);
    }
    existing.firstElementChild.colSpan = colSpan;
  }

  function applyTable() {
    if (applying) return;
    var container = findContainer();
    var table = findTable(container);
    if (!table || !servers.length) return;
    var tbody = table.tBodies[0];
    if (!tbody) return;

    applying = true;
    try {
      var rows = Array.from(tbody.rows).filter(function (row) {
        return !row.classList.contains("geoip-admin-server-tools__empty");
      });
      var idIndex = idColumnIndex(table);
      var rowMap = new Map();
      rows.forEach(function (row) {
        var id = rowId(row, idIndex);
        if (id != null) rowMap.set(id, row);
      });

      var visible = servers.filter(matches).sort(compareServers);
      var visibleIds = new Set(visible.map(function (server) { return Number(server.id); }));

      rows.forEach(function (row) {
        var id = rowId(row, idIndex);
        row.hidden = id == null || !visibleIds.has(id);
      });
      visible.forEach(function (server) {
        var row = rowMap.get(Number(server.id));
        if (row) tbody.appendChild(row);
      });
      ensureEmptyRow(tbody, table.tHead && table.tHead.rows[0] ? table.tHead.rows[0].cells.length : 1, visible.length);
      if (toolbar && toolbar._controls) {
        toolbar._controls.summary.textContent = "显示 " + visible.length + " / " + servers.length;
      }
    } finally {
      applying = false;
    }
  }

  async function loadServers() {
    try {
      var response = await fetch("/api/v1/server", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      var data = await response.json();
      servers = Array.isArray(data) ? data.map(function (server, index) {
        server.__geoipOriginalIndex = index;
        return server;
      }) : [];
      syncToolbar();
      applyTable();
    } catch (error) {
      console.warn("[geoip-admin-server-tools] failed to load servers", error);
    }
  }

  function scheduleLoad() {
    clearTimeout(fetchTimer);
    fetchTimer = window.setTimeout(loadServers, 150);
  }

  function tick() {
    mountToolbar();
    applyTable();
  }

  function start() {
    scheduleLoad();
    tick();
    window.setTimeout(tick, 300);
    window.setTimeout(tick, 1000);
    window.setTimeout(tick, 2500);

    if (!observer) {
      observer = new MutationObserver(function () {
        if (applying) return;
        tick();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.addEventListener("popstate", function () {
      scheduleLoad();
      window.setTimeout(tick, 100);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
  window.addEventListener("load", start, { once: true });
})();
