import { z } from "zod";

export const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "test", "production"]),
    DISCORD_BOT_AUTH_TOKEN: z.string(),
    SOUNDS_FOLDER_PATH: z.string(),
    DEFAULT_LIMIT: z.coerce.number(),
    PORT: z.coerce.number(),
    CB_USERNAME: z.string(),
    CB_PASSWORD: z.string()
});

export const formatErrors = (
    errors: import('zod').ZodFormattedError<Map<string, string>, string>,
) =>
    Object.entries(errors)
        .map(([name, value]) => {
            if (value && "_errors" in value)
                return `${name}: ${value._errors.join(", ")}\n`;
        })
        .filter(Boolean);
