# Invoice & Inventory Management App

Simple web app for managing products, parties, purchases, and sales invoices.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:** SQLite

## Project Structure

```
invoice-inventory-app/
├── backend/          → API server + database
│   ├── database/     → SQLite setup & schema
│   ├── routes/       → API endpoints
│   └── server.js     → Main server file
└── frontend/         → React app
    └── src/
        ├── pages/    → Dashboard, Products, Parties, etc.
        ├── components/
        └── api.js    → Backend API calls
```

## How to Run

### Step 1: Install Backend

```bash
cd backend
npm install
npm run init-db
npm start
```

Backend runs on: **http://localhost:5000**

### Step 2: Install Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: **http://localhost:5173**

Open browser → http://localhost:5173

## Features

1. **Products** - Add, edit, delete products with stock tracking
2. **Parties** - Manage Retailers & Wholesalers
3. **Purchases** - Buy from supplier, stock auto-increases
4. **Sales/Invoice** - Create invoice with GST, stock auto-decreases
5. **PDF Download** - Download invoice as PDF
6. **Dashboard** - Sales, purchase & stock summary
