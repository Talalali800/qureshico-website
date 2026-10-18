/* Loaded first on every page: small safety guards. */
(function () {
  "use strict";
  window.__t0 = Date.now(); /* when the page opened, sent with orders so the script can spot bots */

  /* Do not allow the site to be shown inside another site's frame (clickjacking). A meta CSP cannot do this. */
  if (window.top !== window.self) {
    try { window.top.location = window.self.location; }
    catch (e) { document.documentElement.style.display = "none"; }
  }

  /* Only ever send the browser to Stripe's checkout, never to an address supplied by anyone else. */
  window.safeCheckoutRedirect = function (url) {
    var u;
    try { u = new URL(String(url)); } catch (e) { throw new Error("The payment link was not valid. Please contact us."); }
    if (u.protocol !== "https:" || u.hostname !== "checkout.stripe.com") throw new Error("The payment link was not valid. Please contact us.");
    window.location.assign(u.href);
  };
})();
