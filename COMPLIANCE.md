# Privacy compliance: the Rinisha checklist, item by item

This maps every item of the *Website Compliance Checklist (India 2026)* to what this site does. It is based on the Digital Personal Data Protection (DPDP) Act 2023, the DPDP Rules 2025, the IT (Reasonable Security Practices) Rules 2011, the Consumer Protection (E-Commerce) Rules 2020, the CCPA dark-patterns guidelines 2023 and the CERT-In directions 2022.

**This is not legal advice.** It is a careful implementation of a general checklist for a personal portfolio. Have a qualified lawyer review `public/privacy.html` and `public/terms.html` before you rely on them, especially if you start selling services through the site. Core DPDP duties and penalties apply from **13 May 2027** (the government has proposed bringing this forward; check for a newer notification).

Legend: ✅ done in the code · 👤 your job (the code can't do it for you) · ➖ doesn't apply to this site (and why)

## 1. Privacy Policy (DPDP Act s.5, Rules r.3, IT Rules r.4)

| Item | Status | Where |
| --- | --- | --- |
| Privacy Policy linked in the footer of every page and next to every form | ✅ | `/privacy`. Footer of the portfolio, Privacy and Terms pages, the 404 page, the sign-in card, the setup page and the dashboard sidebar. The contact form links it inside the consent box. |
| Lists each type of data collected | ✅ | "What I collect" table: name, email, topic, message, consent record, network fingerprint, country, browser type, hosting logs, browser storage |
| Specific purpose for each | ✅ | Same table, "Why" column |
| How long data is kept, and who it is shared with | ✅ | "Kept for" column (12 months, 400 days, 7 days…); "Who sees your data" (Vercel, Neon, Google Gmail, GitHub) |
| How to withdraw consent, use rights and complain to the Data Protection Board | ✅ | "Your rights" section |
| Security practices and a "last updated" date | ✅ | "How I keep your data safe"; date and version at the top |
| Notice available in English or an Eighth Schedule language (s.5(3)) | ✅ | "Who I am" section offers any of the 22 languages on request. 👤 If someone asks, send them a translation. |

## 2. Consent, done properly (DPDP Act s.6, Rules r.3)

| Item | Status | Where |
| --- | --- | --- |
| No pre-ticked boxes | ✅ | Both boxes on the contact form start unticked and are never saved in the draft. The server refuses a message unless both are exactly `true`. |
| Marketing consent separate from the service | ✅ | There is no marketing at all; the form says "No marketing, ever." |
| Withdrawing as easy as giving | ✅ | One email, or the form with topic "Privacy / data request" (Privacy Policy → Your rights). |
| Record of who consented, to what, and when | ✅ | Each message stores `consent_at`, `consent_version` (the Privacy Policy version) and `adult_confirmed`, plus a reference number. Shown in the inbox, included in the CSV and Backup. |

## 3. Grievance Officer and contact (DPDP s.8(9)-(10), Rules r.9, r.14; IT Rules r.5(9))

| Item | Status | Where |
| --- | --- | --- |
| Name, designation, email and phone on the website | ✅ | `/privacy#grievance`: Cheerwin Chandra, Owner and Grievance Officer, email and phone. Linked as "Grievance Officer" in every footer. |
| Simple way to complain, ideally with a ticket number | ✅ | The contact form gives every sender a reference number like `CC-7KQ2-M9XD`. |
| Answer within the legal time | ✅ / 👤 | The site promises acknowledgement within 2 working days and resolution within 30 days (well inside the DPDP limit). **You must actually reply in time.** |

## 4. Cookies and tracking (DPDP s.5, s.6; best practice)

| Item | Status | Where |
| --- | --- | --- |
| Banner on the first visit with equally easy Accept, Reject and Choose | ✅ | `public/js/privacy.js`. The three buttons are the same size and style (tested). |
| Non-essential trackers load only after consent | ✅ | There are no trackers. The one optional item (the visitor's browser loading projects straight from GitHub when the server is down) runs only after "Accept" or "Choose" (tested: no request to GitHub otherwise). |
| Privacy Policy names the tools | ✅ | "Cookies and browser storage" table names every cookie and storage key. |
| Change the choice later | ✅ | "Privacy choices" in every footer, and a button on the Privacy page. |
| 👤 | | If you ever add analytics, ads, chat widgets or embeds, add them to the banner and the Privacy Policy first so they wait for consent. |

## 5. Terms and Conditions (Contract Act 1872; IT Intermediary Rules r.3)

| Item | Status | Where |
| --- | --- | --- |
| Services, pricing and payment, cancellations, limits of liability | ✅ | `/terms`: no sales or payments on the site; real work goes under a separate written agreement; liability limits. |
| Governing law, jurisdiction, disputes | ✅ | Laws of India, courts at Bengaluru, Karnataka; informal resolution first. |
| User content rules | ➖ | Visitors can't publish anything; messages are private. The Terms still set rules for what may be sent. |
| Users agree at sign-up or checkout | ✅ | The form says "By sending, you accept the Terms of use", next to the unticked consent box. |

## 6. Selling online (E-Commerce Rules 2020 r.4–6; dark patterns 2023)

| Item | Status | Why |
| --- | --- | --- |
| Return, refund, shipping, warranty policies; price break-up; payment modes; country of origin | ➖ | The site sells nothing and takes no payments (stated in the Terms). 👤 If you ever add paid services or a shop, these become required. |
| Legal name, address, customer care, Grievance Officer | ✅ | Name, city and contact on the Privacy and Terms pages. |
| No dark patterns | ✅ | No countdowns, hidden charges, fake reviews, pre-ticked boxes or tricky banners. Reject is as easy as Accept. |

## 7. Children's data (DPDP Act s.9, Rules r.10)

| Item | Status | Where |
| --- | --- | --- |
| Ask for age where children could use the service | ✅ | Required, unticked "I am 18 or older" box; under-18s are told to ask a parent or guardian to get in touch. |
| Verifiable parental consent for under-18s | ✅ | The site doesn't accept children's data at all; the Privacy Policy says any received without consent is deleted. 👤 If you learn a sender is under 18, delete the message. |
| No tracking or targeted ads aimed at children | ✅ | No tracking or ads for anyone. |
| Nothing harmful to a child's well-being | ✅ | — |

## 8. Data security and breach response (DPDP s.8(5)-(6), Rules r.6-7, CERT-In 2022)

| Item | Status | Where |
| --- | --- | --- |
| Whole site on HTTPS | ✅ | Vercel's HTTPS plus HSTS (2 years) and `upgrade-insecure-requests` (`vercel.json`). |
| Access control, strong passwords and 2-step login | ✅ | Owner-only dashboard; passwords ≥ 10 characters with letters and numbers (enforced on the setup page, the script and the dashboard); two-step sign-in with an authenticator app, **required before the inbox or backups open**; lockouts after 5 wrong tries. |
| Sensitive data encrypted or masked | ✅ | HTTPS in transit; Neon encrypts at rest; IPs stored only as a salted one-way hash or masked; the two-step secret is encrypted with AES-GCM; passwords and session tokens only as hashes. |
| Regular backups | ✅ / 👤 | Dashboard → **Backup** downloads everything as one file. **Download it every week** and keep it somewhere private (an encrypted drive), deleting old copies. |
| Access logs kept at least 1 year | ✅ | Sign-ins, two-step changes, exports, backups and deletions, kept 400 days (Security → Access log, downloadable). |
| Contracts with vendors that require security | 👤 | **Partly a paid-plan matter.** Vercel's Data Processing Addendum ([vercel.com/legal/dpa](https://vercel.com/legal/dpa)) covers its **Pro and Enterprise** plans; on the free Hobby plan only Vercel's Terms and Privacy Policy apply. Neon publishes a DPA at [neon.com/dpa](https://neon.com/dpa); check that it covers your plan. Free Gmail has no DPA (Google Workspace does). For a signed security contract with every vendor, move to Vercel Pro and a business email. Save PDF copies of whatever terms apply. |
| Written breach plan; tell users and the Board (detailed report within 72 hours) | ✅ / 👤 | [`docs/BREACH-RESPONSE-PLAN.md`](docs/BREACH-RESPONSE-PLAN.md), summarised in the Privacy Policy. Read it once now so you know what to do. |
| Report cyber incidents to CERT-In within 6 hours | ✅ / 👤 | Contacts and steps in the breach plan. |

## Beyond the 8

| Item | Status | Where |
| --- | --- | --- |
| User rights: summary, correction, deletion, nominee (s.11–14) | ✅ / 👤 | Privacy Policy → Your rights. To delete: open the message → Delete. To give a summary: Export CSV and send that person's rows. |
| Delete when done (s.8(7), Rules r.8) | ✅ | The daily job (`lib/retention.js`, `/api/cron/daily` in `vercel.json`) deletes messages after 365 days and logs after 400 days. Deleting a message on request removes it at once. 👤 Also delete their emails from your Gmail. |
| Keep records (Rules r.6, 7th Schedule) | ✅ | Consent records with each message; access log for 400 days; deletions logged with the reference only. |
| Large platforms: erase inactive users after 3 years | ➖ | Not a large platform and has no user accounts. |

## Your to-do list (only you can do these)

1. Finish README steps 1–6, including **two-step sign-in** and saving the **recovery codes**.
2. Decide whether your **phone number** stays on `/privacy` (the checklist asks for email + phone).
3. Read the **data-processing terms** of Vercel, Neon and your email provider and save copies. On free plans there may be no signed DPA (Vercel's covers Pro and Enterprise only); upgrade if you need one.
4. Download a **Backup** every week and store it privately.
5. Answer **privacy requests within 30 days** (acknowledge within 2 working days).
6. Read the **breach plan** once, and save the CERT-In contacts in your phone.
7. Before adding analytics, ads, embeds or paid services, update the Privacy Policy, the banner and (for sales) the Terms first.
8. Ask a lawyer to review the Privacy Policy and Terms, and recheck the rules before **13 May 2027**.
9. Remove the old password from your public `eduriskgaurd` GitHub README, and never reuse it.
