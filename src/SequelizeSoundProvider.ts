import { SnowflakeUtil } from "discord.js";
import { Sequelize } from "sequelize-typescript";
import { Dialect } from "sequelize/types";
import { ErrorTypes, ISoundProvider, TEntreeListEntry, TSoundListEntry } from "./interfaces/ISoundProvider";
import Entree from "./models/Entree";
import Limit from "./models/Limit";
import Play from "./models/Play";
import Sound from "./models/Sound";
import * as fs from "fs"
import Axios from "axios";

const sequelize = new Sequelize({
    dialect: process.env.DBDIALECT! as Dialect,
    database: process.env.DBDATABASE,
    models: [__dirname + '/models'],
    username: process.env.DBUSER,
    password: process.env.DBPASSWORD,
    host: process.env.DBHOST,
    logging: process.env.NODE_ENV === "DEVELOPMENT" ? console.log : false
})

export default class SequelizeSoundProvider implements ISoundProvider {

    maxSoundNameLength: number = 64;
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
        return new Promise(resolve => resolve(this.basePath + "/" + soundId + ".mp3"))
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
        this.download(url, this.basePath + "/" + id + ".mp3")
        return Sound.create({
            soundID: id,
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
            // `result` is whatever was returned from the transaction callback (the `user`, in this case)

        } catch (error) {

            // If the execution reaches this line, an error occurred.
            // The transaction has already been rolled back automatically by Sequelize!

        }
    }

    addEntree(guildId: string, userId: string, soundId: string): Promise<void> {
        return Entree.create({ guildID: guildId, userID: userId, soundID: soundId }).then()
    }

    removeEntree(guildId: string, userId: string): Promise<void> {
        return Entree.destroy({ where: { guildID: guildId, userID: userId } }).then()
    }

    getEntreesForGuild(guildId: string): Promise<TEntreeListEntry[]> {
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
                        soundName: entree.sound.soundName
                    }
                })
            })
    }

    getEntreeSoundIdForGuildUser(guildId: string, userId: string): Promise<string | undefined> {
        return Entree.findOne({ where: { userID: userId, guildID: guildId } })
            .then(entree => entree?.soundID)
    }

    getAmountOfSounds(guildId: string): Promise<number> {
        return Sound.count({ where: { guildID: guildId, deleted: false } })
    }

    getLimitForGuild(guildId: string): Promise<number> {
        return Limit.findByPk(guildId)
            .then(limit => limit ? Number(limit.maxsounds) : this.defaultSoundLimit)
    }

    soundPlayed(userId: string, soundId: string): Promise<void> {
        return Play.create({ userID: userId, soundID: soundId, time: new Date() })
            .then()
    }

    initialize(): Promise<void> {

        return sequelize.sync().then()
    }

    private download(url: string, destination: string): Promise<void> {
        return Axios({
            method: "get",
            url: url,
            responseType: "stream"
        })
            .then(response => {
                response.data.pipe(fs.createWriteStream(destination))
            })
    }

}
