/**
 * Qureshi & Co. order system (Google Apps Script)
 *
 * What it does for every website order:
 *   1. Gives it the next order number (QC-1001, QC-1002, ...).
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
  ORDER_PREFIX: 'QC-',
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
  // The customer pays CARD_FEE_CUSTOMER_SHARE of it (0.5 = half); you pay the rest.
  CARD_FEE_PERCENT: 0.029,
  CARD_FEE_FIXED: 0.30,
  CARD_FEE_CUSTOMER_SHARE: 0.5
};

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
  if (data.website) return json_({ ok: false, error: 'Order rejected.' }); // spam trap field

  let order;
  try {
    order = buildOrder_(data);
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
  const limited = rateLimit_(order.email);
  if (limited) return json_({ ok: false, error: limited });

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const props = PropertiesService.getScriptProperties();
    const next = Number(props.getProperty('NEXT_ORDER') || CONFIG.FIRST_ORDER_NUMBER);
    order.number = CONFIG.ORDER_PREFIX + next;
    props.setProperty('NEXT_ORDER', String(next + 1));
    order.date = new Date();
    order.invoiceUrl = saveInvoice_(order);
    appendRow_(order);
  } catch (err) {
    return json_({ ok: false, error: 'Our order system is busy. Please try again in a minute, or contact us.' });
  } finally {
    lock.releaseLock();
  }

  let checkoutUrl = null;
  if (order.payment === 'card') {
    try {
      checkoutUrl = createStripeCheckout_(order);
    } catch (err) {
      order.cardError = true; // the customer can still pay by e-Transfer
    }
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
    if (!CATALOG[sku]) return;
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
  const subtotal = round2_(items.reduce((s, i) => s + i.line, 0));

  const fulfilment = d.fulfilment === 'delivery' ? 'delivery' : 'pickup';
  const address = clean_(d.address, 200);
  if (fulfilment === 'delivery') {
    if (subtotal < CONFIG.FREE_DELIVERY_MIN) throw new Error('GTA delivery is available on orders of $' + CONFIG.FREE_DELIVERY_MIN + ' or more.');
    if (!address) throw new Error('Please enter your delivery address.');
  }
  const payment = d.payment === 'card' ? 'card' : 'etransfer';
  const cardFee = payment === 'card' ? cardFee_(subtotal) : 0;
  const total = round2_(subtotal + cardFee);
  return { name, email, phone, notes, items, subtotal, cardFee, total, fulfilment, address, payment };
}

/** The customer's share of the card processing fee on a given subtotal. */
function cardFee_(subtotal) {
  return round2_((subtotal * CONFIG.CARD_FEE_PERCENT + CONFIG.CARD_FEE_FIXED) * CONFIG.CARD_FEE_CUSTOMER_SHARE);
}

