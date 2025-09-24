# Document Upload System - Architecture

## 🏗️ Monorepo Structure

This is a **Next.js monorepo** with both frontend and backend code in each app using **Next.js API Routes**.

```
project-root/
├── apps/
│   ├── user-app/          # User-facing website (Frontend + Backend)
│   └── admin-app/         # Admin/Agent portal (Frontend + Backend)
├── shared/                # Shared code between apps
└── package.json           # Root workspace configuration
```

## 📱 User App (`apps/user-app`)

### Frontend (UI Pages)
- **`src/app/page.tsx`** - Landing page
- **`src/app/upload/page.tsx`** - Upload & QR code page
- **`src/app/files/page.tsx`** - My files page
- **`src/components/`** - React components (Navbar, QRCodeDisplay, PaymentButton)

### Backend (API Routes)
- **`src/app/api/auth/route.ts`** - User authentication
- **`src/app/api/upload/route.ts`** - File upload handling
- **`src/app/api/qr/route.ts`** - QR code generation
- **`src/app/api/payment/create-order/route.ts`** - Razorpay order creation
- **`src/app/api/payment/verify/route.ts`** - Payment verification
- **`src/app/api/notifications/route.ts`** - Email/SMS notifications

### Environment
- **`.env.local`** - Contains Razorpay keys + DB URL

## 🔧 Admin App (`apps/admin-app`)

### Frontend (UI Pages)
- **`src/app/page.tsx`** - Admin dashboard
- **`src/app/agent/`** - Agent-only pages
  - `page.tsx` - Agent dashboard
  - `files/[id]/page.tsx` - File details
  - `reply/page.tsx` - Reply interface
- **`src/app/admin/`** - Admin-only pages
  - `users/page.tsx` - User management
  - `agents/page.tsx` - Agent management
  - `transactions/page.tsx` - Transaction history
  - `settings/page.tsx` - System settings

### Backend (API Routes)
- **`src/app/api/auth/route.ts`** - Admin/Agent authentication
- **`src/app/api/files/route.ts`** - File management
- **`src/app/api/replies/route.ts`** - Agent replies
- **`src/app/api/admin/route.ts`** - Admin functions

### Environment
- **`.env.local`** - Contains DB URL (NO Razorpay keys)

## 🔄 Shared Code (`shared/`)

### Models
- **`models/User.ts`** - User schema
- **`models/File.ts`** - File schema
- **`models/Payment.ts`** - Payment schema
- **`models/Reply.ts`** - Reply schema

### Types
- **`types/api.ts`** - API response types
- **`types/auth.ts`** - Authentication types
- **`types/file.ts`** - File-related types

### Utils
- **`utils/validation.ts`** - Validation helpers
- **`utils/format.ts`** - Formatting utilities
- **`utils/constants.ts`** - Shared constants

## 🚀 Development Commands

```bash
# Install all dependencies
npm run install:all

# Run both apps simultaneously
npm run dev

# Run individual apps
npm run dev:user    # User app on http://localhost:3000
npm run dev:admin   # Admin app on http://localhost:3001

# Build both apps
npm run build

# Start production servers
npm run start
```

## 🔑 Key Points for Cursor

1. **Frontend pages** go under `src/app/*` (not in api folder)
2. **Backend APIs** go under `src/app/api/*` (Next.js API Routes)
3. **Shared code** is in `shared/` folder - import with `@shared/*`
4. **Environment variables**:
   - User app: Razorpay keys + DB URL
   - Admin app: DB URL only
5. **Database**: Both apps connect to same DB via `shared/models`
6. **TypeScript paths**:
   - `@/*` - Current app's src folder
   - `@shared/*` - Shared folder
   - `@user/*` - User app (from root)
   - `@admin/*` - Admin app (from root)

## 📊 Data Flow

```
User App Frontend → User App API Routes → Database
Admin App Frontend → Admin App API Routes → Database
                ↓
            Shared Models & Utils
```

Both apps are **full-stack Next.js applications** with their own frontend and backend, sharing common code through the `shared/` directory.
