/* "Ship anywhere in Canada" fields and live shipping quote, shared by index.html and custom.html.
   The price shown here is only a preview: the order script recalculates it on the server. */
(function () {
  var PROVINCES = [["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"],
    ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"], ["NU", "Nunavut"],
    ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"], ["SK", "Saskatchewan"], ["YT", "Yukon"]];
  var POSTAL = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
  var cfg, options = [], busy = false, error = "", lastKey = "", seq = 0, timer = null;
  var $ = function (id) { return document.getElementById(id); };
  var money = function (n) { return "$" + Number(n).toFixed(2); };

  function field(label, input, id) {
    var w = document.createElement("div"); w.className = "field";
    var l = document.createElement("label"); l.htmlFor = id; l.textContent = label;
    w.append(l, input); return w;
  }
  function input(id, name, auto, extra) {
    var i = document.createElement("input"); i.id = id; i.name = name; i.autocomplete = auto;
    for (var k in (extra || {})) i.setAttribute(k, extra[k]);
    return i;
  }

  function mount(c) {
    cfg = c;
    var box = $("ship-fields"); if (!box) return;
    var street = input("f-street", "street", "address-line1");
    var city = input("f-city", "city", "address-level2");
    var prov = document.createElement("select"); prov.id = "f-province"; prov.name = "province"; prov.autocomplete = "address-level1";
    prov.add(new Option("Choose…", ""));
    PROVINCES.forEach(function (p) { prov.add(new Option(p[1], p[0])); });
    var postal = input("f-postal", "postal", "postal-code", { maxlength: "7", placeholder: "A1A 1A1", inputmode: "text" });
    var row1 = document.createElement("div"); row1.className = "row2";
    row1.append(field("City", city, "f-city"), field("Province", prov, "f-province"));
    var svc = document.createElement("select"); svc.id = "f-service"; svc.name = "service";
    var status = document.createElement("p"); status.id = "ship-status"; status.className = "fine"; status.setAttribute("aria-live", "polite");
    var intl = document.createElement("p"); intl.className = "fine";
    intl.append("Shipping within Canada. Outside Canada? ");
    var a = document.createElement("a"); a.href = "mailto:contact@thequreshico.ca?subject=International%20order"; a.textContent = "Contact us for a special order."; intl.append(a);
    box.append(field("Street address", street, "f-street"), row1, field("Postal code", postal, "f-postal"),
      field("Shipping option", svc, "f-service"), status, intl);
    [street, city, prov].forEach(function (e) { e.addEventListener("input", change); });
    postal.addEventListener("input", function () { schedule(); });
    svc.addEventListener("change", change);
  }

  function change() { if (cfg && cfg.onChange) cfg.onChange(); }
  function active() { var r = $("f-ship"); return !!(r && r.checked); }
  function postal() { var e = $("f-postal"); return e ? e.value.trim().toUpperCase().replace(/\s+/g, "") : ""; }
  function chosen() {
    var s = $("f-service"); if (!s || !options.length) return null;
    return options.filter(function (o) { return o.code === s.value; })[0] || options[0];
  }

  function setStatus(msg) { var s = $("ship-status"); if (s) s.textContent = msg; }
  function fillOptions() {
    var s = $("f-service"); if (!s) return;
    var prev = s.value; s.textContent = "";
    options.forEach(function (o) { s.add(new Option(o.label + " · " + money(o.price), o.code)); });
    if (options.some(function (o) { return o.code === prev; })) s.value = prev;
  }

  function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 450); }

  function refresh() {
    var box = $("ship-fields"); if (!box) return;
    box.hidden = !active();
    if (!active()) return;
    var cart = cfg.cart();
    if (!cfg.hasItems()) { options = []; fillOptions(); setStatus("Add items to see the shipping price."); return; }
    if (!POSTAL.test(postal())) {
      options = []; fillOptions(); lastKey = "";
      setStatus(postal() ? "Enter a valid Canadian postal code." : "Enter your postal code to see the shipping price.");
      return;
    }
    var key = JSON.stringify(cart) + "|" + postal();
    if (key === lastKey) return;
    lastKey = key; busy = true; error = ""; setStatus("Calculating shipping…");
    var mine = ++seq;
    var body = Object.assign({ action: "quote", postal: postal(), website: "" }, cart);
    fetch(cfg.endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (mine !== seq) return;
        busy = false;
        if (!r.ok) { options = []; error = r.error || "We could not calculate shipping."; lastKey = ""; }
        else { options = r.options || []; error = ""; }
        fillOptions();
        setStatus(error || (options.length ? "Choose how you want it sent." : "No shipping options for that postal code. Please contact us."));
        change();
      })
      .catch(function () {
        if (mine !== seq) return;
        busy = false; options = []; lastKey = "";
        fillOptions(); setStatus("We could not reach our shipping calculator. Please try again or contact us.");
        change();
      });
  }

  function validate() {
    if (!$("f-street").value.trim()) return "Please enter your street address.";
    if (!$("f-city").value.trim()) return "Please enter your city.";
    if (!$("f-province").value) return "Please choose your province.";
    if (!POSTAL.test(postal())) return "Please enter a valid Canadian postal code.";
    if (busy) return "Still calculating shipping. Please wait a moment.";
    if (!chosen()) return "Please wait for the shipping price, or contact us.";
    return "";
  }

  window.Shipping = {
    mount: mount,
    refresh: refresh,
    active: active,
    cost: function () { var c = chosen(); return active() && c ? c.price : 0; },
    ready: function () { return active() && !!chosen(); },
    validate: validate,
    payload: function () {
      var c = chosen();
      return { street: $("f-street").value, city: $("f-city").value, province: $("f-province").value,
        postal: postal(), shipService: c ? c.code : "" };
    }
  };
})();
