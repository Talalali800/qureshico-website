/**
 * Qureshi & Co. order system (Google Apps Script)
 *
 * What it does for every website order:
 *   1. Gives it the next order number (QCM-1001, QCM-1002, ...).
 *   2. Adds a row to the "Orders" sheet.
 *   3. Saves a PDF invoice with the same number to Google Drive.
 *   4. Emails the customer their invoice and how to pay.
 *   5. Emails you a copy so you can prepare the order.
 *   6. For card payments, opens a Stripe checkout tagged with the order number.
 *
 * Setup steps are in SETUP.md. Change the settings below, nothing else.
 */

// ---------------- SETTINGS ----------------
const CONFIG = {
  BUSINESS_NAME: 'Qureshi & Co.',
  BUSINESS_EMAIL: 'contact@thequreshico.ca',    // questions and replies go here; you also get a copy of every order here
  ETRANSFER_EMAIL: 'Talal.Ali@thequreshico.ca', // where customers send Interac e-Transfers
  PHONE: '437-992-7691',
  CITY: 'Hamilton, Ontario',
  ORDER_PREFIX: 'QCM-',
  FIRST_ORDER_NUMBER: 1001,
  MAX_ORDERS_PER_EMAIL_PER_HOUR: 3,      // anti-spam
  MAX_ORDERS_PER_HOUR: 40,               // anti-flood (protects your Gmail sending limit)
  EARLY_BIRD_ENDS: '2026-11-16T00:00:00-05:00', // early-bird price applies to orders before this moment
  FREE_DELIVERY_MIN: 75,                         // GTA delivery offered on orders of $75 or more
  PAYMENT_HOLD_HOURS: 24,
  CUSTOM_BOX_FEE: 6.99,                          // gift box and handwritten card, per custom order
  CUSTOM_BOX_MIN: 30,                            // minimum value of products in a custom box                        // how long an unpaid e-Transfer order is held
  PICKUP_FROM: 'December 1, 2026',
  SITE_URL: 'https://thequreshico.ca',      // used for the Stripe return pages
  SHEET_NAME: 'Orders',
  FOLDER_NAME: 'Qureshi & Co. Invoices',
  TIME_ZONE: 'America/Toronto',
  // Card processing fee: Stripe charges about 2.9% + $0.30 per Canadian card payment.
  // The customer pays all of it, so you receive the full order amount.
  CARD_FEE_PERCENT: 0.029,
  CARD_FEE_FIXED: 0.30,
  // Shipping within Canada by Canada Post (live rates). Keys go in Script properties, see SETUP.md.
  SHIP_ORIGIN_POSTAL: 'L8G4R2',                 // where parcels are sent from (never shown to customers)
  SHIP_MARKUP: 0.01,                            // 1% added to the Canada Post price; not shown to customers
  SHIP_FALLBACK: 16.99,                         // flat price used if Canada Post can't be reached or isn't set up yet
  SHIP_SERVICES: ['DOM.RP', 'DOM.EP', 'DOM.XP'], // Regular Parcel, Expedited Parcel, Xpresspost
  MAX_PARCEL_KG: 30,                            // Canada Post limit per parcel
  MAX_QUOTES_PER_HOUR: 600,                     // anti-flood for the shipping calculator
  MIN_FORM_MS: 3000                             // an order sent less than 3 seconds after the page opened is a bot
};

// Packed size of each ready-made box. ESTIMATES: weigh and measure a real packed box, then edit these.
const SHIP_SPECS = {
  carryOn:      { kg: 1.6, l: 30, w: 22, h: 10 },
  littleTaste:  { kg: 0.6, l: 22, w: 15, h: 8 },
  littleTaste5: { kg: 3.0, l: 36, w: 26, h: 16 },
  hostGift:     { kg: 2.0, l: 30, w: 22, h: 12 }
};
const SHIP_GIFTBOX = { kg: 0.35, vol: 1500 };     // custom gift box and card: weight and volume (cm3). ESTIMATE
const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
const SERVICE_NAMES = { 'DOM.RP': 'Regular Parcel', 'DOM.EP': 'Expedited Parcel', 'DOM.XP': 'Xpresspost' };

// Prices live here (not on the website) so nobody can change them in their browser.
const PRODUCTS = {
  carryOn:      { name: 'Carry-On Canada Box',             price: 44.99, earlyBird: 42.99 },
  littleTaste:  { name: 'Little Taste of Canada',          price: 22.99 },
  littleTaste5: { name: 'Little Taste of Canada, 5-pack',  price: 99.99 },
  hostGift:     { name: 'The Host Gift',                   price: 39.99 }
};

