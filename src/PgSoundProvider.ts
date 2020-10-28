import { ISoundProvider, TSoundListEntry } from "./interfaces/ISoundProvider";
import * as db from "./db"
import { Snowflake, SnowflakeUtil } from "discord.js";
import * as fs from "fs"
import Axios from "axios";

export default class PgSoundProvider implements ISoundProvider {

	basePath = process.env.DWIGHT_SOUNDS_PATH!
	maxSoundNameLength = 64
	defaultSoundLimit = 20

	constructor() {
	}


	initialize(): Promise<void> {
		return this.prepareDatabase()
	}

	getListOfSoundsForGuild(guildId: string): Promise<TSoundListEntry[]> {
		return db.query("SELECT soundID, soundname FROM sounds.sounds WHERE guildID = $1 ORDER BY soundname ASC", [guildId])
			.then(result => {
				const res = result.rows.map(value => {
					return {
						id: value.soundid as Snowflake,
						name: value.name as string
					}
				})
				return res
			})
	}

	getPathToSound(soundId: string): Promise<string> {
		return new Promise(resolve => resolve(this.basePath + "/" + soundId + ".mp3"))
	}

	addSoundForGuild(guildId: string, url: string, name: string): Promise<void> {
		const id = SnowflakeUtil.generate()
		return Promise.all([this.getAmountOfSounds(guildId), this.getLimitForGuild(guildId)])
			.then(([numSounds, limit]) => new Promise((resolve, reject) => numSounds >= limit ? reject("Limit reached") : resolve()))
			.then(() => this.download(url, this.basePath + "/" + id + ".mp3"))
			.then(() => db.query("INSERT INTO sounds.sounds VALUES ($1, $2, $3)", [id, guildId, name]))
			.then(() => Promise.resolve())
	}

	removeSound(soundId: string): Promise<void> {
		return db.query("DELETE FROM sounds.sounds WHERE soundID = $1", [soundId])
			.then(() => this.getPathToSound(soundId))
			.then(path => fs.promises.unlink(path))
	}

	removeAllSoundsForGuild(guildId: string): Promise<void> {
		return db.query("DELETE FROM sounds.sounds WHERE guildID = $1 RETURNING *", [guildId])
			.then(queryresult => Promise.all(queryresult.rows.map(value => this.getPathToSound(value.soundID))))
			.then(paths => Promise.all(paths.map(value => fs.promises.unlink(value))))
			.then(() => Promise.resolve())
	}

	getAmountOfSounds(guildId: string): Promise<number> {
		return db.query("SELECT count(*) FROM sounds.sounds WHERE guildID = $1", [guildId])
			.then(qresult => parseInt(qresult.rows[0].count))
	}

	getLimitForGuild(guildId: string): Promise<number> {
		return db.query("SELECT maxsounds FROM sounds.limits WHERE guildID = $1", [guildId])
			.then(qResult => {
				if (qResult.rowCount === 1) {
					return Promise.resolve(qResult.rows[0].limit as number)
				} else {
					return Promise.resolve(this.defaultSoundLimit)
				}
			})
	}

	soundPlayed(userId: string, soundId: string): Promise<void> {
		const date = new Date()
		return db.query("INSERT INTO sounds.plays VALUES( $1, $2, $3 )", [userId, soundId, date.toISOString()])
			.then(() => Promise.resolve())
			.catch(reason => console.log(Date.now() + ": " + reason))
	}

	private prepareDatabase() {
		return db.query("CREATE SCHEMA IF NOT EXISTS sounds;")
			.then(_ => db.query("CREATE TABLE IF NOT EXISTS sounds.sounds ( soundID BIGINT PRIMARY KEY, guildID BIGINT NOT NULL, soundname VARCHAR(64) NOT NULL);"))
			.then(_ => db.query("CREATE TABLE IF NOT EXISTS sounds.limits ( guildID BIGINT PRIMARY KEY, maxsounds SMALLINT NOT NULL);"))
			.then(_ => { db.query("CREATE TABLE IF NOT EXISTS sounds.plays ( userID BIGINT NOT NULL, soundID BIGINT NOT NULL, time TIMESTAMPZ NOT NULL);") })
			.catch(reason => {
				throw new Error("DB ERROR - Setup: " + reason)
			})
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


/*
DATABASE LAYOUT
SCHEMA: sounds
TABLE: sounds.sounds:
	FIELDS:
		- soundID: bigint primary key (snowflake)
		- guildID: biging (snowflake)
		- name: varchar(this.maxSoundNameLength)
TABLE: sounds.limits:
	FIELDS:
		- guildID: bigint primary key (snowflake)
		- maxsounds: smallint
TABLE: sounds.plays:
	FIELDS:
		- userID: bigint (snowflake)
		- soundID: bigint (snowflake)
		- time: timestamp


*/