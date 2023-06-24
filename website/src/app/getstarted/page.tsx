import Head from "next/head";
import Link from "next/link";
import type { FC } from "react";
import { LinkButton } from "../../components/form";
import { inviteLink, pageClasses } from "../../components/shared";
import Step2 from "./Step2";

const GetStartedPage = () => {
    return (
        <div className={pageClasses}>
            <Head>
                <title>Dwight - Getting Started</title>
            </Head>

            <div><p className="font-bold dark:text-slate-300 text-4xl">Get Started</p></div>
            <StepBox headline="Step 1: Add Dwight to your server">
                <p>Click on the following link and add Dwight to a server you own or have the Manage Server permission for.</p>
                <div className="w-full flex flex-row items-center justify-center mt-4">
                    <LinkButton href={inviteLink} label="Add to server" newTab />
                </div>
            </StepBox>
            <StepBox headline="Step 2: Sign in">
                <p>Sign in with your Discord account.</p>
                <Step2 />

            </StepBox>
            <StepBox headline="Step 3: Add Sounds">
                <p className="text-xs">Signin with Discord required</p>
                <p>Go to <Link className="font-bold" href="/servers">Servers</Link>, select the server you added Dwight to and go to Manage Sounds. There you can add sounds. {"(mp3 file, size < 100kb)"}</p>
                <p>When you added a visible sound, click on Apply Changes and a channel containing a button for each visible sound will be created. Changes do not take effect until this button has been clicked.</p>
            </StepBox>
            <StepBox headline="Step 4: Enjoy">
                <p>Join a voice channel on your server and press one of the sound buttons. Dwight will join your voice channel and play the sound.</p>
            </StepBox>
            <StepBox headline="Step 5: Add an announcement">
                <p>When creating a sound you can set its visibility to to hidden. No button for this this sound will be created. But you can use this sound for announcements. After creating the sound, go to Manage Announcements and create an announcement for a user. When this user joins a voice channel the selected sound will be played. This does not trigger when switching between voice channels.</p>
            </StepBox>
            <StepBox headline="Additional Features">
                <ul className="list-disc list-inside">
                    <li>Implicit rights to play sounds via channel rights</li>
                    <li>Announcement sounds. Play a sounds when someone joins a voice channel</li>
                </ul>
            </StepBox>
        </div>
    )
}

export default GetStartedPage

type StepBoxProps = {
    headline: string,
    children?: React.ReactNode
}

const StepBox: FC<StepBoxProps> = (props) => {
    return (
        <div className="p-2 rounded-lg bg-gray-500/20">
            <p className="text-lg mb-2">{props.headline}</p>
            {props.children}
        </div>
    )
}