import { Client, Guild, Snowflake, User, TextChannel, VoiceChannel, Collection, GuildChannelManager, Message, ApplicationCommand, VoiceState, GuildChannel, Channel, GuildMember, StageChannel, GuildChannelCreateOptions, PartialDMChannel, Interaction, CommandInteraction, GuildApplicationCommandPermissionData, MessageActionRow, MessageButton } from "discord.js";
import { joinVoiceChannel, getVoiceConnection, createAudioResource, createAudioPlayer, AudioPlayerStatus, VoiceConnectionStatus, AudioPlayer } from "@discordjs/voice";
import IAsyncInitializable from "./interfaces/IAsyncInitializable";
import { ErrorTypes, ISoundProvider } from "./interfaces/ISoundProvider";
import SequelizeSoundProvider from "./SequelizeSoundProvider";
import { REST } from '@discordjs/rest'
import { Routes } from "discord-api-types/v9"
import { SlashCommandBuilder } from "@discordjs/builders";
import { RawApplicationCommandData } from "discord.js/typings/rawDataTypes";

export default class Sounds implements IAsyncInitializable {

	// PARAMETER
	maxFileSize = 204800 // 200 kb

	client: Client

	// ChannelId -> AudioPlayer
	players: Collection<Snowflake, AudioPlayer>

	channels: Snowflake[] // Id of channel

	provider: ISoundProvider
	needsRebuild: Set<Guild>

	constructor(client: Client) {
		this.client = client
		this.channels = []
		this.needsRebuild = new Set()
		this.players = new Collection()
		this.provider = new SequelizeSoundProvider()
	}

