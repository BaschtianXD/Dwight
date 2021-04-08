import { Client, Guild, Snowflake, MessageReaction, User, StreamDispatcher, TextChannel, VoiceChannel, Collection, GuildCreateChannelOptions, GuildChannelManager, Message, DMChannel, NewsChannel, VoiceState, GuildChannel, Channel, GuildMember } from "discord.js";
import IAsyncInitializable from "./interfaces/IAsyncInitializable";
import { ErrorTypes, ISoundProvider } from "./interfaces/ISoundProvider";
import SequelizeSoundProvider from "./SequelizeSoundProvider";

export default class Sounds implements IAsyncInitializable {

	// PARAMETER
	maxFileSize = 204800 // 200 kb

	client: Client
	// Snowflake -> Id of channel
	connections: Collection<Snowflake, StreamDispatcher>

	// Message id -> soundId
	messages: Collection<Snowflake, Snowflake>
	channels: TextChannel[]

	provider: ISoundProvider
	needsRebuild: Set<Guild>

	constructor(client: Client) {
		this.client = client
		this.connections = new Collection()
		this.messages = new Collection()
		this.channels = []
		this.needsRebuild = new Set()

		this.provider = new SequelizeSoundProvider()
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
				this.client.on("voiceStateUpdate", (oldState, newState) => this.onVoiceStateChanged(oldState, newState))
				this.client.ws.on("INTERACTION_CREATE" as any, this.onInteractionCreate)
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

	async initForGuild(guild: Guild) {
		if (!this.client.user) {
			// Typescript cleanup
			throw new Error("no user available. log in first!")
		}
		if (!await this.checkChannel(guild)) {
			const channelManager = guild.channels
			return this.createChannel(channelManager, this.client.user.id)
				.then(channel => {
					this.addSoundsToChannel(channel)
				})
				.catch(reason => {
					console.error(new Date() + ": " + reason)
					console.trace()
					return Promise.reject()
				})
		}

	}

	createChannel(channelManager: GuildChannelManager, userId: Snowflake): Promise<TextChannel> {
		const options: GuildCreateChannelOptions = {
			type: "text",
			topic: "Here are the sounds you can play. Press the reaction of a sound to play it in your voice channel. Send '!help' to this channel to get a list of commands.",
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
			.then(list => {
				list.filter(sound => !sound.hidden).reduce((acc, cur) =>
					acc.then(() => {
						return channel.send(cur.name)
					})
						.then(message => message.react("🔊"))
						.then(reaction => {
							return new Promise(resolve => {
								this.messages.set(reaction.message.id, cur.id)
								// Set timeout so we dont hit the discord api rate limit
								setTimeout(() => resolve(), 1000)
							})
						}), Promise.resolve())
			})
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
			.catch(error => {
				console.error(new Date() + ": " + error)
				console.trace()
			})
	}


	onGuildDelete(guild: Guild): void {
		this.provider.removeAllDataForGuild(guild.id)
			.catch(error => {
				console.error(new Date() + ": " + error)
				console.trace()
			})
	}

	onVoiceStateChanged(oldState: VoiceState, newState: VoiceState): void {
		if (oldState.member?.id === oldState.client.user?.id || oldState.channel || !newState.member || !newState.channel) return
		this.provider.getEntreeSoundIdForGuildUser(newState.guild.id, newState.member.id)
			.then(soundId => {
				if (!soundId || !newState.channel) {
					return
				}
				this.playSoundInChannel(soundId, newState.channel, newState.client.user!.id)
			})
	}

	onMessage(message: Message) {
		const genericHelp = " Send `!help` to the sound channel for more informamtion."
		// filter messages that come from Dwight self and that do not come from sound channels
		if (message.author.id !== this.client.user?.id && this.isTextChannel(message.channel) && this.channels.includes(message.channel)) {
			const tokens = message.content.split(" ")
			// filter empty messages and non commands
			if (tokens.length === 0 || !tokens[0].startsWith("!")) return
			const token = tokens.shift()
			switch (token) {
				case "!add_sound":
					var hidden = false
					if (tokens[0] === "--hidden" || tokens[0] === "-h") {
						hidden = true
						tokens.shift()
					}
					if (tokens.length < 2) {
						message.author.send("You need to provide a url and a name for the sound." + genericHelp)
						return
					}
					const url = tokens.shift()!
					var name = tokens.join(" ")
					if (name.length > this.provider.maxSoundNameLength) {
						message.author.send("The name of the sound is too long (max. " + this.provider.maxSoundNameLength + " charackters long)." + genericHelp)
						return
					}
					this.addSoundToGuild(name, url, hidden, message)
					break
				case "!remove_sound":
					if (tokens.length === 0) {
						message.author.send("We need the name of the sound to delete.")
						return
					}
					var name = tokens.join(" ")
					this.removeSound(name, message)
					break
				case "!get_sounds":
					this.sendSoundsForGuild(message)
					break
				case "!rename_sound":
					const sepIndex = tokens.indexOf("-")
					if (sepIndex === -1 || tokens.length <= (sepIndex + 1)) {
						message.author.send("Arguments missing. Check the help for `!rename` by sending `!help` to the sounds channel.")
					}
					const oldName = tokens.slice(0, sepIndex).join(" ")
					const newName = tokens.slice(sepIndex + 1).join(" ")
					this.renameSound(oldName, newName, message)
					break
				case "!add_entree":
					const soundName = tokens.filter(value => !value.startsWith("<@")).join(" ")
					if (message.mentions.members == undefined) {
						// This path should not be reached
						console.error(Date.now() + ": addEntree reached impossible path 0")
						return
					}
					if (message.mentions.members.size !== 1) {
						// Check that there are users mentioned.
						message.author.send("You need to mention exactly 1 user to add entree for." + genericHelp)
						return
					}
					if (soundName === "") {
						message.author.send("You need to add the name of the sound to use as entree. Use `!get_sounds` to see all sounds.")
						return
					}
					var user = message.mentions.members.first()!
					this.addEntree(soundName, user, message)
					break
				case "!remove_entree":
					if (message.mentions.members == undefined) {
						// This path should not be reached
						console.error(Date.now() + ": addEntree reached impossible path 0")
						return
					}
					if (message.mentions.members.size !== 1) {
						// Check that there are users mentioned.
						message.author.send("You need to mention exactly 1 user to remove entree for." + genericHelp)
						return
					}
					var user = message.mentions.members.first()!
					this.removeEntree(user, message)
					break
				case "!rebuild":
					this.initForGuild(message.channel.guild)
					break
				case "!help":
					this.sendHelp(message)
					break
			}
			message.delete()
				.catch(reason => {
					console.error(Date.now() + ": " + reason)
					console.trace()
				})
		}
	}

	async onInteractionCreate(interaction: Interaction) {
		if (!interaction.channel_id) {
			return
		}
		const channel = await this.client.channels.fetch(interaction.channel_id)
		if (!interaction.data || !this.isTextChannel(channel)) {
			return
		}
		const command = interaction.data.name.toLowerCase();
		const args = interaction.data.options;

		switch (command) {
			case "add_sound":
				console.log()
		}
	}

	removeEntree(user: GuildMember, message: Message) {
		const channel = message.channel
		if (!this.isTextChannel(channel)) return
		this.provider.removeEntree(channel.guild.id, user.id)
			.then(_ => {
				message.author.send("Removed entrees for users.")
			})
			.catch(reason => {
				message.author.send("There was an unexplained error.")
				console.error(Date.now() + ": " + reason)
				console.trace()
			})
	}

	addEntree(soundName: string, user: GuildMember, message: Message) {
		const genericHelp = " Send `!help` to the sound channel for more informamtion."
		const channel = message.channel
		if (!this.isTextChannel(channel)) return


		this.provider.getSoundsForGuild(channel.guild.id)
			.then(sounds => {
				const sound = sounds.find((value => value.name === soundName))
				if (!sound) {
					message.author.send("I can't find a sound that fits this name. Use `!get_sounds` to see all sounds." + genericHelp)
					return Promise.reject(13)
				}
				if (!message.mentions.members) return
				return this.provider.addEntree(channel.guild.id, user.id, sound.id)
			})
			.then(_ => {
				message.author.send("Added entrees for users.")
			})
			.catch(reason => {
				if (reason !== 13) {
					message.author.send("There was an unexplained error.")
					console.error(Date.now() + ": " + reason)
					console.trace()
				}
			})
	}

	async addSoundToGuild(name: string, url: string, hidden: boolean, message: Message) {
		const genericHelp = " Send `!help` to the sound channel for more informamtion."
		if (!this.isTextChannel(message.channel)) {
			return // Typescript cleanup
		}
		const guild = message.channel.guild
		const sounds = await this.provider.getSoundsForGuild(guild.id)
		if (sounds.some(sound => sound.name === name)) {
			message.author.send("This name is already in use. Either remove/rename the old sound first or use another name.")
		}
		this.provider.addSoundForGuild(guild.id, url, name, hidden)
			.then(() => {
				if (!hidden) {
					this.needsRebuild.add(guild)
					message.author.send("Added " + name + " to " + guild.name + ".\nUse `!rebuild` in the sound channel to rebuild the channel once all changes are applied.")
				}

			})
			.catch(reason => {
				switch (reason) {
					case ErrorTypes.limitReached:
						message.author.send("You have already reached the maximum number of sounds." + genericHelp)
						return
					case ErrorTypes.duplicatedName:
						message.author.send("This name is already in use. Either remove the old sound first or use another name.")
						return
					case ErrorTypes.fileTooLarge:
						message.author.send("The file is too large. Max 200kb")
						return
					default:
						const date = Date.now()
						message.author.send("There was an unexplained error, sorry. Please contact my developer Bauer#9456 with the follwing number: " + date)
						console.error(date + ": " + reason)
						console.trace()
				}
			})
	}

	removeSound(name: string, message: Message) {
		if (!this.isTextChannel(message.channel)) {
			return // Typescript cleanup
		}
		const guild = message.channel.guild
		this.provider.getSoundsForGuild(guild.id)
			.then(list => {
				const rest = list.filter(value => value.name === name)
				if (rest[0]) {
					this.provider.removeSound(rest[0].id)
						.then(() => {
							this.needsRebuild.add(guild)
							message.author.send("Removed " + name + " from " + guild.name + ".\nUse `!rebuild` in the sound channel to rebuild the channel once all changes are applied.")
						})
						.catch(err => {
							if (err === ErrorTypes.soundUsed) {
								message.author.send("The sound you tried to delete " + name + " is used as entree and cannot be deleted.")
								return
							}
							message.author.send("There was an error deleting the requested sound.")
							console.error(Date.now() + ": " + JSON.stringify(err))
							console.trace()
						})
				} else {
					message.author.send("No sound with that name found. Use `!get_sounds` to see all sounds.")
				}
			})
	}

	async renameSound(oldName: string, newName: string, message: Message) {
		if (!this.isTextChannel(message.channel)) {
			return
		}
		const sounds = await this.provider.getSoundsForGuild(message.channel.guild.id)
		const sound = sounds.find(sound => sound.name === oldName)
		if (!sound) {
			message.author.send("I did not find a sound with the name " + oldName + ". Check your sounds with `!get_sounds`.")
			return
		}
		this.provider.renameSound(sound.id, newName)
			.then(_ => {
				if (!this.isTextChannel(message.channel)) {
					return
				}
				this.needsRebuild.add(message.channel.guild)
				message.author.send("Renamed sound " + oldName + " to " + newName + ". Use `!rebuild` to rebuild the sound channel once all changes are applied.")
			})
	}

	sendSoundsForGuild(message: Message) {
		if (!this.isTextChannel(message.channel)) {
			return // Typescript cleanup
		}
		const guild = message.channel.guild
		this.provider.getSoundsForGuild(guild.id)
			.then(sounds => {
				var mess = "Sounds for server " + guild.name + ":"
				sounds.forEach(sound => {
					mess += "\n\t- " + (sound.hidden ? "*" : "") + sound.name + (sound.hidden ? "*" : "")
				})
				mess += "\nThere " + (sounds.length > 1 ? "are " : "is ") + sounds.length + " sound" + (sounds.length > 1 ? "s" : "") + " on this server."
				mess += "\nCursive sounds are hidden."
				message.author.send(mess)
			})
	}

	sendHelp(message: Message) {
		const help = [
			"I offer the follwing commands:",
			"\t- `!add_sound [--hidden|-h] url soundname` adds the sound at the given url with the given name, hidden makes this not appear in the sounds channel", // TODO explain hidden
			"\t- `!remove_sound soundname` removes the sound with the given name",
			"\t- `!get_sounds` sends you a list of all sounds on this server",
			"\t- `!rename_sound oldName - newName` renames the sound to the new name",
			"\t- `!add_entree soundname @user [@user ...]` adds an entree with the given soundname to the mentioned user(s)",
			"\t- `!remove_entree @user [@user ...]` removes the entree sound(s) for the given user(s)",
			"\t- `!rebuild` rebuild the sound channel if there are pending changes",
			"\t- `!help` send this message again"
		]
		message.author.send(help.join("\n"))
	}

	/**
	 * Checks whether a guild has an already build sound channel
	 */
	async checkChannel(guild: Guild): Promise<boolean> {
		const channel = guild.channels.cache.find(guildchannel => guildchannel.name === "sounds")
		if (!channel || !this.isTextChannel(channel)) return Promise.resolve(false)
		var messages = await this.loadMessages(channel)
		messages.reverse()
		const sounds = await this.provider.getSoundsForGuild(guild.id)
		const filteredSounds = sounds.filter(sound => !sound.hidden)
		if (messages.length !== filteredSounds.length) return false
		for (var i = 0; i < messages.length; i++) {
			if (messages[i].content !== filteredSounds[i].name) return false

		}
		for (var i = 0; i < messages.length; i++) {
			this.messages.set(messages[i].id, filteredSounds[i].id)
			const arr = messages[i].reactions.cache.array()
			if (arr.length !== 1 || arr[0].emoji.name !== "🔊" || arr[0].count !== 1 || !arr[0].me) {
				await messages[i].reactions.removeAll()
				await new Promise<void>(resolve => setTimeout(() => resolve(), 1000))
				await messages[i].react("🔊")
				await new Promise<void>(resolve => setTimeout(() => resolve(), 1000))
			}
		}
		this.channels.push(channel)

		return true
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

	isTextChannel(channel: Channel): channel is TextChannel {
		return channel.type === "text"
	}
}

type Interaction = {
	id: string,
	application_id: string,
	type: InteractionType,
	data?: ApplicationCommandInteractionData,
	guild_id?: string,
	channel_id?: string,
	member: object,
	user: object,
	token: string,
	version: number
}

enum InteractionType {
	Ping = 1,
	ApplicationCommand = 2
}

type ApplicationCommandInteractionData = {
	id: string,
	name: string,
	options?: ApplicationCommandInteractionDataOption[]
}

type ApplicationCommandInteractionDataOption = {
	name: string,
	value: number,
	options?: ApplicationCommandInteractionDataOption
}
