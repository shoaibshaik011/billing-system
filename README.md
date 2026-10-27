# 🍽️ Restaurant Billing POS, SaaS Reseller Hub & Guest QR Ordering System

A commercial-grade, white-label **Restaurant Billing POS, Kitchen Display System (KDS), Multi-Tenant SaaS Vendor Hub, and Mobile Guest Table QR Ordering Web App**.

---

## 🌟 Key Highlights

### 1. 📱 Customer Table QR Ordering (Mobile Web App)
- **Zero App Download**: Guests point their smartphone camera at the table QR stand card.
- **Instant Menu Browsing**: Veg/Non-veg filters, category browsing, item descriptions, and photos.
- **Direct Kitchen Orders**: Guests add items to their cart, enter table/special instructions, and place orders directly to the Kitchen KDS in real-time.
- **Request Bill from Phone**: Diners can request their bill from their mobile screen when finished.

### 2. 🔐 Staff & Counter Login Terminal
- **Quick 4-Digit PIN Pad**: On-screen touch numpad designed for fast cashier shift changes on touch screens, iPads, and counter laptops.
- **Username & Password Sign In**: Secure credentials login.
- **Pre-Configured Accounts**:
  - 👑 **Admin**: PIN `9999` (`admin` / `admin123`)
  - 💼 **Cashier**: PIN `1234` (`cashier` / `cashier123`)
  - ⚡ **SaaS Vendor**: PIN `0000` (`vendor` / `vendor123`)

### 3. 👑 SaaS Vendor Command Hub (`/admin`)
- **Master Client Provisioning**: Customize software for other restaurants and cafes (brand name, theme color, logo mascot emoji, max tables, and subscription tier).
- **1-Click WhatsApp Dispatch**: Generates a pre-written WhatsApp message with the client's dedicated software link (`/r/:slug`), guest QR link, license key, and Chrome PWA install instructions.
- **Subscription Management**: Track active client subscriptions, monthly recurring revenue (MRR), and 1-click `+30 Days Renew`.

### 4. 🍽️ Complete Restaurant POS Operations
- **Floor & Table Management**: Real-time table status (Available, Occupied, Reserved, Billed).
- **Billing & Tax Invoices**: GST / Tax calculation, discount application, split payment, and thermal receipt printing.
- **Kitchen Display System (KDS)**: Real-time Kitchen Order Tickets (KOT) with audio chimes and ticket progress tracking.
- **Printable Table QR Stand Cards**: High-resolution, printable tent cards with embedded QR codes.

---

## 🚀 Live Deployment Guide

### Deploy on Render (Recommended — Free & Automatic)

1. Fork or push this repository to GitHub.
2. Sign in to **[Render.com](https://render.com)**.
3. Click **New +** $\rightarrow$ **Web Service**.
4. Connect your `billing-system` repository.
5. Set:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
6. Click **Deploy Web Service**!

Your app will be live with full HTTPS:
- **POS & Staff Login**: `https://your-app.onrender.com/login`
- **Customer Table 1 QR**: `https://your-app.onrender.com/table/1`
- **SaaS Vendor Hub**: `https://your-app.onrender.com/admin`

---

## 💻 Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup
```bash
# Clone the repository
git clone https://github.com/shoaibshaik011/billing-system.git
cd billing-system

# Install dependencies for both backend and frontend
npm run install:all

# Run backend API server (runs on port 3001)
npm run dev:server

# In a second terminal, run frontend Vite dev server (runs on port 5173)
npm run dev:client
```

---

## 📦 Tech Stack
- **Frontend**: React 18, Vite, React Router v6, Lucide Icons, React Hot Toast
- **Backend**: Node.js, Express 5, CORS
- **Database**: SQLite3 (`better-sqlite3` with WAL mode)
- **Deployment**: Single-service production bundle serving both API and compiled client