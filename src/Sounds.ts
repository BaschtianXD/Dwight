import { Client, Guild, Snowflake, MessageReaction, User, StreamDispatcher, TextChannel, VoiceChannel, Collection, GuildCreateChannelOptions, GuildChannelManager, Message, DMChannel, NewsChannel, VoiceState } from "discord.js";
import IAsyncInitializable from "./interfaces/IAsyncInitializable";
import { ISoundProvider } from "./interfaces/ISoundProvider";
import PgSoundProvider from "./PgSoundProvider";

export default class Sounds implements IAsyncInitializable {

	// PARAMETER
	maxFileSize = 204800 // 200 kb

	client: Client
	// Snowflake -> Id of channel
	connections: Collection<Snowflake, StreamDispatcher>

	// Message id -> index of sound
	messages: Collection<Snowflake, Snowflake>
	channels: TextChannel[]

	provider: ISoundProvider

	currentBuilds: Guild[]
	needsRebuild: Guild[]

	constructor(client: Client) {
		this.client = client
		this.connections = new Collection()
		this.messages = new Collection()
		this.channels = []
		this.currentBuilds = []
		this.needsRebuild = []

		this.provider = new PgSoundProvider()
	}

	initialize(): Promise<void> {
		return this.provider.initialize()
			.then(_ => {
				// Typecasting as we dont have partials enabled
				this.client.on("messageReactionAdd", (reaction, user) => this.onMessageReactionAdd(reaction, user as User))
				this.client.on("ready", () => this.onReady(this.client))
				this.client.on("guildCreate", guild => this.onGuildCreate(guild))
				this.client.on("guildDelete", guild => this.onGuildDelete(guild))
				this.client.on("message", message => this.onMessage(message as Message))
				this.provider.on("soundsChangedForGuild", this.onSoundsChangedForGuild)
				console.log("Sounds initialized")
			})
	}

	onReady(client: Client) {
		const guilds = Array.from(client.guilds.cache.values())
		guilds.reduce((acc, cur) => acc.then(() => this.initForGuild(cur)), Promise.resolve())
			.catch(reason => {
				console.error(new Date() + ": " + reason)
				console.trace()
			})
	}

	initForGuild(guild: Guild): Promise<void> {
		if (!this.client.user) {
			// Typescript cleanup
			throw new Error("no user available. log in first!")
		}

		// check if the channel is getting build right now
		if (this.currentBuilds.includes(guild)) {
			this.needsRebuild.push(guild)
			return Promise.resolve()
		}
		const channelManager = guild.channels
		this.currentBuilds.push(guild)
		return this.createChannel(channelManager, this.client.user.id)
			.then(this.addSoundsToChannel.bind(this))
			.then(() => {
				this.currentBuilds.splice(this.currentBuilds.indexOf(guild), 1)
				const index = this.needsRebuild.indexOf(guild)
				if (index !== -1) {
					this.needsRebuild.splice(index, 1)
					return this.initForGuild(guild)
				}
			})
			.catch(reason => {
				console.error(new Date() + ": " + reason)
				console.trace()
			})

	}

	createChannel(channelManager: GuildChannelManager, userId: Snowflake): Promise<TextChannel> {
		const options: GuildCreateChannelOptions = {
			type: "text",
			topic: "Here are the sounds you can play. Press the reaction of a sound to play it in your voice channel. Send '!add_sound soundname' with a soundfile (mp3, max 200kb) attached to this channel to add a sound and send '!remove_sound soundname' to this channel to remove a sound.",
			permissionOverwrites: [
				{
					id: channelManager.guild.id,
					deny: ['SEND_MESSAGES', 'ADD_REACTIONS']
				},
				{
					id: userId,
					allow: ['SEND_MESSAGES', 'ADD_REACTIONS']
				}
			]
		}

		const oldChannel = channelManager.cache.find(channel => channel.name === "sounds" && channel.type === "text")
		if (oldChannel) {
			if (oldChannel.deletable) {
				options.position = oldChannel.position
				options.permissionOverwrites = oldChannel.permissionOverwrites
				return oldChannel.delete("I need to recreate the channel")
					.then(() => channelManager.create("sounds", options) as Promise<TextChannel>)
					.then(channel => {
						this.channels.push(channel)
						return channel
					})
			} else {
				if (channelManager.guild.owner) {
					channelManager.guild.owner.send("I could not delete the current sounds channel. Please check my permissions and allow me to do so. Then try again or contact my creator Bauer#9456.")
				}
				return Promise.reject("missing permission")
			}
		} else {
			return channelManager.create("sounds", options)
				.then(channel => {
					this.channels.push(channel as TextChannel)
					return channel as TextChannel
				})
		}
	}

