import { Client, Guild, Snowflake, TextChannel, VoiceChannel, Collection, GuildChannelManager, Message, VoiceState, Channel, StageChannel, GuildChannelCreateOptions, PartialDMChannel, Interaction, CommandInteraction, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { joinVoiceChannel, getVoiceConnection, createAudioResource, createAudioPlayer, AudioPlayerStatus, VoiceConnectionStatus, AudioPlayer, StreamType } from "@discordjs/voice";
import PrismaSoundProvider from "./PrismaSoundProvider";

export default class Sounds {

	client: Client

	// ChannelId -> AudioPlayer
	players: Collection<Snowflake, AudioPlayer>

	channels: Snowflake[] // Id of channel

	provider: PrismaSoundProvider
	needsRebuild: Set<Guild>

	constructor(client: Client) {
		this.client = client
		this.needsRebuild = new Set()
		this.players = new Collection()
		this.provider = new PrismaSoundProvider()
	}

	initialize() {
		this.client.on("guildCreate", guild => this.onGuildCreate(guild))
		this.client.on("guildDelete", guild => this.onGuildDelete(guild))
		this.client.on("voiceStateUpdate", (oldState, newState) => this.onVoiceStateChanged(oldState as VoiceState, newState as VoiceState))
		this.client.on("interactionCreate", interaction => this.onInteractionCreate(interaction))
		console.log("Sounds initialized")
	}

	async initForGuild(guild: Guild) {
		if (!this.client.user) {
			// Typescript cleanup
			throw new Error("no user available. log in first!")
		}

		const channelManager = guild.channels
		try {
			const channel = await this.createChannel(channelManager, this.client.user.id)
			this.addSoundsToChannel(channel)
		} catch (err) {
			console.error(new Date() + ": " + err)
			console.trace()
			return Promise.reject()
		}

	}

	async createChannel(channelManager: GuildChannelManager, userId: Snowflake): Promise<TextChannel> {

		const options: GuildChannelCreateOptions = {
			name: "sounds",
			type: ChannelType.GuildText,
			topic: "Here are the sounds you can play. Press the button of a sound to play it in your voice channel.",
			permissionOverwrites: [
				{
					id: channelManager.guild.id,
					deny: ["SendMessages", "AddReactions"]
				},
				{
					id: userId,
					allow: ["SendMessages", "AddReactions"]
				}
			]
		}

		const channels = await channelManager.fetch()
		const oldChannel = channels.find(channel => channel?.name === "sounds" && channel.type === ChannelType.GuildText) as TextChannel | undefined
		if (oldChannel) {
			if (oldChannel.deletable) {
				options.parent = oldChannel.parentId ?? undefined
				options.position = oldChannel.position
				options.permissionOverwrites = oldChannel.permissionOverwrites.cache.map(foo => foo)
				return oldChannel.delete()
					.then(() => channelManager.create(options) as Promise<TextChannel>)
					.then(channel => {
						return channel
					})
			} else {
				try {
					let owner = await channelManager.guild.members.fetch(channelManager.guild.ownerId)
					if (owner) {
						owner.send("I could not delete the current sounds channel. Please check my permissions and allow me to do so. Then try again or contact my creator Bauer#9456.")
					}
				} catch (err) {
					console.error(new Date() + ": " + err)
				}
				return Promise.reject("missing permission")
			}
		} else {
			return channelManager.create(options)
				.then(channel => {
					return channel as TextChannel
				})
		}
	}

	async addSoundsToChannel(channel: TextChannel): Promise<void> {
		let sounds = (await this.provider.getSoundsForGuild(channel.guild.id)).filter(sound => !sound.hidden)
		let rows = chunk(sounds, 5).map(sounds => {
			let row = new ActionRowBuilder<ButtonBuilder>()
			for (let sound of sounds) {
				row = row.addComponents(new ButtonBuilder().setCustomId(sound.id).setLabel(sound.name).setStyle(ButtonStyle.Secondary))
			}
			return row
		})
		let messages = chunk(rows, 5)
		messages.reduce((acc, rows) => {
			return acc.then(_ => {
				channel.send({
					content: "Sounds:",
					components: rows
				})
			})
		}, Promise.resolve())
		return Promise.resolve()
	}

	async playSoundInChannel(soundId: Snowflake, voiceChannel: VoiceChannel | StageChannel, userId: Snowflake): Promise<PlayResult> {
		return new Promise(async (resolve, reject) => {
			var oldPlayer = this.players.get(voiceChannel.id)
			const pathToSound = await this.provider.getPathToSound(soundId)
			let resource = createAudioResource(pathToSound) // TODO change to not call ffmpeg on the fly
			if (oldPlayer) {
				// Currently playing a sound in a channel
				// Overwrite old resource and play new
				oldPlayer.play(resource)
				resolve({ result: PlayResultOption.Overwritten })
			} else {
				let player = createAudioPlayer()
				this.players.set(voiceChannel.id, player)
				player.play(resource) // Does not start playing until we have at leats 1 subscriber
				let connection = joinVoiceChannel({
					channelId: voiceChannel.id,
					guildId: voiceChannel.guildId,
					adapterCreator: voiceChannel.guild.voiceAdapterCreator
				})
				connection.on(VoiceConnectionStatus.Ready, () => {
					let prom = new Promise<void>((resolve, reject) => {
						connection.subscribe(player) // Player should start automatically
						this.provider.soundPlayed(userId, soundId)
							.catch(_ => console.warn("Could not log a play."))
						player.on(AudioPlayerStatus.Idle, () => {
							connection.disconnect() // TODO check if these actions were successfull
							connection.destroy()
							player.stop()
							this.players.delete(voiceChannel.id)
							resolve()
						})
					})
					resolve({ result: PlayResultOption.Played, finish: prom })

				})
			}
		})
	}

	cancelSound(guild: Guild) {
		let voice = getVoiceConnection(guild.id)
		if (!voice || !voice.joinConfig.channelId) return false
		let player = this.players.get(voice.joinConfig.channelId)
		if (!player) return false
		return player.stop()
	}

	onGuildCreate(guild: Guild) {
		console.log("ADDED to new guild: " + guild.name + " id: " + guild.id)
	}

	onGuildDelete(guild: Guild): void {
		console.log("REMOVED from guild: " + guild.name + " id: " + guild.id)
		this.provider.removeAllDataForGuild(guild.id)
			.catch(error => {
				console.error(new Date() + ": " + error)
				console.trace()
			})
	}

	onVoiceStateChanged(oldState: VoiceState, newState: VoiceState): void {
		if (oldState.channel || !newState.channel) return
		this.provider.getEntreeSoundIdForGuildUser(newState.guild.id, newState.id)
			.then(soundId => {
				if (!soundId || !newState.channel || !this.client.user) {
					return
				}
				this.playSoundInChannel(soundId, newState.channel, this.client.user.id)
			})
	}

	async onInteractionCreate(interaction: Interaction): Promise<void> {

		if (interaction.isCommand()) {
			(interaction as CommandInteraction).reply({
				ephemeral: true,
				content: "I no longer support configuration via commands. Visit https://dwight.baschtianxd.com to configure me."
			})
		}
		if (interaction.isButton()) {
			let soundId = interaction.customId
			let guild = interaction.guild
			if (!guild) {
				// Button from dm
				interaction.reply({ ephemeral: true, content: "How did you do that?" })
				return
			}
			if (soundId === "cancelPlay") {
				this.cancelSound(guild)
				await interaction.reply({ content: "I stopped the sound." })
				interaction.deleteReply()
				return
			}
			let member = await guild.members.fetch(interaction.user)
			if (!member.voice.channel) {
				// User not in voice channel
				interaction.reply({ ephemeral: true, content: "You need to be in a voice channel I can join for me to play a sound." })
				return
			}
			let row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId("cancelPlay").setLabel("Cancel").setStyle(ButtonStyle.Primary))
			let result = await this.playSoundInChannel(soundId, member.voice.channel, member.id)
			switch (result.result) {
				case PlayResultOption.Played:
					interaction.reply({ content: "Playing...", components: [row] })
					await result.finish
					interaction.deleteReply()
					break
				case PlayResultOption.Overwritten:
					// Do nothing
					break
			}
		}
		return Promise.resolve()
	}

	/**
	 * Checks whether a guild has an already build sound channel
	 */
	async checkChannel(guild: Guild): Promise<boolean> {
		// TODO
		return false
	}

	async loadMessages(channel: TextChannel): Promise<Message[]> {
		var count = 50
		var messages: Message[] = []
		var before: Snowflake | undefined
		var size = 0
		do {
			const msgCollection = await channel.messages.fetch({ limit: count, before })
			size = msgCollection.size
			messages.push(...msgCollection.values())
		} while (size === count)
		return messages
	}

	async addSoundToGuild(guildid: string, name: string, hidden: boolean, createdBy: string): Promise<string> {
		const soundId = this.provider.addSoundToGuild(guildid, name, hidden, createdBy)
		return soundId
	}

	isTextChannel(channel: Channel | PartialDMChannel | null): channel is TextChannel {
		// Partials are turned off
		return channel !== null && !channel.partial && typeof channel.isTextBased === "function" && channel.isTextBased() && typeof channel.isThread === "function" && !channel.isThread()
	}
}

/**
 * Splits an array into an array of array of chunks of the source array
 * @param src Array to chunk
 * @param count Chunksize
 * @returns Array of arrays with the given size
 * @example chunk([1,2,3,4,5], 2) => [[1,2],[3,4],[5]]
 */
function chunk<T>(src: Array<T>, count: number): Array<Array<T>> {
	return src.reduce((acc, curr, index) => {
		let bucket = Math.floor(index / count)
		let slot = index % count
		if (slot === 0) {
			acc[bucket] = []
		}
		acc[bucket][slot] = curr
		return acc
	}, new Array<Array<T>>(Math.ceil(count)))
}

enum PlayResultOption {
	Played,
	Overwritten,
}

type PlayResult = {
	result: PlayResultOption.Played,
	finish: Promise<void>
} | {
	result: PlayResultOption.Overwritten
}
