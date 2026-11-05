# Cheerwin Chandra · Portfolio (GitHub → Vercel)

Your AI/ML engineer portfolio, with:

- **Smooth animations**, including the coloured cursors that build each section as you scroll.
- **Projects that update themselves** from your GitHub account (`cheerwinchandra-dev`), plus Alice and ZenPagoda.
- **A contact form** whose messages are saved in your own database.
- **A private dashboard at `/login`.** Only you can sign in. Read and reply to messages, choose which projects show, edit every word on the site.
- **Privacy compliance for India** (DPDP Act 2023 and Rules 2025, IT Rules 2011, CERT-In): a Privacy Policy and Terms page, consent boxes on the form, a privacy-choices banner, a Grievance Officer, automatic deletion of old data, a one-year access log, backups, two-step sign-in and a written breach plan. **[COMPLIANCE.md](COMPLIANCE.md)** maps every item of the Rinisha checklist to what was done, and lists the few things only you can do.

It runs on **Vercel** (free Hobby plan) with a free **Neon Postgres** database.

---

## 1. Put it online (about 15 minutes, no terminal needed)

### Step 1: Put the code on GitHub
1. **Unzip** `cheerwin-portfolio-vercel.zip` (Windows: right-click → **Extract All**; Mac: double-click). Open the folder it creates. Inside you should see the folders **`api`**, **`docs`**, **`lib`**, **`public`** and **`scripts`**, and the files **`package.json`**, **`package-lock.json`**, **`vercel.json`**, `README.md` and `COMPLIANCE.md`.
2. On [github.com/new](https://github.com/new), create a repository, for example `portfolio`. **Private** is fine (and recommended). Don't add a README there. Click **Create repository**.
3. On the new repository's page, click **uploading an existing file**.
4. In the unzipped folder, select **everything inside it** (**Ctrl+A**, or **⌘A** on a Mac) and drag it onto the GitHub page, so the folders go up as folders. Don't upload the .zip file itself, and don't upload `node_modules` or any `.env.local` file if you have them.
5. Wait until every file is listed, then click **Commit changes**.
6. Check the repository's main page: `api`, `docs`, `lib`, `public`, `scripts`, `package.json` and `vercel.json` must be listed **at the top level**. If you see loose files such as `router.js` or `site.css` there instead, or everything sits inside one extra folder, the structure was lost; delete the repository and upload again as in item 4.

### Step 2: Import it into Vercel
1. On [vercel.com/new](https://vercel.com/new), sign in with GitHub, pick your `portfolio` repository and click **Import**. (If it isn't listed, click **Adjust GitHub App Permissions** and allow that repository.)
2. Leave every setting as it is. Vercel reads `vercel.json`: no framework, build command `npm run build`, output folder `public`, Node.js 24.
3. Click **Deploy**. When it finishes, your site is live at an address like `https://portfolio-xyz.vercel.app`. The pages work straight away; the contact form and sign-in need steps 3 and 4.

### Step 3: Add the database
1. In your Vercel project, open **Storage** → **Create Database** (or **Connect Database**) → choose **Neon** (Serverless Postgres) → **Continue**.
2. Keep the free plan. For the region, choose **Washington, D.C., USA (East)**, which is where Vercel runs the site's API by default.
3. Click **Create**, then connect it to your project for **all environments**. Keep the default settings, so Vercel adds `DATABASE_URL` for you. The tables are created automatically on first use.

### Step 4: Set your admin password
1. Open **`https://<your-site>/admin/setup`**, type a password twice and click **Create values**. It must have at least 10 characters with letters and numbers. Everything happens in your browser; nothing is sent anywhere. Use a password you don't use anywhere else, and never write it in a README or a repository description.
2. In Vercel, open **Settings** → **Environment Variables** and add both values from that page, for all environments:
   - `ADMIN_PASSWORD_HASH`
   - `CRON_SECRET`
3. Open **Deployments** → the newest deployment → **⋯** → **Redeploy**. New settings only apply after a redeploy.

### Step 5: Sign in and turn on two-step sign-in
1. Sign in at **`https://<your-site>/login`** with username **`cheerwin`** and your password.
2. The inbox asks you to turn on **two-step sign-in** first, because it holds other people's personal data. Click **Set up two-step sign-in**, scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or your password manager) and type the 6-digit code.
3. **Save the 8 recovery codes** it shows (Download or Copy). Each one signs you in once if you lose your phone.

From now on, signing in needs your password and the current code from the app.

### Step 6: Check your privacy details
Open `https://<your-site>/privacy`. The Grievance Officer section shows your name, email (`cheerwinchandra@gmail.com`) and phone (`+91 77954 28568`), because the checklist asks for both. If you would rather not show your phone number, delete that line in `public/privacy.html` on GitHub (pencil icon → edit → **Commit changes**); the email alone also works. Then read **COMPLIANCE.md** for the list of things only you can do.

> Prefer the terminal? `npm install`, then `npm run hash-password` prints the same two values. With the Vercel CLI: `npx vercel`, `npx vercel env add ADMIN_PASSWORD_HASH`, `npx vercel --prod`.

Every time you change something on GitHub, Vercel publishes it automatically.

## 2. Everyday use (no code needed)

| You want to… | Go to |
| --- | --- |
| Read messages | `/login` → **Inbox**. Refreshes every 20 seconds. Each message shows its reference number and consent record. |
| Reply | Open the message → **Reply by email** |
| Handle a privacy request ("show / correct / delete my data") | Messages with the topic **Privacy / data request**. Reply within 30 days. To delete someone's data, open their message → **Delete**; the access log keeps only a note of the reference. |
| Keep a backup | Inbox → **Backup** (one file with everything) or **Export CSV**. Do it every week and keep the file somewhere private. |
| Choose which projects show | **Projects** → *Pin*, *Show* or *Hide*, then *Edit card* |
| Show a new GitHub repo right now | **Projects** → **Sync with GitHub now** |
| Change your text, services, tools | **Profile** → edit → **Save changes** |
| Password, two-step sign-in, devices, access log | **Security** |

What runs by itself every day: the GitHub refresh, deleting messages older than 365 days and access-log entries older than 400 days, and clearing expired sessions and spam counters.

## 3. Forgot your password, or lost your phone?

- **Lost your phone:** sign in with one of your recovery codes instead of the 6-digit code, then **Security** → **Turn off** and set it up again on the new phone.
- **Forgot the password, or lost both phone and recovery codes:** open `/admin/setup`, create new values, replace `ADMIN_PASSWORD_HASH` in Vercel and redeploy. A new `ADMIN_PASSWORD_HASH` always takes over, and it also turns two-step sign-in off, so set it up again after signing in.

## 4. Changing the code or photos

```bash
npm install
npm run hash-password -- --local   # once: saves a test password in .env.local
npm run dev                        # open http://localhost:3000
```

`npm run dev` uses a separate local database in `.data/`, so testing never touches your real messages. Locally you can add `INBOX_WITHOUT_TWO_STEP=1` to `.env.local` to open the inbox without two-step sign-in; never set that in Vercel.

- **Photos** are in `public/img/` (keep the same file names).
- **Default text** is in `public/js/shared/defaults.js` (you normally edit text in the dashboard).
- **Privacy Policy / Terms** are `public/privacy.html` and `public/terms.html`. If you change how data is handled, update the page, its date, and `PRIVACY_VERSION` in `public/js/shared/defaults.js`.
- **Never add analytics or ad scripts** (including Vercel Web Analytics) without first adding them to the Privacy Policy and the privacy-choices banner (`public/js/privacy.js`), so they load only after consent.

## 5. Optional extras

- **Your own domain:** Vercel → **Settings** → **Domains** → **Add**, then redeploy.
- **More reliable GitHub updates:** create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) with *Public repositories (read-only)* and add it as `GITHUB_TOKEN`.

## Security and privacy

| Protection | How |
| --- | --- |
| HTTPS | Vercel serves everything over HTTPS; HSTS (2 years) and `upgrade-insecure-requests` keep it that way. |
| Password storage | Only a salted **PBKDF2-SHA256** hash (310,000 rounds). Passwords need 10+ characters with letters and numbers, without your username or easy words. |
| Two-step sign-in | 6-digit codes from an authenticator app (RFC 6238), each usable once, plus 8 one-time recovery codes. The app secret is stored encrypted (AES-GCM) with a key that only exists in Vercel. **The inbox and backups stay closed until it is on.** |
| Guessing attacks | 5 wrong passwords or codes lock sign-in from that network for 15 minutes, doubling on repeats (up to 24 hours); 30 failures from anywhere pause all sign-ins for 10 minutes. |
| Sessions | Random 256-bit token in an `HttpOnly`, `Secure`, `SameSite=Strict`, `__Host-` cookie; only its hash is stored. Signed out after 2 hours idle or 12 hours at most. Turning on two-step or changing the password signs out other devices. |
| CSRF, XSS, clickjacking | Changes must come from your own domain; visitors' text is always shown as plain text; strict Content Security Policy, `frame-ancestors 'none'` and the other headers in `vercel.json`. |
| Consent | Unticked consent and 18+ boxes on the form; the server refuses messages without them. Each message stores when, which Privacy Policy version, and the 18+ confirmation. |
| Minimal data | IP addresses only as a salted one-way fingerprint (rate limits) or masked (`103.21.x.x`) in the access log. No analytics, no ads, no tracking cookies. Visitors' browsers contact GitHub only if they allow it. |
| Retention | Messages deleted after 365 days, access log after 400 days (at least the one year the rules ask for), automatically every day. |
| Access log | Sign-ins (with or without a two-step code), two-step changes, exports, backups and deletions, downloadable as CSV. |
| Spam | Honeypot field, minimum time on the page, 5 messages per hour per network, 300 per day, duplicate detection, 5-link limit. |
| Daily job | Vercel calls `/api/cron/daily` once a day. With `CRON_SECRET` set (step 4), Vercel signs the call and nobody else can run it; without it, the job runs at most once every 10 minutes. |

## Troubleshooting

| Message | Fix |
| --- | --- |
| Build log: "Some files or folders are missing from your GitHub repository" | The folders didn't reach GitHub as folders, or they sit one level too deep. Redo Step 1, item 4. |
| Your `vercel.app` address shows "404: NOT_FOUND" | No deployment has finished yet. Open **Deployments** → the newest one → read its build log. |
| "Sign-in is not set up yet" | Add `ADMIN_PASSWORD_HASH` (step 4), then redeploy. |
| "The database is not connected yet" | Connect Neon in the Storage tab (step 3), then redeploy. |
| Inbox says "Turn on two-step sign-in to open your inbox" | That is on purpose: do step 5. |
| "That code is not right" | Use the newest code, and make sure your phone sets its time automatically. |
| "Too many failed attempts" | Wait for the time shown, or switch networks (mobile data instead of Wi-Fi). |
| Projects don't show a new repo | **Projects** → **Sync with GitHub now**; if GitHub can't be reached, add a `GITHUB_TOKEN`. |

## What's inside

```
public/              the website (served as-is by Vercel)
  index.html         portfolio page
  privacy.html       Privacy Policy (DPDP notice, Grievance Officer, cookies)
  terms.html         Terms of use
  admin/             dashboard (index.html) and password setup (setup.html)
  js/privacy.js      privacy-choices banner
  js/agents.js       the cursor animation
  css/ fonts/ img/ js/shared/
api/router.js        the one Vercel Function (every /api/* request goes here)
lib/                 server code: routes, sign-in, two-step (totp.js), retention, rate limits, validation, GitHub, database
scripts/             build step, local dev server, hash-password
docs/                BREACH-RESPONSE-PLAN.md (what to do if data leaks)
COMPLIANCE.md        the Rinisha checklist, item by item
vercel.json          security headers, URL rules, the API rewrite and the daily job
```

Fonts: Anton, DM Serif Display, Manrope and Mrs Saint Delafield (SIL Open Font License). Smooth scrolling: Lenis (MIT). QR codes: qrcode-generator (MIT).
