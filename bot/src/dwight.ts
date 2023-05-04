import { Client } from "discord.js"
import Sounds from "./Sounds"
import express from "express";
import { envSchema, formatErrors } from "./env/schema.js";
import multer from "multer"
import { createSign, createVerify, generateKeyPairSync } from "crypto";
import expressBasicAuth from "express-basic-auth";
import { spawn } from "child_process";

const storage = multer.memoryStorage()
const upload = multer({
	storage: storage, limits: {
		files: 1,
		fileSize: 200 * 1024, // 200kb
	}
})


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

	app.listen(8080, () => {
		console.log("Listening on port " + 8080)
	})
})

client.on("rateLimit", (info) => {
	console.warn("DISCORD API: Hit rate limit")
	console.warn(JSON.stringify(info))
})

client.on("warn", info => {
	console.warn("DISCORD API: WARNING - " + info)
})

// Services
const sounds = new Sounds(client)


Promise.all([
	sounds.initialize()
])
	.then(_ => client.login(envVars.DISCORD_BOT_AUTH_TOKEN))
	.catch(reason => {
		console.error(Date.now() + ": " + reason)
		process.exit(1)
	})


const { privateKey, publicKey } = generateKeyPairSync("ec", {
	namedCurve: "sect239k1"
})
const auth = expressBasicAuth({
	users: {
		[envVars.CB_USERNAME]: envVars.CB_PASSWORD
	}
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
app.get("/build/:guildid", auth, async (req: expressBasicAuth.IBasicAuthedRequest, res) => {
	const guildid = req.params.guildid
	try {
		const guild = await client.guilds.fetch(guildid)
		await sounds.initForGuild(guild)
		res.status(200).send()
	} catch (err) {
		res.status(500).send()
	}

})
app.get("/presign", auth, async (req: expressBasicAuth.IBasicAuthedRequest, res) => {
	const { guildid, userid } = req.query
	const exp = Date.now() + 1000 * 60 // 1 minute valid

	if (typeof guildid !== "string") {
		res.status(400)
		res.send("Malformed guildid")
		return
	}

	const sign = createSign("SHA256")
	sign.update(guildid + userid + exp)
	const signature = sign.sign(privateKey, "hex")

	res.send({
		exp: exp,
		key: signature
	})

})
app.put("/sound/:guildid", upload.single("sound"), async (req, res) => {
	const guildid = req.params.guildid
	const { key, exp } = req.query
	const { userid, name, hidden } = req.body
	const soundFile = req.file

	if (typeof key !== "string") {
		res.status(400).send("Malformed key")
		return
	}
	if (typeof exp !== "string" || Number.isNaN(parseInt(exp, 10))) {
		res.status(400).send("Malformed exp")
		return
	}
	if (typeof userid !== "string") {
		res.status(400).send("Malformed userid")
		return
	}
	if (typeof name !== "string") {
		res.status(400).send("Malformed name")
		return
	}
	if (typeof hidden !== "string") {
		res.status(400).send("Malformed hidden")
		return
	}
	if (!soundFile) {
		res.status(400).send("Missing file")
		return
	}

	const verify = createVerify('SHA256');
	verify.update(guildid + userid + exp)
	const valid = verify.verify(publicKey, key, "hex")

	const now = Date.now()

	if (!valid || now > parseInt(exp, 10)) {
		res.status(400)
		res.send("invalid key")
		return
	}

	const soundId = await sounds.addSoundToGuild(guildid, name, hidden === "true", userid)

	const finalFilePath = envVars.SOUNDS_FOLDER_PATH + "/" + soundId + ".opus"

	const child = spawn("ffmpeg", ["-f", "mp3", "-i", "pipe:", "-c:a", "libopus", "-b:a", "64k", "-vbr", "on", "-compression_level", "10", "-frame_duration", "60", finalFilePath], {
		stdio: ["pipe", "ignore", process.stderr]
	})

	child.on("exit", (code) => {
		if (code !== 0) {
			res.status(500).send()
		} else {
			res.status(201).send()
		}
	})

	child.stdin.end(soundFile.buffer)



})
