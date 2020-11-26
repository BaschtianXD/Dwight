import { Snowflake } from "discord.js";
import { EventEmitter } from "events";
import IAsyncInitializable from "./IAsyncInitializable";
import { TypedEmitter } from 'tiny-typed-emitter';

export interface ISoundProviderEvents {
	"soundsChangedForGuild": (guildId: string) => void
}

export interface ISoundProvider extends IAsyncInitializable, TypedEmitter<ISoundProviderEvents> {

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
	 * @returns A promise for chaining
	 */
	addSoundForGuild(guildId: Snowflake, url: string, name: string): Promise<void>

	/**
	 * 
	 * @param soundId If of the sound to remove
	 * @returns A promise for chaining
	 */
	removeSound(soundId: Snowflake): Promise<void>

	/**
	 * 
	 * @param guildId Id of the guild
	 * @returns A promise for chaining
	 */
	removeAllSoundsForGuild(guildId: Snowflake): Promise<void>

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
	name: string
}