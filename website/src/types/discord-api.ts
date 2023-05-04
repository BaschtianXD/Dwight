import { z } from "zod";

export const MeGuildResponseBody = z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    icon: z.nullable(z.string().min(1)),
    owner: z.boolean(),
    permissions: z.number(),
    features: z.array(z.string().min(1)),
    permissions_new: z.string().min(1)
}))

export const MeGuildResponseBodyError = z.object({
    message: z.string().min(1),
    code: z.number()
})

export const RoleObject = z.object({
    id: z.string(),
    name: z.string(),
    color: z.number(),
    hoist: z.boolean(),
    icon: z.string().nullish(),
    unicode_emoji: z.string().nullish(),
    position: z.number(),
    permissions: z.number(),
    managed: z.boolean(),
    mentionable: z.boolean(),
    tags: z.any(),
})

export const UserObject = z.object({
    id: z.string(),
    username: z.string(),
    discriminator: z.string(),
    avatar: z.string().nullish(),
    bot: z.boolean().nullish(),
    system: z.boolean().nullish(),
    mfa_enabled: z.boolean().nullish(),
    banner: z.string().nullish(),
    accent_color: z.number().nullish(),
    locale: z.string().nullish(),
    verified: z.boolean().nullish(),
    email: z.boolean().nullish(),
    flags: z.number().nullish(),
    premium_type: z.number().nullish(),
    public_flags: z.number().nullish(),
})

export const EmojiObject = z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    roles: z.array(z.string()),
    user: UserObject.nullish(),
    require_colons: z.boolean().nullish(),
    managed: z.boolean().nullish(),
    animated: z.boolean().nullish(),
    available: z.boolean().nullish()
})

export const WelcomeScreenChannelObject = z.object({
    channel_id: z.string(),
    descrption: z.string(),
    emoji_id: z.string().nullish(),
    emoji_name: z.string().nullish(),
})

export const WelcomeScreenObject = z.object({
    description: z.string().nullish(),
    welcome_channels: z.array(WelcomeScreenChannelObject),
})

export const StickerObject = z.object({
    id: z.string(),
    pack_id: z.string().nullish(),
    name: z.string(),
    description: z.string().nullish(),
    tags: z.string(),
    asset: z.string(), // DEPRECATED, now empty string
    type: z.number(),
    format_type: z.number(),
    available: z.boolean().nullish(),
    guild_id: z.string().nullish(),
    user: UserObject.nullish(),
    sort_value: z.number().nullish(),
})

export const GuildObject = z.object({
    id: z.string().min(1).regex(/^\d+$/),
    name: z.string(),
    icon: z.string().nullish(),
    icon_hash: z.string().nullish(),
    splash: z.string().nullish(),
    discovery_splash: z.string().nullish(),
    owner_id: z.string(),
    permissions: z.string().nullish(),
    region: z.string().nullish(),
    afk_channel_id: z.string().nullish(),
    afk_timeout: z.number(),
    widget_enabled: z.boolean(),
    widget_channel_id: z.string().nullish(),
    verification_level: z.number(),
    default_message_notifications: z.number(),
    explicit_content_filter: z.number(),
    roles: z.array(RoleObject),
    emojis: z.array(EmojiObject),
    features: z.array(z.string()),
    mfa_level: z.number(),
    application_id: z.string().nullish(),
    system_channel_id: z.string().nullish(),
    system_channel_flags: z.number(),
    rules_channel_id: z.string().nullish(),
    max_presences: z.number().nullish(),
    max_members: z.number().nullish(),
    vanity_url_code: z.string().nullish(),
    description: z.string().nullish(),
    banner: z.string().nullish(),
    premium_tier: z.number(),
    premium_subscription_count: z.number().nullish(),
    preferred_locale: z.string(),
    public_updates_channel: z.string().nullish(),
    max_video_channel_users: z.number().nullish(),
    approximate_member_count: z.number().nullish(),
    approximate_presence_count: z.number().nullish(),
    welcome_screen: WelcomeScreenObject.nullish(),
    nsfw_level: z.number(),
    stickers: z.array(StickerObject),
    premium_progress_bar_enabled: z.boolean()
})

export const GuildMemberObject = z.object({
    user: UserObject,
    nick: z.string().nullish(),
    avatar: z.string().nullish(),
    roles: z.array(z.string()),
    joined_at: z.string(),
    premium_since: z.string().nullish(),
    deaf: z.boolean(),
    mute: z.boolean(),
    pending: z.boolean().nullish(),
    permissions: z.string().nullish(),
    communication_disabled_until: z.string().nullish()
})

export const DiscordApiError = z.object({
    code: z.number(),
    message: z.string()
})

export const DiscordAccessTokenResponse = z.object({
    access_token: z.string(),
    token_type: z.string(),
    expires_in: z.number(),
    refresh_token: z.string()
})
