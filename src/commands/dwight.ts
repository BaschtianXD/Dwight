import Command from "../interfaces/Command"
import { Message } from "discord.js"

export class dwight implements Command {

	execute(msg: Message): void {
		msg.reply(`Hello. I am Dwight Schrute. I work for the Dunder Mifflin Paper Company, Inc. Scranton branch.
I am delightet to offer you these services:
!dwight	- shows this
!clear	- clears the text channel of all messages of the last 14 days, except pinned ones
!sound [name]	- plays the sound with the given [name], else shows a list of available sounds
		`)
	}

}