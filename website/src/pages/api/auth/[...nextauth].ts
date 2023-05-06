import NextAuth, { type NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
// Prisma adapter for NextAuth, optional and can be removed
import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { env } from "../../../env/server.mjs";
import { prisma } from "../../../server/db/client";
import { URLSearchParams } from "url";
import { DiscordAccessTokenResponse } from "../../../types/discord-api";

export const authOptions: NextAuthOptions = {
  // Include user.id on session
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async jwt({ token, user, account }) {
      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async session({ session, user, token }) {
      if (session.user) {
        const discordAccount = await prisma.account.findFirstOrThrow({
          where: {
            provider: "discord",
            userId: user.id
          }
        })

        if (!discordAccount.expires_at || (discordAccount.expires_at * 1000) < Date.now()) {
          if (discordAccount.refresh_token) {
            console.log("REFRESH ACCESS TOKEN")
            try {
              const refreshTokenData = await refreshAccessToken(discordAccount.refresh_token)
              await prisma.account.update({
                where: {
                  provider_providerAccountId: {
                    provider: "discord",
                    providerAccountId: discordAccount.providerAccountId
                  }
                },
                data: {
                  refresh_token: refreshTokenData.refreshToken,
                  expires_at: refreshTokenData.accessTokenExpiresAt,
                  access_token: refreshTokenData.accessToken
                }
              })
            } catch (error) {
              await prisma.account.delete({
                where: {
                  provider_providerAccountId: {
                    provider: "discord",
                    providerAccountId: discordAccount.providerAccountId
                  }
                }
              })
              session.user = undefined
              return session
            }
          } else {
            await prisma.account.delete({
              where: {
                provider_providerAccountId: {
                  provider: "discord",
                  providerAccountId: discordAccount.providerAccountId
                }
              }
            })
            session.user = undefined
            return session
          }

        }
        session.user.id = user.id;
        session.user.discordId = discordAccount.providerAccountId
      }
      return session;
    },
  },
  // Configure one or more authentication providers
  adapter: PrismaAdapter(prisma),
  providers: [
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      authorization: "https://discord.com/api/oauth2/authorize?scope=identify+email+guilds+guilds.members.read",
    }),
    // ...add more providers here
  ],
};

async function refreshAccessToken(token: string) {
  try {
    const url = "https://discord.com/api/oauth2/token?"

    const headers = new Headers()
    headers.append("Content-Type", "application/x-www-form-urlencoded")

    const urlencoded = new URLSearchParams();
    urlencoded.append("client_id", env.DISCORD_CLIENT_ID);
    urlencoded.append("client_secret", env.DISCORD_CLIENT_SECRET);
    urlencoded.append("grant_type", "refresh_token");
    urlencoded.append("refresh_token", token);

    const requestOptions: RequestInit = {
      method: "POST",
      headers: headers,
      body: urlencoded,
      redirect: "follow"
    }
    const response = await fetch(url, requestOptions)

    if (!response.ok) {
      console.error("RESPONSE WAS NOT OKAY")
      console.error(await response.json())
      throw response
    }

    const responseJson = await response.json()

    const answer = DiscordAccessTokenResponse.parse(responseJson)

    return {
      accessToken: answer.access_token,
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) + answer.expires_in,
      refreshToken: answer.refresh_token, // Fall back to old refresh token
    }
  } catch (error) {
    console.error(error)
    throw new Error("unable to refresh access token")
  }
}

export default NextAuth(authOptions);
