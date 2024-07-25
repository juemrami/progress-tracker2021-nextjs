import NextAuth, { type Session, type SessionOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';
import type { NextAuthOptions, User } from 'next-auth';
import prisma from '@server/prisma/client';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import dayjs from 'dayjs';
import { TRPCError } from '@trpc/server';

type AccessTokenResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    error: any
}

const refreshAccessToken = async (user: User, session: Session) => {
    const provider = "discord";
    const userProviderAccount = await prisma.account.findFirst({
        where: {userId: user.id, provider: provider}
    });
    const tokenURL = "https://discord.com/api/v10/oauth2/token";
    const currentTime = dayjs()
    const refreshFailedError = (data: any) => {
        console.error("[NextAuth] Failed to refresh session token for user: ", user)
        return new TRPCError({
        code: "INTERNAL_SERVER_ERROR", 
        message: `Next-Auth Failed to refresh session token for ${user.name} |\ndata: ${JSON.stringify(data)}`, 
    })}
    if (userProviderAccount
    && ((userProviderAccount.expires_at!! * 1000) < (currentTime.valueOf())))
    {
        console.log("[NextAuth] Refreshing users session token")
        // display time passed since userProviderAccount.expires_at
        console.log(`[NextAuth] Session has been expired for ${
            dayjs(userProviderAccount.expires_at).diff(currentTime, "seconds")
        } seconds`)
        // see https://discord.com/developers/docs/topics/oauth2#authorization-code-grant-refresh-token-exchange-example
        try  {
            const response = await fetch(tokenURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body : new URLSearchParams({
                    client_id: process.env.DISCORD_CLIENT_ID!!,
                    client_secret: process.env.DISCORD_CLIENT_SECRET!!,
                    refresh_token: userProviderAccount.refresh_token!!,
                    grant_type: "refresh_token",                
                })
            })
            console.log(response)
            if (!response.ok) throw response
            const data: AccessTokenResponse = await response.json();
            const expiry = dayjs().add(data.expires_in, "seconds");
            await prisma.account.update({
                where: { id: userProviderAccount.id, provider: provider },
                data: {
                    expires_at: expiry.valueOf(),
                    access_token: data.access_token,
                    refresh_token: data.refresh_token ?? userProviderAccount.refresh_token,
                }
            })
        } catch (error) { throw refreshFailedError(error) }
    };
    session.user = {
        id: user.id,
        name: user.name || null,
        username: user.name || null,
        image: user.image || null,
    }
    return session
}

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
            const userExists = (await prisma.user.findUnique({ where: { id: params.user.id } }))
            if (params.account.provider === "discord" && !!userExists) {
                // For existing users, update their profile picture if it exist
                if (params.profile.image_url) await prisma.user.update({
                    where: { id: params.user.id },
                    data: { image: params.profile.image_url as string }
                });
                // update the account provider db info
                await prisma.account.update({
                    where: { provider_providerAccountId: {
                        provider: params.account.provider,
                        providerAccountId: params.account.providerAccountId
                    }},
                    data: {
                        access_token: params.account.access_token,
                        refresh_token: params.account.refresh_token,
                        expires_at: params.account.expires_at
                    }
                })
            }
            return true
        },
        async session({ session, user }) {
            console.log("[NextAuth] Invoking /api/session")
            // session = await refreshAccessToken(user, session)
            session.user = {
                id: user.id,
                name: user.name || null,
                username: user.name || null,
                image: user.image || null,
            }
            console.log("[NextAuth] next-auth user Session`:", session)
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