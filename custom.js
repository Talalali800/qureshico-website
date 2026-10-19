/* Paste the same Google Apps Script web app URL as on the main page. */
const ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfycbwSexkNuWC9BNWwKU7dhjHhy_HXrUb_uUyZYdSI3K2CQxxaS3NQ8kS8iQEvQ3CSHVfwlA/exec";
const BOX_FEE = 6.99, BOX_MIN = 30, FREE_DELIVERY_MIN = 75;
const CARD_FEE = { percent: 0.029, fixed: 0.30 };
const CATALOG = [{"sku": "B-27051", "name": "Maple-leaf bottle, amber", "size": "50 ml", "price": 6.99, "cat": "syrup", "carry": true}, {"sku": "B-27101", "name": "Maple-leaf bottle, amber", "size": "100 ml", "price": 10.99, "cat": "syrup", "carry": true}, {"sku": "B-27241", "name": "Maple-leaf bottle, amber", "size": "250 ml", "price": 16.99, "cat": "syrup", "carry": false}, {"sku": "B-17101", "name": "Sugar shack tin, amber", "size": "100 ml", "price": 10.99, "cat": "syrup", "carry": true}, {"sku": "B-17251", "name": "Sugar shack tin, amber", "size": "250 ml", "price": 13.99, "cat": "syrup", "carry": false}, {"sku": "B-11541CAB", "name": "Classic can, amber", "size": "540 ml", "price": 10.99, "cat": "syrup", "carry": false}, {"sku": "B-14251", "name": "Dorica bottle, golden", "size": "250 ml", "price": 11.99, "cat": "syrup", "carry": false}, {"sku": "B-12252", "name": "Handle bottle, dark", "size": "250 ml", "price": 9.99, "cat": "syrup", "carry": false}, {"sku": "B-13102", "name": "Maple syrup jug, dark", "size": "100 ml", "price": 6.99, "cat": "syrup", "carry": true}, {"sku": "B-13252", "name": "Maple syrup jug, dark", "size": "250 ml", "price": 9.99, "cat": "syrup", "carry": false}, {"sku": "B-13552", "name": "Maple syrup jug, dark", "size": "500 ml", "price": 15.99, "cat": "syrup", "carry": false}, {"sku": "B-13702", "name": "Maple syrup jug, dark", "size": "1 L", "price": 25.99, "cat": "syrup", "carry": false}, {"sku": "LL-16231", "name": "Bretelles maple syrup, golden", "size": "236 ml", "price": 11.99, "cat": "syrup", "carry": false}, {"sku": "LL-16472", "name": "Bretelles maple syrup, amber", "size": "473 ml", "price": 17.99, "cat": "syrup", "carry": false}, {"sku": "LL-16473", "name": "Bretelles maple syrup, dark", "size": "473 ml", "price": 17.89, "cat": "syrup", "carry": false}, {"sku": "BD-30045", "name": "Pure maple butter", "size": "45 g", "price": 4.99, "cat": "spreads", "carry": true}, {"sku": "B-30160", "name": "Pure maple butter", "size": "160 g", "price": 8.99, "cat": "spreads", "carry": false}, {"sku": "B-30330", "name": "Pure maple butter", "size": "330 g", "price": 13.99, "cat": "spreads", "carry": false}, {"sku": "LL-30250", "name": "Bretelles maple butter", "size": "250 g", "price": 10.89, "cat": "spreads", "carry": false}, {"sku": "LL-30250BIO", "name": "Bretelles organic maple butter", "size": "250 g", "price": 10.99, "cat": "spreads", "carry": false}, {"sku": "B-35115", "name": "Maple jelly", "size": "115 ml", "price": 7.99, "cat": "spreads", "carry": false}, {"sku": "LL-35110", "name": "Aleppo pepper maple jelly", "size": "110 ml", "price": 8.99, "cat": "spreads", "carry": false}, {"sku": "LL-36250", "name": "Bretelles maple caramel", "size": "250 g", "price": 9.99, "cat": "spreads", "carry": false}, {"sku": "LL-34250", "name": "Bretelles maple taffy", "size": "250 g", "price": 10.99, "cat": "spreads", "carry": false}, {"sku": "BD-40025", "name": "Granulated maple sugar jar", "size": "25 g", "price": 4.99, "cat": "sugar", "carry": true}, {"sku": "B-40065", "name": "Granulated maple sugar shaker", "size": "65 g", "price": 6.99, "cat": "sugar", "carry": true}, {"sku": "LL-40200", "name": "Bretelles fine maple sugar", "size": "200 g", "price": 10.99, "cat": "sugar", "carry": true}, {"sku": "B-40250", "name": "Granulated maple sugar shaker", "size": "250 g", "price": 16.99, "cat": "sugar", "carry": true}, {"sku": "BD-40350", "name": "Fine maple sugar bag", "size": "350 g", "price": 14.99, "cat": "sugar", "carry": false}, {"sku": "B-55005", "name": "Soft maple candies, 5 pieces", "size": "35 g", "price": 5.99, "cat": "sweets", "carry": true}, {"sku": "B-55012", "name": "Soft maple candies, 12 pieces", "size": "84 g", "price": 11.89, "cat": "sweets", "carry": true}, {"sku": "BB-55012", "name": "Organic soft maple candies", "size": "84 g", "price": 11.99, "cat": "sweets", "carry": true}, {"sku": "LL-55010", "name": "Bretelles soft maple candies, 10 pieces", "size": "70 g", "price": 7.89, "cat": "sweets", "carry": true}, {"sku": "LL-55010BIO", "name": "Bretelles organic soft maple candies", "size": "70 g", "price": 7.99, "cat": "sweets", "carry": true}, {"sku": "B-56020", "name": "Maple lollipop", "size": "20 g", "price": 2.99, "cat": "sweets", "carry": true}, {"sku": "B-56090", "name": "Hard maple candies", "size": "90 g", "price": 6.99, "cat": "sweets", "carry": true}, {"sku": "LL-50140", "name": "Bretelles maple caramel popcorn", "size": "140 g", "price": 7.99, "cat": "sweets", "carry": true}];
const qty = {}; CATALOG.forEach((p) => { qty[p.sku] = 0; });
const customCart = () => { const c = {}; for (const k in qty) if (qty[k] > 0) c[k] = qty[k]; return c; };
Shipping.mount({ endpoint: ORDER_ENDPOINT, cart: () => ({ custom: customCart() }),
  hasItems: () => Object.keys(customCart()).length > 0 && totals().products >= BOX_MIN, onChange: () => render() });
