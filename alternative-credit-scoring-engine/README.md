# Alternative Credit Scoring Engine

Production-ready full-stack web application for alternative credit scoring using transaction analytics and behavioral signals.

## Stack
- Frontend: React + TailwindCSS + React Router + Chart.js (`frontend`)
- Backend: Node.js + Express (`backend`)
- Auth: JWT + bcrypt password hashing
- Database: MongoDB with Mongoose
- File Upload: PDF/CSV statement upload + extraction (`multer`, `pdf-parse`, `@fast-csv/parse`)

## Folder Structure
```text
alternative-credit-scoring-engine/
  backend/
    demo/
      sample-users.json
      mockCsvStrings.js
      statements/
        gig_worker.csv
        salaried_emi.csv
        volatile_cashflow.csv
    seed/
      seedDemoData.js
      previewSampleScores.js
    src/
      config/db.js
      controllers/
        authController.js
        bankController.js
        analyticsController.js
        historyController.js
        loanController.js
        scoreController.js
      middleware/authMiddleware.js
      models/
        User.js
        Statement.js
        Loan.js
      routes/
        authRoutes.js
        bankRoutes.js
        analyticsRoutes.js
        historyRoutes.js
        loanRoutes.js
        scoreRoutes.js
      services/
        parserService.js
        analyticsService.js
        loanService.js
        recommendationService.js
        scoringService.js
      utils/token.js
      app.js
      server.js
    .env.example
    package.json

  frontend/
    src/
      api/client.js
      components/
        Layout.jsx
        Navbar.jsx
        ProtectedRoute.jsx
        StatCard.jsx
        ThemeToggle.jsx
      context/AuthContext.jsx
      pages/
        LandingPage.jsx
        LoginPage.jsx
        SignupPage.jsx
        DashboardPage.jsx
        HistoryPage.jsx
        LoanCenterPage.jsx
        UploadStatementPage.jsx
        ScoreBreakdownPage.jsx
        ProfilePage.jsx
      App.jsx
      main.jsx
      index.css
    .env.example
    index.html
    tailwind.config.js
    postcss.config.js
    vite.config.js
    package.json
```

## Features Implemented

### 1) Authentication
- Signup with name, email, phone, password
- Login with JWT token
- Password hashing with bcrypt
- Role-based users (`USER`, `ADMIN`)
- Admin bootstrap from `ADMIN_EMAILS` in backend `.env`
- Protected routes in frontend + backend auth middleware

### 2) Bank Statement Upload + Parsing
- `POST /bank/upload` (and `/api/bank/upload`)
- Accepts PDF/CSV files
- PDF extraction via `pdf-parse`
- CSV parsing via `@fast-csv/parse`
- Rule-based detection:
  - Salary credits: `SALARY`, `PAYROLL`
  - EMI: `EMI`, `NACH`, `ECS`
  - Utility bills: `BESCOM`, `WATER`, `GAS`, `RECHARGE`
- Auto-categorizes transactions (Rent, Food, Bills, EMI, Transport, Shopping, etc.)

### 3) Analytics Engine
Computes and returns:
- Inflow / outflow
- Monthly income, expenses, and net cashflow
- Category-wise spending distribution
- Transaction trend series
- Average monthly income
- Average monthly expenses
- Income stability score
- Volatility score
- Savings ratio + score
- Minimum balance stability score
- EMI consistency score
- Utility bill timeliness score
- Spending discipline score

### 4) Alternative Credit Scoring Model (0-900)
Rule-based + behavioral weighted model with components:
- Income Regularity
- Spending Pattern
- Missed EMI Indicators
- Savings Ratio
- Utility Bill Timeliness
- Account Balance Stability

Outputs:
- Trust Score (0-900)
- Score band
- Component-wise contribution and weights
- Behavioral adjustment

### 5) Dashboard + Visualization
- Welcome section with user info
- Upload button
- Recommendation cards generated from latest behavioral signals
- Risk flag alerts from latest analysis
- Chart.js visualizations:
  - Monthly income vs expenses (bar)
  - Category-wise spending (pie)
  - Balance trend (line)

### 6) History + Export Features
- Statement history API + UI page with score trend chart
- Per-statement detail retrieval from history
- Export latest or specific score report in JSON/CSV