// Build-your-own box: every retail product, at suggested retail price.
const CATALOG = {
  'B-27051': { name: 'Maple-leaf bottle, amber (50 ml)', price: 6.99 },
  'B-27101': { name: 'Maple-leaf bottle, amber (100 ml)', price: 10.99 },
  'B-27241': { name: 'Maple-leaf bottle, amber (250 ml)', price: 16.99 },
  'B-17101': { name: 'Sugar shack tin, amber (100 ml)', price: 10.99 },
  'B-17251': { name: 'Sugar shack tin, amber (250 ml)', price: 13.99 },
  'B-11541CAB': { name: 'Classic can, amber (540 ml)', price: 10.99 },
  'B-14251': { name: 'Dorica bottle, golden (250 ml)', price: 11.99 },
  'B-12252': { name: 'Handle bottle, dark (250 ml)', price: 9.99 },
  'B-13102': { name: 'Maple syrup jug, dark (100 ml)', price: 6.99 },
  'B-13252': { name: 'Maple syrup jug, dark (250 ml)', price: 9.99 },
  'B-13552': { name: 'Maple syrup jug, dark (500 ml)', price: 15.99 },
  'B-13702': { name: 'Maple syrup jug, dark (1 L)', price: 25.99 },
  'LL-16231': { name: 'Bretelles maple syrup, golden (236 ml)', price: 11.99 },
  'LL-16472': { name: 'Bretelles maple syrup, amber (473 ml)', price: 17.99 },
  'LL-16473': { name: 'Bretelles maple syrup, dark (473 ml)', price: 17.89 },
  'BD-30045': { name: 'Pure maple butter (45 g)', price: 4.99 },
  'B-30160': { name: 'Pure maple butter (160 g)', price: 8.99 },
  'B-30330': { name: 'Pure maple butter (330 g)', price: 13.99 },
  'LL-30250': { name: 'Bretelles maple butter (250 g)', price: 10.89 },
  'LL-30250BIO': { name: 'Bretelles organic maple butter (250 g)', price: 10.99 },
  'B-35115': { name: 'Maple jelly (115 ml)', price: 7.99 },
  'LL-35110': { name: 'Aleppo pepper maple jelly (110 ml)', price: 8.99 },
  'LL-36250': { name: 'Bretelles maple caramel (250 g)', price: 9.99 },
  'LL-34250': { name: 'Bretelles maple taffy (250 g)', price: 10.99 },
  'BD-40025': { name: 'Granulated maple sugar jar (25 g)', price: 4.99 },
  'B-40065': { name: 'Granulated maple sugar shaker (65 g)', price: 6.99 },
  'LL-40200': { name: 'Bretelles fine maple sugar (200 g)', price: 10.99 },
  'B-40250': { name: 'Granulated maple sugar shaker (250 g)', price: 16.99 },
  'BD-40350': { name: 'Fine maple sugar bag (350 g)', price: 14.99 },
  'B-55005': { name: 'Soft maple candies, 5 pieces (35 g)', price: 5.99 },
  'B-55012': { name: 'Soft maple candies, 12 pieces (84 g)', price: 11.89 },
  'BB-55012': { name: 'Organic soft maple candies (84 g)', price: 11.99 },
  'LL-55010': { name: 'Bretelles soft maple candies, 10 pieces (70 g)', price: 7.89 },
  'LL-55010BIO': { name: 'Bretelles organic soft maple candies (70 g)', price: 7.99 },
  'B-56020': { name: 'Maple lollipop (20 g)', price: 2.99 },
  'B-56090': { name: 'Hard maple candies (90 g)', price: 6.99 },
  'LL-50140': { name: 'Bretelles maple caramel popcorn (140 g)', price: 7.99 }
};

const HEADERS = ['Order #', 'Date', 'Status', 'Name', 'Email', 'Phone', 'Items', 'Total ($)',
  'Payment method', 'Fulfilment', 'Delivery address', 'Notes', 'Invoice', 'Paid on'];
const STATUSES = ['Awaiting payment', 'Paid', 'Packed', 'Picked up', 'Delivered', 'Cancelled', 'Refunded'];

// ---------------- ONE-TIME SETUP ----------------
/** Run once from the editor: creates the sheet layout and the invoice folder. */
function setup() {
  const sheet = getSheet_();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build();
  sheet.getRange(2, 3, 1000, 1).setDataValidation(rule);
  sheet.getRange(2, 8, 1000, 1).setNumberFormat('0.00');
  getFolder_();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('NEXT_ORDER')) props.setProperty('NEXT_ORDER', String(CONFIG.FIRST_ORDER_NUMBER));
  Logger.log('Setup complete. Next order number: ' + CONFIG.ORDER_PREFIX + props.getProperty('NEXT_ORDER'));
}

/** Optional: run once after adding your Stripe key, to mark card orders Paid automatically every 15 minutes. */
function installStripeSync() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncStripePayments')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncStripePayments').timeBased().everyMinutes(15).create();
  Logger.log('Stripe sync installed.');
}

// ---------------- WEB ENDPOINTS ----------------
function doGet() {
  return json_({ ok: true, service: 'Qureshi & Co. orders' });
}

function doPost(e) {
  let data;
  try {
    if (!e || !e.postData || e.postData.contents.length > 20000) throw new Error('too large');
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'We could not read your order. Please try again.' });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json_({ ok: false, error: 'We could not read your order. Please try again.' });
  if (data.website) return json_({ ok: false, error: 'Order rejected.' }); // spam trap field
  if (data.action === 'quote') return json_(quote_(data));
  // Real visitors need a few seconds to choose items and fill the form. Scripts that post straight to this URL do not.
  if (!(Number(data.elapsed) >= CONFIG.MIN_FORM_MS)) return json_({ ok: false, error: 'Please review your order and try again.' });
  const captchaError = verifyCaptcha_(data.captcha);
  if (captchaError) return json_({ ok: false, error: captchaError });

  let order;
  try {
    order = buildOrder_(data);
  } catch (err) {
    return json_({ ok: false, error: userMsg_(err) });
  }
  const limited = rateLimit_(order.email);
  if (limited) return json_({ ok: false, error: limited });

  let checkoutUrl = null;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const props = PropertiesService.getScriptProperties();
    const next = Number(props.getProperty('NEXT_ORDER') || CONFIG.FIRST_ORDER_NUMBER);
    order.number = CONFIG.ORDER_PREFIX + next;
    props.setProperty('NEXT_ORDER', String(next + 1));
    order.date = new Date();
    if (order.payment === 'card') {
      // Open the Stripe checkout BEFORE the invoice is made. If Stripe is unavailable the order becomes a plain
      // e-Transfer order (no card fee), so the invoice, the emails and the sheet all show the same amount.
      try {
        checkoutUrl = createStripeCheckout_(order);
      } catch (err) {
        console.error('Stripe: ' + err.message);
        order.cardError = true;
        order.payment = 'etransfer';
        order.cardFee = 0;
        order.total = order.subtotal;
      }
    }
    order.invoiceUrl = saveInvoice_(order);
    appendRow_(order);
  } catch (err) {
    return json_({ ok: false, error: 'Our order system is busy. Please try again in a minute, or contact us.' });
  } finally {
    lock.releaseLock();
  }

  try { emailCustomer_(order, checkoutUrl); } catch (err) { /* order is saved even if email fails */ }
  try { emailOwner_(order); } catch (err) {}

  return json_({
    ok: true,
    orderNumber: order.number,
    total: order.total.toFixed(2),
    payment: order.payment,
    checkoutUrl: checkoutUrl,
    etransferEmail: CONFIG.ETRANSFER_EMAIL,
    holdHours: CONFIG.PAYMENT_HOLD_HOURS
  });
}

