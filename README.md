# Smart Credit MERN Project

A simulated academic credit platform built with React/Vite, Express and MongoDB.

## Included
- Customer, merchant and admin roles
- Merchant QR generation and customer QR scanning
- Credit purchases and repayments
- Correct available-credit/outstanding calculations
- Transaction `approved`, `paid` and `disputed` states
- Merchant pending/settled settlement tracking
- Customer and merchant KYC document uploads (PDF/JPG/PNG, max 5 MB each)
- Admin KYC approval/rejection and document viewing
- Customer Auto Settlement toggle
- Daily simulated Auto Settlement scheduler (default 08:00 server time)
- Demo admin seeded automatically

## Run

### Backend
```bash
cd server
npm install
# copy .env.example to .env and set MONGO_URI and JWT_SECRET
npm run dev
```

### Frontend
```bash
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally http://localhost:5173.

## Demo admin
Email: `admin@smartcredit.local`
Password: `Admin@12345`

## KYC
KYC documents are stored locally in `server/uploads/kyc` for this academic/demo project. In production, use secure object storage, access controls, encryption and document retention policies.

## Auto Settlement
Auto Settlement is simulated and does not move real money. A customer must enable it and have approved KYC. The scheduler checks every minute and runs at `AUTO_SETTLEMENT_HOUR` (default `8`) server time. For a demo, set `AUTO_SETTLEMENT_HOUR=23` and wait for the next matching hour, or restart near that time.


## Notifications
The project includes an in-app notification center with unread counts, read/read-all actions, and automatic polling every 30 seconds. Notifications are generated for:
- Credit purchases
- Repayments
- Auto settlements
- KYC submissions
- KYC approvals/rejections
- Merchant credit sales

The notification API is mounted at `/api/notifications`.
