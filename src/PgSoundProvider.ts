import { ISoundProvider, TEntreeListEntry, TSoundListEntry, ErrorTypes } from "./interfaces/ISoundProvider";
import * as db from "./db"
import { Snowflake, SnowflakeUtil } from "discord.js";
import * as fs from "fs"
import Axios from "axios";

export default class PgSoundProvider implements ISoundProvider {

	basePath = process.env.DWIGHT_SOUNDS_PATH!
	maxSoundNameLength = 64
	defaultSoundLimit = 20


	getEntreeSoundIdForGuildUser(guildId: string, userId: string): Promise<string | undefined> {
		return db.query<{ soundid: string }>("SELECT soundid FROM sounds.entrees WHERE guildID = $1 AND userID = $2;", [guildId, userId])
			.then(qRes => {
				if (qRes.rowCount === 1) {
					return qRes.rows[0].soundid
				}
			})
	}

	addEntree(guildId: string, userId: string, soundId: string): Promise<void> {
		return db.query("INSERT INTO sounds.entrees VALUES ($1, $2, $3) ON CONFLICT (guildID, userID) DO UPDATE SET soundID = $3;", [guildId, userId, soundId])
			.then()
	}
	removeEntree(guildId: string, userId: string): Promise<void> {
		return db.query("DELETE FROM sounds.entrees WHERE guildID = $1 AND userID = $2;", [guildId, userId])
			.then()
	}
	getEntreesForGuild(guildId: string): Promise<TEntreeListEntry[]> {
		return db.query<{ userid: string, soundname: string }>("SELECT userid, soundname FROM sounds.entrees NATURAL JOIN sounds.sounds WHERE guildID = $1;", [guildId])
			.then(qResult => {
				return qResult.rows.map(row => { return { userId: row.userid, soundName: row.soundname } })
			})
	}


	initialize(): Promise<void> {
		return this.prepareDatabase()
	}

	getSoundsForGuild(guildId: string): Promise<TSoundListEntry[]> {
		return db.query<{ soundid: string, soundname: string, hidden: boolean }>("SELECT soundID, soundname, hidden FROM sounds.sounds WHERE guildid = $1 AND deleted = false ORDER BY soundname ASC;", [guildId])
			.then(result => {
				const res = result.rows.map(value => {
					return {
						id: value.soundid,
						name: value.soundname,
						hidden: value.hidden
					}
				})
				return res
			})
	}

	getPathToSound(soundId: string): Promise<string> {
		return new Promise(resolve => resolve(this.basePath + "/" + soundId + ".mp3"))
	}

	addSoundForGuild(guildId: string, url: string, name: string, hidden: boolean): Promise<void> {
		const id = SnowflakeUtil.generate()
		return Promise.all([this.getAmountOfSounds(guildId), this.getLimitForGuild(guildId)])
			.then(([numSounds, limit]) => new Promise<void>((resolve, reject) => numSounds >= limit ? reject("Limit reached") : resolve()))
			.then(() => this.download(url, this.basePath + "/" + id + ".mp3"))
			.then(() => db.query("INSERT INTO sounds.sounds VALUES ($1, $2, $3, $4);", [id, guildId, name, String(hidden)]))
			.then(() => Promise.resolve())
	}

	removeSound(soundId: string): Promise<void> {
		return db.query("UPDATE sounds.sounds SET deleted = true WHERE soundid = $1;", [soundId])
			.then(_ => { })
			.catch(err => {
				if (err.code === "23503") {
					return Promise.reject(ErrorTypes.soundUsed)
				} else {
					return Promise.reject(err)
				}
			})
	}

	removeAllDataForGuild(guildId: string): Promise<void> {
		return db.query("DELETE FROM sounds.entrees WHERE guildID = $1", [guildId])
			.then(() => db.query("UPDATE sounds.sounds SET deleted = true WHERE guildID = $1;", [guildId]))
			.then(() => Promise.resolve())
	}

	getAmountOfSounds(guildId: string): Promise<number> {
		return db.query<{ count: string }>("SELECT count(*) FROM sounds.sounds WHERE guildID = $1 AND deleted = false", [guildId])
			.then(qresult => parseInt(qresult.rows[0].count))
	}

	getLimitForGuild(guildId: string): Promise<number> {
		return db.query<{ maxsounds: number }>("SELECT maxsounds FROM sounds.limits WHERE guildID = $1", [guildId])
			.then(qResult => {
				if (qResult.rowCount === 1) {
					return Promise.resolve(qResult.rows[0].maxsounds)
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
			.then(_ => db.query("CREATE TABLE IF NOT EXISTS sounds.sounds ( soundID BIGINT PRIMARY KEY, guildID BIGINT NOT NULL, soundname VARCHAR(64) NOT NULL, hidden BOOLEAN NOT NULL DEFAULT false, deleted BOOLEAN NOT NULL DEFAULT false);"))
			.then(_ => db.query("CREATE TABLE IF NOT EXISTS sounds.limits ( guildID BIGINT PRIMARY KEY, maxsounds SMALLINT NOT NULL);"))
			.then(_ => db.query("CREATE TABLE IF NOT EXISTS sounds.entrees ( guildID BIGINT, userID BIGINT, soundID BIGINT REFERENCES sounds.sounds, PRIMARY KEY (guildID, userID) );"))
			.then(_ => { db.query("CREATE TABLE IF NOT EXISTS sounds.plays ( userID BIGINT NOT NULL, soundID BIGINT NOT NULL, time TIMESTAMPTZ NOT NULL);") })
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
		- soundid: bigint primary key (snowflake)
		- guildid: biging (snowflake)
		- soundname: varchar(this.maxSoundNameLength)
		- hidden: boolean (default false)
		- deleted: boolean (default false)
TABLE: sounds.limits:
	FIELDS:
		- guildid: bigint primary key (snowflake)
		- maxsounds: smallint
TABLE: sounds.plays:
	FIELDS:
		- userid: bigint (snowflake)
		- soundid: bigint (snowflake)
		- time: timestamp
TABLE: sounds.entrees:
	FIELDS:
		- guildid: bigint primary key
		- userid: bigint primary key
		- soundid: bigint foreign key to sounds.sounds

*/