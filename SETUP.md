# Setup guide — Qureshi & Co. Maple

Two things make the website work:

1. **The website** (these files) — hosted free on GitHub Pages at https://thequreshico.ca
2. **The order system** (`apps-script/Code.gs`) — a small program that runs in *your* Google account.
   When a customer places an order on the website, it: numbers the order (QCM-1001…), adds a row to a Google Sheet,
   makes a PDF invoice in Google Drive, emails the customer and emails you.

Until step A is done, the order button shows "Online ordering opens soon."

---

## A. Turn on the order system (about 10 minutes, Google account)

1. Go to https://sheets.google.com and create a blank spreadsheet. Name it **Qureshi & Co. Orders**.
2. In the sheet: **Extensions → Apps Script**.
3. Delete the sample code. Open `apps-script/Code.gs` from this folder, copy everything, paste it in. Click **Save**.
4. At the top, choose the function **setup** and click **Run**. Google asks for permission
   (Sheets, Drive, Gmail). Click through "Advanced → Go to project (unsafe)" — it's your own script.
5. **Deploy → New deployment → ⚙ → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (starts with `https://script.google.com/macros/s/…/exec`).
6. Put that URL into `ORDER_ENDPOINT` in **both** `index.html` and `custom.html`
   (or send it to Claude and it will do this for you).
7. Test: place a small order on the live site and check the Sheet, your inbox and the customer email.

> If you later edit `Code.gs`: Deploy → **Manage deployments** → edit → **New version**. The URL stays the same.

### Optional: card payments with Stripe
Interac e-Transfer works without Stripe. To also accept cards:
1. Create a Stripe account (stripe.com).
2. In Apps Script: **Project Settings → Script properties → Add** `STRIPE_SECRET_KEY` = your secret key
   (starts `sk_live_…`; use `sk_test_…` first to try it). **Never** put this key in the website files or share it.
3. Run the function **installStripeSync** once (marks card orders "Paid" automatically).

### Colour-coded Orders sheet

Run the function **colorCodeOrders** once from the Apps Script editor (pick it in the function dropdown, click Run). Every row is then coloured by its Status:

| Colour | Status |
|--------|--------|
| Amber | Awaiting payment |
| **Red** | Awaiting payment for longer than 24 hours: follow up or cancel |
| Green | Paid |
| Blue | Packed |
| Indigo | Shipped |
| Teal | Picked up / Delivered |
| Grey, struck through | Cancelled |
| Purple | Refunded |

The Status cell is a stronger version of the row colour. Change a row's Status with the dropdown and the colour follows. Card orders turn green by themselves, and e-Transfers can too with the automatic matching below.

### Packing and shipping workflow (three lists)

An order moves through these statuses, which you change with the dropdown in the **Status** column of the **Orders** tab:

`Awaiting payment` → `Paid` → `Packed` → `Shipped` (or `Picked up` / `Delivered`)

Three tabs show your to-do lists. They are live views of the Orders tab, so you never type in them. Change a Status and the order moves to the next list by itself:

| Tab | Shows orders with Status | What it is for |
|-----|--------------------------|----------------|
| **To pack** | Paid | Paid and waiting for you to pack. Shows name, phone, items, pickup/delivery/shipping, address and notes. |
| **To ship** | Packed | Packed and waiting to be posted or handed over. Shows the packed date and tracking number. |
| **Shipped & completed** | Shipped, Picked up, Delivered | Your record of everything that has gone out, newest first, with packed date, shipped date and tracking number. |

Dates are written for you in the Orders tab when you change a Status: **Paid on**, **Packed on**, and **Shipped / handed over on**. Type the Canada Post number in the **Tracking #** column (column Q) before you set the order to Shipped.

**After pasting a new `Code.gs`, run `setup` once** (pick it in the function dropdown, click Run). It adds the new columns and the three tabs, updates the Status dropdown and the colours. It is safe to run again. It does not touch your orders or your order-number counter.

### Automatic e-Transfer matching

When a customer pays by Interac e-Transfer, the script can mark their order **Paid** for you. It works like this: your bank/Interac emails you a "sent you money" notice at `Talal.Ali@thequreshico.ca`. A forwarding rule copies **only Interac notices** to the Google account that owns this script (the Gmail where Apps Script runs). Every 10 minutes the script reads those notices and matches them to orders. The script runs in your own Google account and nothing else can read your mailbox.

An order is marked Paid **only when all of these are true**:
1. The email is from an `interac.ca` address **and Gmail's own check confirms it genuinely came from Interac** (this stops forged emails).
2. The customer put the order number (like `QCM-1004`) in the e-Transfer message.
3. That order exists, is still **Awaiting payment**, and was meant to be paid by e-Transfer.
4. The amount in the email equals the order total.