// ---------------- ORDER LOGIC ----------------
function buildOrder_(d) {
  const name = clean_(d.name, 80);
  const email = clean_(d.email, 120).toLowerCase();
  const phone = clean_(d.phone, 30);
  const notes = clean_(d.notes, 500);
  if (!name) throw new Error('Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  if (phone.replace(/\D/g, '').length < 10) throw new Error('Please enter a phone number we can reach you on.');

  const built = buildItems_(d);
  const items = built.items;
  const goods = built.goods;

  const fulfilment = d.fulfilment === 'delivery' ? 'delivery' : (d.fulfilment === 'ship' ? 'ship' : 'pickup');
  let address = clean_(d.address, 200);
  if (fulfilment === 'delivery') {
    if (goods < CONFIG.FREE_DELIVERY_MIN) throw new Error('GTA delivery is available on orders of $' + CONFIG.FREE_DELIVERY_MIN + ' or more.');
    if (!address) throw new Error('Please enter your delivery address.');
  }
  if (fulfilment === 'ship') {
    const a = shipAddress_(d);
    address = a.text;
    const pick = shippingOptions_(items, a.postal).filter(o => o.code === String(d.shipService))[0];
    if (!pick) throw new Error('Please choose a shipping option.');
    items.push({ id: 'shipping', name: 'Shipping: ' + pick.label, qty: 1, unit: pick.price, line: pick.price });
  }
  const subtotal = round2_(items.reduce((s, i) => s + i.line, 0));
  if (!isFinite(subtotal) || subtotal <= 0) throw new Error('Please add at least one item to your order.');
  const payment = d.payment === 'card' ? 'card' : 'etransfer';
  const cardFee = payment === 'card' ? cardFee_(subtotal) : 0;
  const total = round2_(subtotal + cardFee);
  return { name, email, phone, notes, items, subtotal, cardFee, total, fulfilment, address, payment };
}

/** Validates the cart and prices it (products and custom box). Returns { items, goods }. */
function buildItems_(d) {
  const earlyBird = new Date() < new Date(CONFIG.EARLY_BIRD_ENDS);
  const items = [];
  Object.keys(PRODUCTS).forEach(id => {
    const qty = Math.floor(Number((d.items || {})[id]) || 0);
    if (qty < 0 || qty > 50) throw new Error('Please choose between 0 and 50 of each box.');
    if (qty > 0) {
      const p = PRODUCTS[id];
      const unit = (earlyBird && p.earlyBird) ? p.earlyBird : p.price;
      items.push({ id: id, name: p.name, qty: qty, unit: unit, line: round2_(unit * qty) });
    }
  });
  // Build-your-own box items
  let customValue = 0;
  Object.keys(d.custom || {}).forEach(sku => {
    const qty = Math.floor(Number(d.custom[sku]) || 0);
    if (!has_(CATALOG, sku)) return;
    if (qty < 0 || qty > 50) throw new Error('Please choose between 0 and 50 of each product.');
    if (qty > 0) {
      const p = CATALOG[sku];
      const line = round2_(p.price * qty);
      customValue = round2_(customValue + line);
      items.push({ id: sku, name: p.name, qty: qty, unit: p.price, line: line });
    }
  });
  if (customValue > 0) {
    if (customValue < CONFIG.CUSTOM_BOX_MIN) throw new Error('A custom box needs at least $' + CONFIG.CUSTOM_BOX_MIN + ' of products.');
    items.push({ id: 'giftbox', name: 'Custom gift box and handwritten card', qty: 1, unit: CONFIG.CUSTOM_BOX_FEE, line: CONFIG.CUSTOM_BOX_FEE });
  }
  if (!items.length) throw new Error('Please add at least one item to your order.');
  return { items, goods: round2_(items.reduce((s, i) => s + i.line, 0)) };
}

// ---------------- SHIPPING (Canada Post) ----------------
function normPostal_(v) {
  const p = String(v || '').toUpperCase().replace(/\s+/g, '');
  return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(p) ? p : null;
}

function shipAddress_(d) {
  const street = clean_(d.street, 120), city = clean_(d.city, 60), province = String(d.province || '').toUpperCase();
  const postal = normPostal_(d.postal);
  if (!street) throw new Error('Please enter your street address.');
  if (!city) throw new Error('Please enter your city.');
  if (PROVINCES.indexOf(province) < 0) throw new Error('Please choose your province.');
  if (!postal) throw new Error('Please enter a valid Canadian postal code.');
  return { postal: postal, text: street + ', ' + city + ', ' + province + ' ' + postal.slice(0, 3) + ' ' + postal.slice(3) };
}

/** Guess a catalog item's weight (g) from the size in its name, e.g. "(250 ml)", "(1 L)", "(45 g)". ESTIMATE. */
function itemGrams_(name) {
  const m = /\((\d+(?:\.\d+)?)\s*(ml|l|g)\)/i.exec(name);
  if (!m) return 300;
  let n = Number(m[1]); const u = m[2].toLowerCase();
  if (u === 'l') n *= 1000;
  const content = u === 'g' ? n : n * 1.3;
  return Math.round(content * 1.1 + 90);
}

/** Works out one parcel (kg and cm) for the items in an order. Sizes of custom items are estimates. */
function parcelFromItems_(items) {
  let grams = 0, vol = 0, single = null, lines = 0;
  items.forEach(i => {
    let g, v;
    if (has_(SHIP_SPECS, i.id)) { const sp = SHIP_SPECS[i.id]; g = sp.kg * 1000; v = sp.l * sp.w * sp.h; if (i.qty === 1) single = sp; }
    else if (i.id === 'giftbox') { g = SHIP_GIFTBOX.kg * 1000; v = SHIP_GIFTBOX.vol; }
    else if (has_(CATALOG, i.id)) { g = itemGrams_(CATALOG[i.id].name); v = Math.max(60, g * 0.9); }
    else return;
    lines++; grams += g * i.qty; vol += v * i.qty;
  });
  const kg = Math.max(0.1, Math.round(grams / 10) / 100);
  if (kg > CONFIG.MAX_PARCEL_KG) throw new Error('This is a large order. Please contact us and we will quote shipping for you.');
  let l, w, h;
  if (single && lines === 1) { l = single.l; w = single.w; h = single.h; }
  else {
    const e = Math.cbrt(vol * 1.25);
    l = Math.max(16, e * 1.3); w = Math.max(11, e); h = Math.max(4, e / 1.3);
  }
  const dims = [l, w, h].sort((a, b) => b - a).map(x => Math.round(x * 10) / 10);
  return { kg: kg, l: dims[0], w: dims[1], h: dims[2] };
}

/** Prices to show a customer: live Canada Post rates plus the markup, or the flat fallback. */
function shippingOptions_(items, postal) {
  const parcel = parcelFromItems_(items);
  let rates = null;
  try { rates = canadaPostRates_(parcel, postal); } catch (err) { console.error('Canada Post: ' + err.message); }
  const wanted = (rates || []).filter(r => CONFIG.SHIP_SERVICES.indexOf(r.code) >= 0);
  if (!wanted.length) {
    return [{ code: 'FLAT', label: 'Standard shipping', price: round2_(CONFIG.SHIP_FALLBACK) }];
  }
  return wanted.sort((a, b) => a.price - b.price).map(r => ({
    code: r.code,
    label: (SERVICE_NAMES[r.code] || r.name) + (r.days ? ' (about ' + r.days + ' business ' + (r.days === 1 ? 'day' : 'days') + ')' : ''),
    price: round2_(r.price * (1 + CONFIG.SHIP_MARKUP))
  }));
}

/** Canada Post REST API (OAuth 2.0 client credentials, JSON). Addresses come from Canada Post's Rating 4.0.0 spec. */
const CP_TOKEN_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/cpc-api-native-oauth-provider/oauth2/token';
const CP_RATING_URL = 'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs/rating/v1';

/** Gets an access token (cached until shortly before it expires). Returns null if the keys are not set up. */
function cpToken_(forceNew) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CP_CLIENT_ID'), secret = props.getProperty('CP_CLIENT_SECRET');
  if (!id || !secret) return null;
  const cache = CacheService.getScriptCache();
  if (!forceNew) { const hit = cache.get('cp_token'); if (hit) return hit; }
  const res = UrlFetchApp.fetch(CP_TOKEN_URL, {
    method: 'post', muteHttpExceptions: true,
    headers: { 'X-IBM-Client-Id': id, 'X-IBM-Client-Secret': secret, accept: 'application/json' },
    payload: 'scope=merchant&grant_type=client_credentials'
  });
  if (res.getResponseCode() !== 200) throw new Error('Token HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  const t = JSON.parse(res.getContentText());
  if (!t.access_token) throw new Error('No access token in response');
  const ttl = Math.max(60, Math.min(21000, (Number(t.expires_in) || 3600) - 300));
  cache.put('cp_token', t.access_token, ttl);
  return t.access_token;
}

/** Asks Canada Post for rates. Returns null if the keys are not set up, otherwise [{ code, name, price, days }]. */
function canadaPostRates_(parcel, postal) {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CP_CLIENT_ID') || !props.getProperty('CP_CLIENT_SECRET')) return null;
  const cache = CacheService.getScriptCache();
  const ckey = 'cp:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    [postal, parcel.kg, parcel.l, parcel.w, parcel.h].join('|')));
  const hit = cache.get(ckey);
  if (hit) return JSON.parse(hit);

  const customer = props.getProperty('CP_CUSTOMER_NUMBER'), contract = props.getProperty('CP_CONTRACT_ID');
  const body = {
    quoteType: customer ? 'commercial' : 'counter',   // commercial = your small-business/contract price
    parcelCharacteristics: {
      weight: Math.round(parcel.kg * 1000) / 1000,
      dimensions: { length: parcel.l, width: parcel.w, height: parcel.h }
    },
    originPostalCode: CONFIG.SHIP_ORIGIN_POSTAL,
    destination: { domestic: { postalCode: postal } }
  };
  if (customer) body.customerNumber = customer;
  if (customer && contract) body.contractId = contract;

  const call = (token) => UrlFetchApp.fetch(CP_RATING_URL + '/prices', {
    method: 'post', muteHttpExceptions: true, contentType: 'application/json', payload: JSON.stringify(body),
    headers: { Authorization: 'Bearer ' + token, accept: 'application/json', 'Accept-Language': 'en-CA' }
  });
  let res = call(cpToken_(false));
  if (res.getResponseCode() === 401) res = call(cpToken_(true));   // token may have expired early
  if (res.getResponseCode() !== 200) throw new Error('Rates HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
  const out = JSON.parse(res.getContentText()).map(q => ({
    code: q.serviceCode,
    name: q.serviceName,
    price: Number(q.priceDetails && q.priceDetails.due),
    days: Number(q.serviceStandard && q.serviceStandard.expectedTransitTime) || 0
  })).filter(q => q.code && q.price > 0);
  if (out.length) cache.put(ckey, JSON.stringify(out), 6 * 3600);
  return out;
}

/** The shipping calculator on the website: returns the options for a cart and postal code. */
function quote_(d) {
  try {
    const cache = CacheService.getScriptCache();
    const k = 'q:' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
    const n = Number(cache.get(k) || 0);
    if (n >= CONFIG.MAX_QUOTES_PER_HOUR) return { ok: false, error: 'Shipping calculator is busy. Please try again shortly or contact us.' };
    cache.put(k, String(n + 1), 3600);
    const postal = normPostal_(d.postal);
    if (!postal) return { ok: false, error: 'Please enter a valid Canadian postal code.' };
    const options = shippingOptions_(buildItems_(d).items, postal);
    return { ok: true, options: options };
  } catch (err) {
    return { ok: false, error: userMsg_(err) };
  }
}

/** Card processing fee added for the customer. Stripe takes its percentage of the whole amount charged, so this is
 *  worked out so that the amount left after Stripe's fee equals the order amount. */
function cardFee_(subtotal) {
  return round2_((subtotal + CONFIG.CARD_FEE_FIXED) / (1 - CONFIG.CARD_FEE_PERCENT) - subtotal);
}

function appendRow_(o) {
  getSheet_().appendRow([
    o.number,
    Utilities.formatDate(o.date, CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm'),
    'Awaiting payment',
    safeCell_(o.name), safeCell_(o.email), "'" + o.phone,
    o.items.map(i => i.qty + ' × ' + i.name).join('\n') + (o.cardFee ? '\nCard processing fee: $' + o.cardFee.toFixed(2) : ''),
    o.total,
    o.payment === 'card' ? 'Card (Stripe)' : 'Interac e-Transfer',
    o.fulfilment === 'delivery' ? 'GTA delivery' : (o.fulfilment === 'ship' ? 'Canada Post shipping' : 'Pickup, Hamilton'),
    safeCell_(o.address), safeCell_(o.notes), o.invoiceUrl, ''
  ]);
}

// ---------------- INVOICE ----------------
function saveInvoice_(o) {
  const html = invoiceHtml_(o);
  const pdf = Utilities.newBlob(html, 'text/html', o.number + '.html').getAs('application/pdf').setName('Invoice ' + o.number + '.pdf');
  const file = getFolder_().createFile(pdf);
  o.pdf = pdf;
  return file.getUrl();
}

/** Your logo (maple drop), embedded so the PDF never depends on a web address. PNG, about 44 pt wide when printed. */
const LOGO_DATA_URI = 'data:image/png;base64,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';

function money_(n) { return '$' + Number(n).toFixed(2); }
/** 4165551234 -> 416-555-1234 (anything that is not a plain 10-digit number is shown as typed). */
function fmtPhone_(p) {
  const d = String(p == null ? '' : p).replace(/\D/g, '');
  return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : String(p == null ? '' : p);
}

/**
 * The invoice PDF. Built from plain tables and inline colours because Google's HTML-to-PDF converter
 * ignores modern layout (flexbox, grid, web fonts). Fonts are the safe set: Georgia for headings, Helvetica for text.
 */
function invoiceHtml_(o) {
  const INK = '#33210F', MUTED = '#6E5641', ACCENT = '#B8660F', CREAM = '#F7EFE2', ROW = '#FBF6EC', LINE = '#E3D5BE';
  const SERIF = 'Georgia,Times New Roman,serif', SANS = 'Helvetica,Arial,sans-serif';
  const date = Utilities.formatDate(o.date, CONFIG.TIME_ZONE, 'MMMM d, yyyy');
  const products = o.items.filter(i => i.id !== 'shipping');
  const ship = o.items.filter(i => i.id === 'shipping')[0];
  const goods = round2_(products.reduce((s, i) => s + i.line, 0));

  const label = (t) => '<div style="font-family:' + SANS + ';font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:' + MUTED + ';padding-bottom:3px;">' + t + '</div>';
  const th = (t, align, w) => '<td ' + (w ? 'width="' + w + '" ' : '') + 'align="' + align + '" bgcolor="' + INK + '" style="background:' + INK +
    ';color:#FFFFFF;font-family:' + SANS + ';font-size:9px;letter-spacing:1.5px;text-transform:uppercase;padding:9px 10px;">' + t + '</td>';
  const cell = (html, align, bg, extra) => '<td align="' + align + '" bgcolor="' + bg + '" style="background:' + bg + ';font-family:' + SANS +
    ';font-size:11px;color:' + INK + ';padding:9px 10px;border-bottom:1px solid ' + LINE + ';' + (extra || '') + '">' + html + '</td>';
  const sumRow = (text, value) => '<tr><td colspan="3" align="right" style="font-family:' + SANS + ';font-size:11px;color:' + MUTED + ';padding:7px 10px;">' + text +
    '</td><td align="right" style="font-family:' + SANS + ';font-size:11px;color:' + INK + ';padding:7px 10px;">' + value + '</td></tr>';

  const itemRows = products.map((i, n) => {
    const bg = n % 2 ? ROW : '#FFFFFF';
    return '<tr>' + cell(esc_(i.name), 'left', bg) + cell(String(i.qty), 'right', bg) + cell(money_(i.unit), 'right', bg) + cell(money_(i.line), 'right', bg, 'font-weight:bold;') + '</tr>';
  }).join('');

  const payText = o.payment === 'card'
    ? 'Pay securely by card using the Stripe link in your confirmation email. Your Stripe receipt confirms your payment.'
    : '<b>1.</b> Send <b>' + money_(o.total) + '</b> by Interac e-Transfer to <b>' + esc_(CONFIG.ETRANSFER_EMAIL) + '</b><br>' +
      '<b>2.</b> Put <b>' + esc_(o.number) + '</b> in the message<br>' +
      '<b>3.</b> We hold your order for ' + CONFIG.PAYMENT_HOLD_HOURS + ' hours while we wait for your payment';
  const status = o.payment === 'card' ? 'Awaiting card payment' : 'Awaiting e-Transfer';
  const method = o.payment === 'card' ? 'Credit or debit card' : 'Interac e-Transfer';

  let wherePlace, whereDetail;
  if (o.fulfilment === 'ship') { wherePlace = 'Shipped by Canada Post'; whereDetail = esc_(o.address) + '<br><span style="color:' + MUTED + ';">We will email your tracking number when it ships.</span>'; }
  else if (o.fulfilment === 'delivery') { wherePlace = 'GTA delivery'; whereDetail = esc_(o.address) + '<br><span style="color:' + MUTED + ';">We will contact you to arrange a time.</span>'; }
  else { wherePlace = 'Pickup in ' + esc_(CONFIG.CITY); whereDetail = 'From ' + esc_(CONFIG.PICKUP_FROM) + '<br><span style="color:' + MUTED + ';">We will email the address and pickup times.</span>'; }

  const metaCell = (title, value, w) => '<td width="' + w + '" valign="top" style="padding:10px 12px;">' + label(title) +
    '<div style="font-family:' + SANS + ';font-size:11px;font-weight:bold;color:' + INK + ';">' + value + '</div></td>';

  return '<html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#FFFFFF;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="padding:34px 38px 30px 38px;">' +

    // header: logo and business on the left, INVOICE on the right
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>' +
    '<td width="60" valign="middle"><img src="' + LOGO_DATA_URI + '" width="44" height="65" alt=""></td>' +
    '<td valign="middle" style="padding-left:6px;"><div style="font-family:' + SERIF + ';font-size:21px;font-weight:bold;color:' + ACCENT + ';">' + esc_(CONFIG.BUSINESS_NAME) + '</div>' +
    '<div style="font-family:' + SANS + ';font-size:10px;color:' + MUTED + ';padding-top:3px;">Canadian maple gifts, carry-on ready<br>' +
    esc_(CONFIG.CITY) + ' · ' + esc_(CONFIG.BUSINESS_EMAIL) + ' · ' + esc_(CONFIG.PHONE) + '</div></td>' +
    '<td align="right" valign="middle"><div style="font-family:' + SERIF + ';font-size:30px;letter-spacing:4px;color:' + INK + ';">INVOICE</div>' +
    '<div style="font-family:' + SANS + ';font-size:12px;font-weight:bold;color:' + ACCENT + ';padding-top:4px;">' + esc_(o.number) + '</div></td>' +
    '</tr></table>' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px;"><tr><td height="4" bgcolor="' + ACCENT + '" style="background:' + ACCENT + ';font-size:1px;line-height:4px;">&nbsp;</td></tr></table>' +

    // order details strip
    '<table width="100%" cellpadding="0" cellspacing="0" bgcolor="' + CREAM + '" style="border-collapse:collapse;background:' + CREAM + ';margin-top:14px;"><tr>' +
    metaCell('Invoice no.', esc_(o.number), '25%') + metaCell('Date', date, '25%') + metaCell('Payment method', method, '25%') + metaCell('Status', status, '25%') +
    '</tr></table>' +

    // billed to / delivery
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:18px;"><tr>' +
    '<td width="50%" valign="top" style="padding-right:12px;">' + label('Billed to') +
    '<div style="font-family:' + SANS + ';font-size:11px;line-height:16px;color:' + INK + ';"><b>' + esc_(o.name) + '</b><br>' + esc_(o.email) + '<br>' + esc_(fmtPhone_(o.phone)) + '</div></td>' +
    '<td width="50%" valign="top" style="padding-left:12px;">' + label('Pickup or delivery') +
    '<div style="font-family:' + SANS + ';font-size:11px;line-height:16px;color:' + INK + ';"><b>' + wherePlace + '</b><br>' + whereDetail + '</div></td>' +
    '</tr></table>' +

    // items
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:20px;"><tr>' +
    th('Item', 'left', '52%') + th('Qty', 'right', '10%') + th('Price', 'right', '18%') + th('Amount', 'right', '20%') + '</tr>' + itemRows +
    ((ship || o.cardFee) ? sumRow('Subtotal', money_(goods)) : '') +
    (ship ? sumRow('Shipping: ' + esc_(String(ship.name).replace(/^Shipping:\s*/, '')), money_(ship.line)) : '') +
    (o.cardFee ? sumRow('Card processing fee', money_(o.cardFee)) : '') +
    '<tr><td colspan="3" align="right" bgcolor="' + ACCENT + '" style="background:' + ACCENT + ';color:#FFFFFF;font-family:' + SANS + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;padding:12px 10px;">Total due (CAD)</td>' +
    '<td align="right" bgcolor="' + ACCENT + '" style="background:' + ACCENT + ';color:#FFFFFF;font-family:' + SERIF + ';font-size:18px;font-weight:bold;padding:10px 10px;">' + money_(o.total) + '</td></tr>' +
    '</table>' +

    // how to pay
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:20px;"><tr>' +
    '<td width="5" bgcolor="' + ACCENT + '" style="background:' + ACCENT + ';">&nbsp;</td>' +
    '<td bgcolor="' + CREAM + '" style="background:' + CREAM + ';padding:12px 16px;"><div style="font-family:' + SERIF + ';font-size:13px;font-weight:bold;color:' + INK + ';padding-bottom:5px;">How to pay</div>' +
    '<div style="font-family:' + SANS + ';font-size:11px;line-height:17px;color:' + INK + ';">' + payText + '</div></td></tr></table>' +

    (o.notes ? '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px;"><tr><td width="5" bgcolor="' + LINE + '" style="background:' + LINE + ';">&nbsp;</td>' +
      '<td style="padding:10px 16px;border:1px solid ' + LINE + ';"><div style="font-family:' + SANS + ';font-size:8px;letter-spacing:1.5px;text-transform:uppercase;color:' + MUTED + ';padding-bottom:3px;">Your notes</div>' +
      '<div style="font-family:' + SANS + ';font-size:11px;color:' + INK + ';">' + esc_(o.notes) + '</div></td></tr></table>' : '') +

    // footer
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:26px;"><tr><td align="center" style="border-top:1px solid ' + LINE + ';padding-top:14px;">' +
    '<div style="font-family:' + SERIF + ';font-size:14px;font-style:italic;color:' + ACCENT + ';">Thank you for choosing ' + esc_(CONFIG.BUSINESS_NAME) + '</div>' +
    '<div style="font-family:' + SANS + ';font-size:9px;line-height:14px;color:' + MUTED + ';padding-top:6px;">' +
    'Cancellation: full refund within 48 hours of ordering. After 48 hours, refunds are less a $10 cancellation fee.<br>' +
    'Questions? ' + esc_(CONFIG.BUSINESS_EMAIL) + ' · ' + esc_(CONFIG.PHONE) + ' · thequreshico.ca</div></td></tr></table>' +

    '</td></tr></table></body></html>';
}

// ---------------- EMAILS ----------------
function emailCustomer_(o, checkoutUrl) {
  const items = o.items.map(i => '<li>' + i.qty + ' × ' + esc_(i.name) + ', $' + i.line.toFixed(2) + '</li>').join('') +
    (o.cardFee ? '<li>Card processing fee, $' + o.cardFee.toFixed(2) + '</li>' : '');
  let payBlock;
  if (o.payment === 'card' && checkoutUrl) {
    payBlock = '<p><b>Pay by card:</b> <a href="' + checkoutUrl + '">complete your secure Stripe payment</a>. ' +
      'If you already paid, you can ignore this link.</p>';
  } else {
    payBlock = '<p><b>Pay by Interac e-Transfer:</b> send <b>$' + o.total.toFixed(2) + '</b> to <b>' + esc_(CONFIG.ETRANSFER_EMAIL) +
      '</b> and put <b>' + o.number + '</b> in the message. We hold your order for ' + CONFIG.PAYMENT_HOLD_HOURS + ' hours.</p>' +
      (o.cardError ? '<p>Our card checkout was unavailable when you ordered, so please use e-Transfer, or reply and we will send a card link.</p>' : '');
  }
  const where = o.fulfilment === 'ship'
    ? '<p><b>Shipping:</b> ' + esc_(o.address) + '. We will email you a tracking number when your order ships.</p>'
    : o.fulfilment === 'delivery'
    ? '<p><b>Delivery:</b> ' + esc_(o.address) + '. We will contact you to arrange a time.</p>'
    : '<p><b>Pickup:</b> in ' + esc_(CONFIG.CITY) + ' from ' + esc_(CONFIG.PICKUP_FROM) + '. We will email the address and pickup times.</p>';
  MailApp.sendEmail({
    to: o.email,
    replyTo: CONFIG.BUSINESS_EMAIL,
    name: CONFIG.BUSINESS_NAME,
    subject: 'Your order ' + o.number + ' from ' + CONFIG.BUSINESS_NAME,
    htmlBody: '<div style="font-family:Arial,sans-serif;color:#33210F;font-size:15px;line-height:1.5">' +
      '<p>Hi ' + esc_(o.name.split(' ')[0]) + ',</p>' +
      '<p>Thank you for your order. Your order number is <b>' + o.number + '</b>. Your invoice is attached.</p>' +
      '<ul>' + items + '</ul><p><b>Total: $' + o.total.toFixed(2) + '</b></p>' + payBlock + where +
      '<p>Questions? Reply to this email or call ' + esc_(CONFIG.PHONE) + '.</p>' +
      '<p>' + esc_(CONFIG.BUSINESS_NAME) + '</p></div>',
    attachments: [o.pdf]
  });
}

function emailOwner_(o) {
  MailApp.sendEmail({
    to: CONFIG.BUSINESS_EMAIL,
    subject: 'New order ' + o.number + ': $' + o.total.toFixed(2) + ' (' + (o.payment === 'card' ? 'card' : 'e-Transfer') + ')',
    htmlBody: '<p><b>' + o.number + '</b> from ' + esc_(o.name) + ' (' + esc_(o.email) + ', ' + esc_(o.phone) + ')</p>' +
      '<ul>' + o.items.map(i => '<li>' + i.qty + ' × ' + esc_(i.name) + '</li>').join('') + '</ul>' +
      '<p>Total: $' + o.total.toFixed(2) + '<br>Fulfilment: ' + (o.fulfilment === 'delivery' ? 'GTA delivery, ' + esc_(o.address) : (o.fulfilment === 'ship' ? 'Canada Post shipping, ' + esc_(o.address) : 'Pickup')) +
      '<br>Notes: ' + (esc_(o.notes) || 'none') + '</p><p><a href="' + o.invoiceUrl + '">Invoice in Drive</a></p>',
    attachments: [o.pdf]
  });
}

// ---------------- STRIPE ----------------
// Add your Stripe secret key in Project Settings > Script properties as STRIPE_SECRET_KEY (never on the website).
function createStripeCheckout_(o) {
  const key = PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY');
  if (!key) throw new Error('No Stripe key');
  const p = {
    'mode': 'payment',
    'client_reference_id': o.number,
    'customer_email': o.email,
    'metadata[order_number]': o.number,
    'payment_intent_data[description]': 'Order ' + o.number,
    'payment_intent_data[metadata][order_number]': o.number,
    'success_url': CONFIG.SITE_URL + '/#paid',
    'cancel_url': CONFIG.SITE_URL + '/#order'
  };
  const lines = o.items.map(it => ({ name: it.name, qty: it.qty, unit: it.unit }));
  if (o.cardFee) lines.push({ name: 'Card processing fee', qty: 1, unit: o.cardFee });
  lines.forEach((it, n) => {
    p['line_items[' + n + '][quantity]'] = String(it.qty);
    p['line_items[' + n + '][price_data][currency]'] = 'cad';
    p['line_items[' + n + '][price_data][unit_amount]'] = String(Math.round(it.unit * 100));
    p['line_items[' + n + '][price_data][product_data][name]'] = it.name;
  });
  const res = UrlFetchApp.fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'post', payload: p, headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true
  });
  const body = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) throw new Error(body.error ? body.error.message : 'Stripe error');
  return body.url;
}