### 7) Pages
- Landing Page
- Login
- Signup
- Dashboard
- History
- Loan Center
- Upload Statement
- Score Breakdown
- Profile
- Responsive UI + dark mode toggle

### 8) Loan Engine (Real App Flow)
- Trust-score-led underwriting with risk tiers (`PRIME`, `PREFERRED`, `STANDARD`, `STARTER`)
- Loan offers based on:
  - score tier and rate slab
  - average income / expense behavior
  - repayment capacity and savings trend
- Full lifecycle:
  - borrower applies -> `PENDING` approver queue
  - approver decision (`APPROVED` / `REJECTED`)
  - single in-progress loan guard (`PENDING`/`APPROVED`/`ACTIVE` blocks new applications)
  - disbursement (`APPROVED` -> `ACTIVE`)
  - repayment and schedule tracking
  - auto-close when outstanding becomes zero (`ACTIVE` -> `CLOSED`)
- Loan Center UI:
  - eligibility snapshot (borrower)
  - recommended loan offers
  - apply/disburse/pay actions
  - admin approval queue with approve/reject controls
  - repayment schedule + next due date

## API Endpoints
All required endpoints are available exactly as requested, and also with `/api` prefix.

- `POST /auth/signup`
- `POST /auth/login`
- `POST /bank/upload` (multipart, key: `statement`)
- `GET /analytics/summary`
- `GET /analytics/history`
- `GET /analytics/history/:statementId`
- `GET /score/generate`
- `GET /score/report`
- `GET /score/report/:statementId`
- `GET /loan/offers`
- `POST /loan/apply`
- `GET /loan/my-loans`
- `GET /loan/:loanId`
- `GET /loan/:loanId/repayment-summary`
- `POST /loan/:loanId/pay-emi`
- `POST /loan/:loanId/pay-full`
- `POST /loan/:loanId/disburse`
- `POST /loan/:loanId/pay`
- `GET /loan/admin/pending` (admin)
- `POST /loan/admin/:loanId/decision` (admin)

Also available:
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/bank/upload`
- `GET /api/analytics/summary`
- `GET /api/analytics/history`
- `GET /api/analytics/history/:statementId`
- `GET /api/score/generate`
- `GET /api/score/report`
- `GET /api/score/report/:statementId`
- `GET /api/loan/offers`
- `POST /api/loan/apply`
- `GET /api/loan/my-loans`
- `GET /api/loan/:loanId`
- `GET /api/loan/:loanId/repayment-summary`
- `POST /api/loan/:loanId/pay-emi`
- `POST /api/loan/:loanId/pay-full`
- `POST /api/loan/:loanId/disburse`
- `POST /api/loan/:loanId/pay`
- `GET /api/loan/admin/pending` (admin)
- `POST /api/loan/admin/:loanId/decision` (admin)

## Setup & Run

### Backend
```bash
cd alternative-credit-scoring-engine/backend
cp .env.example .env
npm install
npm run dev
```
Set `ADMIN_EMAILS` in `.env` to the comma-separated emails that should act as loan approvers.

### Frontend
```bash
cd alternative-credit-scoring-engine/frontend
cp .env.example .env
npm install
npm run dev
```

Backend default: `http://localhost:5001`
Frontend default: `http://localhost:5173`

## Demo Data

### Seed 3 Sample Users + Statements
```bash
cd alternative-credit-scoring-engine/backend
npm run seed:demo
```

Demo users in `backend/demo/sample-users.json`:
1. `asha.gig@example.com` / `Asha@1234` (gig worker profile)
2. `ravi.salary@example.com` / `Ravi@1234` (stable salaried + EMI)
3. `imran.unstable@example.com` / `Imran@1234` (volatile cashflow)

### Preview sample scores without seeding DB
```bash
cd alternative-credit-scoring-engine/backend
npm run preview:scores
```

Expected relative ordering:
- `salaried_emi.csv`: highest score (strong regularity + healthy balances)
- `gig_worker.csv`: medium score (good savings discipline, less regular than salaried)
- `volatile_cashflow.csv`: lowest score (high volatility, missed EMI indicators, weak balance stability)

## Notes
- This implementation is production-structured and extensible.
- For real production deployment, add:
  - Input schema validation (`zod`/`joi`)
  - Rate-limiting and brute-force protection
  - Refresh-token strategy
  - Background processing for heavy PDF parsing
  - Unit/integration tests and CI