let filter = "all";
const $ = (id) => document.getElementById(id);
const money = (n) => "$" + n.toFixed(2);
const round2 = (n) => Math.round(n * 100) / 100;

function el(tag, attrs, text) { const e = document.createElement(tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }

function buildGrid() {
  const grid = $("grid");
  CATALOG.forEach((p) => {
    const card = el("article", { class: "card", "data-sku": p.sku, "data-cat": p.cat, "data-carry": p.carry ? "1" : "0" });
    card.append(el("img", { src: "img/p/" + p.sku + ".jpg", alt: p.name + ", " + p.size, width: "600", height: "600", loading: "lazy" }));
    const b = el("div", { class: "card-body" });
    b.append(el("h3", {}, p.name));
    const meta = el("div", { class: "meta" }); meta.append(el("span", {}, p.size), el("b", {}, money(p.price))); b.append(meta);
    b.append(el("span", { class: p.carry ? "badge" : "badge no" }, p.carry ? "✓ CARRY-ON OK" : "CHECKED BAG"));
    const st = el("div", { class: "stepper", "data-sku": p.sku });
    st.append(el("button", { type: "button", "data-step": "-1", "aria-label": "Remove one " + p.name + " " + p.size }, "−"),
      el("output", { "aria-label": p.name + " " + p.size + " quantity" }, "0"),
      el("button", { type: "button", "data-step": "1", "aria-label": "Add one " + p.name + " " + p.size }, "+"));
    b.append(st); card.append(b); grid.append(card);
  });
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".stepper button"); if (!btn) return;
    const sku = btn.parentElement.dataset.sku;
    qty[sku] = Math.max(0, Math.min(50, qty[sku] + Number(btn.dataset.step)));
    render();
  });
}

function applyFilter() {
  const carryOnly = $("carry-only").checked; let shown = 0;
  document.querySelectorAll(".card").forEach((c) => {
    const ok = (filter === "all" || c.dataset.cat === filter) && (!carryOnly || c.dataset.carry === "1");
    c.hidden = !ok; if (ok) shown++;
  });
  $("empty-cat").hidden = shown > 0;
}
document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
  filter = c.dataset.cat;
  document.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
  applyFilter();
}));
$("carry-only").addEventListener("change", applyFilter);

function totals() {
  let products = 0, count = 0; const lines = [];
  CATALOG.forEach((p) => { if (qty[p.sku] > 0) {
    const line = round2(p.price * qty[p.sku]); products = round2(products + line); count += qty[p.sku];
    lines.push({ qty: qty[p.sku], name: p.name + " (" + p.size + ")", line });
  }});
  const subtotal = products > 0 ? round2(products + BOX_FEE) : 0;
  const card = document.querySelector('input[name="payment"]:checked').value === "card";
  const ship = Shipping.cost();
  const base = round2(subtotal + ship);
  const fee = card && subtotal > 0 ? round2((base + CARD_FEE.fixed) / (1 - CARD_FEE.percent) - base) : 0;
  return { lines, products, count, subtotal, ship, fee, total: round2(base + fee) };
}

