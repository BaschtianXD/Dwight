import { Snowflake } from "discord.js";
import IAsyncInitializable from "./IAsyncInitializable";

export interface ISoundProvider extends IAsyncInitializable {

	/**
	 * 
	 * @param guildId Id of guild
	 * @returns A promise resolving to the list of sounds of the given guild
	 */
	getSoundsForGuild(guildId: Snowflake): Promise<TSoundListEntry[]>

	/**
	 * 
	 * @param soundId  Id of the sound
	 * @returns A promise resolving to the filepath to the given sound
	 */
	getPathToSound(soundId: Snowflake): Promise<string>

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
	 */
	getEntreeSoundIdForGuildUser(guildId: Snowflake, userId: Snowflake): Promise<Snowflake | undefined>

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
	soundUsed,
	limitReached,
	duplicatedName,
	noSoundFoundForId,
	fileTooLarge
}