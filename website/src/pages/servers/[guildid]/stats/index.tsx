import type { inferRouterOutputs } from "@trpc/server";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import { LoadingIcon } from "../../../../components/form";
import type { AppRouter } from "../../../../server/trpc/router/_app";
import { trpc } from "../../../../utils/trpc";
import { pageClasses } from "../../../../components/shared";
import NavHeader from "../../../../components/NavHeader";
import { signIn, useSession } from "next-auth/react";
import Head from "next/head";
import { TrophyIcon } from "@heroicons/react/24/outline";

type RouterOutput = inferRouterOutputs<AppRouter>
type Sound = RouterOutput["discord"]["getVisibleSounds"][number]

const StatsPage: NextPage = () => {
    const { data: sessionData } = useSession();
    const router = useRouter();
    const { guildid } = router.query
    const soundsQuery = trpc.discord.getVisibleSounds.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string", staleTime: 2000 })
    const playCountQuery = trpc.discord.getTopSoundsForGuild.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string", staleTime: 2000 })
    const guildQuery = trpc.discord.getGuild.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string", staleTime: 1000 * 60 * 5 })
    const lastPlays = trpc.discord.getLastPlays.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string", staleTime: 1000 * 60 * 5 })

    if (typeof guildid !== "string") {
        return (<LoadingIcon className="h-20 w-20" />)
    }

    if (soundsQuery.error?.data?.code === "PRECONDITION_FAILED"
        || playCountQuery.error?.data?.code === "PRECONDITION_FAILED"
        || guildQuery.error?.data?.code === "PRECONDITION_FAILED"
    ) {
        router.push("/")
    }

    if (sessionData && !sessionData.user) {
        signIn()
    }

    const soundsMap = soundsQuery.data?.reduce((acc, sound) => {
        return acc.set(sound.soundid, sound)
    }, new Map<string, Sound>())

    const scoreboard = soundsMap && playCountQuery.data?.sort((a, b) => b.count - a.count).map(counter => ({
        soundName: soundsMap.get(counter.soundid)?.name ?? "",
        count: counter.count
    }))

    return (
        <div className={pageClasses}>

            <Head>
                <title>Dwight - {guildQuery.data?.guild.name ?? ""} - Statistics</title>
            </Head>

            {/* NAV HEADER */}
            <NavHeader elements={[
                { label: "Servers", href: "/servers" },
                { label: "" + guildQuery.data?.guild.name, href: "/servers/" + guildQuery.data?.guild.id, loading: !guildQuery.data },
                { label: "Statistics", href: "/servers/" + guildQuery.data?.guild.id + "/stats" }
            ]} />

            {/* PAGE HEADER */}
            <div className="flex flex-row flex-wrap w-full justify-between gap-2">
                <p className="font-bold text-4xl">Statistics</p>
            </div>

            {/* PAGE CONTENT */}
            <div className="w-full h-full overflow-visible flex flex-col gap-8">
                {scoreboard &&
                    <div>
                        <p className="text-center text-2xl font-bold">Most played sounds</p>
                        <div className="mt-4">
                            <ol type="1" className="grid gap-4 lg:grid-cols-3">
                                {!scoreboard[0] &&
                                    <li className="lg:col-span-3">
                                        <p className="text-center">No sound has been played yet.</p>
                                    </li>
                                }
                                {scoreboard[0] &&
                                    <li className="lg:order-2">
                                        <TrophyIcon className="w-16 h-16 mx-auto stroke-yellow-400" />
                                        <p className="text-center">1.</p>
                                        <p className="text-center text-lg font-bold">{scoreboard[0].soundName}</p>
                                        <p className="text-center">{scoreboard[0].count} plays</p>
                                    </li>
                                }
                                {scoreboard[1] &&
                                    <li className="lg:order-1 lg:mt-4">
                                        <TrophyIcon className="w-12 h-12 mx-auto stroke-gray-400" />
                                        <p className="text-center">2.</p>
                                        <p className="text-center text-lg font-bold">{scoreboard[1].soundName}</p>
                                        <p className="text-center">{scoreboard[1].count} plays</p>
                                    </li>
                                }
                                {scoreboard[2] &&
                                    <li className="lg:order-3 lg:mt-6">
                                        <TrophyIcon className="w-10 h-10 mx-auto stroke-amber-700" />
                                        <p className="text-center">3.</p>
                                        <p className="text-center text-lg font-bold">{scoreboard[2].soundName}</p>
                                        <p className="text-center">{scoreboard[2].count} plays</p>
                                    </li>
                                }

                            </ol>
                        </div>
                    </div>
                }
                {lastPlays.data &&
                    <div className="w-full max-w-full pb-6">
                        <p className="text-center text-2xl font-bold mb-2">Recently played sounds</p>
                        <ol className="flex flex-row overflow-x-scroll snap-x snap-mandatory -left-4 relative w-screen md:flex-wrap md:overflow-hidden md:snap-none md:w-auto md:left-0 md:relat">
                            {lastPlays.data.map((play, index) => (
                                <li className="m-1 p-4 rounded bg-gray-500/50 inline-block w-5/6 md:w-auto snap-start scroll-ml-4" key={index}>
                                    <p className="text-center text-3xl whitespace-nowrap">{play.sound.name}</p>
                                </li>
                            ))}
                        </ol>

                    </div>
                }

            </div>

        </div >
    )
}

export default StatsPage