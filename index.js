/* Paste the Google Apps Script web app URL here once it's deployed (see SETUP.md). */
const ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfycbwSexkNuWC9BNWwKU7dhjHhy_HXrUb_uUyZYdSI3K2CQxxaS3NQ8kS8iQEvQ3CSHVfwlA/exec";
const EARLY_BIRD_ENDS = new Date("2026-11-16T00:00:00-05:00");
const FREE_DELIVERY_MIN = 75;
const CARD_FEE = { percent: 0.029, fixed: 0.30 }; /* keep in sync with the script */
const PRODUCTS = {
  carryOn: { name: "Carry-On Canada Box", price: 44.99, earlyBird: 42.99 },
  littleTaste: { name: "Little Taste of Canada", price: 22.99 },
  littleTaste5: { name: "Little Taste of Canada, 5-pack", price: 99.99 },
  hostGift: { name: "The Host Gift", price: 39.99 }
};
const qty = { carryOn: 0, littleTaste: 0, littleTaste5: 0, hostGift: 0 };
Shipping.mount({ endpoint: ORDER_ENDPOINT, cart: () => ({ items: qty }),
  hasItems: () => Object.keys(qty).some((k) => qty[k] > 0), onChange: () => render() });
const $ = (id) => document.getElementById(id);
const money = (n) => "$" + n.toFixed(2);
const round2 = (n) => Math.round(n * 100) / 100;
const unitPrice = (p) => (new Date() < EARLY_BIRD_ENDS && p.earlyBird) ? p.earlyBird : p.price;

function totals() {
  let subtotal = 0; const lines = [];
  for (const id in qty) if (qty[id] > 0) {
    const line = round2(unitPrice(PRODUCTS[id]) * qty[id]);
    subtotal = round2(subtotal + line); lines.push({ id, qty: qty[id], name: PRODUCTS[id].name, line });
  }
  const card = document.querySelector('input[name="payment"]:checked').value === "card";
  const ship = Shipping.cost();
  const base = round2(subtotal + ship);
  const fee = card && subtotal > 0 ? round2((base + CARD_FEE.fixed) / (1 - CARD_FEE.percent) - base) : 0;
  return { lines, subtotal, ship, fee, total: round2(base + fee) };
}

function render() {
  document.querySelectorAll(".stepper").forEach((st) => { st.querySelector("output").textContent = qty[st.dataset.id]; });
  const t = totals();
  const ul = $("sum-lines"); ul.textContent = "";
  t.lines.forEach((l) => {
    const li = document.createElement("li");
    const a = document.createElement("span"); a.textContent = l.qty + " × " + l.name;
    const b = document.createElement("span"); b.textContent = money(l.line);
    li.append(a, b); ul.append(li);
  });
  $("sum-empty").hidden = t.lines.length > 0;
  $("sum-sub").textContent = money(t.subtotal);
  $("ship-row").hidden = !Shipping.active();
  $("sum-ship").textContent = Shipping.ready() ? money(t.ship) : "Enter postal code";
  $("fee-row").hidden = t.fee === 0;
  $("sum-fee").textContent = money(t.fee);
  $("sum-total").textContent = money(t.total);
  const canDeliver = t.subtotal >= FREE_DELIVERY_MIN;
  $("f-delivery").disabled = !canDeliver;
  if (!canDeliver && $("f-delivery").checked) $("f-pickup").checked = true;
  $("delivery-hint").textContent = canDeliver ? "Free on your order" : "Available on orders of $75 or more (add " + money(round2(FREE_DELIVERY_MIN - t.subtotal)) + ")";
  $("address-field").hidden = !$("f-delivery").checked;
  Shipping.refresh();
  const sample = t.subtotal > 0 ? round2(t.subtotal + t.ship) : 50;
  const sampleFee = round2((sample + CARD_FEE.fixed) / (1 - CARD_FEE.percent) - sample);
  $("card-hint").textContent = "Secure checkout by Stripe. A card processing fee of about 2.9% + $0.30 is added. On " +
    money(sample) + " it is " + money(sampleFee) + ". Interac e-Transfer has no fee.";
}

