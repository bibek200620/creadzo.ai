# Credzo.ai (Next.js + Firebase Backend)

This project now includes a Firebase-backed backend inside Next.js route handlers.

## Implemented backend domains

- Auth: signup, login, current user profile (`/api/auth/*`)
- Analysis persistence with 15-day lock (`/api/analysis/*`)
- Bank account linking (`/api/bank-accounts`)
- Loan application + EMI repayment tracking (`/api/loans`, `/api/loans/latest`, `/api/loans/repay`)

## API routes

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PUT /api/auth/me`
- `POST /api/analysis/save`
- `GET /api/analysis/latest`
- `GET /api/bank-accounts`
- `POST /api/bank-accounts`
- `GET /api/loans`
- `POST /api/loans`
- `GET /api/loans/latest`
- `POST /api/loans/repay`
- `POST /api/analyze` (Gemini analysis)

## Environment setup

1. Copy `.env.example` to `.env.local`
2. Fill Firebase values and Gemini key

Required keys:

- `GEMINI_API_KEY`
- `FIREBASE_WEB_API_KEY`
- Either:
  - `FIREBASE_SERVICE_ACCOUNT_KEY` (full JSON string), or
  - `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`

## Firebase requirements

- Enable **Email/Password** in Firebase Authentication
- Create a **Service Account** and use its credentials in `.env.local`
- Firestore will auto-create these collections/documents when APIs are used:
  - `profiles/{uid}`
  - `profiles/{uid}/analysisRecords/*`
  - `profiles/{uid}/bankAccounts/*`
  - `profiles/{uid}/loans/*`
  - `profiles/{uid}/loans/{loanId}/installments/*`
  - `profiles/{uid}/loans/{loanId}/repayments/*`

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`
