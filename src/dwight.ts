import { Client } from "discord.js"
import Sounds from "./Sounds"
import * as http from "http"

const client = new Client({
	intents: [
		"Guilds",
		"GuildVoiceStates"
	]
});

client.on("ready", () => {
	console.log('DISCORD API: Logged in as ' + client.user!.tag + '!');

	console.log("Connected guilds:")
	client.guilds.cache.forEach((guild) => {
		console.log("ID: " + guild.id + ", Name: " + guild.name)
	})

})

client.on("rateLimit", (info) => {
	console.log("DISCORD API: Hit rate limit")
	console.log(JSON.stringify(info))
})

client.on("warn", info => {
	console.log("DISCORD API: WARNING - " + info)
})

// Services
const sounds = new Sounds(client)


Promise.all([
	sounds.initialize()
])
	.then(_ => client.login(process.env.DISCORD_AUTH_TOKEN!))
	.catch(reason => {
		console.log(Date.now() + ": " + reason)
		process.exit(1)
	})

// Readiness/Liveness probe
const host = 'localhost';
const port = 8080;
const server = http.createServer((req, res) => {
	if (client.user) {
		res.writeHead(200)
	} else {
		res.writeHead(500)
	}
	res.end()
})

server.listen(port, host, () => {
	console.log("Init readiness probe")
})
