import * as Discord from "discord.js"
import Sounds from "./Sounds"

const client = new Discord.Client();
client.token = process.env.DISCORD_AUTH_TOKEN || null

client.on("ready", () => {
	console.log('Logged in as ' + client.user!.tag + '!');

	console.log("Connected guilds:")
	client.guilds.cache.forEach((guild) => {
		console.log("ID: " + guild.id + ", Name: " + guild.name)
	})

})

// Services
const sounds = new Sounds(client)


Promise.all([
	sounds.initialize()
])
	.then(_ => client.login())
	.catch(reason => {
		console.log(Date.now() + ": " + reason)
		process.exit(1)
	})