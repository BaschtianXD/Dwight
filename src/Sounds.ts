import { Client, Guild, Snowflake, MessageReaction, User, StreamDispatcher, TextChannel, VoiceChannel, Collection, GuildCreateChannelOptions, GuildChannelManager, Message } from "discord.js";
import IAsyncInitializable from "./interfaces/IAsyncInitializable";
import { ISoundProvider } from "./interfaces/ISoundProvider";
import PgSoundProvider from "./PgSoundProvider";

export default class Sounds implements IAsyncInitializable {

	//PARAMETER
	maxFileSize = 204800 // 200 kb

	client: Client
	// Snowflake -> Id of channel
	connections: Collection<Snowflake, StreamDispatcher>

	// Message id -> index of sound
	messages: Collection<Snowflake, Snowflake>
	channels: Snowflake[]

	provider: ISoundProvider

	constructor(client: Client) {
		this.client = client
		this.connections = new Collection()
		this.messages = new Collection()
		this.channels = []

		// TODO
		this.provider = new PgSoundProvider()
	}

	initialize(): Promise<void> {
		return this.provider.initialize()
			.then(_ => {
				// Typecasting as we dont have partials enabled
				this.client.on("messageReactionAdd", (reaction, user) => this.onMessageReactionAdd(reaction, user as User))
				this.client.on("ready", _ => this.onReady(this.client))
				this.client.on("guildCreate", guild => this.onGuildCreate(guild))
				this.client.on("guildDelete", guild => this.onGuildDelete(guild))
				this.client.on("message", message => this.onMessage(message as Message))
				console.log("Sounds initialized")
			})
	}

	onReady(client: Client) {
		const guilds = Array.from(client.guilds.cache.values())
		guilds.forEach(guild => {
			this.initForGuild(guild)
		})
	}

	initForGuild(guild: Guild): Promise<void> {
		if (!this.client.user) {
			// Typescript cleanup
			throw new Error("no user available. log in first!")
		}
		const options: GuildCreateChannelOptions = {
			type: "text",
			topic: "Here are the sounds you can play. Press the reaction of a sound to play it in your voice channel.",
			permissionOverwrites: [
				{
					id: guild.id,
					deny: ['SEND_MESSAGES', 'ADD_REACTIONS']
				},
				{
					id: this.client.user.id,
					allow: ['SEND_MESSAGES', 'ADD_REACTIONS']
				}
			]
		}
		var channelManager: GuildChannelManager
		return this.provider.getAmountOfSounds(guild.id)
			.then(() => {
				channelManager = guild.channels
				const oldChannel = channelManager.cache.find(channel => channel.name === "sounds" && channel.type === "text") as TextChannel
				if (oldChannel) {
					options.position = oldChannel.position
					return oldChannel.delete("recreation of channel")
				}
			})
			.then(() => this.createChannel(channelManager, options))
			.catch(reason => {
				console.log(Date.now() + ": " + reason)
				console.trace()
			})

	}

	createChannel(channelManager: GuildChannelManager, options: GuildCreateChannelOptions) {
		channelManager.create("sounds", options)
			.then((channel: TextChannel) => {
				this.channels.push(channel.id)
				this.addSoundsToChannel(channel)
			}).catch(reason => {
				console.log(new Date() + ": " + reason)
				console.trace()
			})
	}

	addSoundsToChannel(channel: TextChannel) {
		this.provider.getListOfSoundsForGuild(channel.guild.id)
			.then(list => {
				list.forEach((sound) => {
					channel.send(sound.name)
						.then(message => message.react("🔊"))
						.then(messagereaction => {
							this.messages.set(messagereaction.message.id, sound.id)
						})
						.catch(reason => {
							console.log(new Date() + ": " + reason)
							console.trace()
						})
				}
				)
			})
	}

	onMessageReactionAdd(messageReaction: MessageReaction, user: User) {
		if (user.id === this.client.user?.id || !(messageReaction.message.guild)) {
			return
		}
		const guild = messageReaction.message.guild
		if (this.channels.includes(messageReaction.message.channel.id)) {
			const voiceChannel = guild.member(user)?.voice.channel
			const soundId = this.messages.get(messageReaction.message.id)
			if (voiceChannel && soundId) {
				this.playSoundInChannel(soundId, voiceChannel, user.id)
			}

			// remove reaction
			messageReaction.users.remove(user)
				.catch(reason => {
					console.log(new Date() + ": " + reason)
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
					console.log(new Date() + ": " + reason)
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

	onMessage(message: Message) {
		if (message.author.id !== this.client.user?.id && this.channels.includes(message.channel.id) && message.guild) {
			const guild = message.guild
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
							const guild = message.guild
							this.provider.addSoundForGuild(guild.id, attachment.url, name)
								.then(_ => {
									this.initForGuild(guild)
								})
								.catch(reason => {
									author.send("there was an error, sorry")
									console.log(Date.now() + ": " + reason)
									console.trace()
								})
						}
					}
				} else if (message.content.substring(0, index) === "!remove_sound" || message.content.substring(0, index) === "!delete_sound") {
					this.provider.getListOfSoundsForGuild(message.guild.id)
						.then(list => {
							const rest = list.filter(value => value.name === name)
							if (rest[0]) {
								this.provider.removeSound(rest[0].id)
									//.then(() => author.send("Sound " + rest[0].name + " deleted."))
									.then(() => this.initForGuild(guild))
							} else {
								author.send("No sound with that name found.")
							}
						})
				}
			}
			message.delete()
				.catch(reason => {
					console.log(Date.now() + ": " + reason)
					console.trace()
				})
		}

	}
}