	initialize(): Promise<void> {
		return this.provider.initialize()
			.then(_ => {
				this.client.on("ready", () => this.onReady(this.client))
				this.client.on("guildCreate", guild => this.onGuildCreate(guild))
				this.client.on("guildDelete", guild => this.onGuildDelete(guild))
				this.client.on("voiceStateUpdate", (oldState, newState) => this.onVoiceStateChanged(oldState, newState))
				this.client.on("interactionCreate", interaction => this.onInteractionCreate(interaction))
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

	async createChannel(channelManager: GuildChannelManager, userId: Snowflake): Promise<TextChannel> {

		const options: GuildChannelCreateOptions = {
			type: "GUILD_TEXT",
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

		const oldChannel = channelManager.cache.find(channel => channel.name === "sounds" && channel.type === "GUILD_TEXT") as GuildChannel
		if (oldChannel) {
			if (oldChannel.deletable) {
				options.parent = oldChannel.parentId ?? undefined
				options.position = oldChannel.position
				options.permissionOverwrites = oldChannel.permissionOverwrites.cache.map(foo => foo)
				return oldChannel.delete()
					.then(() => channelManager.create("sounds", options) as Promise<TextChannel>)
					.then(channel => {
						this.channels.push(channel.id)
						return channel
					})
			} else {
				let owner = await channelManager.guild.members.fetch(channelManager.guild.ownerId)
				if (owner) {
					owner.send("I could not delete the current sounds channel. Please check my permissions and allow me to do so. Then try again or contact my creator Bauer#9456.")
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

	async addSoundsToChannel(channel: TextChannel): Promise<void> {
		let sounds = (await this.provider.getSoundsForGuild(channel.guild.id)).filter(sound => !sound.hidden)
		let rows = chunk(sounds, 5).map(sounds => {
			var row = new MessageActionRow()
			for (let sound of sounds) {
				row = row.addComponents(new MessageButton().setCustomId(sound.id).setLabel(sound.name).setStyle("SECONDARY"))
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
			let resource = createAudioResource(await this.provider.getPathToSound(soundId))
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
							.catch(_ => console.log("Could not log a play."))
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

	async onInteractionCreate(interaction: Interaction): Promise<void> {

		if (!interaction.channel || !interaction.inGuild() || !interaction.member?.user || !this.channels.includes(interaction.channel.id)) {
			// not sent from a valid guild channel
			if (interaction.isCommand())
				(interaction as CommandInteraction).reply({
					ephemeral: true,
					content: "You can only use interactions with me in a sound channel I created."
				})
			return
		}
		if (interaction.isCommand() && interaction.guild) { // guild required for typescript typechecker
			let args = interaction.options.data
			var answer = ""
			switch (interaction.commandName) {
				case "rebuild":
					answer += "I will rebuild this channel soon..."
					this.initForGuild(interaction.guild)
					break
				case "get_sounds":
					var sounds = await this.provider.getSoundsForGuild(interaction.guild.id)
					answer = `Sounds on server ${interaction.guild.name}:`
					for (let sound of sounds) {
						answer += `\n\t- ${sound.name}${sound.hidden ? " (hidden)" : ""}`
					}
					break
				case "add_sound":
					var name = args.find(arg => arg.name === "name")?.value
					var link = args.find(arg => arg.name === "link")?.value
					var hidden = args.find(arg => arg.name === "hidden")?.value ?? false
					if (typeof name !== "string" || typeof link !== "string" || (typeof hidden !== "undefined" && typeof hidden !== "boolean")) {
						// Wrong arguments
						answer += "You must provide valid arguments"
						break
					}
					await this.provider.addSoundForGuild(interaction.guild.id, link, name, hidden ?? false)
					answer += `Added ${name}. Use \`/rebuild\` to apply the changes.`
					break
				case "delete_sound":
					var name = args?.find(arg => arg.name === "name")?.value
					if (typeof name !== "string") {
						answer += "You must provide valid arguments"
						break
					}
					let delSounds = await this.provider.getSoundsForGuild(interaction.guild.id)
					let delSound = delSounds.find(sound => sound.name === name)
					if (!delSound) {
						answer += "I did not find a sound with that name. Use `/get_sounds` to see a list of sounds on this server."
						break
					}
					await this.provider.removeSound(delSound.id)
					answer += `Removed ${name} from this server. Use \`/rebuild\` to apply the changes.`
					break
				case "rename_sound":
					let oldName = args?.find(arg => arg.name === "oldname")?.value
					let newName = args?.find(arg => arg.name === "newname")?.value
					if (typeof oldName !== "string" || typeof newName !== "string") {
						answer += "You must provide valid arguments"
						break
					}
					let oldsounds = await this.provider.getSoundsForGuild(interaction.guild.id)
					let oldsound = oldsounds.find(sound => sound.name === oldName)
					if (!oldsound) {
						answer += "I did not find a sound with that name. Use \`/get_sounds\` to see a list of sounds on this server."
						break
					}
					await this.provider.renameSound(oldsound.id, newName)
					answer += `Renamed ${oldName} to ${newName}. Use \`/rebuild\` to apply the changes.`
					break
				case "get_entrees":
					let entrees = await this.provider.getEntreesForGuild(interaction.guild.id)
					answer += `Entrees on server ${interaction.guild.name}:`
					for (let entree of entrees) {
						answer += `\n\t- ${entree.soundName} for <@${entree.userId}>`
					}
					break
				case "add_entree":
					var userArg = args?.find(arg => arg.name === "user")
					var soundNameArg = args?.find(arg => arg.name === "sound")
					if (userArg?.type !== "USER" || typeof userArg.value !== "string" || soundNameArg?.type !== "STRING" || typeof soundNameArg.value !== "string") {
						answer += "You must provide valid arguments."
						break
					}
					var soundName = soundNameArg.value
					let entreeSounds = await this.provider.getSoundsForGuild(interaction.guild.id)
					let sound = entreeSounds.find(sound => sound.name === soundName)
					if (!sound) {
						answer += "I did not find a sound with that name. Use \`/get_sounds\` to see a list of sounds on this server."
						break
					}
					await this.provider.addEntree(interaction.guild.id, userArg.value, sound.id)
					answer += `Added Entree ${soundName} for <@${userArg.value}>`
					break
				case "remove_entree":
					var userArg = args?.find(arg => arg.name === "user")
					if (userArg?.type !== "USER" || typeof userArg.value !== "string") {
						answer += "You must provide valid arguments."
						break
					}
					await this.provider.removeEntree(interaction.guild.id, userArg.value)
					answer += `Removed entree for <@${userArg.value}>.`
					break
			}
			interaction.reply({
				ephemeral: true,
				content: answer
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
			let row = new MessageActionRow().addComponents(new MessageButton().setCustomId("cancelPlay").setLabel("Cancel").setStyle("PRIMARY"))
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

	async removeEntree(gmember: GuildMember, user: User) {
		return this.provider.removeEntree(gmember.guild.id, gmember.id)
			.then(_ => {
				user.send("Removed entrees for users.")
			})
			.catch(reason => {
				user.send("There was an unexplained error.")
				console.error(Date.now() + ": " + reason)
				console.trace()
			})
	}

	async addEntree(soundName: string, gmember: GuildMember, user: User) {
		const genericHelp = " Send `!help` to the sound channel for more informamtion."
		return this.provider.getSoundsForGuild(gmember.guild.id)
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

	async removeSound(name: string, guild: Guild, user: User) {
		return this.provider.getSoundsForGuild(guild.id)
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

	async sendSoundsForGuild(guild: Guild, responder: User) {
		return this.provider.getSoundsForGuild(guild.id)
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

	isTextChannel(channel: Channel | PartialDMChannel | null): channel is TextChannel {
		// Partials are turned off
		return channel !== null && !channel.partial && channel.isText() && !channel.isThread()
	}

	// SLASH COMMANDS
	commands = [
		new SlashCommandBuilder().setName("rebuild").setDescription("Rebuild the sounds channel so that changes become visible.").setDefaultPermission(false),
		new SlashCommandBuilder().setName("get_sounds").setDescription("Get a list of all sounds on this server").setDefaultPermission(false),
		new SlashCommandBuilder().setName("add_sound").setDescription("Add a sound to this server").setDefaultPermission(false)
			.addStringOption(option => option.setName("name").setDescription("Name of the sound").setRequired(true))
			.addStringOption(option => option.setName("link").setDescription("Link to the sound file (.mp3, max 200kb)").setRequired(true))
			.addBooleanOption(option => option.setName("hidden").setDescription("If set to true, this sound will no be playable by button")),
		new SlashCommandBuilder().setName("rename_sound").setDescription("Rename a sound from this server").setDefaultPermission(false)
			.addStringOption(option => option.setName("oldname").setDescription("Name of the sound").setRequired(true))
			.addStringOption(option => option.setName("newname").setDescription("The new name of the sound").setRequired(true)),
		new SlashCommandBuilder().setName("delete_sound").setDescription("Delete a sound from this server").setDefaultPermission(false)
			.addStringOption(option => option.setName("name").setDescription("Name of the sound to delete").setRequired(true)),
		new SlashCommandBuilder().setName("get_entrees").setDescription("Get the list of entrees of this server").setDefaultPermission(false),
		new SlashCommandBuilder().setName("add_entree").setDescription("Add or change an entree for a user in this server").setDefaultPermission(false)
			.addUserOption(option => option.setName("user").setDescription("User to add entree for").setRequired(true))
			.addStringOption(option => option.setName("sound").setDescription("Name of the sound").setRequired(true)),
		new SlashCommandBuilder().setName("remove_entree").setDescription("Remove an entree for a user in this server").setDefaultPermission(false)
			.addUserOption(option => option.setName("user").setDescription("User to remove entree for").setRequired(true))
	]

	async initiateSlashCommands(): Promise<void> {
		if (!this.client.user?.id || !this.client.token) {
			// Only happens when we get called before logged in.
			return Promise.reject()
		}
		let rest = new REST({ version: "9" }).setToken(this.client.token)
		let route = process.env.NODE_ENV === "DEVELOPMENT" ? Routes.applicationGuildCommands(this.client.user.id, "828763932072214589") : Routes.applicationCommands(this.client.user.id)

		let rawCommands = await rest.put(route, {
			body: this.commands
		}) as RawApplicationCommandData[]

		let commands = rawCommands.map(raw => new ApplicationCommand(this.client, raw))

		// Set permission such that guild owner can use commands.
		this.client.guilds.cache.forEach((guild) => {
			let permissions: {
				fullPermissions: GuildApplicationCommandPermissionData[] // This type annotation seems to be requierd as it doesnt work otherwise.
			} = {
				fullPermissions: commands.map(command => {
					return {
						id: command.id,
						permissions: [{
							id: guild.ownerId,
							type: "USER",
							permission: true
						}]
					}
				})
			}
			try {
				guild.commands.permissions.set(permissions)
			} catch (err) {
				console.error("Error setting permissions for guild " + guild.name + " with id " + guild.id)
				console.error(err)
				console.trace()
			}

		})


	}
}

/**
 * Splits an array into an array of array of chunks of the source array
 * @example chunk([1,2,3,4,5], 2) => [[1,2],[3,4],[5]]
 * @param src Array to chunk
 * @param count Chunksize
 * @returns Array of arrays with the given size
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
