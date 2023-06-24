import Link from "next/link";
import { inviteLink } from "../components/shared";

export default function Home() {

    return (
        <>
            <main className="flex min-h-full flex-col items-center justify-center">
                <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
                    <h1 className="text-5xl font-extrabold tracking-tight dark:text-white sm:text-[5rem]">
                        Dwight - Discord Sound Bot
                    </h1>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
                        <div
                            className="flex max-w-xs flex-col gap-4 rounded-xl bg-gray-500/20 p-4 dark:text-white hover:bg-gray-500/30">
                            <h3 className="text-2xl font-bold">Features</h3>
                            <div className="text-lg">
                                Upload sounds which can be played by pressing a button in Discord or attach a sound to a user to play the sound when the user joins a voicechannel.
                            </div>
                        </div>
                        <Link
                            href="https://youtu.be/_MEb2ov5hxs"
                            target="_blank"
                            className="flex max-w-xs flex-col gap-4 rounded-xl bg-gray-500/20 p-4 dark:text-white hover:bg-gray-500/30">
                            <h3 className="text-2xl font-bold">Inspiration</h3>
                            <div className="text-lg">
                                Throwing A Garden Party by James Trickington<br />
                                <p className="italic">&quot;Chapter 2:<br />Announcing guests as they enter is the height of the decorum, the more volume displayed the more honor is bestowed upon everyone present. &quot;</p>
                                The Office: S8E4
                            </div>
                        </Link>
                        <Link
                            className="flex max-w-xs flex-col gap-4 rounded-xl bg-gray-500/20 p-4 dark:text-white hover:bg-gray-500/30"
                            href="/getstarted"
                        >
                            <h3 className="text-2xl font-bold">Get Started →</h3>
                            <div className="text-lg">
                                Step by step guide to use Dwight.
                            </div>
                        </Link>
                        <Link
                            className="flex max-w-xs flex-col gap-4 rounded-xl bg-gray-500/20 p-4 dark:text-white hover:bg-gray-500/30"
                            href={inviteLink}
                            target="_blank"
                        >
                            <h3 className="text-2xl font-bold">Add Dwight to your server</h3>
                            <div className="text-lg">
                                You already know the steps and just want to add Dwight to a server? Here you go.
                            </div>
                        </Link>
                    </div>
                </div>
                <div>
                    <p>Made with love by <Link className="font-bold" href="https://github.com/BaschtianXD" target="_blank" rel="noreferrer">@BaschtianXD</Link></p>
                </div>
            </main>
        </>
    );
}
