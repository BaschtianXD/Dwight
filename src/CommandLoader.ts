import * as coms from "./commands"
import { Collection } from "discord.js";
import Command from "./interfaces/Command"

var commands = new Collection<String, Command>()

for (var com in coms) {
    commands.set(coms[com].name, new coms[com]())
}

export default commands