/* Cloudflare Turnstile bot check for the order forms. It stays OFF until you paste your SITE key below.
   The site key is public and safe to keep in this file. The SECRET key never goes here: it lives only in Apps Script. */
(function () {
  "use strict";
  var SITE_KEY = ""; /* e.g. "0x4AAAAAAA..." from the Cloudflare Turnstile dashboard */
  var token = "", widget = null, ready = false;

  function mount() {
    var box = document.getElementById("captcha");
    if (!SITE_KEY || !box) return;
    window.__onTurnstile = function () {
      widget = window.turnstile.render(box, {
        sitekey: SITE_KEY,
        appearance: "interaction-only", /* invisible unless Cloudflare needs the visitor to do something */
        theme: "auto",
        callback: function (t) { token = t; },
        "expired-callback": function () { token = ""; },
        "error-callback": function () { token = ""; }
      });
      ready = true;
    };
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstile";
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }

  window.Captcha = {
    enabled: function () { return !!SITE_KEY; },
    token: function () { return token; },
    /* a token works once, so ask for a fresh one after every attempt */
    reset: function () { token = ""; if (ready && widget !== null) { try { window.turnstile.reset(widget); } catch (e) { /* ignore */ } } }
  };
  mount();
})();