/** Marks card orders "Paid" in the sheet once Stripe shows them paid. Runs every 15 min after installStripeSync(). */
function syncStripePayments() {
  const key = PropertiesService.getScriptProperties().getProperty('STRIPE_SECRET_KEY');
  if (!key) return;
  const since = Math.floor(Date.now() / 1000) - 3 * 24 * 3600;
  const res = UrlFetchApp.fetch('https://api.stripe.com/v1/checkout/sessions?limit=100&created[gte]=' + since, {
    headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return;
  const paid = {};
  JSON.parse(res.getContentText()).data.forEach(s => {
    if (s.payment_status === 'paid' && s.client_reference_id) paid[s.client_reference_id] = true;
  });
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (paid[values[r][0]] && values[r][2] === 'Awaiting payment') {
      sheet.getRange(r + 1, 3).setValue('Paid');
      sheet.getRange(r + 1, 14).setValue(Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm'));
    }
  }
}

// ---------------- SECURITY ----------------
/** Blocks floods and email-bombing: max 3 orders per email per hour, max 40 orders per hour in total. */
function rateLimit_(email) {
  const cache = CacheService.getScriptCache();
  const hour = Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHH');
  const ek = 'e:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email)) + hour;
  const gk = 'g:' + hour;
  const e = Number(cache.get(ek) || 0), g = Number(cache.get(gk) || 0);
  if (e >= CONFIG.MAX_ORDERS_PER_EMAIL_PER_HOUR) return 'You have placed several orders recently. Please contact us if you need to change your order.';
  if (g >= CONFIG.MAX_ORDERS_PER_HOUR) return 'We are receiving a lot of orders right now. Please try again shortly or contact us.';
  cache.put(ek, String(e + 1), 3600); cache.put(gk, String(g + 1), 3600);
  return null;
}
/** Stops spreadsheet formula injection (text starting with = + - @ is stored as plain text). */
function safeCell_(v) { const s = String(v == null ? '' : v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }

// ---------------- HELPERS ----------------
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
}
function getFolder_() {
  const it = DriveApp.getFoldersByName(CONFIG.FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.FOLDER_NAME);
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
/** Cloudflare Turnstile bot check. Switched off until TURNSTILE_SECRET is added to Script properties. */
function verifyCaptcha_(token) {
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  if (!secret) return null;
  const failed = 'Please complete the security check and try again.';
  const unavailable = 'The security check is unavailable right now. Please try again in a few minutes, or contact us.';
  if (typeof token !== 'string' || !token || token.length > 2048) return failed;
  try {
    const res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post', muteHttpExceptions: true, payload: { secret: secret, response: token }
    });
    if (res.getResponseCode() !== 200) { console.error('Turnstile HTTP ' + res.getResponseCode()); return unavailable; }
    const out = JSON.parse(res.getContentText());
    if (out.success === true) return null;
    console.error('Turnstile refused the token: ' + JSON.stringify(out['error-codes'] || []));
    return failed;
  } catch (err) {
    console.error('Turnstile: ' + err.message);
    return unavailable;
  }
}

/** True only for properties we defined ourselves (not "constructor", "__proto__" and the like). */
function has_(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
/** Message that is safe to show a visitor: our own messages pass through, internal errors are replaced. */
function userMsg_(err) {
  if (err instanceof TypeError || err instanceof ReferenceError || err instanceof RangeError || err instanceof SyntaxError) {
    console.error('Unexpected error: ' + err.message);
    return 'Something went wrong. Please try again, or contact us.';
  }
  return err.message;
}
function clean_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function round2_(n) { return Math.round(n * 100) / 100; }
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
