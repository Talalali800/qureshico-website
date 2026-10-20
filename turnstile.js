/* Cloudflare Turnstile bot check for the order forms.
   The site key below is public and safe to keep in this file. The SECRET key never goes here: it lives only in Apps Script
   (Script property TURNSTILE_SECRET). If the check cannot load (for example an ad blocker), the form does not lock the
   customer out: the order script then decides whether to accept the order. */
(function () {
  "use strict";
  var SITE_KEY = "0x4AAAAAAFeZXGWwhcpJ1bGm";
  var token = "", widget = null, ready = false, failed = false;

  function mount() {
    var box = document.getElementById("captcha");
    if (!SITE_KEY || !box) return;
    window.__onTurnstile = function () {
      widget = window.turnstile.render(box, {
        sitekey: SITE_KEY,
        appearance: "interaction-only", /* invisible unless Cloudflare needs the visitor to do something */
        theme: "auto",
        callback: function (t) { token = t; failed = false; },
        "expired-callback": function () { token = ""; },
        "error-callback": function () { token = ""; failed = true; }
      });
      ready = true;
    };
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstile";
    s.async = true; s.defer = true;
    s.onerror = function () { failed = true; }; /* blocked or offline */
    document.head.appendChild(s);
  }

  window.Captcha = {
    /* true only while the check is working, so a broken check never stops a customer from ordering */
    enabled: function () { return !!SITE_KEY && !failed; },
    token: function () { return token; },
    /* a token works once, so ask for a fresh one after every attempt */
    reset: function () { token = ""; if (ready && widget !== null) { try { window.turnstile.reset(widget); } catch (e) { /* ignore */ } } }
  };
  mount();
})();
