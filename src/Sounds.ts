import axios from "axios";
import { Client, Guild, Snowflake, MessageReaction, User, StreamDispatcher, TextChannel, VoiceChannel, Collection, GuildCreateChannelOptions, GuildChannelManager, Message, DMChannel, NewsChannel, VoiceState, GuildChannel, Channel, GuildMember, MessageEmbed, TextBasedChannelFields, APIMessage } from "discord.js";
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
	channels: Snowflake[] // Id of channel

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
				if (process.env.NODE_ENV !== "DEVELOPMENT") {
					// Only do this in prod as on dev we do not have access to sound files
					this.client.on("messageReactionAdd", (reaction, user) => this.onMessageReactionAdd(reaction, user as User))
				}
				this.client.on("ready", () => this.onReady(this.client))
				this.client.on("guildCreate", guild => this.onGuildCreate(guild))
				this.client.on("guildDelete", guild => this.onGuildDelete(guild))
				this.client.on("message", message => this.onMessage(message as Message))
				this.client.on("voiceStateUpdate", (oldState, newState) => this.onVoiceStateChanged(oldState, newState))
				this.client.ws.on("INTERACTION_CREATE" as any, interaction => this.onInteractionCreate(interaction))
				console.log("Sounds initialized")
			})
	}

	async onReady(client: Client) {
		await this.initiateSlashCommands()
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
			topic: "Here are the sounds you can play. Press the reaction of a sound to play it in your voice channel. Use my / commands to interact with me.",
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
				options.parent = oldChannel.parentID ?? undefined
				options.position = oldChannel.position
				options.permissionOverwrites = oldChannel.permissionOverwrites
				return oldChannel.delete("I need to recreate the channel")
					.then(() => channelManager.create("sounds", options) as Promise<TextChannel>)
					.then(channel => {
						this.channels.push(channel.id)
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
					this.channels.push(channel.id)
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
								setTimeout(() => resolve(), 1100)
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
		if (this.channels.includes(messageReaction.message.channel.id)) {
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

	playSoundInChannel(soundId: Snowflake, voiceChannel: VoiceChannel, userId: Snowflake, force: boolean = false) {
		const disp = this.connections.get(voiceChannel.id)
		if (disp && !force) {
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
				this.playSoundInChannel(soundId, newState.channel, newState.client.user!.id, true)
			})
	}

	async onMessage(message: Message) {
		const genericHelp = " Send `!help` to the sound channel for more informamtion."
		// filter messages that come from Dwight self and that do not come from sound channels
		if (message.author.id !== this.client.user?.id && this.isTextChannel(message.channel) && this.channels.includes(message.channel.id) && message.guild) {
			const tokens = message.content.split(" ")
			// filter empty messages and non commands
			if (tokens.length === 0 || !tokens[0].startsWith("!")) {
				if (message.deletable) {
					message.delete()
						.catch(reason => {
							console.error(Date.now() + ": " + reason)
							console.trace()
						})
					return
				}
			}
			const token = tokens.shift()?.toLowerCase()
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
					this.provider.addSoundForGuild(message.guild.id, url, name, hidden)
						.then(_ => {
							message.author.send("The sound has been added to your server. Use \`!rebuild\` to show the changes.")
						})
						.catch(err => {
							switch (err) {
								case ErrorTypes.duplicatedName:
									message.author.send("The name you want to use is already in use. Use another name or rename/delete the current sound with that name.")
									break
								case ErrorTypes.fileTooLarge:
									message.author.send("The file you want to add is too large. Must be mp3 file and max 200kb in size.")
									break
								case ErrorTypes.limitReached:
									message.author.send("This server has reached its limit of sounds. Delete another sound first.")
									break
								default:
							}
						})
					break
				case "!remove_sound":
					if (tokens.length === 0) {
						message.author.send("We need the name of the sound to delete.")
						return
					}
					var name = tokens.join(" ")
					var sounds = await this.provider.getSoundsForGuild(message.guild.id)
					var id = sounds.find(sound => sound.name === name)?.id
					if (id) {
						this.provider.removeSound(id)
							.then(_ => {
								message.author.send(`${name} has been deleted from ${message.guild?.name}. Use \`!rebuild\` to show the changes.`)
							})
					} else {
						// no sound with that name found
						message.author.send(`I found no sound with the name *${name}* to delete.`)
					}
					break
				case "!get_sounds":
					var sounds = await this.provider.getSoundsForGuild(message.guild.id)
					var msg = `Here are the sounds for ${message.guild.name}:`
					for (var sound of sounds) {
						msg += `\n\t- ${sound.name}${sound.hidden ? " *hidden*" : ""}`
					}
					message.author.send(msg)
					break
				case "!rename_sound":
					const sepIndex = tokens.indexOf("-")
					if (sepIndex === -1 || tokens.length <= (sepIndex + 1)) {
						message.author.send("Arguments missing. Check the help for `!rename` by sending `!help` to the sounds channel.")
					}
					const oldName = tokens.slice(0, sepIndex).join(" ")
					const newName = tokens.slice(sepIndex + 1).join(" ")
					var sounds = await this.provider.getSoundsForGuild(message.guild.id)
					var id = sounds.find(sound => sound.name === oldName)?.id
					if (id) {
						this.provider.renameSound(id, newName)
							.then(_ => {
								message.author.send(`Renamed ${oldName} to ${newName}`)
							})
					}

					this.renameSound(oldName, newName, message.guild, message.author)
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
					var gmember = message.mentions.members.first()!
					this.addEntree(soundName, gmember, message.author)
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
					var gmember = message.mentions.members.first()!
					this.removeEntree(gmember, message.author)
					break
				case "!rebuild":
					this.initForGuild(message.channel.guild)
					break
				case "!help":
					this.sendHelp(message.author)
					break
			}
			if (message.deletable) {
				message.delete()
					.catch(reason => {
						console.error(Date.now() + ": " + reason)
						console.trace()
					})
			}
		}
	}

	async onInteractionCreate(interaction: Interaction) {

		if (!interaction.channel_id || !interaction.guild_id || !interaction.member?.user?.id || !this.channels.includes(interaction.channel_id)) {
			// not sent from a valid guild channel
			this.answerInteraction(interaction.id, interaction.token, "You can only use interactions with me in a sound channel I created.")
			return
		}
		const channel = await this.client.channels.fetch(interaction.channel_id)
		const guild = await this.client.guilds.fetch(interaction.guild_id)
		if (!interaction.data || !this.isTextChannel(channel)) {
			return
		}
		const command = interaction.data.name.toLowerCase();
		const args = interaction.data.options;

		switch (command) {
			case "rebuild":
				this.answerInteraction(interaction.id, interaction.token, "I will rebuild this channel soon...")
				this.initForGuild(guild)
				break
			case "get_sounds":
				// this.sendSoundsForGuild(guild, user)
				var sounds = await this.provider.getSoundsForGuild(guild.id)
				var desc = `Sounds on server ${guild.name}:`
				for (let sound of sounds) {
					desc += `\n\t- ${sound.name}${sound.hidden ? " (hidden)" : ""}`
				}
				this.answerInteraction(interaction.id, interaction.token, desc)
				return
			case "add_sound":
				var name = args?.find(arg => arg.name === "name")?.value
				var link = args?.find(arg => arg.name === "link")?.value
				var hidden = args?.find(arg => arg.name === "hidden")?.value ?? false
				if (typeof name !== "string" || typeof link !== "string" || (typeof hidden !== "undefined" && typeof hidden !== "boolean")) {
					// Wrong arguments
					this.answerInteraction(interaction.id, interaction.token, "You must provide valid arguments.")
					return
				}
				this.provider.addSoundForGuild(guild.id, link, name, hidden ?? false)
					.then(_ => {
						this.answerInteraction(interaction.id, interaction.token, `Added ${name}. Use \`/rebuild\` to apply the changes.`)
					})
				break
			case "delete_sound":
				var name = args?.find(arg => arg.name === "name")?.value
				if (typeof name !== "string") {
					return this.answerInteraction(interaction.id, interaction.token, "You must provide valid arguments.")
				}
				this.provider.getSoundsForGuild(guild.id)
					.then(sounds => {
						var sound = sounds.find(sound => sound.name === name)
						if (!sound) {
							this.answerInteraction(interaction.id, interaction.token, "I did not find a sound with that name. Use \`/get_sounds\` to see a list of sounds on this server.")
							return Promise.reject()
						}
						return this.provider.removeSound(sound.id)
					})
					.then(_ => {
						this.answerInteraction(interaction.id, interaction.token, `Removed ${name} from this server. Use \`/rebuild\` to apply the changes.`)
					})
					.catch(err => {
						if (!err) {
							return
						} else {
							return Promise.reject(err)
						}
					})
				break
			case "rename_sound":
				var oldName = args?.find(arg => arg.name === "oldname")?.value
				var newName = args?.find(arg => arg.name === "newname")?.value
				if (typeof oldName !== "string" || typeof newName !== "string") {
					this.answerInteraction(interaction.id, interaction.token, "You must provide valid arguments.")
					break
				}
				var sounds = await this.provider.getSoundsForGuild(guild.id)
				var sound = sounds.find(sound => sound.name === oldName)
				if (!sound) {
					this.answerInteraction(interaction.id, interaction.token, "I did not find a sound with that name. Use \`/get_sounds\` to see a list of sounds on this server.")
					break
				}
				await this.provider.renameSound(sound.id, newName)
				this.answerInteraction(interaction.id, interaction.token, `Renamed ${oldName} to ${newName}. Use \`/rebuild\` to apply the changes.`)
				break
			case "get_entrees":
				var entrees = await this.provider.getEntreesForGuild(guild.id)
				var desc = `Entrees on server ${guild.name}:`
				for (let entree of entrees) {
					desc += `\n\t- ${entree.soundName} for <@${entree.userId}>`
				}
				this.answerInteraction(interaction.id, interaction.token, desc)
				break
			case "add_entree":
				var userArg = args?.find(arg => arg.name === "user")
				var soundNameArg = args?.find(arg => arg.name === "sound")
				if (userArg?.type !== 6 || typeof userArg.value !== "string" || soundNameArg?.type !== 3 || typeof soundNameArg.value !== "string") {
					this.answerInteraction(interaction.id, interaction.token, "You must provide valid arguments.")
					break
				}
				var soundName = soundNameArg.value
				var sounds = await this.provider.getSoundsForGuild(guild.id)
				var sound = sounds.find(sound => sound.name === soundName)
				if (!sound) {
					this.answerInteraction(interaction.id, interaction.token, "I did not find a sound with that name. Use \`/get_sounds\` to see a list of sounds on this server.")
					break
				}
				await this.provider.addEntree(guild.id, userArg.value, sound.id)
				this.answerInteraction(interaction.id, interaction.token, `Added Entree ${soundName} for <@${userArg.value}>`)
				break
			case "remove_entree":
				var userArg = args?.find(arg => arg.name === "user")
				if (userArg?.type !== 6 || typeof userArg.value !== "string") {
					this.answerInteraction(interaction.id, interaction.token, "You must provide valid arguments.")
					break
				}
				await this.provider.removeEntree(guild.id, userArg.value)
				this.answerInteraction(interaction.id, interaction.token, `Removed entree for <@${userArg.value}>.`)
				break
		}
	}

	removeEntree(gmember: GuildMember, user: User) {
		this.provider.removeEntree(gmember.guild.id, gmember.id)
			.then(_ => {
				user.send("Removed entrees for users.")
			})
			.catch(reason => {
				user.send("There was an unexplained error.")
				console.error(Date.now() + ": " + reason)
				console.trace()
			})
	}

	addEntree(soundName: string, gmember: GuildMember, user: User) {
		const genericHelp = " Send `!help` to the sound channel for more informamtion."
		this.provider.getSoundsForGuild(gmember.guild.id)
			.then(sounds => {
				const sound = sounds.find((value => value.name === soundName))
				if (!sound) {
					user.send("I can't find a sound that fits this name. Use `!get_sounds` to see all sounds." + genericHelp)
					return Promise.reject()
				}
				return this.provider.addEntree(gmember.guild.id, gmember.id, sound.id)
			})
			.then(_ => {
				user.send("Added entrees for users.")
			})
			.catch(reason => {
				if (reason) {
					user.send("There was an unexplained error.")
					console.error(Date.now() + ": " + reason)
					console.trace()
				}
			})
	}

	removeSound(name: string, guild: Guild, user: User) {
		this.provider.getSoundsForGuild(guild.id)
			.then(list => {
				const rest = list.filter(value => value.name === name)
				if (rest[0]) {
					this.provider.removeSound(rest[0].id)
						.then(() => {
							this.needsRebuild.add(guild)
							user.send("Removed " + name + " from " + guild.name + ".\nUse `!rebuild` in the sound channel to rebuild the channel once all changes are applied.")
						})
						.catch(err => {
							if (err === ErrorTypes.soundUsed) {
								user.send("The sound you tried to delete " + name + " is used as entree and cannot be deleted.")
								return
							}
							user.send("There was an error deleting the requested sound.")
							console.error(Date.now() + ": " + JSON.stringify(err))
							console.trace()
						})
				} else {
					user.send("No sound with that name found. Use `!get_sounds` to see all sounds.")
				}
			})
	}

	async renameSound(oldName: string, newName: string, guild: Guild, user: User) {
		const sounds = await this.provider.getSoundsForGuild(guild.id)
		const sound = sounds.find(sound => sound.name === oldName)
		if (!sound) {
			user.send("I did not find a sound with the name " + oldName + ". Check your sounds with `!get_sounds`.")
			return
		}
		this.provider.renameSound(sound.id, newName)
			.then(_ => {
				this.needsRebuild.add(guild)
				user.send("Renamed sound " + oldName + " to " + newName + ". Use `!rebuild` to rebuild the sound channel once all changes are applied.")
			})
	}

	sendSoundsForGuild(guild: Guild, responder: User) {
		this.provider.getSoundsForGuild(guild.id)
			.then(sounds => {
				var mess = "Sounds for server " + guild.name + ":"
				sounds.forEach(sound => {
					mess += "\n\t- " + (sound.hidden ? "*" : "") + sound.name + (sound.hidden ? "*" : "")
				})
				mess += "\nThere " + (sounds.length > 1 ? "are " : "is ") + sounds.length + " sound" + (sounds.length > 1 ? "s" : "") + " on this server."
				mess += "\nCursive sounds are hidden."
				responder.send(mess)
			})
	}

	sendHelp(user: User) {
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
		user.send(help.join("\n"))
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
		this.channels.push(channel.id)

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

	// SLASH COMMANDS
	commands: ApplicationCommandCreateBody[] = [
		{
			name: "rebuild",
			description: "Rebuild the sounds channel so that changes become visible."
		},
		// SOUNDS
		{
			name: "get_sounds",
			description: "Get a list of all sounds on this server."
		},
		{
			name: "add_sound",
			description: "Add a sound to this server",
			options: [{
				type: 3,
				name: "name",
				description: "Name for the sound",
				required: true
			},
			{
				type: 3,
				name: "link",
				description: "Link to the sound file (.mp3, max 200kb)",
				required: true
			},
			{
				type: 5,
				name: "hidden",
				description: "Wether to hide the sound"
			}]
		},
		{
			name: "rename_sound",
			description: "Rename a sound from this server",
			options: [
				{
					type: 3,
					name: "oldname",
					description: "Name of the sound",
					required: true
				},
				{
					type: 3,
					name: "newname",
					description: "New name for the sound",
					required: true
				}
			]
		},
		{
			name: "delete_sound",
			description: "Delete a sound from this server",
			options: [
				{
					type: 3,
					name: "name",
					description: "Name of the sound to delete",
					required: true
				}
			]
		},
		// ENTREES
		{
			name: "get_entrees",
			description: "Get the list of entrees of this server"
		},
		{
			name: "add_entree",
			description: "Add or change an entree for a user in this server",
			options: [
				{
					type: 6,
					name: "user",
					description: "User to add entree for",
					required: true
				},
				{
					type: 3,
					name: "sound",
					description: "Name of the sound",
					required: true
				}
			]
		},
		{
			name: "remove_entree",
			description: "Remove an entree for a user in this server",
			options: [
				{
					type: 6,
					name: "user",
					description: "User to remove entree for",
					required: true
				}
			]
		}
	]

	async initiateSlashCommands() {
		const clientID = this.client.user?.id
		if (!clientID) {
			// Only happens when we get called before logged in.
			return Promise.reject()
		}
		let ax = axios.create({
			headers: {
				common: {
					Authorization: `Bot ${this.client.token}`
				}
			}
		})
		var baseCommandsUrl = `https://discord.com/api/v8/applications/${clientID}/${process.env.NODE_ENV === "DEVELOPMENT" ? "guilds/828763932072214589/" : ""}commands`
		// get current slash commands
		const currentCommands = (await ax.get<ApplicationCommand[]>(baseCommandsUrl)).data
		if (!this.compareCommands(currentCommands)) {
			// Commands dont equal, need to redo.
			// Check if we removed a command. if so delete it. other commands get overwritten
			console.log("New commands detected. Updating commands.")
			for (var i = 0; i < currentCommands.length; i++) {
				const command = currentCommands[i]
				if (this.commands.filter(curCom => command.name === curCom.name).length !== 1) {
					await ax.delete(baseCommandsUrl + `/${command.id}`)
						.catch(err => {
							console.error(`Unable to delete command with id: ${command.id}`)
							console.error(err)
							console.trace()
						})
				}
			}
			for (var i = 0; i < this.commands.length; i++) {
				const command = this.commands[i]
				await ax.post(baseCommandsUrl, command)
					.catch(err => {
						console.error(`Unable to post command with name: ${command.name}`)
						console.error(err)
						console.trace()
					})
				await new Promise(resolve => setTimeout(resolve, 5000))
			}
			console.log("Updated commands. In case of production it might take up to 1 hour until new commands appear.")
		}

	}

	// return true if the to commands are the same as this.commands
	compareCommands(to: ApplicationCommand[]): boolean {
		if (this.commands.length !== to.length) {
			return false
		}
		this.commands.sort((a, b) => a.name.localeCompare(b.name))
		to.sort((a, b) => a.name.localeCompare(b.name))
		for (var i = 0; i < this.commands.length; i++) {
			const base = this.commands[i]
			const com = to[i]
			if (base.name !== com.name || base.description !== com.description) {
				return false
			}
			if (base.options !== undefined || com.options !== undefined) {
				if (base.options && com.options && base.options.length === com.options.length) {
					for (var j = 0; j < base.options.length; j++) {
						const opa = base.options[j]
						const opb = com.options[j]
						if (opa.name !== opb.name || opa.description !== opb.description || opa.required !== opb.required || opa.type !== opb.type) {
							return false
						}
					}
				} else {
					return false
				}
			}
		}
		return true
	}

	answerInteraction(id: string, token: string, message: string) {
		const ax = axios.create({
			baseURL: "https://discord.com/api/v8/",
			headers: {
				common: {
					Authorization: `Bot ${this.client.token}`
				}
			}
		})
		const response: InteractionResponse = {
			type: 4,
			data: {
				flags: 64, // only visible to issueing user
				content: message
			}
		}
		return ax.post(`/interactions/${id}/${token}/callback`, response)
			.catch(err => {
				console.error(err)
				console.error(JSON.stringify(err.response.data))
			})
	}
}

type Interaction = {
	id: string,
	application_id: string,
	type: InteractionType,
	data?: ApplicationCommandInteractionData,
	guild_id?: string,
	channel_id?: string,
	member?: GuildMemberT,
	user?: UserT,
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
	type: number,
	value: any,
	options?: ApplicationCommandInteractionDataOption
}

type ApplicationCommandCreateBody = {
	name: string,
	description: string,
	options?: ApplicationCommandOption[]
}

type ApplicationCommandOption = {
	type: number,
	name: string,
	description: string,
	required?: boolean,
	choices?: ApplicationCommandOptionChoice[]
	options?: ApplicationCommandOption[]
}

type ApplicationCommandOptionChoice = {
	name: string
	value: string | number
}
type ApplicationCommand = {
	id: string,
	application_id: string,
	name: string,
	description: string,
	options?: ApplicationCommandOption[]
}

type InteractionResponse = {
	//* 1: Ping, 4: Response, 5: Defer response
	type: number,
	data?: InteractionApplicationCommandCallbackData
}

type InteractionApplicationCommandCallbackData = {
	// left allowed mentions out.
	tts?: boolean,
	content?: string,
	embeds?: MessageEmbed[],
	flags?: number
}

type UserT = {
	id: string,
	username: string,
	discriminator: string,
	avatar?: string,
	bot?: boolean
	system?: boolean
	mfa_enabled?: boolean
	locale?: string
	verified?: boolean
	email?: string
	flags?: number
	premium_type?: number
	public_flags?: number
}

type GuildMemberT = {
	user?: UserT
	nick?: string
	roles: string[]
	joined_at: string
	premium_since?: string
	deaf: boolean
	mute: boolean
	pending?: boolean
	permissions?: string
}

