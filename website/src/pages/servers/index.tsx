import { ChevronRightIcon } from "@heroicons/react/20/solid";
import type { NextPage } from "next";
import { signIn } from "next-auth/react";
import Head from "next/head";
import Link from "next/link";
import { LoadingIcon } from "../../components/form";
import NavHeader from "../../components/NavHeader";
import { inviteLink, pageClasses } from "../../components/shared";
import { trpc } from "../../utils/trpc";
import Image from "next/image";

const ServersPage: NextPage = () => {
    const guilds = trpc.discord.getGuilds.useQuery(undefined, { staleTime: 1000 * 10 })

    if (guilds.error) {
        if (guilds.error.data?.code === "UNAUTHORIZED") {
            signIn()
        }
    }
    return (
        <div className={pageClasses}>
            <Head>
                <title>
                    Dwight - Servers
                </title>
            </Head>

            {/* NAV HEADER */}
            <NavHeader elements={[{
                href: "/servers",
                label: "Servers"
            }]} />

            {/* PAGE HEADER */}
            <div className="flex flex-row flex-wrap w-full justify-between gap-2">
                <p className="font-bold text-4xl">Servers</p>
            </div>
            <p>Here are your servers Dwight is on. You can configure Dwight on servers you are the owner of or have the Manage Server permission. If a server is missing, click <Link className="font-bold" href={inviteLink}>here</Link> to add it to the server {"(requires server owner or manage server permission)"}</p>
            {guilds.isLoading &&
                <div className="w-full grow flex flex-row items-center justify-around">
                    <LoadingIcon className="w-10 h-10" />
                </div>
            }

            {guilds.data && guilds.data.guilds.size > 0 &&
                <div className="flex flex-col w-full gap-6">
                    {Array.from(guilds.data.guilds.values()).map(guild => (
                        <Link key={guild.id} href={"/servers/" + guild.id} className="w-full rounded bg-gray-500/40 flex items-center justify-between p-4 group">
                            <div className="flex gap-2">
                                {guild.icon &&
                                    <Image
                                        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon?.startsWith("a_") ? "gif" : "webp"}?size=28`}
                                        alt="Guild Icon"
                                        width={28}
                                        height={28}
                                        className="mr-2 aspect-square rounded-3xl group-hover:rounded-md transition-all"
                                    />
                                }

                                <p className="text-xl whitespace-nowrap truncate">{guild.name}</p>
                            </div>
                            <ChevronRightIcon className="w-7 h-7" />
                        </Link>
                    ))}

                </div>
            }

            {guilds.data && guilds.data.guilds.size === 0 &&
                <p>Dwight does not seem to be on one of your servers. How about you add him?</p>
            }


        </div >

    )
}

export default ServersPage