If anything does not line up (wrong amount, no order number, a payment for a cancelled order, an email that cannot be verified), **nothing is changed** and you get an email explaining why, so you can check your bank and set the Status yourself.

**Set it up**
1. **Forward Interac notices.** In IONOS webmail open the settings for your `Talal.Ali@thequreshico.ca` mailbox and create a **rule/filter**: *if the sender contains `interac.ca`, forward a copy to the Gmail address that owns the script.* Forward only these emails, not your whole mailbox. (Menu names differ slightly between IONOS versions: look for *Rules*, *Filters* or *Forwarding*.) In Gmail, also make a filter *from: interac.ca → Never send to spam*.
2. **Wait for the next e-Transfer notice** (or have a friend send you a small one with a test order number in the message). Check that it arrives in the Gmail inbox.
3. **Dry run.** In Apps Script run **previewEtransfers** and read the log (View → Logs / Execution log). It lists each Interac email and what the script *would* do, and says whether Gmail confirms the sender. It changes nothing. Google asks you to approve Gmail access the first time.
4. **Switch it on.** Run **installEtransferSync** once. From then on it checks every 10 minutes. Handled emails get a Gmail label (`QCM-etransfer-done` or `QCM-etransfer-review`).

If the dry run says Gmail could **not** confirm the sender for a genuine email, the forwarding changed the message. Ask me to adjust it, or temporarily set `ETRANSFER_REQUIRE_DKIM` to `false` in the settings at the top of `Code.gs` (only if you accept that a forged email could then mark an order Paid).

### Shipping across Canada with Canada Post (live rates)

Customers can choose **Ship anywhere in Canada**. They enter a postal code and see Canada Post prices
(Regular Parcel, Expedited Parcel, Xpresspost). The script adds a 1% markup (`SHIP_MARKUP` in `Code.gs`) and
recalculates the price on the server, so the website cannot change it. Customers never see the markup.

**Until the Canada Post keys are added, every shipped order is charged a flat $16.99** (`SHIP_FALLBACK`),
so ordering still works.

1. In the Canada Post **Developer Portal**, open **Apps**, create an app and subscribe it to **Rating 4.0.0**.
   Use a **Production** app (a Test app returns made-up prices). The app gets a **Client ID** (API key) and a **Client Secret**.
   The secret is shown only once, so save it in a password manager.
2. In Apps Script: **Project Settings (⚙) → Script properties → Add script property**. Add:

   | Property | Value |
   |----------|-------|
   | `CP_CLIENT_ID` | the app's Client ID (API key) |
   | `CP_CLIENT_SECRET` | the app's Client Secret |
   | `CP_CUSTOMER_NUMBER` | your Canada Post customer number (gets your small-business "commercial" prices; without it you get regular counter prices) |
   | `CP_CONTRACT_ID` | *(only if you have a contract number; leave out otherwise)* |

   These stay private inside Apps Script. Never put them in the website files or share them.
3. Paste the updated `Code.gs` and publish: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**.
4. Test: on the site choose "Ship anywhere in Canada", add a box and enter a postal code. You should see
   Canada Post options (not just "Standard shipping").
   If you only see "Standard shipping" at the flat price, open **Executions** in Apps Script and look for a line
   starting "Canada Post:" . It says what went wrong (wrong keys, app not subscribed to Rating, and so on).

How it talks to Canada Post: it first gets a short-lived access token (OAuth 2.0 client credentials) and then asks the
Rating API for prices as JSON. Tokens and prices are cached so the site stays fast.

**Box weights and sizes are estimates.** Weigh and measure each packed box, then edit `SHIP_SPECS` near the top of
`Code.gs` (`kg` and `l`/`w`/`h` in centimetres). Custom boxes estimate each item's weight from its size, plus the gift box
(`SHIP_GIFTBOX`). Accurate numbers mean accurate prices. Orders over 30 kg ask the customer to contact you.

**Origin postal code** is `L8G4R2` (`SHIP_ORIGIN_POSTAL`). It is only used to ask Canada Post for a rate.

**Outside Canada:** the site invites customers to email you for a special order.

---

## B. Put the website on your domain (GitHub Pages + IONOS)

### B1. GitHub
1. Repo → **Settings → Pages**.
2. Source: **Deploy from a branch** → Branch: `main` / `(root)` → Save.
3. Custom domain: `thequreshico.ca` → Save. Tick **Enforce HTTPS** once it becomes available
   (can take up to an hour after DNS is set).

