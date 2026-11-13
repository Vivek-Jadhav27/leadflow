# LeadFlow CRM — Complete Sample Data Reference

This document catalogs all sample, seed, and prototype data utilized throughout the **LeadFlow** application across the prototype store, auth provider, interactive walkthrough canvas, workflow decision visualizer, extension capture simulators, and system constants.

---

## Table of Contents

1. [Architecture & Storage Keys](#1-architecture--storage-keys)
2. [Authenticated Prototype Accounts](#2-authenticated-prototype-accounts)
3. [Workspace Settings](#3-workspace-settings)
4. [Team Members & Pending Invites](#4-team-members--pending-invites)
5. [Sample Leads (12 Seeded + 1 Extension Simulation)](#5-sample-leads)
6. [Outbound Sequences & Message Templates](#6-outbound-sequences--message-templates)
7. [Scheduled Tasks](#7-scheduled-tasks)
8. [Activity Timeline Events](#8-activity-timeline-events)
9. [Journey Decision Tree Nodes & Transitions](#9-journey-decision-tree-nodes--transitions)
10. [Visual Sequence Workflow Graph](#10-visual-sequence-workflow-graph)
11. [System Constants & Taxonomies](#11-system-constants--taxonomies)

---

## 1. Architecture & Storage Keys

LeadFlow operates in zero-friction prototype mode with live browser persistence:

| Resource | File Source | Storage Key | Initial Seed Source |
| :--- | :--- | :--- | :--- |
| **CRM Prototype DB** | `src/services/prototypeStore.ts` | `leadflow_hubspot_crm_db_v3` | `SEEDED_LEADS`, `SEEDED_SEQUENCES`, `SEEDED_TASKS`, `SEEDED_ACTIVITIES`, `SEEDED_TEAM_MEMBERS`, `SEEDED_SETTINGS` |
| **User Session** | `src/context/AuthProvider.tsx` | `leadflow_auth_user_v3` | `ADMIN_USER`, `SDR_USER` |
| **Decision Tree Walkthrough** | `src/components/walkthrough/JourneyDecisionTree.tsx` | In-memory reactive state | `NODES_DATA`, `EDGES_DATA` |
| **Workflow Canvas Graph** | `src/components/workflow/WorkflowCanvas.tsx` | Dynamic compute | 11 graph nodes & 11 branching edges |

---

## 2. Authenticated Prototype Accounts

Defined in `src/services/prototypeStore.ts` and managed via `src/context/AuthProvider.tsx`:

### Quick-Login Personas

```json
[
  {
    "uid": "user_admin_marcus",
    "email": "admin@leadflow.io",
    "displayName": "Marcus Sterling",
    "photoURL": null,
    "role": "admin",
    "title": "Workspace Owner & Admin"
  },
  {
    "uid": "user_sdr_alex",
    "email": "sdr@leadflow.io",
    "displayName": "Alex Rivera",
    "photoURL": null,
    "role": "sdr",
    "title": "Outbound SDR & Account Specialist"
  }
]
```

*Note: Any email entered on the login screen automatically creates an SDR account session.*

---

## 3. Workspace Settings

Default organization configuration in `src/services/prototypeStore.ts`:

```json
{
  "name": "LeadFlow B2B Outbound",
  "domain": "leadflow.io",
  "timezone": "America/New_York (UTC-5)",
  "currency": "USD ($)",
  "defaultAssignmentRule": "round_robin",
  "defaultFollowupDays": 3,
  "workHoursStart": "09:00",
  "workHoursEnd": "18:00",
  "skipWeekends": true,
  "stopSequenceOnReply": true,
  "dailyLinkedInConnectLimit": 25,
  "dailyLinkedInMessageLimit": 50
}
```

---

## 4. Team Members & Pending Invites

### Active Team Members (`SEEDED_TEAM_MEMBERS`)

| ID | Name | Email | Role | Title | Initials | Leads | Active Seq | Completed Tasks/Wk | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `user_admin_marcus` | Marcus Sterling | `admin@leadflow.io` | `admin` | Workspace Owner & Admin | `MS` | 4 | 3 | 22 | `active` |
| `user_sdr_alex` | Alex Rivera | `sdr@leadflow.io` | `sdr` | Outbound SDR | `AR` | 5 | 2 | 31 | `active` |
| `user_sarah_connor` | Sarah Connor | `sarah@leadflow.io` | `sdr` | Lead SDR & Operations | `SC` | 3 | 2 | 18 | `active` |
| `user_maya_lin` | Maya Lin | `maya@leadflow.io` | `sdr` | Outbound Specialist | `ML` | 3 | 1 | 14 | `away` |

### Simulated Pending Teammate Invitations (`src/app/(dashboard)/team/page.tsx`)

```json
[
  {
    "id": "inv_1",
    "name": "Morgan Blake",
    "email": "morgan.blake@leadflow.io",
    "role": "Outbound SDR",
    "invitedAt": "Today"
  }
]
```

---

## 5. Sample Leads

The application seeds **12 leads** (`SEEDED_LEADS`) representing various lifecycle stages and decision-tree outcomes, plus **1 simulated extension lead** (`AddLeadDrawer.tsx`).

### Summary Matrix

| ID | Name | Company | Job Title | Step | Connection | Outreach Status | Disposition | Next Action / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `lead_1` | Elena Rostova | CloudScale AI | VP of Engineering | 3/5 | `connected` | `message_sent` | `active` (`Interested`) | Follow-up LinkedIn Message (Oct 31) |
| `lead_2` | Marcus Sterling | FinEdge Capital | Head of Growth | 2/5 | `request_sent` | `in_sequence` | `active` | Check connection acceptance (Oct 30) |
| `lead_3` | David Miller | Omnicorp Systems | Dir. Sales Ops | 2/5 | `connected` | `followup_due` | `active` | **Due Today:** Welcome Message (Oct 29) |
| `lead_4` | Sophia Chen | Nexus Robotics | CTO | 3/5 | `connected` | `replied` | `meeting_booked` | **Meeting Booked:** Discovery Call Thursday |
| `lead_5` | James Wilson | Logistics Pro | VP Operations | 4/5 | `connected` | `followup_due` | `active` | **Due Today:** Follow-up #2 (Objection note) |
| `lead_6` | Amara Okafor | PayStream Global | Chief Product Officer | 5/5 | `connected` | `completed` | `enriched` (`Converted`) | Complete Details -> Enriched ($45M ARR) |
| `lead_7` | Liam Patel | Verve Health AI | Founder & CEO | 2/5 | `declined` | `stopped` | `active` (`Lost`) | Connection declined; sequence halted |
| `lead_8` | Chloe Dupont | GlobalHR Solutions | Head of People Ops | 5/5 | `connected` | `completed` | `archived` | Outreach finished; moved to Archive |
| `lead_9` | Alexander Wright | PulseMedia Agency | Head of Outbound Mktg | 3/5 | `connected` | `followup_due` | `active` | **Overdue:** Follow-up #1 (Due Oct 27) |
| `lead_10` | Rachel Green | Apex Cloud Systems | Enterprise Solutions Dir | 0/0 | `not_started` | `unassigned` | `active` | Captured via Extension; duplicate check passed |
| `lead_11` | Vikram Malhotra | CyberShield Security | VP Strategy & Alliances | 5/5 | `connected` | `completed` | `complete_details` | Step 5 Parent Stage; awaiting Enrich vs Archive |
| `lead_12` | Daniel Vance | ByteCore Technologies| Head of Infrastructure | 4/5 | `connected` | `stopped` | `not_interested` | Replied "Not interested"; future tasks cancelled |
| *Ext* | Dmitri Volkov | Krypton Cyber Defense| CISO | 0/0 | `not_started` | `unassigned` | `active` | Pre-fill profile in Browser Extension modal |

---

### Detailed Records

#### Lead 1: Elena Rostova (Active Conversation)
```json
{
  "id": "lead_1",
  "firstName": "Elena",
  "lastName": "Rostova",
  "company": "CloudScale AI",
  "jobTitle": "VP of Engineering",
  "email": "elena.rostova@cloudscale.ai",
  "phone": "+1 (415) 890-2341",
  "linkedinUrl": "https://linkedin.com/in/elena-rostova-tech",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_founders",
  "sequenceName": "SaaS Tech Founders & VPs (LinkedIn)",
  "currentStepNumber": 3,
  "totalSteps": 5,
  "connectionStatus": "connected",
  "outreachStatus": "message_sent",
  "disposition": "active",
  "outcome": "Interested",
  "assignedToId": "user_sdr_alex",
  "assignedToName": "Alex Rivera",
  "assignedToEmail": "sdr@leadflow.io",
  "nextFollowUpDate": "2026-10-31",
  "nextActionTitle": "Follow-up LinkedIn Message",
  "notes": "Elena accepted connection warmly. Scaling SDR team from 3 to 10 in Q4.",
  "createdAt": "2026-10-20T11:20:00Z",
  "updatedAt": "2026-10-27T15:00:00Z"
}
```

#### Lead 2: Marcus Sterling (Pending Connection Acceptance)
```json
{
  "id": "lead_2",
  "firstName": "Marcus",
  "lastName": "Sterling",
  "company": "FinEdge Capital",
  "jobTitle": "Head of Growth",
  "email": "m.sterling@finedge.com",
  "phone": "+1 (212) 555-0199",
  "linkedinUrl": "https://linkedin.com/in/marcussterling-growth",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_founders",
  "sequenceName": "SaaS Tech Founders & VPs (LinkedIn)",
  "currentStepNumber": 2,
  "totalSteps": 5,
  "connectionStatus": "request_sent",
  "outreachStatus": "in_sequence",
  "disposition": "active",
  "assignedToId": "user_admin_marcus",
  "assignedToName": "Marcus Sterling",
  "assignedToEmail": "admin@leadflow.io",
  "nextFollowUpDate": "2026-10-30",
  "nextActionTitle": "Check connection acceptance status",
  "notes": "Met briefly at SaaStr. Waiting for LinkedIn connection acceptance.",
  "createdAt": "2026-10-26T09:15:00Z",
  "updatedAt": "2026-10-26T09:30:00Z"
}
```

#### Lead 3: David Miller (Follow-up Due Today)
```json
{
  "id": "lead_3",
  "firstName": "David",
  "lastName": "Miller",
  "company": "Omnicorp Systems",
  "jobTitle": "Director of Sales Operations",
  "email": "david.miller@omnicorp-sys.com",
  "phone": "+1 (312) 440-8812",
  "linkedinUrl": "https://linkedin.com/in/david-miller-salesops",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_enterprise",
  "sequenceName": "Enterprise CISO & Security Leaders (LinkedIn)",
  "currentStepNumber": 2,
  "totalSteps": 5,
  "connectionStatus": "connected",
  "outreachStatus": "followup_due",
  "disposition": "active",
  "assignedToId": "user_sdr_alex",
  "assignedToName": "Alex Rivera",
  "assignedToEmail": "sdr@leadflow.io",
  "nextFollowUpDate": "2026-10-29",
  "nextActionTitle": "Send LinkedIn Welcome Message",
  "notes": "Connection accepted yesterday! Ready for initial direct message.",
  "createdAt": "2026-10-25T08:00:00Z",
  "updatedAt": "2026-10-28T10:00:00Z"
}
```

#### Lead 4: Sophia Chen (Meeting Booked)
```json
{
  "id": "lead_4",
  "firstName": "Sophia",
  "lastName": "Chen",
  "company": "Nexus Robotics",
  "jobTitle": "Chief Technology Officer",
  "email": "sophia.chen@nexusrobotics.io",
  "phone": "+1 (650) 782-9901",
  "linkedinUrl": "https://linkedin.com/in/sophia-chen-robotics",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_founders",
  "sequenceName": "SaaS Tech Founders & VPs (LinkedIn)",
  "currentStepNumber": 3,
  "totalSteps": 5,
  "connectionStatus": "connected",
  "outreachStatus": "replied",
  "disposition": "meeting_booked",
  "outcome": "Meeting Booked",
  "assignedToId": "user_sdr_alex",
  "assignedToName": "Alex Rivera",
  "assignedToEmail": "sdr@leadflow.io",
  "nextActionTitle": "Discovery Call on Thursday 2pm",
  "notes": "Sophia replied on LinkedIn: \"This looks relevant. Let's do a 15-min call next Thursday.\" Meeting booked in calendar.",
  "createdAt": "2026-10-21T14:10:00Z",
  "updatedAt": "2026-10-28T16:45:00Z"
}
```

#### Lead 5: James Wilson (Objection Review)
```json
{
  "id": "lead_5",
  "firstName": "James",
  "lastName": "Wilson",
  "company": "Logistics Pro",
  "jobTitle": "VP Operations",
  "email": "j.wilson@logisticspro.net",
  "phone": "+1 (773) 290-8821",
  "linkedinUrl": "https://linkedin.com/in/james-wilson-supplychain",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_founders",
  "sequenceName": "SaaS Tech Founders & VPs (LinkedIn)",
  "currentStepNumber": 4,
  "totalSteps": 5,
  "connectionStatus": "connected",
  "outreachStatus": "followup_due",
  "disposition": "active",
  "assignedToId": "user_maya_lin",
  "assignedToName": "Maya Lin",
  "assignedToEmail": "maya@leadflow.io",
  "nextFollowUpDate": "2026-10-29",
  "nextActionTitle": "Send Follow-up LinkedIn Message #2",
  "notes": "Initial message was read with objection: \"We are locked into another tool until Q1\". Needs tailored response.",
  "createdAt": "2026-10-18T10:00:00Z",
  "updatedAt": "2026-10-25T11:15:00Z"
}
```

#### Lead 6: Amara Okafor (Enriched & Converted)
```json
{
  "id": "lead_6",
  "firstName": "Amara",
  "lastName": "Okafor",
  "company": "PayStream Global",
  "jobTitle": "Chief Product Officer",
  "email": "amara.okafor@paystream.co",
  "phone": "+44 20 7946 0912",
  "linkedinUrl": "https://linkedin.com/in/amara-okafor-fintech",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_founders",
  "sequenceName": "SaaS Tech Founders & VPs (LinkedIn)",
  "currentStepNumber": 5,
  "totalSteps": 5,
  "connectionStatus": "connected",
  "outreachStatus": "completed",
  "disposition": "enriched",
  "outcome": "Converted",
  "assignedToId": "user_admin_marcus",
  "assignedToName": "Marcus Sterling",
  "assignedToEmail": "admin@leadflow.io",
  "notes": "Sequence finished. Lead marked for Complete Details -> Enriched with verified company intelligence.",
  "enrichedData": {
    "phoneVerified": true,
    "phone": "+44 20 7946 0912",
    "companySize": "250-500 employees",
    "annualRevenue": "$45M ARR",
    "techStack": ["HubSpot", "Salesforce", "React", "AWS"],
    "headquarters": "London, UK",
    "enrichedAt": "2026-10-28T14:00:00Z",
    "enrichmentNotes": "Verified corporate intelligence. Converted to Enterprise Opportunity."
  },
  "createdAt": "2026-10-14T08:30:00Z",
  "updatedAt": "2026-10-28T14:00:00Z"
}
```

#### Lead 7: Liam Patel (Connection Declined)
```json
{
  "id": "lead_7",
  "firstName": "Liam",
  "lastName": "Patel",
  "company": "Verve Health AI",
  "jobTitle": "Founder & CEO",
  "email": "liam@vervehealth.ai",
  "linkedinUrl": "https://linkedin.com/in/liam-patel-healthtech",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_founders",
  "sequenceName": "SaaS Tech Founders & VPs (LinkedIn)",
  "currentStepNumber": 2,
  "totalSteps": 5,
  "connectionStatus": "declined",
  "outreachStatus": "stopped",
  "disposition": "active",
  "outcome": "Lost",
  "assignedToId": "user_sarah_connor",
  "assignedToName": "Sarah Connor",
  "assignedToEmail": "sarah@leadflow.io",
  "notes": "LinkedIn connection request was declined/withdrawn. Sequence halted at Decision 2 gate.",
  "createdAt": "2026-10-12T16:00:00Z",
  "updatedAt": "2026-10-19T10:00:00Z"
}
```

#### Lead 8: Chloe Dupont (Completed & Archived)
```json
{
  "id": "lead_8",
  "firstName": "Chloe",
  "lastName": "Dupont",
  "company": "GlobalHR Solutions",
  "jobTitle": "Head of People Operations",
  "email": "c.dupont@globalhr.eu",
  "phone": "+33 1 40 20 50 00",
  "linkedinUrl": "https://linkedin.com/in/chloedupont-hr",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_founders",
  "sequenceName": "SaaS Tech Founders & VPs (LinkedIn)",
  "currentStepNumber": 5,
  "totalSteps": 5,
  "connectionStatus": "connected",
  "outreachStatus": "completed",
  "disposition": "archived",
  "outcome": "Archived",
  "assignedToId": "user_admin_marcus",
  "assignedToName": "Marcus Sterling",
  "assignedToEmail": "admin@leadflow.io",
  "notes": "Outreach completed without response. Transitioned from Complete Details stage to Archived.",
  "createdAt": "2026-10-05T09:00:00Z",
  "updatedAt": "2026-10-24T18:00:00Z"
}
```

#### Lead 9: Alexander Wright (Overdue Follow-up)
```json
{
  "id": "lead_9",
  "firstName": "Alexander",
  "lastName": "Wright",
  "company": "PulseMedia Agency",
  "jobTitle": "Head of Outbound Marketing",
  "email": "alexander@pulsemedia.io",
  "phone": "+1 (512) 309-4411",
  "linkedinUrl": "https://linkedin.com/in/alexander-wright-marketing",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_founders",
  "sequenceName": "SaaS Tech Founders & VPs (LinkedIn)",
  "currentStepNumber": 3,
  "totalSteps": 5,
  "connectionStatus": "connected",
  "outreachStatus": "followup_due",
  "disposition": "active",
  "assignedToId": "user_sdr_alex",
  "assignedToName": "Alex Rivera",
  "assignedToEmail": "sdr@leadflow.io",
  "nextFollowUpDate": "2026-10-27",
  "nextActionTitle": "Send Follow-up LinkedIn Message #1",
  "notes": "Task overdue! Follow-up was due 2 days ago.",
  "createdAt": "2026-10-16T11:00:00Z",
  "updatedAt": "2026-10-27T08:00:00Z"
}
```

#### Lead 10: Rachel Green (Newly Captured via Extension)
```json
{
  "id": "lead_10",
  "firstName": "Rachel",
  "lastName": "Green",
  "company": "Apex Cloud Systems",
  "jobTitle": "Enterprise Solutions Director",
  "email": "rachel.green@apexcloud.co",
  "phone": "+1 (206) 880-9912",
  "linkedinUrl": "https://linkedin.com/in/rachelgreen-cloud",
  "channel": "linkedin",
  "currentStepNumber": 0,
  "totalSteps": 0,
  "connectionStatus": "not_started",
  "outreachStatus": "unassigned",
  "disposition": "active",
  "assignedToId": "user_sdr_alex",
  "assignedToName": "Alex Rivera",
  "assignedToEmail": "sdr@leadflow.io",
  "notes": "Captured via Chrome Extension. Duplicate check passed: No match found. Ready for sequence assignment.",
  "createdAt": "2026-10-29T14:00:00Z",
  "updatedAt": "2026-10-29T14:00:00Z"
}
```

#### Lead 11: Vikram Malhotra (Step 5: Complete Details Stage)
```json
{
  "id": "lead_11",
  "firstName": "Vikram",
  "lastName": "Malhotra",
  "company": "CyberShield Security",
  "jobTitle": "VP Strategy & Alliances",
  "email": "vikram.m@cybershield.security",
  "phone": "+1 (408) 555-7733",
  "linkedinUrl": "https://linkedin.com/in/vikram-malhotra-cyber",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_founders",
  "sequenceName": "SaaS Tech Founders & VPs (LinkedIn)",
  "currentStepNumber": 5,
  "totalSteps": 5,
  "connectionStatus": "connected",
  "outreachStatus": "completed",
  "disposition": "complete_details",
  "assignedToId": "user_maya_lin",
  "assignedToName": "Maya Lin",
  "assignedToEmail": "maya@leadflow.io",
  "notes": "Sequence finished. Currently in Complete Details stage awaiting disposition decision (Enrich vs Archive).",
  "createdAt": "2026-10-10T12:00:00Z",
  "updatedAt": "2026-10-28T17:00:00Z"
}
```

#### Lead 12: Daniel Vance (Not Interested)
```json
{
  "id": "lead_12",
  "firstName": "Daniel",
  "lastName": "Vance",
  "company": "ByteCore Technologies",
  "jobTitle": "Head of Infrastructure",
  "email": "d.vance@bytecore.dev",
  "linkedinUrl": "https://linkedin.com/in/daniel-vance-infra",
  "channel": "linkedin",
  "sequenceId": "seq_linkedin_founders",
  "sequenceName": "SaaS Tech Founders & VPs (LinkedIn)",
  "currentStepNumber": 4,
  "totalSteps": 5,
  "connectionStatus": "connected",
  "outreachStatus": "stopped",
  "disposition": "not_interested",
  "outcome": "Not Interested",
  "assignedToId": "user_sarah_connor",
  "assignedToName": "Sarah Connor",
  "assignedToEmail": "sarah@leadflow.io",
  "notes": "Replied: \"Not interested right now, please remove from sequence.\" Future tasks cancelled after confirmation.",
  "createdAt": "2026-10-19T09:30:00Z",
  "updatedAt": "2026-10-24T10:05:00Z"
}
```

#### Browser Extension Simulator Profile (`AddLeadDrawer.tsx`)
```json
{
  "firstName": "Dmitri",
  "lastName": "Volkov",
  "company": "Krypton Cyber Defense",
  "jobTitle": "Chief Information Security Officer",
  "email": "dmitri.volkov@kryptoncyber.com",
  "phone": "+1 (415) 332-9011",
  "linkedinUrl": "https://linkedin.com/in/dmitri-volkov-ciso",
  "notes": "Captured via LeadFlow Chrome Extension from LinkedIn profile on Oct 29."
}
```

---

## 6. Outbound Sequences & Message Templates

### Sequence 1: `seq_linkedin_founders`
* **Name:** SaaS Tech Founders & VPs (LinkedIn)
* **Channel:** `linkedin`
* **Status:** `active` | **Approved by:** Marcus Sterling (Admin)
* **Enrolled Leads Count:** 6
* **Description:** High-touch multichannel LinkedIn outreach for B2B engineering and product leaders.

#### Steps & Sequence
1. **Step 1 (Delay 0d):** `connection_request` — Send LinkedIn Connection Request
   > *"Hi {{firstName}}, noticed your team's recent growth at {{company}}. Would love to connect and follow your journey."*
2. **Step 2 (Delay 2d):** `wait_for_acceptance` — Wait for Connection Acceptance (Decision Gate 2)
3. **Step 3 (Delay 1d):** `send_message` — Send LinkedIn Welcome Message
   > *"Thanks for connecting, {{firstName}}! Quick question—how is {{company}} managing multichannel SDR follow-ups this quarter?"*
4. **Step 4 (Delay 3d):** `followup` — Follow-up LinkedIn Message
   > *"Hey {{firstName}}, just following up on my previous note. We helped similar B2B SaaS teams cut drop-off by 35%. Worth a 10-min chat next Tuesday?"*
5. **Step 5 (Delay 2d):** `complete_details` — Complete Details Parent Stage (branches to Enrich or Archive)

---

### Sequence 2: `seq_linkedin_enterprise`
* **Name:** Enterprise CISO & Security Leaders (LinkedIn)
* **Channel:** `linkedin`
* **Status:** `active` | **Approved by:** Marcus Sterling (Admin)
* **Enrolled Leads Count:** 4
* **Description:** Targeted custom sequence for enterprise revenue and security leaders.

#### Steps & Sequence
1. **Step 1 (Delay 0d):** `connection_request` — Connection Invitation with Industry Note
   > *"Hi {{firstName}}, impressed by your security architecture work at {{company}}. Would appreciate connecting here."*
2. **Step 2 (Delay 2d):** `wait_for_acceptance` — Wait for Connection Acceptance
3. **Step 3 (Delay 1d):** `send_message` — Personalized Value Proposition Note
   > *"Hi {{firstName}}, thanks for connecting. Reaching out because enterprise teams like {{company}} are streamlining pipeline review."*
4. **Step 4 (Delay 3d):** `followup` — Case Study & Benchmark Follow-up
   > *"Hey {{firstName}}, wanted to share how CloudScale boosted their SDR response rates by 42%. Would 5 minutes be useful?"*
5. **Step 5 (Delay 2d):** `complete_details` — Complete Details Review

---

### Sequence 3: `seq_linkedin_inbound`
* **Name:** High-Intent Inbound Whitepaper Download
* **Channel:** `linkedin`
* **Status:** `pending_approval` (Decision 3 Gate)
* **Enrolled Leads Count:** 0
* **Description:** Custom SDR sequence awaiting manager approval before launch.

#### Steps & Sequence
1. **Step 1 (Delay 0d):** `connection_request` — Connect & Reference Download
   > *"Hi {{firstName}}, saw you downloaded our 2026 B2B Outbound Sequence Guide. Let's connect!"*
2. **Step 2 (Delay 1d):** `wait_for_acceptance` — Wait for Connection Acceptance
3. **Step 3 (Delay 1d):** `send_message` — Offer Implementation Walkthrough
   > *"Thanks for connecting! What was your main priority for {{company}} in the report?"*

---

### Default Sequence Builder Template (`sequences/page.tsx`)
```json
[
  {
    "stepNumber": 1,
    "actionType": "connection_request",
    "title": "Send LinkedIn Connection Request",
    "delayDays": 0,
    "messageTemplate": "Hi {{firstName}}, noticed your work at {{company}}. Would love to connect and follow your journey.",
    "enabled": true
  },
  {
    "stepNumber": 2,
    "actionType": "wait_for_acceptance",
    "title": "Wait for Connection Acceptance",
    "delayDays": 2,
    "enabled": true
  },
  {
    "stepNumber": 3,
    "actionType": "send_message",
    "title": "Send Initial Value Proposition Message",
    "delayDays": 1,
    "messageTemplate": "Thanks for connecting, {{firstName}}! How is {{company}} optimizing sales pipeline this quarter?",
    "enabled": true
  },
  {
    "stepNumber": 4,
    "actionType": "followup",
    "title": "Follow-up Case Study Nudge",
    "delayDays": 3,
    "messageTemplate": "Quick follow-up {{firstName}}—open to a brief 5-min walkthrough of our pipeline results next week?",
    "enabled": true
  },
  {
    "stepNumber": 5,
    "actionType": "complete_details",
    "title": "Complete Details & Outcome Review",
    "delayDays": 2,
    "enabled": true
  }
]
```

---

## 7. Scheduled Tasks

Defined in `src/services/prototypeStore.ts`:

| Task ID | Title | Lead | Type | Due Date | Priority | Status | Message / Context |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `task_1` | Send LinkedIn Welcome Message to David Miller | David Miller (Omnicorp) | `linkedin_message` | 2026-10-29 | `high` | `pending` | *"Hi David, thanks for connecting. Reaching out because enterprise teams like Omnicorp are streamlining pipeline review."* |
| `task_2` | Send Follow-up LinkedIn Message #2 to James Wilson | James Wilson (Logistics Pro) | `linkedin_message` | 2026-10-29 | `high` | `pending` | *"Hey James, just following up on my previous note. We helped similar B2B SaaS teams cut drop-off by 35%. Worth a 10-min chat next Tuesday?"* |
| `task_3` | OVERDUE: Send Follow-up LinkedIn Message #1 to Alexander Wright | Alexander Wright (PulseMedia) | `followup` | 2026-10-27 | `high` | `overdue` | *"Hi Alexander, wanted to follow up on my note regarding pipeline conversion."* |
| `task_4` | Confirm Calendar Meeting with Sophia Chen (Reply Received) | Sophia Chen (Nexus Robotics) | `manual_review` | 2026-10-30 | `high` | `pending` | *Prepare slide deck for 15-minute intro call.* |
| `task_5` | Review Complete Details & Enrich Vikram Malhotra | Vikram Malhotra (CyberShield) | `enrich` | 2026-10-30 | `medium` | `pending` | *Step 5 Complete Details review.* |
| `task_6` | Check connection acceptance status for Marcus Sterling | Marcus Sterling (FinEdge) | `linkedin_connect` | 2026-10-30 | `medium` | `pending` | *Check LinkedIn connection acceptance status.* |

---

## 8. Activity Timeline Events

Defined in `src/services/prototypeStore.ts`:

```json
[
  {
    "id": "act_1",
    "leadId": "lead_4",
    "type": "meeting_booked",
    "title": "Meeting Booked via LinkedIn",
    "description": "Sophia Chen scheduled 15-min discovery call. Automated follow-ups halted.",
    "actorName": "Sophia Chen",
    "timestamp": "2026-10-28T16:45:00Z"
  },
  {
    "id": "act_2",
    "leadId": "lead_6",
    "type": "lead_enriched",
    "title": "Lead Enriched with Intelligence",
    "description": "Added verified phone, tech stack (Salesforce, AWS), and $45M ARR profile.",
    "actorName": "Marcus Sterling",
    "timestamp": "2026-10-28T14:00:00Z"
  },
  {
    "id": "act_3",
    "leadId": "lead_1",
    "type": "message_sent",
    "title": "LinkedIn Welcome Message Sent",
    "description": "Sent personal introduction note after Elena accepted connection.",
    "actorName": "Alex Rivera",
    "timestamp": "2026-10-27T15:00:00Z"
  },
  {
    "id": "act_4",
    "leadId": "lead_1",
    "type": "connection_accepted",
    "title": "LinkedIn Connection Accepted",
    "description": "Elena Rostova accepted connection invitation. Proceeded to message step.",
    "actorName": "Elena Rostova",
    "timestamp": "2026-10-27T10:15:00Z"
  },
  {
    "id": "act_5",
    "leadId": "lead_10",
    "type": "duplicate_checked",
    "title": "Duplicate Check Passed",
    "description": "No match found in workspace. Created new lead record for Rachel Green.",
    "actorName": "Alex Rivera",
    "timestamp": "2026-10-29T14:00:00Z"
  }
]
```

---

## 9. Journey Decision Tree Nodes & Transitions

Configured in `src/components/walkthrough/JourneyDecisionTree.tsx` across **20 hierarchical nodes**:

### Node Master Table

| Node ID | Type | Owner | Title | Subtitle | Status | Default Actions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `start` | `admin` | ADMIN | Create workspace | Start a new LeadFlow account | Start | `individual`, `team` |
| `individual` | `admin` | ADMIN | Individual workspace | One user manages their own leads | Individual | `capture` |
| `team` | `admin` | ADMIN | Create team | Admin owns workspace settings | Team created | `invite` |
| `invite` | `admin` | ADMIN | Invite member | Invitation sent to teammate | Invited | `joined`, `declined` |
| `joined` | `member` | TEAM MEMBER | Member joins team | Access follows team permissions | Joined | `capture` |
| `declined` | `end` | END STATE | Invitation declined | No member access granted | Closed | `invite`, `capture` |
| `capture` | `member` | TEAM MEMBER | Capture lead | Browser extension or manual entry | Lead capture | `duplicate` |
| `duplicate` | `decision` | **DECISION 1** | Possible duplicate? | Does this prospect already exist? | Check required | `validate`, `existing`, `missing` |
| `existing` | `end` | END STATE | Open existing lead | Duplicate creation prevented | Existing record | `validate`, `duplicate` |
| `missing` | `member` | TEAM MEMBER | Complete lead details | Fill required fields / verify data | Needs information | `validate`, `archived` |
| `archived` | `end` | END STATE | Lead archived | No sequence is started | Archived | `capture` |
| `validate` | `system` | SYSTEM | Enrich & validate | Check quality and required fields | Validated | `connection`, `verify` |
| `verify` | `end` | END STATE | Needs verification | Outreach remains blocked | On hold | `validate`, `archived` |
| `connection`| `decision` | **DECISION 2** | Connection accepted?| LinkedIn connection status | Choose status | `sequence`, `pending`, `rejected`, `verify` |
| `pending` | `end` | WAIT STATE | Connection pending | No sequence tasks created | Waiting | `sequence`, `pending` |
| `rejected` | `end` | END STATE | Rejected / withdrawn| LinkedIn sequence blocked | Blocked | `connection`, `rejected` |
| `sequence` | `member` | TEAM MEMBER | Choose sequence | Standard or custom · LinkedIn | Not assigned | `approval` |
| `approval` | `decision` | **DECISION 3** | Approved to start? | Review messages and schedule | Awaiting approval| `tasks`, `changes`, `sequenceRejected` |
| `changes` | `member` | TEAM MEMBER | Edit sequence | Update steps and timing | Needs edits | `approval` |
| `sequenceRejected` | `end` | END STATE | Sequence not approved| No outreach tasks activated | Inactive | `sequence` |
| `tasks` | `system` | SYSTEM | Create daily tasks | Scheduled · Due today · Overdue | Task queue | `send` |
| `send` | `member` | TEAM MEMBER | Send message manually| Open profile, copy, send, log | Due today | `reply`, `skipped`, `paused` |
| `skipped` | `system` | SYSTEM | Task skipped | Skip recorded in activity history | Skipped | `reply`, `paused` |
| `paused` | `end` | END STATE | Sequence paused | Future tasks held until resumed | Paused | `tasks`, `stopped` |
| `reply` | `system` | SYSTEM + MEMBER| Check for reply | Manual tracking or supported detection| No reply yet | `noReply`, `positive`, `objection`, `notInterested`, `meeting` |
| `noReply` | `system` | FOLLOW-UP PATH | Follow-up remains scheduled | Continue if no response | Scheduled | `analytics` |
| `positive` | `member` | TEAM MEMBER | Positive reply | Continue conversation | Interested | `meetingQualified`, `outcome` |
| `objection` | `member` | TEAM MEMBER | Review objection | Decide whether to pause | Review needed | `paused`, `outcome`, `stopped` |
| `notInterested`| `end` | END STATE | Not interested | Stop outreach and update outcome | Stopped | `outcome` |
| `meeting` | `end` | SUCCESS OUTCOME| Meeting booked | Close sequence and update lead | Meeting booked | `analytics` |
| `meetingQualified`| `end`| SUCCESS OUTCOME| Meeting booked | Qualified converted to meeting | Meeting booked | `analytics` |
| `stopped` | `end` | END STATE | Sequence stopped | Future tasks cancelled | Stopped | `outcome` |
| `outcome` | `member` | TEAM MEMBER | Update lead outcome | Interested · Meeting · Converted · Lost| Outcome pending| `analytics` |
| `analytics` | `system` | SYSTEM | Analytics & reporting | Reply rate · Meetings · Conversion | Updated | `finish`, `start` |
| `finish` | `end` | JOURNEY COMPLETE| Journey complete | Lead outcome and activity recorded | Complete | `reset` |

---

## 10. Visual Sequence Workflow Graph

Configured in `src/components/workflow/WorkflowCanvas.tsx` for visual sequence inspection:

### Workflow Graph Nodes
1. `node_start` (`start`): Lead Enrolled in Sequence (Decision 3 Approved)
2. `node_conn_request` (`action`): Connection Request (Step 1)
3. `node_declined_branch` (`terminal`): Declined / Timeout Branch (Stops sequence)
4. `node_wait_acceptance` (`wait`): Wait for Acceptance (Decision 2 Gate)
5. `node_conn_accepted` (`condition`): Connection Accepted (Step 2 Network Member)
6. `node_send_message` (`action`): Manual LinkedIn Message (Step 3 Initial outreach)
7. `node_reply_branch` (`terminal`): Reply Received / Meeting (Branch to left, halts sequence)
8. `node_followup` (`action`): Follow-up Message Nudge (Step 4 Case study nudge)
9. `node_complete_details` (`stage`): **Parent Stage: Complete Details** (Step 5 Sequence complete)
10. `node_enrich` (`outcome`): **Child Outcome 1: Enrich** (Branches directly beneath Complete Details)
11. `node_archived` (`outcome`): **Child Outcome 2: Archived** (Branches directly beneath Complete Details)

### Graph Edge Routing
* `node_start` ➔ `node_conn_request` *(solid)*
* `node_conn_request` ➔ `node_declined_branch` *(dashed, "Declined / Timeout")*
* `node_conn_request` ➔ `node_wait_acceptance` *(solid, "Sent")*
* `node_wait_acceptance` ➔ `node_conn_accepted` *(solid, "Accepted")*
* `node_conn_accepted` ➔ `node_send_message` *(solid, "Network Member")*
* `node_send_message` ➔ `node_reply_branch` *(branch_success, "Reply Received")*
* `node_send_message` ➔ `node_followup` *(solid, "No Reply (3d)")*
* `node_followup` ➔ `node_reply_branch` *(branch_success, "Reply Received")*
* `node_followup` ➔ `node_complete_details` *(solid, "Sequence Complete")*
* `node_complete_details` ➔ `node_enrich` *(branch_success, "Option: Enrich")*
* `node_complete_details` ➔ `node_archived` *(dashed, "Option: Archive")*

---

## 11. System Constants & Taxonomies

Defined in `src/constants/`:

### Designations (`src/constants/designations.ts`)
* `VP of Engineering`
* `Engineering Manager`
* `QA Lead`
* `QA Manager`
* `Director of Engineering`
* `Director of QA`

### Lead Status Options & Color Tokens (`src/constants/leadStatus.ts`)
* `New` — `bg-blue-500/10`, `text-blue-600 dark:text-blue-400`
* `Contacted` — `bg-amber-500/10`, `text-amber-600 dark:text-amber-400`
* `Closed` — `bg-emerald-500/10`, `text-emerald-600 dark:text-emerald-400`
* **Lead Sources:** `LinkedIn`, `Email`, `Website`

### Priorities (`src/constants/priorities.ts`)
* `Low` — `bg-slate-500/10`, `text-slate-600 dark:text-slate-400`
* `Medium` — `bg-amber-500/10`, `text-amber-600 dark:text-amber-400`
* `High` — `bg-rose-500/10`, `text-rose-600 dark:text-rose-400`

### Step Status & Sequence Types (`src/constants/status.ts`)
* **Sequence Types:** `linkedin` ("LinkedIn Sequence"), `email` ("Email Sequence")
* **Step Statuses:**
  * `Pending` — `bg-amber-500/10`, `text-amber-600 dark:text-amber-400`
  * `Sent` — `bg-emerald-500/10`, `text-emerald-600 dark:text-emerald-400`
  * `Skipped` — `bg-slate-500/10`, `text-slate-600 dark:text-slate-400`
