import { PrismaClient } from "@prisma/client";
import { envVars } from "./dwight";
import { ISoundProvider, TEntreeListEntry, TSoundListEntry } from "./interfaces/ISoundProvider";

export default class PrismaSoundProvider implements ISoundProvider {

    prisma: PrismaClient
    basePath = envVars.SOUNDS_FOLDER_PATH

    constructor() {
        this.prisma = new PrismaClient()
    }

    async getSoundsForGuild(guildId: string): Promise<TSoundListEntry[]> {
        const queryResult = await this.prisma.sound.findMany({
            select: {
                soundid: true,
                name: true,
                hidden: true
            },
            where: {
                guildid: guildId
            }
        })
        return queryResult.map(sound => ({
            id: sound.soundid,
            name: sound.name,
            hidden: sound.hidden
        }))
    }

    async getPathToSound(soundId: string): Promise<string> {
        return this.basePath + "/" + soundId + ".opus"
    }

    async removeAllDataForGuild(guildId: string): Promise<void> {
        await this.prisma.$transaction([
            this.prisma.entree.deleteMany({
                where: {
                    guildid: guildId
                }
            }),
            this.prisma.sound.updateMany({
                where: {
                    guildid: guildId
                },
                data: {
                    deleted: true
                }
            })
        ])
    }

    async getEntreeSoundIdForGuildUser(guildId: string, userId: string): Promise<string | undefined> {
        const entree = await this.prisma.entree.findUnique({
            where: {
                guildid_userid: {
                    guildid: guildId,
                    userid: userId
                }
            }
        })
        return entree?.soundid
    }

    async soundPlayed(userId: string, soundId: string): Promise<void> {
        await this.prisma.play.create({
            data: {
                soundid: soundId,
                userid: userId
            }
        })
    }

    initialize(): Promise<void> {
        throw new Error("Method not implemented.");
    }

}