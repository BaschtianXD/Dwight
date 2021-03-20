import { Snowflake } from "discord.js";
import { EventEmitter } from "events";
import IAsyncInitializable from "./IAsyncInitializable";

export interface ISoundProvider extends IAsyncInitializable {

	maxSoundNameLength: number

	/**
	 * 
	 * @param guildId Id of guild
	 * @returns A promise resolving to the list of sounds of the given guild
	 */
	getSoundsForGuild(guildId: Snowflake): Promise<TSoundListEntry[]>

	/**
	 * 
	 * @param soundId  If of the sound
	 * @returns A promise resolving to the filepath to the given sound
	 */
	getPathToSound(soundId: Snowflake): Promise<string>

	/**
	 * Adds a sound to for a guild. If the guild has already reached the maximum amount of sounds, this fails.
	 * @param guildId Id of the guild
	 * @param url URL to the sound
	 * @param name Name of the sound
	 * @param hidden Set to true if the sound should not appear in the sounds channel
	 * @returns A promise for chaining
	 */
	addSoundForGuild(guildId: Snowflake, url: string, name: string, hidden: boolean): Promise<void>

	/**
	 * 
	 * @param soundId If of the sound to remove
	 * @returns A promise for chaining
	 */
	removeSound(soundId: Snowflake): Promise<void>

	/**
	 * Remove all data for a specified guild
	 * @param guildId Id of the guild
	 * @returns A promise for chaining
	 */
	removeAllDataForGuild(guildId: Snowflake): Promise<void>

	/**
	 * 
	 * @param guildId Id of the guild
	 * @param userId Id of the user
	 * @param soundId Id of the sound
	 * @returns A promise for chaining
	 */
	addEntree(guildId: Snowflake, userId: Snowflake, soundId: Snowflake): Promise<void>

	/**
	 * 
	 * @param guildId Id of the guild
	 * @param userId Id of the user
	 * @returns A promise for chaining
	 */
	removeEntree(guildId: Snowflake, userId: Snowflake): Promise<void>

	/**
	 * 
	 * @param guildId Id of the guildd
	 * @returns A promise with an array of entrees
	 */
	getEntreesForGuild(guildId: Snowflake): Promise<TEntreeListEntry[]>

	/**
	 * 
	 * @param guildId Id of the guild
	 * @param userId Id of the user
	 */
	getEntreeSoundIdForGuildUser(guildId: Snowflake, userId: Snowflake): Promise<Snowflake | undefined>

	/**
	 * 
	 * @param guildId Id of the guild
	 * @returns A promise resolving to the number of sounds the guild has
	 */
	getAmountOfSounds(guildId: Snowflake): Promise<number>

	/**
	 * 
	 * @param guildId Id of the guild
	 * @returns A promise resolving to the limit of sounds for the guild
	 */
	getLimitForGuild(guildId: Snowflake): Promise<number>

	/**
	 * Logs a played sound
	 * @param userId Id of the user
	 * @param soundId Id of the sound
	 */
	soundPlayed(userId: Snowflake, soundId: Snowflake): Promise<void>

}

export type TSoundListEntry = {
	id: Snowflake,
	name: string,
	hidden: boolean
}

export type TEntreeListEntry = {
	userId: Snowflake,
	soundName: string
}

export enum ErrorTypes {
	soundUsed
}