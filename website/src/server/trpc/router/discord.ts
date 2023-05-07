import { TRPCError } from "@trpc/server";
import { ZodError, z } from "zod";
import { env } from "../../../env/server.mjs";
import { DiscordApiError, GuildMemberObject, GuildObject, MeGuildResponseBody } from "../../../types/discord-api";
import { protectedProcedure, router } from "../trpc";
import { Cache } from "memory-cache"
import type { RESTGetAPICurrentUserGuildsResult } from "discord.js";

export const discordRouter = router({
    getGuilds: protectedProcedure.query(async (query) => {

        const discordAccount = await query.ctx.prisma.account.findFirstOrThrow({
            where: {
                userId: query.ctx.session.user.id,
                provider: "discord"
            }
        })
        // TODO reenable this when proper handling is implemented
        // if (!discordAccount.expires_at || discordAccount.expires_at < (Date.now() / 1000)) {
        //     // refresh access token
        //     throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Access token expired" })
        // }
        const accessToken = discordAccount.access_token

        try {
            // get user guilds
            const response = await fetch("https://discord.com/api/users/@me/guilds", {
                method: "GET",
                headers: new Headers({
                    'Authorization': 'Bearer ' + accessToken
                })
            })
            // TODO error handling in case discord api returns an error (Rate Limited, AccessToken expired...)
            // TODO implement fitlering so we only return guilds the user can actually edit (owner or has role with manage guild)
            const jsonBody = await response.json()
            if (Math.floor(response.status / 100) !== 2) {
                const errorParseResult = DiscordApiError.safeParse(jsonBody)
                if (!errorParseResult.success) {
                    console.error("ERROR - TRPC DISCORD - GETGUILDS - MALFORMED BODY")
                    console.error(jsonBody)
                    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Discord API error" })
                }
                console.error("ERROR - TRPC DISCORD - GETGUILDS - MALFORMED API REQUEST")
                console.error(errorParseResult.data)
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Discord API error" })
            }

            const guilds = MeGuildResponseBody.parse(jsonBody)
            const ownedGuilds = guilds.map(guild => {
                return {
                    id: guild.id,
                    name: guild.name,
                    icon: guild.icon
                }
            })

            // get bot guild
            const botResponse = await fetch("https://discord.com/api/users/@me/guilds", {
                method: "GET",
                headers: new Headers({
                    'Authorization': 'Bot ' + env.DISCORD_BOT_AUTH_TOKEN
                })
            })
            if (botResponse.status !== 200) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Discord API Error" })
            }
            const botGuilds = await botResponse.json() as RESTGetAPICurrentUserGuildsResult

            const intersection = ownedGuilds.filter(botGuild => botGuilds.some(userGuild => botGuild.id === userGuild.id))

            const guildMap = new Map<string, { id: string, name: string, icon: string | null }>()
            intersection.reduce((acc, value) => {
                return acc.set(value.id, value)
            }, guildMap)

            return {
                guilds: guildMap
            }
        } catch (error) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Discord API Error 2" })
        }


    }),
    getGuild: protectedProcedure.input(z.object({ guildid: z.string().regex(/^\d+$/) })).query(async (query) => {
        if (!await isGuildMember(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        const botToken = env.DISCORD_BOT_AUTH_TOKEN

        // fetch guild
        try {
            const response = await fetch("https://discord.com/api/guilds/" + query.input.guildid, {
                method: "get",
                headers: new Headers({
                    'Authorization': 'Bot ' + botToken
                })
            })
            const json = await response.json()
            const guildParseResult = GuildObject.safeParse(json)
            if (!guildParseResult.success) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Discord API Error: Cannot retrieve Server" })
            }

            // await new Promise(r => setTimeout(r, 5000));

            return {
                guild: guildParseResult.data
            }
        }
        catch (err) {
            console.error(JSON.stringify(err))
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Callback Error" })
        }

    }),

    getCountsForGuild: protectedProcedure.input(z.object({ guildid: z.string() })).query(async query => {
        if (!await hasManageGuild(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        const soundCount = await query.ctx.prisma.sound.count({
            where: {
                guildid: query.input.guildid,
                deleted: false
            }
        })

        const entreeCount = await query.ctx.prisma.entree.count({
            where: {
                guildid: query.input.guildid
            }
        })

        const playCount = await query.ctx.prisma.play.count({
            where: {
                sound: {
                    guildid: query.input.guildid,
                    deleted: false
                }
            }
        })

        return {
            soundCount,
            entreeCount,
            playCount
        }
    }),

    getSounds: protectedProcedure.input(z.object({ guildid: z.string().regex(/^\d+$/) })).query(async query => {
        if (!await hasManageGuild(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        const sounds = await query.ctx.prisma.sound.findMany({
            where: {
                guildid: query.input.guildid,
                deleted: false
            },
            select: {
                soundid: true,
                name: true,
                hidden: true,
            }
        })
        // await new Promise(r => setTimeout(r, 5000));
        return { sounds }
    }),

    getVisibleSounds: protectedProcedure.input(z.object({ guildid: z.string().regex(/^\d+$/) })).query(async query => {
        if (!await isGuildMember(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        const sounds = await query.ctx.prisma.sound.findMany({
            where: {
                guildid: query.input.guildid,
                deleted: false,
                hidden: false
            },
            select: {
                soundid: true,
                name: true,
                hidden: true,
            }
        })
        // await new Promise(r => setTimeout(r, 5000));
        return sounds
    }),

    createSound: protectedProcedure.input(z.object({ name: z.string(), hidden: z.boolean(), guildid: z.string(), fileData: z.string() })).mutation(async query => {

        if (!await hasManageGuild(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        const limitResult = await query.ctx.prisma.limit.findUnique({
            where: {
                guildid: query.input.guildid
            }
        })

        const limit = limitResult?.limit ?? env.DEFAULT_LIMIT

        const soundCount = await query.ctx.prisma.sound.count({
            where: {
                guildid: query.input.guildid,
                deleted: false
            }
        })

        if (soundCount >= limit) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You have reached the limit." })
        }

        const buffer = Buffer.from(query.input.fileData, "base64")
        const arrBuffer = Uint8Array.from(buffer)

        const formData = new FormData()
        formData.append("sound", new Blob([arrBuffer], { type: "audio/mpeg" }))
        formData.append("userid", query.ctx.session.user.discordId)
        formData.append("name", query.input.name)
        formData.append("hidden", query.input.hidden ? "true" : "false")

        try {
            const response = await fetch(env.DWIGHT_BASE + "/sound/" + query.input.guildid, {
                method: "POST",
                headers: {
                    "Authorization": "Basic " + Buffer.from(env.DWIGHT_USERNAME + ":" + env.DWIGHT_PASSWORD).toString("base64")
                },
                body: formData
            })

            if (response.status !== 201) {
                console.error("Status: " + response.status)
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failure to upload file" })
            }
        }
        catch (err) {
            if (err instanceof TypeError) {
                console.error("TypeError")
                console.error("Message: " + err.message)
            }
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to reach backend" })
        }
    }),

    updateSound: protectedProcedure.input(z.object({ soundid: z.string(), name: z.string(), hidden: z.boolean() })).mutation(async query => {
        const sound = await query.ctx.prisma.sound.findUnique({
            where: {
                soundid: query.input.soundid
            }
        })

        if (!sound) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "The sound you want to edit does not exist" })
        }

        if (!await hasManageGuild(sound.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        await query.ctx.prisma.sound.update({
            where: {
                soundid: query.input.soundid
            },
            data: {
                name: query.input.name,
                hidden: query.input.hidden
            }
        })
    }),

    deleteSound: protectedProcedure.input(z.object({ soundid: z.string() })).mutation(async query => {

        const sound = await query.ctx.prisma.sound.findUnique({
            where: {
                soundid: query.input.soundid
            },
            include: {
                entrees: true
            }
        })

        if (!sound) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "The requested sound does not exist" })
        }

        if (!await hasManageGuild(sound.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        await query.ctx.prisma.$transaction([
            query.ctx.prisma.sound.update({
                where: {
                    soundid: query.input.soundid
                },
                data: {
                    deleted: true
                }
            }),
            query.ctx.prisma.entree.deleteMany({
                where: {
                    soundid: sound.soundid
                }
            })
        ])
    }),

    getAnnouncements: protectedProcedure.input(z.object({ guildid: z.string() })).query(async query => {
        if (!await hasManageGuild(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        const announcements = await query.ctx.prisma.entree.findMany({
            where: {
                guildid: query.input.guildid
            },
            include: {
                sound: true
            }
        })
        return {
            announcements: announcements
        }
    }),

    upsertAnnouncement: protectedProcedure.input(z.object({ guildid: z.string(), userid: z.string(), soundid: z.string() })).mutation(async query => {
        if (!await hasManageGuild(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        await query.ctx.prisma.entree.upsert({
            where: {
                guildid_userid: {
                    guildid: query.input.guildid,
                    userid: query.input.userid
                }
            },
            create: {
                soundid: query.input.soundid,
                guildid: query.input.guildid,
                userid: query.input.userid
            },
            update: {
                soundid: query.input.soundid
            }
        })
    }),

    deleteAnnouncement: protectedProcedure.input(z.object({ guildid: z.string(), userid: z.string() })).mutation(async query => {
        if (!await hasManageGuild(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        await query.ctx.prisma.entree.delete({
            where: {
                guildid_userid: {
                    guildid: query.input.guildid,
                    userid: query.input.userid
                }
            }
        })
    }),

    getGuildMembers: protectedProcedure.input(z.object({ guildid: z.string() })).query(async query => {
        if (!await isGuildMember(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        // TODO handle guilds with more than 1000 users
        const botResponse = await fetch(`https://discord.com/api/guilds/${query.input.guildid}/members?limit=1000`, {
            method: "get",
            headers: new Headers({
                'Authorization': 'Bot ' + env.DISCORD_BOT_AUTH_TOKEN
            })
        })

        const guildMembers = await z.array(GuildMemberObject).parseAsync(await botResponse.json()) // TODO error handling

        const result = guildMembers.filter(member => {
            return member.user.id !== "609005073531404304"
        }).map(member => ({
            userid: member.user.id,
            name: member.nick ?? member.user.username,
            avatar: member.avatar,
            userAvatar: member.user.avatar,
            discriminator: member.user.discriminator
        }))

        return result
    }),

    getLimit: protectedProcedure.input(z.object({ guildid: z.string() })).query(async query => {
        if (!await hasManageGuild(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        const limitResult = await query.ctx.prisma.limit.findUnique({
            where: {
                guildid: query.input.guildid
            }
        })

        const limit = limitResult?.limit ?? env.DEFAULT_LIMIT

        return limit
    }),

    getPendingChanges: protectedProcedure.input(z.object({ guildid: z.string() })).query(async query => {
        if (!await hasManageGuild(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        const [lastModified, lastUpdate] = await Promise.all([
            query.ctx.prisma.sound.aggregate({
                _max: {
                    modifiedAt: true
                },
                where: {
                    guildid: query.input.guildid
                }
            }),
            query.ctx.prisma.guildLastUpdate.findUnique({
                where: {
                    guildid: query.input.guildid
                }
            })
        ])

        const hasPendingChanges = !!(!lastUpdate && lastModified._max.modifiedAt) || (lastUpdate && lastModified._max.modifiedAt && lastUpdate.lastUpdate < lastModified._max.modifiedAt)

        return {
            pendingChanges: hasPendingChanges
        }

    }),

    applyChanges: protectedProcedure.input(z.object({ guildid: z.string() })).mutation(async query => {
        if (!await hasManageGuild(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        // Check if rebuild is needed
        const [lastModified, lastUpdate] = await Promise.all([
            query.ctx.prisma.sound.aggregate({
                _max: {
                    modifiedAt: true
                },
                where: {
                    guildid: query.input.guildid
                }
            }),
            query.ctx.prisma.guildLastUpdate.findUnique({
                where: {
                    guildid: query.input.guildid
                }
            })
        ])

        const hasPendingChanges = !!(!lastUpdate && lastModified._max.modifiedAt) || (lastUpdate && lastModified._max.modifiedAt && lastUpdate.lastUpdate < lastModified._max.modifiedAt)

        if (!hasPendingChanges) {
            // no rebuild needed
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No rebuild needed" })
        }
        if (env.DWIGHT_BASE) {
            try {
                await fetch(env.DWIGHT_BASE + "/build/" + query.input.guildid, {
                    headers: {
                        "Authorization": "Basic " + Buffer.from(env.DWIGHT_USERNAME + ":" + env.DWIGHT_PASSWORD).toString("base64")
                    },
                })
            } catch (err) {
                console.error("Callback error")
                console.error(err)
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not rebuild channel", cause: err })
            }
        } else {
            // only happens when env is not connected to dwigthprocess
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Not connected to dwight process" })
        }


        await query.ctx.prisma.guildLastUpdate.upsert({
            where: {
                guildid: query.input.guildid
            },
            update: {
                lastUpdate: new Date()
            },
            create: {
                guildid: query.input.guildid,
                lastUpdate: new Date()
            }
        })
    }),

    getTopSoundsForGuild: protectedProcedure.input(z.object({ guildid: z.string() })).query(async query => {
        if (!await isGuildMember(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        const queryResult = await query.ctx.prisma.play.groupBy({
            by: ["soundid"],
            where: {
                sound: {
                    guildid: query.input.guildid,
                    hidden: false,
                    deleted: false
                }
            },
            _count: true
        })

        return queryResult.map(entry => ({
            soundid: entry.soundid,
            count: entry._count
        }))
    }),

    getLastPlays: protectedProcedure.input(z.object({ count: z.number().min(1).max(10).default(10), guildid: z.string() })).query(async query => {
        if (!await isGuildMember(query.input.guildid, query.ctx.session.user.discordId)) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "You are not entitled to access this server." })
        }

        const queryResult = await query.ctx.prisma.play.findMany({
            select: {
                sound: {
                    select: {
                        name: true
                    }
                }
            },
            where: {
                userid: {
                    not: "609005073531404304" // id of dwight
                },
                sound: {
                    guildid: query.input.guildid
                }
            },
            orderBy: {
                time: "desc"
            },
            take: query.input.count
        })

        return queryResult
    }),

    getPermissionLevel: protectedProcedure.input(z.object({ guildid: z.string() })).query(async query => {
        if (await hasManageGuild(query.input.guildid, query.ctx.session.user.discordId)) {
            return "admin"
        }
        if (await isGuildMember(query.input.guildid, query.ctx.session.user.discordId)) {
            return "member"
        }
        return "none"
    })
})

// AUTH
type GuildId = string
const guildMemberCache = new Cache<string, z.infer<typeof GuildMemberObject>>()
const guildDataCache = new Cache<GuildId, { ownerId: string, roleIds: string[] }>()

async function getGuildMember(guildid: GuildId, discordUserId: string) {
    let guildMember = guildMemberCache.get(guildid + discordUserId)
    if (!guildMember) {
        const guildMemberResponse = await fetch("https://discord.com/api/guilds/" + guildid + "/members/" + discordUserId, {
            method: "get",
            headers: new Headers({
                'Authorization': 'Bot ' + env.DISCORD_BOT_AUTH_TOKEN
            })
        })
        if (guildMemberResponse.status === 404) {
            // This happens when someone tries to access a guild they're not a member of
            return null
        }
        if (guildMemberResponse.status !== 200) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Discord API Error" })
        }
        const guildMemberJson = await guildMemberResponse.json()
        const guildParseResult = GuildMemberObject.safeParse(guildMemberJson)
        if (guildParseResult.success) {
            guildMemberCache.put(guildid + discordUserId, guildParseResult.data, 60 * 1000) // keep 1 minute in cache
            guildMember = guildParseResult.data
        } else {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Discord API Error" })
        }
    }
    return guildMember
}

/**
 * Returns the ownerid and roles that has permission manage server
 * @param guildid 
 * @returns { ownerId, roleIds} id of owner and list of roleids with sufficient permissions
 */
async function getGuildData(guildid: GuildId) {
    let guildData = guildDataCache.get(guildid)
    if (!guildData) {
        const guildResponse = await fetch("https://discord.com/api/guilds/" + guildid, {
            method: "get",
            headers: new Headers({
                'Authorization': 'Bot ' + env.DISCORD_BOT_AUTH_TOKEN
            })
        })
        if (guildResponse.status !== 200) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Discord API Error" })
        }
        const guildJson = await guildResponse.json()
        const guildResult = GuildObject.safeParse(guildJson)
        if (!guildResult.success) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Discord API Error" })
        }
        const rolesWithSufficientPermissions = guildResult.data.roles.filter(role => ((role.permissions & 0x8) === 0x8 || (role.permissions & 0x20) === 0x20)).map(role => role.id)
        guildData = { ownerId: guildResult.data.owner_id, roleIds: rolesWithSufficientPermissions }
        guildDataCache.put(guildid, guildData, 60 * 1000)
    }
    return guildData
}

async function hasManageGuild(guildid: string, discordUserId: string) {

    const [guildMember, { ownerId, roleIds }] = await Promise.all([getGuildMember(guildid, discordUserId), getGuildData(guildid)])

    return guildMember && (guildMember.user.id === ownerId || guildMember.roles.some(assignedRoleId => roleIds.includes(assignedRoleId)))
}

async function isGuildMember(guildid: string, discordUserId: string) {
    const guildMember = await getGuildMember(guildid, discordUserId)

    return !!guildMember
}