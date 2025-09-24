# Google OAuth Setup Instructions

## Environment Variables Required

Create a `.env.local` file in the `apps/user-app` directory with the following variables:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Razorpay Configuration (already provided)
RAZORPAY_KEY_ID=rzp_test_RJTmoYCxPGvgYd
RAZORPAY_KEY_SECRET=o2nkihTLoehKOtBHNkq94LF4
```

## Google OAuth Setup Steps

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** or select an existing one
3. **Enable Google+ API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
4. **Create OAuth 2.0 credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://yourdomain.com/api/auth/callback/google` (for production)
5. **Copy the Client ID and Client Secret** to your `.env.local` file
6. **Generate a NextAuth secret**:
   ```bash
   openssl rand -base64 32
   ```

## Installation

```bash
cd apps/user-app
npm install
```

## Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`
