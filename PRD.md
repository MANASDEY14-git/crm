# MVP CRM Prompt (WhatsApp-First SMB CRM)

You can give this directly to Lovable or your AI coding agent.
I’ve structured it like a real product requirement document so the output stays clean and focused instead of becoming bloated.

---

# PRODUCT VISION

Build a modern, extremely simple, WhatsApp-first CRM for SMB businesses in India.

The CRM should feel:

* lightweight
* fast
* mobile-friendly
* easy for non-technical staff
* similar to WhatsApp simplicity

The primary goal is:

> Help SMB businesses never lose customer follow-ups again.

The CRM is NOT an ERP.

Avoid:

* accounting complexity
* inventory modules
* unnecessary reports
* enterprise jargon
* cluttered dashboards

Focus only on:

* leads
* customers
* WhatsApp conversations
* follow-ups
* pipeline management

---

# TARGET USERS

Small and medium businesses:

* furniture stores
* interior businesses
* electronics retailers
* local distributors
* agencies
* service businesses

Users are:

* owners
* sales staff
* follow-up executives

Most users are not tech-savvy.

The interface must work smoothly on:

* desktop
* tablets
* mobile phones

---

# DESIGN PHILOSOPHY

The UI should feel like:

* WhatsApp Web
* Notion simplicity
* Linear cleanliness
* minimal clicks
* large readable UI
* modern but practical

Use:

* soft neutral colors
* rounded cards
* clean spacing
* minimal text clutter
* large touch-friendly buttons

Avoid:

* overloaded dashboards
* too many charts
* complex menus
* hidden actions
* small buttons

The app should feel operational and calm.

---

# CORE MVP MODULES

# 1. AUTHENTICATION

Features:

* Secure login
* Email/password authentication
* Business workspace support
* Role-based access:

  * Admin
  * Sales Staff

---

# 2. MAIN LAYOUT

Layout structure:

## Left Sidebar

Contains:

* Dashboard
* Inbox
* Leads
* Customers
* Tasks
* Settings

Sidebar should be:

* collapsible
* icon-first
* clean
* mobile responsive

---

## Top Header

Contains:

* Global search
* Notification bell
* User profile
* Quick add button

---

# 3. DASHBOARD

Purpose:
Show only actionable information.

DO NOT create complex analytics.

Widgets:

* Total leads today
* Pending follow-ups
* Hot leads
* Tasks due today
* Recent conversations
* Conversion summary

Add:

* “Today’s Attention Center”
  showing:
* overdue follow-ups
* unread chats
* pending callbacks

Dashboard must feel lightweight and operational.

---

# 4. WHATSAPP-STYLE INBOX (MOST IMPORTANT)

This is the heart of the CRM.

Build a clean WhatsApp-style shared inbox.

Layout:

## Left Panel

Conversation list:

* customer name
* last message
* timestamp
* unread count
* lead status color tag

Search bar on top.

Filters:

* Unread
* Assigned to me
* Hot leads
* Follow-up due

---

## Middle Chat Panel

Show:

* full conversation
* message bubbles
* timestamps
* customer details shortcut

Bottom input:

* text box
* emoji support
* attachment support
* quick replies
* AI reply suggestion placeholder

Typing experience must feel smooth.

---

## Right Customer Context Panel

Show:

* customer name
* phone
* tags
* lead stage
* notes
* tasks
* last follow-up
* assigned staff

Quick actions:

* Add task
* Change lead stage
* Add note
* Schedule follow-up

This panel is critical.

---

# 5. LEAD MANAGEMENT

Create a Kanban pipeline board.

Stages:

* New Inquiry
* Contacted
* Interested
* Follow-up Pending
* Quotation Sent
* Won
* Lost

Features:

* drag and drop cards
* quick edit
* priority badges
* expected deal value
* follow-up dates

Lead cards should be compact and visually clean.

---

# 6. CUSTOMER PROFILE PAGE

Each customer profile should contain:

## Sections

* Basic info
* Conversation history
* Notes timeline
* Tasks timeline
* Lead activity
* Files/documents

The timeline should feel similar to a CRM activity feed.

---

# 7. TASKS & FOLLOW-UPS

Simple task system.

Task types:

* Call
* WhatsApp Follow-up
* Meeting
* Callback

Features:

* due dates
* reminders
* assigned staff
* completion status

Important:
Show overdue tasks aggressively but cleanly.

---

# 8. QUICK ACTIONS

Global quick-add button.

Allow:

* Add lead
* Add customer
* Add task
* Start new conversation

Must open fast modal windows.

---

# 9. SEARCH SYSTEM

Global search should instantly search:

* customers
* phone numbers
* chats
* leads

Must be extremely fast.

---

# 10. SETTINGS

Simple settings only:

* Business profile
* Staff management
* WhatsApp connection status
* Notification settings

Avoid bloated settings pages.

---

# UX REQUIREMENTS

# Speed First

* instant page transitions
* realtime updates
* optimistic UI updates

---

# Mobile Experience

Mobile version is extremely important.

On mobile:

* inbox should feel app-like
* floating action button
* swipe gestures optional
* responsive chat UI

---

# Empty States

Every empty screen should guide users:
Example:
“No leads yet. Add your first customer inquiry.”

---

# Notifications

Use:

* subtle toast notifications
* non-intrusive alerts

Avoid excessive popups.

---

# UI STYLE GUIDE

Typography:

* modern sans-serif
* highly readable

Spacing:

* generous whitespace

Cards:

* rounded
* soft shadow

Animations:

* subtle and fast

Theme:

* support dark/light mode

---

# TECH STACK

Frontend:

* React
* TypeScript
* TailwindCSS
* shadcn/ui

Backend:

* Supabase

Realtime:

* Supabase Realtime

Auth:

* Supabase Auth

State:

* TanStack Query

---

# DATABASE STRUCTURE

Core tables:

* users
* businesses
* customers
* leads
* conversations
* messages
* tasks
* notes

---

# IMPORTANT PRODUCT RULES

DO NOT:

* build ERP features
* add accounting
* add inventory
* overcomplicate reports
* create enterprise-level settings
* add unnecessary AI features in MVP

FOCUS ONLY ON:

* conversations
* follow-ups
* pipeline visibility
* customer management

---

# MVP SUCCESS METRIC

The product is successful if:

* staff can learn it in 10 minutes
* owners can see pending follow-ups instantly
* no customer inquiry gets forgotten
* WhatsApp conversations become organized
* users enjoy opening the app daily

---

# FINAL UX GOAL

The CRM should feel like:

> “WhatsApp + Follow-up system + Simple sales pipeline”

NOT:

> “Heavy enterprise CRM software”
