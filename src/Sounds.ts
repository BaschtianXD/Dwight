import { Client, Guild, Snowflake, MessageReaction, User, StreamDispatcher, TextChannel, VoiceChannel, Collection, GuildCreateChannelOptions, GuildChannelManager, Message, SnowflakeUtil, GuildChannel } from "discord.js";
import FileSystemSoundProvider from "./FileSystemSoundProvider";
import IAsyncInitializable from "./interfaces/IAsyncInitializable";
import { ISoundProvider } from "./interfaces/ISoundProvider";
import PgSoundProvider from "./PgSoundProvider";

export default class Sounds implements IAsyncInitializable {

	//PARAMETER
	maxFileSize = 204800 // 200 kb

	client: Client
	// Snowflakes of guilds we joined
	guildFlakes: Snowflake[]
	// Snowflake -> Id of channel
	connections: Collection<Snowflake, StreamDispatcher>

	// Message id -> index of sound
	messages: Collection<Snowflake, number>
	channels: Snowflake[]

	provider: ISoundProvider

	constructor(client: Client) {
		this.client = client
		this.guildFlakes = []
		this.connections = new Collection()
		this.messages = new Collection()
		this.channels = []

		// TODO
		this.provider = process.env.NODE_ENV === "development" ? new PgSoundProvider() : new FileSystemSoundProvider()
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
		if ((process.env.NODE_ENV === "development") !== (guild.id !== "608301015384588320")) {
			return Promise.resolve()
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
		// No sounds => no need to init
		return this.provider.getAmountOfSounds(guild.id)
			.then(numSounds => new Promise((resolve, reject) => numSounds > 0 ? resolve() : reject()))
			.then(() => {
				this.guildFlakes.push(guild.id)
				channelManager = guild.channels
				const oldChannel = channelManager.cache.find(channel => channel.name === "sounds" && channel.type === "text") as TextChannel
				if (oldChannel) {
					options.position = oldChannel.position
					return oldChannel.delete("recreation of channel")
				}
			})
			.then(() => this.createChannel(channelManager, options))
	}

	createChannel(channelManager: GuildChannelManager, options: GuildCreateChannelOptions) {
		channelManager.create("sounds", options)
			.then((channel: TextChannel) => {
				this.channels.push(channel.id)
				this.addSoundsToChannel(channel)
			}).catch(reason => {
				console.error(new Date() + ": " + reason)
			})
	}

	addSoundsToChannel(channel: TextChannel) {
		this.provider.getListOfSoundsForGuild(channel.guild.id)
			.then(list => {
				list.forEach((sound, index) => {
					channel.send(sound)
						.then(message => message.react("🔊"))
						.then(messagereaction => {
							this.messages.set(messagereaction.message.id, index)
						})
						.catch(reason => {
							console.log(new Date() + ": " + reason)
						})
				}
				)
			})

	}

	onMessageReactionAdd(messageReaction: MessageReaction, user: User) {
		if (user.id === this.client.user?.id || !(messageReaction.message.guild && this.guildFlakes.includes(messageReaction.message.guild.id))) {
			return
		}
		const guild = messageReaction.message.guild
		if (this.channels.includes(messageReaction.message.channel.id)) {
			const voiceChannel = guild.member(user)?.voice.channel
			if (voiceChannel) {
				this.playSoundInChannel(messageReaction.message.content, voiceChannel)
			}

			// remove reaction
			messageReaction.users.remove(user)
				.catch(reason => console.log(new Date() + ": " + reason))
		}
	}

	playSoundInChannel(sound: string, voiceChannel: VoiceChannel) {
		const disp = this.connections.get(voiceChannel.id)
		if (disp) {
			disp.pause()
		} else {
			this.provider.getPathToSound(sound)
				.then(soundPath => {
					voiceChannel.join()
						.then(connection => {
							const dispatcher = connection.play(soundPath, { "volume": false })
							dispatcher.on("speaking", speaking => {
								if (!speaking) {
									voiceChannel.leave()
									this.connections.delete(voiceChannel.id)
								}
							})
							this.connections.set(voiceChannel.id, dispatcher)
						})
						.catch(reason => console.log(new Date() + ": " + reason))
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
		if (message.guild) {
			if (process.env.NODE_ENV !== "development") {
				return
			}
			const index = message.content.indexOf(" ")
			if (index !== -1 && message.content.substring(0, index) === "!add_sound" && message.content.substring(index + 1).length > 0) {
				if (message.attachments.size < 1) {
					message.reply("no sound attached to add.")
				} else if (message.attachments.size > 1) {
					message.reply("only 1 sound allowed per command")
				} else {
					const name = message.content.substring(index + 1)
					const attachment = message.attachments.first()!
					if (attachment.size > this.maxFileSize) {
						message.reply("sound is too big. Max 200kb")
					} else if (!attachment.name || attachment.name.endsWith(".mp3") && !attachment.name.includes("\\") && !attachment.name.includes("'") && attachment.name.length < this.provider.maxSoundNameLength) {
						const guild = message.guild
						this.provider.addSoundForGuild(guild.id, attachment.url, name)
							.then(_ => {
								this.initForGuild(guild)
							})
							.catch(reason => {
								message.reply("there was an error, sorry")
								console.log(Date.now() + ": " + reason)
							})
					}
				}
			}
		}

	}
}