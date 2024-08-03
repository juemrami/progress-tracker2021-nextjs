import NextAuth, { type Session, type SessionOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import type { NextAuthOptions } from 'next-auth';
import prisma from '@server/prisma/client';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import dayjs from 'dayjs';
export const nextAuthOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
        })
    ],
    callbacks: {
        async signIn(params) {
            console.log("[NextAuth] signIn callback invoked w/ params: ", params)
            // For existing users, update their profile picture if it exist
            const userExists = (await prisma.user.findUnique({ where: { id: params.user.id } }))
            if (params.account.provider === "discord" 
            && (params.profile.image_url) 
            && (!!userExists)) 
            {
                await prisma.user.update({
                    where: {
                        id: params.user.id
                    },
                    data: {
                        image: params.profile.image_url as string
                    }
                })
            }
            return true
        },
        async session({ session, user, token}) {
            console.log("[NextAuth] Invoking /api/session")
            // Token only used with jwt strategy, not the session cookie strategy
            console.log("[NextAuth] next-auth session data :", session)
            session.user = {
                id: user.id,
                name: user.name || null,
                username: user.name || null,
                image: user.image || null,
            }
            return session
        },
    },
    events: {
        createUser: ({ user }) => {
            console.log("[NextAuth] Creating user in database")
            console.log(user)
        },
        linkAccount({ user, account }) {
            console.log("[NextAuth] User provider accounts linked");
            console.log(user, account)
        },
        signIn: async ({ user, isNewUser, account }) => {
            console.log("[NextAuth] User has been 'Signed-In': ", user)
            console.log("[NextAuth] User sign-in provider Account: ", account)
            console.log("[NextAuth] Cleaning up expired sessions for User")
            await prisma.session.deleteMany({
                where: {
                    userId: user.id,
                    expires: {
                        lt: dayjs().toISOString()
                    }
                }
            });
        },
        updateUser({ user }) {
            console.log('updateUser', user);
        },
    },
    session: {
        strategy: "database",
        maxAge: 60 * 60 * 1.5, // session duration: 1.5 hours
        updateAge: 60 * 5, // refresh session every: 5 minutes
    },
    theme: {
        logo: "https://i.imgur.com/OX5mAdU.png",
        colorScheme: "dark",
        brandColor: "#ff0000",
    },
    debug: true,
    secret: process.env.SECRET!,

}

export default NextAuth(nextAuthOptions)
type callback_types = NonNullable<typeof nextAuthOptions.callbacks>
type session_cb = NonNullable<callback_types["session"]>
export type UserSession = Awaited<ReturnType<session_cb>>