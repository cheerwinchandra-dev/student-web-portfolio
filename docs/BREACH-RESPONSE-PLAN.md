# Data breach response plan

**Owner and responder:** Cheerwin Chandra (Grievance Officer) · cheerwinchandra@gmail.com · +91 77954 28568

A *personal data breach* is any unauthorised access to, or loss, change, disclosure or destruction of, the personal data this site holds: contact messages (names, emails, message text), consent records and the access log. Examples: someone else signs in to the dashboard, the database password leaks, a backup file is lost, or the GitHub repository or Vercel account is taken over.

Legal clocks (DPDP Rules 2025 r.7; CERT-In directions, April 2022):

| Who | When |
| --- | --- |
| **CERT-In** | within **6 hours** of noticing a cyber incident |
| **Data Protection Board of India** | without delay, then a **detailed report within 72 hours** of becoming aware |
| **Every affected person** | **without delay** |

Write down the time you first noticed the problem: every deadline starts then.

## 1. Contain it (first 30 minutes)

Do whichever of these fits:

1. **Dashboard → Security → Sign out other devices.**
2. **Change your password** (Security), or for a full reset put a new `ADMIN_PASSWORD_HASH` in Vercel (from `/admin/setup`) and redeploy. A new hash also turns two-step sign-in off: set it up again straight after.
3. **Two-step sign-in:** if your phone or recovery codes were lost, sign in and use **New recovery codes**, or turn it off and on again with a new phone.
4. **Database password:** in the Neon console, reset the database password (or create a new role), then update `DATABASE_URL` in Vercel → Settings → Environment Variables and redeploy.
5. **Other secrets:** replace `CRON_SECRET` and `GITHUB_TOKEN` in Vercel, and revoke the old GitHub token.
6. **Accounts:** change the passwords of your Vercel, GitHub, Neon and Gmail accounts and turn on two-step sign-in there. Remove any team members or devices you don't recognise.
7. **Lost backup file:** note which date it was from; that is the data affected.

## 2. Find out what happened (first 2 hours)

- Dashboard → **Security → Access log → Download all**: look for sign-ins, exports, backups or deletions you didn't do, and from which country/network.
- Vercel → your project → **Logs**, and Vercel / GitHub / Neon account security logs.
- Write down: what happened, when it started, when you noticed, what data and roughly how many people are affected, and what you have done so far. Keep this file; it is your incident record (keep it at least a year).

## 3. Report to CERT-In (within 6 hours)

- Email **incident@cert-in.org.in** (phone **1800-11-4949**, fax **1800-11-6969**). Check www.cert-in.org.in for the current incident reporting form and fill it in if one is available.
- Include: your name and contact, the website address, the type of incident, when it happened and when you noticed, what systems and data are affected, and what you have done.
- Send what you know within 6 hours, even if it is incomplete; you can send updates later.

## 4. Tell the Data Protection Board (without delay, details within 72 hours)

Use the Board's official online channel as published at the time. Send first, without delay, a short **intimation**: what happened, when, what data, how many people, likely consequences. Then, within **72 hours**, a **detailed report**: the facts, how it happened, what you did to contain it and stop it happening again, the people and data affected, and how you told those people.

## 5. Tell the people affected (without delay)

Email each affected person (from the inbox or your backup), in plain words. Template:

> **Subject:** Important: a security incident affecting your message to me
>
> Hello {name},
>
> On {date}, I found that {what happened, e.g. "someone without permission signed in to the inbox of my portfolio website"}. The information involved was {e.g. "the name, email address and message you sent me on {date}" }.
>
> What this could mean for you: {e.g. "you may receive emails pretending to be from me. I will never ask you for passwords or payments."}
>
> What I have done: {e.g. "I changed every password, signed out all devices and reported the incident to CERT-In and the Data Protection Board of India."}
>
> What you can do: {e.g. "be careful with unexpected emails that mention your message."}
>
> If you have any questions, reply to this email or contact me at cheerwinchandra@gmail.com, +91 77954 28568.
>
> Cheerwin Chandra, Grievance Officer

## 6. Afterwards

- Fix the cause (a weak or reused password, a leaked secret, a lost device).
- Delete anything that no longer needs keeping.
- Add a short "what I changed" note to the incident record.
- Read this plan again, and update it if something was missing.
