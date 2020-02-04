import Command from "../interfaces/Command"
import { Message, TextChannel, NewsChannel, Channel } from "discord.js"

export class clear implements Command {
    execute(msg: Message): void {
        var channel = msg.channel;
        if(channel instanceof TextChannel || channel instanceof NewsChannel) {
            let tchannel = channel as TextChannel
            tchannel.messages.fetch()
            .then( messages => {
                messages = messages.filter( m =>{
                    //We can only buld delete messages that aren't older than 14 days
                    let date = m.createdAt
                    date.setDate(date.getDate() + 14)
                    return !m.pinned && (date.getTime() - Date.now() > 0)
                } )
                channel.bulkDelete(messages)
            }).catch( reason => {
                msg.reply("there was an error.\n" + reason)
                console.log(reason)
            })
        } else {
            msg.reply("this is not possible here.")
        }
        
    }
    
    
}