### B2. IONOS DNS  (Domains → thequreshico.ca → DNS)
**Only touch the website records. Do NOT change MX, SPF/TXT or DKIM records — those run your email.**

Add / replace these:

| Type  | Host (name) | Value |
|-------|-------------|-------|
| A     | @           | 185.199.108.153 |
| A     | @           | 185.199.109.153 |
| A     | @           | 185.199.110.153 |
| A     | @           | 185.199.111.153 |
| CNAME | www         | talalali800.github.io |

Delete any *existing* `A` record for `@` and any `AAAA` record for `@` or `www` that point to IONOS
parking/website-builder servers, and the old `CNAME` for `www` if it points elsewhere.
Changes can take from a few minutes up to 24 hours.

(GitHub's current IP list is at
https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site —
check it if these ever stop working.)

### B3. Check
- https://thequreshico.ca loads the store, and https://www.thequreshico.ca redirects to it.
- Email to contact@thequreshico.ca still works.

### Bot protection with Cloudflare Turnstile (free)

Turnstile is Cloudflare's invisible "are you a human" check. It stops scripts from flooding the order form with fake orders.
It is **off until you add both keys**, so the shop keeps working in the meantime.

1. Create a free account at cloudflare.com, then open **Turnstile** (left menu) → **Add widget**.
2. Widget name: "Qureshi orders". Hostnames: add `thequreshico.ca` (and `www.thequreshico.ca`). Widget mode: **Managed**. Create it.
3. Cloudflare shows a **Site key** (public) and a **Secret key** (private).
4. **Site key:** put it in `turnstile.js` (the line `var SITE_KEY = "";`) and push the website to GitHub. (Or send the site key to Claude.)
5. **Secret key:** in Apps Script, **Project Settings → Script properties → Add**: name `TURNSTILE_SECRET`, value = the secret key.
   Never put the secret in any file or share it.
6. Paste the latest `Code.gs` and publish a **New version** (do this after step 4 is live, and add the secret last).
7. Test: place a small order. It should work with no visible puzzle. Orders posted straight to the script URL without a valid token are refused.

If customers ever report "the security check has not finished", it usually means an ad blocker is blocking challenges.cloudflare.com.
To switch Turnstile off again, delete the `TURNSTILE_SECRET` property in Apps Script.

---

## C. Security: what is in place and what you should keep doing

**Built into the site and script**
- HTTPS only (GitHub Pages certificate, "Enforce HTTPS" on).
- A strict Content Security Policy on every page: only this site's own scripts and styles run, and the page may only talk to
  Google Apps Script (orders and shipping quotes). Injected scripts, outside images and framing are blocked.
- The page cannot be shown inside another website's frame, and it will only ever send a customer to Stripe's checkout address.
- The order script (`Code.gs`) re-checks everything on the server: prices, shipping, quantities, product codes, address fields and
  total. The website cannot change a price.
- Spam and bot protection: a hidden trap field, a minimum time on the page, optional Cloudflare Turnstile (section above), 3 orders per email per hour, 40 orders per hour overall.
- All customer text is escaped before it goes into invoices and emails, and spreadsheet cells starting with `=`, `+`, `-` or `@`
  are neutralised so they cannot run as formulas.
- Error messages shown to visitors never include internal details. Secret keys live only in Apps Script **Script properties**.

**When you change `Code.gs` or the pages**
1. Push the website files to GitHub first, then paste the new `Code.gs` into Apps Script and publish a **New version**.
   (The script now expects the website to send a short timing value with each order, so an old page would be refused.)
2. Never put a Stripe key, Canada Post secret or password in any file in this repository. The repository is public.

**Your accounts are the real front door. Please do all of these**
- Turn on **2-step verification** for: your Google account (it owns the orders sheet and invoices), GitHub, Stripe, IONOS and Canada Post.
- Use a **different, long password** on each (a password manager helps).
- Use a Stripe **restricted key** (Checkout Sessions: Write only), never the full secret key. If a key might have leaked, delete it in Stripe and make a new one.
- In Google Drive, keep the invoices folder and the orders sheet **private** (not "anyone with the link").
- In GitHub, only you should be a collaborator on the repository.
- Remove old DNS records you no longer use (for example the old `merchant` record), because forgotten records can be taken over.
- Optional email protection: your `_dmarc` record is set to monitor only (`p=none`). Once you are sure all your email is working, ask IONOS
  support or change it to `p=quarantine` so fake emails pretending to be you are sent to spam.
- Check the Stripe dashboard and the orders sheet now and then for orders you do not recognise.