	addSoundsToChannel(channel: TextChannel): Promise<void> {
		return this.provider.getSoundsForGuild(channel.guild.id)
			.then(list => list.reduce((acc, cur) =>
				acc.then(() => channel.send(cur.name))
					.then(message => message.react("🔊"))
					.then(reaction => {
						this.messages.set(reaction.message.id, cur.id)
					}), Promise.resolve()))
			.catch(reason => {
				console.error(new Date() + ": " + reason)
				console.trace()
			})
	}

	onMessageReactionAdd(messageReaction: MessageReaction, user: User) {
		if (user.id === this.client.user?.id || !(messageReaction.message.guild)) {
			return
		}
		const guild = messageReaction.message.guild
		if (this.channels.includes(messageReaction.message.channel as TextChannel)) {
			const voiceChannel = guild.member(user)?.voice.channel
			const soundId = this.messages.get(messageReaction.message.id)
			if (voiceChannel && soundId) {
				this.playSoundInChannel(soundId, voiceChannel, user.id)
			}

			// remove reaction
			messageReaction.users.remove(user)
				.catch(reason => {
					console.error(new Date() + ": " + reason)
					console.trace()
				})
		}
	}

	playSoundInChannel(soundId: Snowflake, voiceChannel: VoiceChannel, userId: Snowflake) {
		const disp = this.connections.get(voiceChannel.id)
		if (disp) {
			disp.pause()
		} else {
			this.provider.getPathToSound(soundId)
				.then(soundPath => Promise.all([soundPath, voiceChannel.join()]))
				.then(([soundPath, connection]) => {
					const dispatcher = connection.play(soundPath, { "volume": false })
					dispatcher.on("speaking", speaking => {
						if (!speaking) {
							voiceChannel.leave()
							this.connections.delete(voiceChannel.id)
						}
					})
					this.connections.set(voiceChannel.id, dispatcher)
					this.provider.soundPlayed(userId, soundId)
				})
				.catch(reason => {
					console.error(new Date() + ": " + reason)
					console.trace()
				})

		}

	}

	onGuildCreate(guild: Guild) {
		this.initForGuild(guild)
	}


	onGuildDelete(guild: Guild): void {
		this.provider.removeAllSoundsForGuild(guild.id)
	}

	onVoiceStateChanged(oldState: VoiceState, newState: VoiceState): void {
		const userId = "360059142490292224"
		if (newState.id === userId && newState.guild.id === "486553873192976417" && oldState.channelID === null && newState.channel) {
			this.playSoundInChannel("781650765268779014", newState.channel, newState.client.user!.id)
		}
	}

	onMessage(message: Message) {
		if (message.author.id !== this.client.user?.id && this.isTextChannel(message.channel) && this.channels.includes(message.channel)) {
			const guild = message.channel.guild
			const author = message.author
			const index = message.content.indexOf(" ")
			if (index !== -1 && message.content.substring(index + 1).length > 0) {
				const name = message.content.substring(index + 1)
				if (message.content.substring(0, index) === "!add_sound") {
					if (message.attachments.size < 1) {
						author.send("no sound attached to add.")
					} else if (message.attachments.size > 1) {
						author.send("only 1 sound allowed per command")
					} else {
						const attachment = message.attachments.first()!
						if (attachment.size > this.maxFileSize) {
							author.send("sound is too big. Max 200kb")
						} else if (!attachment.name || attachment.name.endsWith(".mp3") && !attachment.name.includes("\\") && !attachment.name.includes("'") && attachment.name.length < this.provider.maxSoundNameLength) {
							this.provider.addSoundForGuild(message.channel.guild.id, attachment.url, name)
								.then(_ => this.initForGuild(guild))
								.catch(reason => {
									if (reason === "limit reached") {
										author.send("you have already reached the maximum number of sounds.")
										return
									}
									author.send("there was an error, sorry")
									console.error(Date.now() + ": " + reason)
									console.trace()
								})
						}
					}
				} else if (message.content.substring(0, index) === "!remove_sound" || message.content.substring(0, index) === "!delete_sound") {
					this.provider.getSoundsForGuild(guild.id)
						.then(list => {
							const rest = list.filter(value => value.name === name)
							if (rest[0]) {
								this.provider.removeSound(rest[0].id)
									.catch(err => author.send("There was an error deleting the requested sound."))
							} else {
								author.send("No sound with that name found.")
							}
						})
				}
			}
			message.delete()
				.catch(reason => {
					console.error(Date.now() + ": " + reason)
					console.trace()
				})
		}

	}

	async onSoundsChangedForGuild(guildId: string) {
		try {
			this.initForGuild(await this.client.guilds.fetch(guildId))
		}
		catch (err) {
			console.log("ERROR AFTER SOUNDSCHANGEDFORGUILD")
			console.log(err)
		}

	}

	isTextChannel(channel: TextChannel | DMChannel | NewsChannel): channel is TextChannel {
		return channel.type === "text"
	}
}