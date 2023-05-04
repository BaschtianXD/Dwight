import { PrismaClient } from "@prisma/client";
import { envVars } from "./dwight";
import { ISoundProvider, TEntreeListEntry, TSoundListEntry } from "./interfaces/ISoundProvider";
import fs from "fs";

export default class PrismaSoundProvider implements ISoundProvider {

    prisma: PrismaClient

    constructor() {
        this.prisma = new PrismaClient()
    }

    async addSoundToGuild(guildid: string, name: string, hidden: boolean, createdBy: string): Promise<string> {
        const queryResult = await this.prisma.sound.create({
            data: {
                guildid,
                hidden,
                name
            }
        })

        return queryResult.soundid
    }

    async getSoundsForGuild(guildId: string): Promise<TSoundListEntry[]> {
        const queryResult = await this.prisma.sound.findMany({
            select: {
                soundid: true,
                name: true,
                hidden: true
            },
            where: {
                guildid: guildId,
                deleted: false
            }
        })
        return queryResult.map(sound => ({
            id: sound.soundid,
            name: sound.name,
            hidden: sound.hidden
        }))
    }

    async getPathToSound(soundId: string): Promise<string> {
        let path = envVars.SOUNDS_FOLDER_PATH + "/" + soundId + ".opus"
        if (fs.existsSync(path)) {
            return path
        } else {
            console.error("File for requested sound does not exist. Soundid: " + soundId)
            throw (new Error("file not found"))
        }
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

}