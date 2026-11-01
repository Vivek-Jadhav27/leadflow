# 🚀 LeadFlow - LinkedIn Lead Clipper (Chrome Extension)

Capture leads and prospects directly from LinkedIn profiles into your **LeadFlow CRM** in one click.

---

## ✨ Features

- **⚡ 1-Click Auto-Extraction**: Automatically extracts:
  - Full Name (cleans pronouns like *(He/Him)* and professional titles like *, PhD*)
  - First Name & Last Name (intelligently separated)
  - Current Company Name (from company badge, experience, or headline)
  - Job Title / Position
  - Profile URL (clean permalink without tracking queries)
  - Profile Avatar picture
- **📋 Smart Pre-fill & Review**: Review and edit fields before saving, add phone/email, write outreach notes.
- **🔄 Instant Sequence Enrollment**: Pick which Outreach Sequence to enroll the prospect into (e.g., *LinkedIn 4-Step Outbound*).
- **⚠️ Duplicate Detection**: Warns you if you've already saved this prospect previously.
- **🟠 In-Page Floating Quick Button**: Adds a discreet `[+ Add to LeadFlow]` floating button directly on LinkedIn profiles for ultra-fast clipping.
- **🔌 Real-Time CRM Sync**: Pushes directly to LeadFlow's `/api/leads` endpoint and appears instantly in your dashboard.

---

## 🛠️ How to Install in Chrome / Brave / Edge

1. Open your browser and navigate to:
   ```
   chrome://extensions/
   ```
2. Enable **Developer mode** toggle in the upper right corner.
3. Click the **Load unpacked** button in the top left.
4. Browse to and select this folder:
   ```
   d:\LeadFlow\leadflow\extension
   ```
5. You will see **LeadFlow - LinkedIn Lead Clipper** installed with the orange **LF** icon!
6. Pin the extension to your browser toolbar for quick access.

---

## 🎯 How to Use It

1. Make sure your LeadFlow web application is running:
   ```bash
   npm run dev
   ```
   *(By default, the extension connects to `http://localhost:3000`)*.
2. Open any LinkedIn profile page:
   - Example: `https://www.linkedin.com/in/satyanadella/` or any prospect's profile.
3. Click the **LF** extension icon in your toolbar, or click the orange `[+ Add to LeadFlow]` button at the bottom-right of the LinkedIn page.
4. Notice that:
   - Name, Position, and Company are **auto-populated**.
   - Plausible work email is predicted.
5. Click **Add Lead to LeadFlow**.
6. Switch back to your LeadFlow CRM tab (`http://localhost:3000/leads`) — the new lead will automatically appear in your active leads list, enrolled in the sequence, with Step 1 tasks created!

---

## ⚙️ Configuration & Custom Server

If you deploy LeadFlow to production (Vercel, Firebase, custom domain):
1. Click the extension icon.
2. Click the ⚙️ (Settings) gear icon in the top header.
3. Update the **API Endpoint** to your hosted URL (e.g. `https://your-leadflow-app.vercel.app`).
4. Click **Save Settings**.