function render() {
  document.querySelectorAll(".card .stepper").forEach((st) => {
    const n = qty[st.dataset.sku]; st.querySelector("output").textContent = n;
    st.closest(".card").classList.toggle("on", n > 0);
  });
  const t = totals();
  const ul = $("sum-lines"); ul.textContent = "";
  t.lines.forEach((l) => { const li = el("li"); li.append(el("span", {}, l.qty + " × " + l.name), el("span", {}, money(l.line))); ul.append(li); });
  $("sum-empty").hidden = t.lines.length > 0;
  $("sum-sub").textContent = money(t.products);
  $("sum-box").textContent = t.products > 0 ? money(BOX_FEE) : "$0.00";
  $("ship-row").hidden = !Shipping.active();
  $("sum-ship").textContent = Shipping.ready() ? money(t.ship) : "Enter postal code";
  $("fee-row").hidden = t.fee === 0;
  $("sum-fee").textContent = money(t.fee);
  $("sum-total").textContent = money(t.total);
  $("meter").style.width = Math.min(100, t.products / BOX_MIN * 100) + "%";
  $("min-note").textContent = t.products >= BOX_MIN ? "Minimum reached. Your box is ready to order." : "Add " + money(round2(BOX_MIN - t.products)) + " more to reach the $30 minimum.";
  const canDeliver = t.subtotal >= FREE_DELIVERY_MIN;
  $("f-delivery").disabled = !canDeliver;
  if (!canDeliver && $("f-delivery").checked) $("f-pickup").checked = true;
  $("delivery-hint").textContent = canDeliver ? "Free on your order" : "Available on orders of $75 or more";
  $("address-field").hidden = !$("f-delivery").checked;
  Shipping.refresh();
  const sample = t.subtotal > 0 ? round2(t.subtotal + t.ship) : 50;
  $("card-hint").textContent = "Secure checkout by Stripe. A card processing fee of about 2.9% + $0.30 is added. On " +
    money(sample) + " it is " + money(round2((sample + CARD_FEE.fixed) / (1 - CARD_FEE.percent) - sample)) + ". Interac e-Transfer has no fee.";
  $("bar-text").textContent = t.count ? t.count + (t.count === 1 ? " item · " : " items · ") + money(t.total) : "Your box is empty";
}
document.querySelectorAll('input[name="payment"], input[name="fulfilment"]').forEach((r) => r.addEventListener("change", render));

function showError(msg) { const e = $("form-error"); e.textContent = msg; e.hidden = false; }

$("order-form").addEventListener("submit", async (e) => {
  e.preventDefault(); $("form-error").hidden = true;
  const t = totals();
  if (!t.lines.length) return showError("Your box is empty. Add products using the + buttons.");
  if (t.products < BOX_MIN) return showError("A custom box needs at least $30 of products. Add " + money(round2(BOX_MIN - t.products)) + " more.");
  if (!$("f-name").value.trim()) return showError("Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("f-email").value.trim())) return showError("Please enter a valid email address.");
  if ($("f-phone").value.replace(/\D/g, "").length < 10) return showError("Please enter a phone number we can reach you on.");
  const fulfilment = document.querySelector('input[name="fulfilment"]:checked').value;
  const payment = document.querySelector('input[name="payment"]:checked').value;
  if (fulfilment === "delivery" && !$("f-address").value.trim()) return showError("Please enter your delivery address.");
  if (fulfilment === "ship") { const se = Shipping.validate(); if (se) return showError(se); }
  if (!ORDER_ENDPOINT) return showError("Online ordering opens soon. Until then, message us to order a custom box.");
  if (Captcha.enabled() && !Captcha.token()) return showError("The security check has not finished yet. Please wait a few seconds and try again. If this keeps happening, turn off any content blocker for this site, or contact us.");
  const btn = $("submit-btn"); btn.disabled = true; btn.textContent = "Placing order…";
  try {
    const custom = {}; for (const k in qty) if (qty[k] > 0) custom[k] = qty[k];
    const res = await fetch(ORDER_ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ name: $("f-name").value, email: $("f-email").value, phone: $("f-phone").value, custom,
        fulfilment, address: $("f-address").value, payment, notes: $("f-notes").value, website: $("f-website").value, elapsed: Date.now() - window.__t0, captcha: Captcha.token() },
        fulfilment === "ship" ? Shipping.payload() : {})) });
    const r = await res.json();
    if (!r.ok) throw new Error(r.error || "Something went wrong.");
    if (r.payment === "card" && r.checkoutUrl) { safeCheckoutRedirect(r.checkoutUrl); return; }
    $("done-number").textContent = r.orderNumber;
    const p = $("done-text"); p.textContent = "";
    p.append("Send ", el("b", {}, "$" + r.total), " by Interac e-Transfer to ", el("b", {}, r.etransferEmail),
      " and put ", el("b", {}, r.orderNumber), " in the message. We hold your order for " + r.holdHours + " hours.");
    $("order-form").hidden = true; $("order-done").hidden = false; $("order-done").focus();
  } catch (err) {
    showError(err.message === "Failed to fetch" ? "We could not reach our order system. Please try again, or contact us." : err.message);
  } finally { btn.disabled = false; btn.textContent = "Place order"; Captcha.reset(); }
});

buildGrid(); applyFilter(); render();
