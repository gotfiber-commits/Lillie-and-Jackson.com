# Wedding Website & Planner

A complete wedding site for Netlify with two parts:

- **The public wedding website** at `/` with your photos, story, event details, gallery, wedding party, travel and hotels, registry, questions and answers, and an online RSVP form.
- **The private planner** at `/app/` behind sign-in, with the budget, accounts, checklist, guests, vendors, North Alabama vendor list, day-of timeline, tips, and admin tools for the website and user accounts.

## 1. Deploy

Netlify Functions power sign-in, saving, photos and RSVPs, so deploy from Git or the Netlify CLI. Drag-and-drop deploys don't include functions.

**From GitHub (recommended)**

1. Push this folder to a new GitHub repository.
2. In Netlify, choose **Add new site > Import an existing project** and pick the repo. `netlify.toml` configures everything; no build command is needed.
3. Under **Site configuration > Environment variables**, add:

   | Variable | What it's for |
   |---|---|
   | `AUTH_SECRET` | Signs sign-in sessions. Use a long random string, e.g. `openssl rand -hex 32`. |
   | `SETUP_KEY` | A one-time key you type when creating the admin account. Pick something only you know. |

4. Trigger a new deploy so the functions pick up the variables.

**From the Netlify CLI**

```bash
npm install
npm install -g netlify-cli
netlify login
netlify init
netlify env:set AUTH_SECRET "$(openssl rand -hex 32)"
netlify env:set SETUP_KEY "choose-a-private-setup-key"
netlify deploy --build --prod
```

## 2. Create the admin account

1. Go to `https://your-site.netlify.app/app/` (or `/login`).
2. The first visit shows **Create the admin account**. Enter your `SETUP_KEY`, your name, a username and a password.
3. You're signed in as the admin. Setup can't run again once an account exists.

`SETUP_KEY` is only used for this step. You can delete it from Netlify afterward.

## 3. Build the website

In the planner, open **Website & users**.

- **Website tab**: edit the welcome text and names, your story, events (with addresses for directions), wedding party, travel and hotels, registry links, and questions and answers. Choose cover photos and a story photo. Use **Copy details from planner** to pull in names, date, city and venue.
- **Cover photo size**: in the Welcome card's Edit form, choose Banner, Standard (the default, about two-thirds of the screen) or Full screen. Smaller sizes crop close-up photos less, and the photo is positioned to keep faces near the top of the frame in view.
- **Cover slideshow**: add more than one cover photo in the Welcome card and the home page fades through them in order, changing every 6 seconds, with dots guests can tap to jump between photos. Use the arrows on each thumbnail to reorder and the X to remove.
- **Photos tab**: upload photos. They're resized in the browser to web size before uploading. Checked photos appear in the gallery in the order shown.
- **RSVP**: turn on online RSVPs, set a reply-by date, meal choices and party size.
- **Preview website** shows the draft only to admins. **Publish website** makes it public.

Questions without an answer stay hidden on the public site, so you can fill them in over time.

### Photo tips

- Use a wide landscape photo for the cover. The names sit near the bottom, so photos with faces in the upper two-thirds work best.
- A portrait (vertical) photo works best for the story section.
- Everything in the Photos tab is public once the site is published.

## 4. Invite people

Under **Website & users > People**, add accounts and choose an access level:

| Access | Can do |
|---|---|
| Admin | Everything, including people, website editing and publishing |
| Planner | Edit the budget, accounts, checklist, guests, vendors and timeline |
| Viewer | See the whole planner without changing anything |

The app shows the temporary password once so you can share it. People change their own password under **Settings > Your account**. Admins can reset a password, change access, or turn an account off, which signs that person out immediately. The site always keeps at least one active admin, and you can't remove your own admin access.

Sign-in locks for 15 minutes after 8 wrong passwords in a row.

## 5. Website RSVPs

Replies from the public form appear at the top of the **Guests** page. **Add to guest list** matches the reply to an existing guest by name (or adds a new one), records attending or declining, meal, dietary needs, contact details and plus-ones, then marks the reply handled. The dashboard shows a reminder when new RSVPs arrive.

The form has quiet spam protection (a hidden field and a minimum fill time) and closes automatically after the reply-by date.

## Upgrading from the earlier version

- `APP_USERNAME` and `APP_PASSWORD` are no longer used. Add `SETUP_KEY`, redeploy, and create the admin account as described above. You can then remove the old variables.
- Your existing planner data is kept. It stays in the same Netlify Blobs store and loads after you sign in.
- The planner moved from `/` to `/app/`. The public website now lives at `/`.

## Where data is stored

All data lives in Netlify Blobs on your site:

| Store | Contents |
|---|---|
| `wedding-auth` | User accounts. Passwords are hashed with scrypt; they're never stored in plain text. |
| `wedding-planner` | The planner (budget, accounts, guests, and everything else) |
| `wedding-site` | Website content |
| `wedding-photos` | Uploaded photos |
| `wedding-rsvps` | RSVP form replies, one record each |

Use **Settings > Download backup** in the planner now and then. Website photos aren't part of that backup, so keep your originals.

## Search engines

Both the website and planner ask search engines not to index them. To make the public website findable, remove the `robots` meta line near the top of `public/index.html`.

## Using Accounts

- **Chart of accounts**: add checking, savings, credit card or cash accounts. For credit cards, the opening balance is the amount owed. Expense categories are your budget categories.
- **Expenses and money in**: link an expense to a budget item and the Budget page counts it as paid. A vendor refund is money in linked to the item.
- **Transfers**: moving money between accounts, including paying a credit card, isn't counted as spending.
- **Bills**: enter an invoice with a due date, then pay it in full or in part.
- **Reconcile**: enter the statement date and ending balance, check off what's on the statement, and finish when the difference is zero.
- **Import CSV**: import transactions downloaded from your bank. Likely duplicates are skipped.

## Customizing

- Built-in planner templates and the North Alabama vendor list: `public/app/data.js`
- Website design: `public/site.css`
- Planner design: `public/app/styles.css`

## Security notes

- Passwords are checked on the server and stored as salted scrypt hashes.
- Sessions are HMAC-signed tokens (1 day, or 30 days with "Keep me signed in") and are checked against the account on every request, so role changes, resets and turned-off accounts take effect right away.
- Permissions are enforced by the server functions, not just hidden in the interface.
- Rotating `AUTH_SECRET` signs everyone out.

## Project layout

```
public/
  index.html, site.css, site.js   Public wedding website
  app/
    index.html, styles.css        Planner shell and styles
    app.js                        Planner core (routing, sign-in, budget, checklist, guests, vendors, timeline)
    accounting.js                 Accounts
    local.js                      North Alabama vendors
    admin.js                      Website editor, photos, people, website RSVPs
    data.js                       Templates and local listings
netlify/
  lib/auth.mjs                    Passwords, tokens, roles
  functions/
    setup.mjs   POST /api/setup         First-run admin creation
    login.mjs   POST /api/login
    me.mjs      GET/POST /api/me        Current user, change password
    users.mjs   /api/users[/:id]        Admin user management
    data.mjs    GET/PUT /api/data       Planner data
    site.mjs    GET/PUT /api/site       Website content
    photos.mjs  /api/photos[/:id]       Photo upload and serving
    rsvp.mjs    /api/rsvp[/:id]         RSVP form and replies
netlify.toml
package.json
```