document.querySelectorAll(".stepper").forEach((st) => {
  st.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const id = st.dataset.id;
    qty[id] = Math.max(0, Math.min(50, qty[id] + Number(b.dataset.step)));
    render();
  });
});
document.querySelectorAll('input[name="payment"], input[name="fulfilment"]').forEach((r) => r.addEventListener("change", render));

function showError(msg) { const e = $("form-error"); e.textContent = msg; e.hidden = false; }

$("order-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("form-error").hidden = true;
  const t = totals();
  const f = e.target;
  if (!t.lines.length) return showError("Add at least one box using the + buttons above.");
  if (!$("f-name").value.trim()) return showError("Please enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("f-email").value.trim())) return showError("Please enter a valid email address.");
  if ($("f-phone").value.replace(/\D/g, "").length < 10) return showError("Please enter a phone number we can reach you on.");
  const fulfilment = document.querySelector('input[name="fulfilment"]:checked').value, payment = document.querySelector('input[name="payment"]:checked').value;
  if (fulfilment === "delivery" && !$("f-address").value.trim()) return showError("Please enter your delivery address.");
  if (fulfilment === "ship") { const se = Shipping.validate(); if (se) return showError(se); }
  if (!ORDER_ENDPOINT) return showError("Online ordering opens soon. Until then, message us to pre-order.");
  if (Captcha.enabled() && !Captcha.token()) return showError("The security check has not finished yet. Please wait a few seconds and try again. If this keeps happening, turn off any content blocker for this site, or contact us.");

  const btn = $("submit-btn"); btn.disabled = true; btn.textContent = "Placing order…";
  try {
    const res = await fetch(ORDER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ name: $("f-name").value, email: $("f-email").value, phone: $("f-phone").value, items: qty,
        fulfilment, address: $("f-address").value, payment, notes: $("f-notes").value, website: $("f-website").value, elapsed: Date.now() - window.__t0, captcha: Captcha.token() },
        fulfilment === "ship" ? Shipping.payload() : {}))
    });
    const r = await res.json();
    if (!r.ok) throw new Error(r.error || "Something went wrong.");
    if (r.payment === "card" && r.checkoutUrl) { safeCheckoutRedirect(r.checkoutUrl); return; }
    $("done-number").textContent = r.orderNumber;
    const p = $("done-text"); p.textContent = "";
    p.append("Send ", Object.assign(document.createElement("b"), { textContent: "$" + r.total }),
      " by Interac e-Transfer to ", Object.assign(document.createElement("b"), { textContent: r.etransferEmail }),
      " and put ", Object.assign(document.createElement("b"), { textContent: r.orderNumber }),
      " in the message. We hold your order for " + r.holdHours + " hours.");
    f.hidden = true; $("order-done").hidden = false; $("order-done").focus();
  } catch (err) {
    showError(err.message === "Failed to fetch" ? "We could not reach our order system. Please try again, or contact us." : err.message);
  } finally {
    btn.disabled = false; btn.textContent = "Place order";
    Captcha.reset();
  }
});

if (location.hash === "#paid") {
  $("order-form").hidden = true; $("order-done").hidden = false;
  $("done-number").textContent = "paid";
  $("done-text").textContent = "Thank you. Your card payment went through, and your invoice is on its way by email.";
}
render();

document.querySelectorAll("[data-copy]").forEach(function (b) {
  b.addEventListener("click", function () {
    const el = document.getElementById(b.dataset.copy);
    const done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy"; }, 1600); };
    const fallback = function () { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected"; };
    try { navigator.clipboard.writeText(el.textContent).then(done, fallback); } catch (e) { fallback(); }
  });
});
