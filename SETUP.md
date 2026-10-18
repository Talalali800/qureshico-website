# Setup guide — Qureshi & Co. Maple

Two things make the website work:

1. **The website** (these files) — hosted free on GitHub Pages at https://thequreshico.ca
2. **The order system** (`apps-script/Code.gs`) — a small program that runs in *your* Google account.
   When a customer places an order on the website, it: numbers the order (QC-1001…), adds a row to a Google Sheet,
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

---

## C. Security: what is in place and what you should keep doing

**Built into the site and script**
- HTTPS only (GitHub Pages certificate, "Enforce HTTPS" on).
- A strict Content Security Policy on every page: only this site's own scripts and styles run, and the page may only talk to
  Google Apps Script (orders and shipping quotes). Injected scripts, outside images and framing are blocked.
- The page cannot be shown inside another website's frame, and it will only ever send a customer to Stripe's checkout address.
- The order script (`Code.gs`) re-checks everything on the server: prices, shipping, quantities, product codes, address fields and
  total. The website cannot change a price.
- Spam and bot protection: a hidden trap field, a minimum time on the page, 3 orders per email per hour, 40 orders per hour overall.
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
