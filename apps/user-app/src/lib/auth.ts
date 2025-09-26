import NextAuth, { AuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { adminDb } from "./firebase-admin"

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          // Check if user exists in Firestore
          const userDoc = await adminDb.collection('user').doc(user.id).get();
          
          if (!userDoc.exists()) {
            // Create new user in Firestore
            const userData = {
              userId: user.id,
              name: user.name || user.email?.split('@')[0] || 'User',
              email: user.email || '',
              phone: '',
              createdAt: new Date().toISOString(),
            };
            
            await adminDb.collection('user').doc(user.id).set(userData);
          }
          return true;
        } catch (error) {
          console.error('Error creating user:', error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, account, profile, user }) {
      if (account) {
        token.accessToken = account.access_token
        token.userId = user?.id
      }
      return token
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken
      (session as any).userId = token.userId
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

export default NextAuth(authOptions)
