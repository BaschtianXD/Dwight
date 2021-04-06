import { Snowflake } from "discord.js";
import * as fs from "fs";
import { ISoundProvider, TEntreeListEntry, TSoundListEntry } from "./interfaces/ISoundProvider";

/**
 * # This class is not meant to be used in production!
 * It can be used for testing while not requiring a database.
 */
export default class FileSystemSoundProvider implements ISoundProvider {

	baseFilePath: string
	sounds: string[]
	maxSoundNameLength = 64

	constructor() {
		this.baseFilePath = process.env.DWIGHT_SOUNDS_PATH || process.cwd() + "/sounds"

		if (!this.baseFilePath) {
			console.error("No baseFilePath for sounds")
			console.log(this.baseFilePath)
			process.exit(1)
		}
		// This runs on setup, otherwise we cant check higher up.
		const files = fs.readdirSync(this.baseFilePath)
		if (files.length === 0) {
			console.log("Could not read filepath: " + this.baseFilePath)
			return
		}
	}
	renameSound(soundId: string, newName: string): Promise<void> {
		return Promise.resolve()
	}
	getEntreeSoundIdForGuildUser(guildId: string, userId: string): Promise<string | undefined> {
		return Promise.resolve(undefined)
	}
	addEntree(guildId: string, userId: string, soundId: string): Promise<void> {
		return Promise.resolve()
	}
	removeEntree(guildId: string, userId: string): Promise<void> {
		return Promise.resolve()
	}
	getEntreesForGuild(guildId: string): Promise<TEntreeListEntry[]> {
		return Promise.resolve([])
	}
	soundPlayed(userId: string, soundId: string): Promise<void> {
		return Promise.resolve()
	}

	getAmountOfSounds(guildId: string): Promise<number> {
		return Promise.resolve(1)
	}

	initialize(): Promise<void> {
		return new Promise((resolve, reject) => {
			fs.readdir(this.baseFilePath, (err, files) => {
				if (err) {
					reject(err)
				}
				this.sounds = files.filter((file) => file.endsWith(".mp3")).map(file => file.slice(0, -4))
				resolve()
			})
		})
	}

	getSoundsForGuild(guildId: Snowflake): Promise<TSoundListEntry[]> {
		return new Promise(resolve => {
			const res = this.sounds.map(value => {
				return {
					id: value,
					name: value,
					hidden: false
				}
			})
			resolve(res)
		})
	}

	getPathToSound(soundId: Snowflake): Promise<string> {
		return Promise.resolve(this.baseFilePath + "/" + soundId + ".mp3")
	}

	addSoundForGuild(guildId: Snowflake, url: string, name: string): Promise<void> {
		console.log("addSoundForGuild is not implemented in FileSystemSoundProdiver")
		return new Promise((resolve, reject) => reject("not yet implemented"))
	}

	removeSound(soundId: Snowflake): Promise<void> {
		console.log("removeSound is not implemented in FileSystemSoundProvider")
		return new Promise((resolve, reject) => reject("not yet implemented"))
	}

	removeAllDataForGuild(guildId: Snowflake): Promise<void> {
		return new Promise((resolve, reject) => reject("not yet implemented"))
	}

	getLimitForGuild(guildId: Snowflake): Promise<number> {
		return new Promise(resolve => resolve(20))
	}

}