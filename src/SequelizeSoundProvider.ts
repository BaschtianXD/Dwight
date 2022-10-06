import { SnowflakeUtil } from "discord.js";
import { Sequelize, Dialect } from "@sequelize/core";
import { ErrorTypes, ISoundProvider, TEntreeListEntry, TSoundListEntry } from "./interfaces/ISoundProvider";
import Entree from "./models/Entree";
import Limit from "./models/Limit";
import Play from "./models/Play";
import Sound from "./models/Sound";
import * as fs from "fs"
import Axios from "axios";
import { exec } from "child_process";

export const sequelize = new Sequelize({
    dialect: process.env.DBDIALECT! as Dialect,
    database: process.env.DBDATABASE,
    username: process.env.DBUSER,
    password: process.env.DBPASSWORD,
    host: process.env.DBHOST,
    logging: process.env.NODE_ENV === "DEVELOPMENT" ? console.log : false
})


export default class SequelizeSoundProvider implements ISoundProvider {

    constructor() {
        Sound.add(sequelize)
        Limit.add(sequelize)
        Play.add(sequelize)
        Entree.add(sequelize)
    }

    maxSoundNameLength: number = 64
    basePath = process.env.DWIGHT_SOUNDS_PATH!
    defaultSoundLimit = 20


    async getSoundsForGuild(guildId: string): Promise<TSoundListEntry[]> {
        const result = await Sound.findAll({
            attributes: [
                "soundID", "soundName", "hidden"
            ],
            where: {
                guildID: guildId,
                deleted: false
            },
            order: [
                ["soundName", "ASC"]
            ]
        })
        return result.map(row => {
            return {
                id: row.soundID,
                name: row.soundName,
                hidden: row.hidden
            }
        })
    }

    getPathToSound(soundId: string): Promise<string> {
        return new Promise(resolve => resolve(this.basePath + "/" + soundId + ".opus"))
    }

    async addSoundForGuild(guildId: string, url: string, name: string, hidden: boolean): Promise<void> {
        const id = SnowflakeUtil.generate()
        const sounds = await Sound.findAll({ where: { guildID: guildId, deleted: false } })
        const limit = await this.getLimitForGuild(guildId)
        if (sounds.length >= limit) {
            return Promise.reject(ErrorTypes.limitReached)
        }
        if (sounds.some(sound => sound.soundName === name)) {
            return Promise.reject(ErrorTypes.duplicatedName)
        }
        try {
            // TODO
            // download to temporary folder and convert to opus
            // ffmpeg -i 897995667325190145.mp3 -c:a libopus -b:a 64k -vbr on -compression_level 10 -frame_duration 60 897995667325190145.opus
            const tempFilePath = this.basePath + "/conv/" + id + ".mp3"
            const finalFilePath = this.basePath + "/" + id + ".opus"
            await this.download(url, tempFilePath)
            let prom = new Promise<void>((resolve, reject) => {
                exec("ffmpeg -i " + tempFilePath + " -c:a libopus -b:a 64k -vbr on -compression_level 10 -frame_duration 60 " + finalFilePath, (err, _stdout, _stderr) => {
                    if (err) {
                        reject()
                    } else {
                        resolve()
                    }
                })
            })
            prom.then(() => {
                let prom = new Promise<void>((resolve, reject) => {
                    fs.unlink(tempFilePath, (err) => {
                        if (err) {
                            reject()
                        } else {
                            resolve()
                        }
                    })
                })
                return prom
            })
            await prom
        } catch (err) {
            return Promise.reject(ErrorTypes.fileTooLarge)
        }
        return Sound.create({
            soundID: id.toString(),
            guildID: guildId,
            soundName: name,
            hidden: hidden
        }).then()
    }

    async removeSound(soundId: string): Promise<void> {
        const entree = await Entree.findOne({ where: { soundID: soundId } })
        if (entree) {
            // There exists an Entree using the requested sound.
            return Promise.reject(ErrorTypes.soundUsed)
        }
        const sound = await Sound.findOne({ where: { soundID: soundId } })
        if (sound) {
            sound.deleted = true
            return sound.save().then()
        } else {
            return Promise.reject()
        }
    }

    renameSound(soundId: string, newName: string): Promise<void> {
        return Sound.findByPk(soundId)
            .then(sound => {
                if (!sound) {
                    return Promise.reject(ErrorTypes.noSoundFoundForId)
                }
                sound.soundName = newName
                return sound.save()
            })
            .then()
    }

    async removeAllDataForGuild(guildId: string): Promise<void> {
        try {

            return await sequelize.transaction(async (t) => {

                await Entree.destroy({
                    where: {
                        guildID: guildId
                    },
                    transaction: t
                })

                await Sound.update({ deleted: true },
                    {
                        where:
                            { guildID: guildId },
                        transaction: t
                    })

                return;

            });

            // If the execution reaches this line, the transaction has been committed successfully
            // `result` is whatever was returned from the transaction callback

        } catch (error) {

            // If the execution reaches this line, an error occurred.
            // The transaction has already been rolled back automatically by Sequelize!

        }
    }

    async addEntree(guildId: string, userId: string, soundId: string): Promise<void> {
        return Entree.create({ guildID: guildId, userID: userId, soundID: soundId }).then()
    }

    async removeEntree(guildId: string, userId: string): Promise<void> {
        return Entree.destroy({ where: { guildID: guildId, userID: userId } }).then()
    }

    async getEntreesForGuild(guildId: string): Promise<TEntreeListEntry[]> {
        return Entree.findAll({
            attributes: ["userID"],
            where: { guildID: guildId },
            include: {
                model: Sound,
                attributes: ["soundName"]
            }
        })
            .then(entrees => {
                return entrees.map(entree => {
                    return {
                        userId: entree.userID,
                        soundName: entree.sound!.soundName // sound is included in query
                    }
                })
            })
    }

    async getEntreeSoundIdForGuildUser(guildId: string, userId: string): Promise<string | undefined> {
        return Entree.findOne({ where: { userID: userId, guildID: guildId } })
            .then(entree => entree?.soundID)
    }

    async getAmountOfSounds(guildId: string): Promise<number> {
        return Sound.count({ where: { guildID: guildId, deleted: false } })
    }

    async getLimitForGuild(guildId: string): Promise<number> {
        return Limit.findByPk(guildId)
            .then(limit => limit ? Number(limit.maxsounds) : this.defaultSoundLimit)
    }

    async soundPlayed(userId: string, soundId: string): Promise<void> {
        return Play.create({ userID: userId, soundID: soundId, time: new Date() })
            .then()
    }

    async initialize(): Promise<void> {

        return sequelize.sync().then()
    }

    private async download(url: string, destination: string): Promise<void> {
        return Axios({
            method: "get",
            url: url,
            responseType: "stream",
            maxContentLength: 2000000
        })
            .then(response => {
                response.data.pipe(fs.createWriteStream(destination))
            })
    }

}
