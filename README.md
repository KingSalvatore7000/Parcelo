# 📦 Parcelo
**A digital parcel room for Indian apartment societies.**

Guards log every parcel at the gate, residents choose when and how to receive it, and a one-time code closes each handover with a permanent record.

![Status](https://img.shields.io/badge/status-in%20development-F26B4E)
![Stack](https://img.shields.io/badge/stack-React%20%7C%20React%20Native%20%7C%20Node.js%20%7C%20PostgreSQL-0B5D5B)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Table of contents
- [The problem](#the-problem)
- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API overview](#api-overview)
- [Data model](#data-model)
- [Security](#security)
- [Roadmap](#roadmap)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

## The problem
In most Indian apartment societies, parcels are handled informally at the gate:

- Parcels pile up in the guard room with no log of what arrived or when.
- Working residents miss deliveries, and failed attempts end in returns.
- There is no proof of who collected a parcel, so disputes have no answer.

Society apps such as MyGate and NoBrokerHood mainly handle visitors and gate approvals. Parcelo adds the missing parcel layer. It is inspired by [Fetch Package](https://fetchpackage.com), a US startup that manages package delivery for apartment communities, adapted for how Indian societies actually work.

## Features
- **Parcel logging**: the guard records flat, courier and a photo in a few taps.
- **Instant notifications**: the resident is alerted by push, with WhatsApp or SMS as a pluggable option.
- **Slot scheduling**: the resident picks pickup from the parcel room (free) or door delivery (paid), and a time slot.
- **Code-verified handover**: a 4-digit one-time code is shown to the resident and entered by the guard to complete the handover.
- **Admin dashboard**: live counts, overdue-parcel list, reminders, and resident and flat management.
- **Live updates**: new parcels and status changes appear instantly on the guard desk through WebSockets.

## How it works
1. **Log**: a parcel arrives and the guard logs it against a flat.
2. **Notify**: everyone linked to that flat is alerted.
3. **Schedule**: the resident chooses pickup or door delivery and a slot, and receives a 4-digit code.
4. **Hand over**: the guard enters the code, the parcel is marked handed over, and the guard ID and timestamp are saved.
5. **Follow up**: a daily job reminds residents about parcels waiting more than 2 days and flags old ones to the admin.

## Tech stack
| Layer | Technology |
|---|---|
| Web (guard desk and admin) | React, Vite, Tailwind CSS |
| Mobile (resident app) | React Native (Expo) |
| Backend | Node.js, Express, TypeScript, Zod |
| Realtime | Socket.io |
| Database | PostgreSQL with Prisma |
| Notifications | Firebase Cloud Messaging, WhatsApp or SMS provider |
| Auth | Phone OTP, JWT |
| Storage | Cloudinary or S3 for parcel photos |

## Architecture

```
Resident app (React Native) ─┐
Guard desk (React)           ─┼─►  Node.js + Express API  ─┬─► PostgreSQL (Prisma)
Admin dashboard (React)      ─┘    REST · Socket.io · JWT  ├─► Push / WhatsApp / SMS
                                                           └─► Photo storage
```

## Project structure

```
parcelo/
├── apps/
│   ├── api/        # Express API, Prisma schema, jobs
│   ├── web/        # Guard desk and admin dashboard (React)
│   └── mobile/     # Resident app (React Native, Expo) — planned
├── packages/
│   └── shared/     # Shared types and Zod schemas
├── docker-compose.yml
└── README.md
```

## Getting started

### Prerequisites
- Node.js 20 or later
- Docker Desktop (for local PostgreSQL, exposed on host port **5433**)

### Setup
```bash
# 1. Clone
git clone https://github.com/KingSalvatore7000/parcelo.git
cd parcelo

# 2. Install dependencies
#    (postinstall builds packages/shared and generates the Prisma client)
npm install

# 3. Start PostgreSQL
npm run db:up

# 4. Configure environment
#    The API reads the root .env; the Prisma CLI reads apps/api/.env
cp .env.example .env
cp .env.example apps/api/.env

# 5. Create tables
npm run db:migrate

# 6. Load demo data (WARNING: deletes all existing data first)
npm run db:seed

# 7. Run the apps (separate terminals)
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:5173
```

Other scripts: `npm run build` (shared, API and web), `npm run db:studio`, `npm run db:down`.

> The resident mobile app (`apps/mobile`) is planned and not in the repo yet.

### Demo flow
1. Sign in as the guard and log a parcel for a flat.
2. Sign in as that flat's resident and choose a slot. A 4-digit code appears.
3. Back on the guard desk, enter a wrong code to see the error, then the right code to complete the handover.
4. Open the admin dashboard to see the counts update.

## Environment variables

Used today (see `.env.example`):

| Variable | Description |
|---|---|
| `PORT` | API port (default `4000`) |
| `NODE_ENV` | `development` or `production` |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CORS_ORIGIN` | Comma-separated allowed web origins |
| `MOCK_SMS_CONSOLE` | Print login OTPs to the API console |
| `DEFAULT_DEV_OTP` | Fixed login OTP in development |
| `VITE_API_URL` | (web) API base URL, default `http://localhost:4000` |

Planned: `JWT_REFRESH_SECRET`, `FCM_SERVER_KEY`, `WHATSAPP_TOKEN`, `STORAGE_BUCKET`, `OTP_PROVIDER`.

## API overview

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/otp/request` | Request a login OTP |
| POST | `/auth/otp/verify` | Verify OTP and receive tokens |
| POST | `/parcels` | Guard logs a parcel |
| GET | `/parcels` | List parcels, scoped by role |
| POST | `/parcels/:id/schedule` | Resident chooses mode and slot, receives code |
| POST | `/parcels/:id/handover` | Guard submits the code to complete handover |
| GET | `/admin/stats` | Dashboard counts |
| POST/PATCH | `/admin/flats`, `/admin/users` | Manage flats and residents |

## Data model
`Society` · `Flat` · `User` · `Parcel` · `Handover` · `Notification`

Parcel status flow: `LOGGED → SCHEDULED → HANDED_OVER` (with `UNCLAIMED` and `RETURNED` as side states).

## Security
- Phone OTP login with rate limiting and short-lived tokens
- Handover codes stored **hashed**, with expiry and attempt limits
- Every query scoped to a single society, with role-based access on every route
- Private photo storage and minimal personal data, following the principles of India's DPDP Act

## Roadmap
- [x] Parcel logging and code-verified handover
- [x] Resident slot scheduling
- [x] Admin dashboard
- [ ] Pilot in one or two societies
- [ ] Payments for door delivery (Razorpay)
- [ ] Smart parcel lockers
- [ ] Integration with existing society apps and courier tracking

## Screenshots
_Add screenshots here._

| Resident app | Guard desk | Admin dashboard |
|---|---|---|
| ![Resident](docs/resident.png) | ![Guard](docs/guard.png) | ![Admin](docs/admin.png) |

## Contributing
Contributions are welcome.

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push the branch and open a pull request


## Author
**Amarnath** · B.E. Computer Science and Engineering, Kumaraguru College of Technology, Coimbatore
GitHub: [@KingSalvatore7000](https://github.com/KingSalvatore7000)

