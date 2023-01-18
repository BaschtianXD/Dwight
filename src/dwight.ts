import { Client } from "discord.js"
import Sounds from "./Sounds"
import express from "express";
import { envSchema, formatErrors } from "./env/schema.js";


// CHECK ENV VARIABLES
const foo = envSchema.safeParse(process.env)
if (!foo.success) {
	console.error(
		"❌ Invalid environment variables:\n",
		...formatErrors(foo.error.format()),
	);
	throw new Error("Invalid environment variables");
}

export const envVars = foo.data

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

	app.listen(envVars.PORT, () => {
		console.log("Listening on port " + envVars.PORT)
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
	.then(_ => client.login(envVars.DISCORD_BOT_AUTH_TOKEN))
	.catch(reason => {
		console.log(Date.now() + ": " + reason)
		process.exit(1)
	})


const app = express()
app.get("/live", (req, res) => {
	if (client.user) {
		res.writeHead(200)
	} else {
		res.writeHead(500)
	}
	res.send()
})
app.get("/build/:guildid", async (req, res) => {
	const guildid = req.params.guildid
	try {
		const guild = await client.guilds.fetch(guildid)
		await sounds.initForGuild(guild)
		res.status(200).send()
	} catch (err) {
		res.status(500).send()
	}

})