function appendRow_(o) {
  getSheet_().appendRow([
    o.number,
    Utilities.formatDate(o.date, CONFIG.TIME_ZONE, 'yyyy-MM-dd HH:mm'),
    'Awaiting payment',
    safeCell_(o.name), safeCell_(o.email), "'" + o.phone,
    o.items.map(i => i.qty + ' × ' + i.name).join('\n') + (o.cardFee ? '\nCard fee (customer half): $' + o.cardFee.toFixed(2) : ''),
    o.total,
    o.payment === 'card' ? 'Card (Stripe)' : 'Interac e-Transfer',
    o.fulfilment === 'delivery' ? 'GTA delivery' : 'Pickup, Hamilton',
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

function invoiceHtml_(o) {
  const rows = o.items.map(i =>
    '<tr><td>' + esc_(i.name) + '</td><td class="r">' + i.qty + '</td><td class="r">$' + i.unit.toFixed(2) +
    '</td><td class="r">$' + i.line.toFixed(2) + '</td></tr>').join('') +
    (o.cardFee ? '<tr><td colspan="3">Card processing fee (your half; we pay the other half)</td><td class="r">$' + o.cardFee.toFixed(2) + '</td></tr>' : '');
  const date = Utilities.formatDate(o.date, CONFIG.TIME_ZONE, 'MMMM d, yyyy');
  const pay = o.payment === 'card'
    ? 'Card payment through Stripe. Your Stripe receipt confirms payment.'
    : 'Interac e-Transfer of $' + o.total.toFixed(2) + ' to ' + esc_(CONFIG.ETRANSFER_EMAIL) +
      '. Put <b>' + o.number + '</b> in the message. Unpaid orders are held for ' + CONFIG.PAYMENT_HOLD_HOURS + ' hours.';
  const where = o.fulfilment === 'delivery'
    ? 'GTA delivery to: ' + esc_(o.address)
    : 'Pickup in ' + esc_(CONFIG.CITY) + ' from ' + esc_(CONFIG.PICKUP_FROM) + '. We will email the address and times.';
  return '<html><head><style>' +
    'body{font-family:Helvetica,Arial,sans-serif;color:#33210F;font-size:12px;margin:36px}' +
    'h1{font-size:26px;margin:0;color:#B8660F}.muted{color:#6E5641}' +
    'table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:8px 6px;border-bottom:1px solid #E3D5BE;text-align:left}' +
    'th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6E5641}.r{text-align:right}' +
    '.total td{font-weight:bold;font-size:14px;border-bottom:0}.box{background:#F7EFE2;padding:12px;margin-top:18px}' +
    '</style></head><body>' +
    '<table style="margin:0"><tr><td style="border:0;padding:0"><h1>' + esc_(CONFIG.BUSINESS_NAME) + '</h1>' +
    '<div class="muted">' + esc_(CONFIG.CITY) + '<br>' + esc_(CONFIG.BUSINESS_EMAIL) + ' · ' + esc_(CONFIG.PHONE) + '</div></td>' +
    '<td class="r" style="border:0;padding:0;vertical-align:top"><b style="font-size:16px">INVOICE ' + o.number + '</b><br>' +
    '<span class="muted">Order number: ' + o.number + '<br>Date: ' + date + '</span></td></tr></table>' +
    '<p style="margin-top:22px"><b>Bill to</b><br>' + esc_(o.name) + '<br>' + esc_(o.email) + '<br>' + esc_(o.phone) + '</p>' +
    '<table><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr>' + rows +
    '<tr class="total"><td colspan="3" class="r">Total (CAD)</td><td class="r">$' + o.total.toFixed(2) + '</td></tr></table>' +
    '<div class="box"><b>Payment</b><br>' + pay + '</div>' +
    '<div class="box"><b>Pickup or delivery</b><br>' + where + '</div>' +
    (o.notes ? '<div class="box"><b>Your notes</b><br>' + esc_(o.notes) + '</div>' : '') +
    '<p class="muted" style="margin-top:22px">Cancellation: full refund within 48 hours of ordering. After 48 hours, refunds are less a $10 cancellation fee. ' +
    'Qureshi & Co. is not registered for GST/HST, so no GST/HST is charged. Thank you for your order.</p>' +
    '</body></html>';
}

// ---------------- EMAILS ----------------
function emailCustomer_(o, checkoutUrl) {
  const items = o.items.map(i => '<li>' + i.qty + ' × ' + esc_(i.name) + ', $' + i.line.toFixed(2) + '</li>').join('') +
    (o.cardFee ? '<li>Card processing fee (your half; we pay the other half), $' + o.cardFee.toFixed(2) + '</li>' : '');
  let payBlock;
  if (o.payment === 'card' && checkoutUrl) {
    payBlock = '<p><b>Pay by card:</b> <a href="' + checkoutUrl + '">complete your secure Stripe payment</a>. ' +
      'If you already paid, you can ignore this link.</p>';
  } else {
    payBlock = '<p><b>Pay by Interac e-Transfer:</b> send <b>$' + (o.cardError ? o.subtotal : o.total).toFixed(2) + '</b> to <b>' + esc_(CONFIG.ETRANSFER_EMAIL) +
      '</b> and put <b>' + o.number + '</b> in the message. We hold your order for ' + CONFIG.PAYMENT_HOLD_HOURS + ' hours.</p>' +
      (o.cardError ? '<p>Our card checkout was unavailable when you ordered, so please use e-Transfer, or reply and we will send a card link.</p>' : '');
  }
  const where = o.fulfilment === 'delivery'
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
      '<p>Total: $' + o.total.toFixed(2) + '<br>Fulfilment: ' + (o.fulfilment === 'delivery' ? 'GTA delivery, ' + esc_(o.address) : 'Pickup') +
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
  if (o.cardFee) lines.push({ name: 'Card processing fee (your half; we pay the other half)', qty: 1, unit: o.cardFee });
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
function clean_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function round2_(n) { return Math.round(n * 100) / 100; }
function esc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
