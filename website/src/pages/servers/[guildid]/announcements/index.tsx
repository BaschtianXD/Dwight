import { Dialog, Listbox, Menu, Transition } from "@headlessui/react";
import type { inferRouterOutputs } from "@trpc/server";
import type { NextPage } from "next";
import { useRouter } from "next/router";
import type { Reducer } from "react";
import { useState } from "react";
import { Fragment } from "react";
import { useReducer } from "react";
import { PositiveButton, DefaultButton, NegativeButton, LoadingIcon } from "../../../../components/form";
import type { AppRouter } from "../../../../server/trpc/router/_app";
import { trpc } from "../../../../utils/trpc";
import { ChevronDownIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid"
import { PencilSquareIcon, PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import { pageClasses } from "../../../../components/shared";
import NavHeader from "../../../../components/NavHeader";
import { signIn, useSession } from "next-auth/react";
import Image from "next/image";
import { RubikFont } from "../../../../common";
import Link from "next/link";
import Head from "next/head";

type RouterOutput = inferRouterOutputs<AppRouter>
type Sound = RouterOutput["discord"]["getSounds"]["sounds"][number]
type User = RouterOutput["discord"]["getGuildMembers"][number]

interface Announcement {
    user: User | null,
    sound: Sound | null
}

type AnnouncementReducerActionCreate = {
    type: "init"
}

type AnnouncementReducerActionEdit = {
    type: "edit"
    user: User,
    sound: Sound
}

type AnnouncementReducerActionSetUser = {
    type: "setUser",
    user: User
}

type AnnouncementReducerActionSetSound = {
    type: "setSound",
    sound: Sound
}

type AnnouncementReducerActionClear = {
    type: "clear"
}

type AnnouncementDialogType = "create" | "edit"

type newAnnouncementReducerAction = AnnouncementReducerActionCreate | AnnouncementReducerActionEdit | AnnouncementReducerActionSetUser | AnnouncementReducerActionSetSound | AnnouncementReducerActionClear

const newAnnouncementReducer: Reducer<Announcement | null, newAnnouncementReducerAction> = ((prevState, action) => {
    switch (action.type) {
        case "clear":
            return null
        case "init":
            return {
                user: null,
                sound: null
            }
        case "edit":
            return {
                user: action.user,
                sound: action.sound
            }
        case "setSound":
            return prevState ? {
                ...prevState,
                sound: action.sound
            } : null
        case "setUser":
            return prevState ? {
                ...prevState,
                user: action.user
            } : null
    }
})

const AnnouncementPage: NextPage = () => {
    const { data: sessionData } = useSession();
    const router = useRouter();
    const { guildid } = router.query
    const announcementsQuery = trpc.discord.getAnnouncements.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string" })
    const upsertAnnouncement = trpc.discord.upsertAnnouncement.useMutation()
    const deleteAnnouncement = trpc.discord.deleteAnnouncement.useMutation()

    const [announcementObject, dispatchAnnouncementAction] = useReducer(newAnnouncementReducer, null)

    const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false)
    const [announcementDialogType, setAnnoucementDialogType] = useState("edit" as AnnouncementDialogType)
    const soundsQuery = trpc.discord.getSounds.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string", staleTime: 2000 })

    const guildQuery = trpc.discord.getGuild.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string", staleTime: 1000 * 60 * 5 })

    const guildMembersQuery = trpc.discord.getGuildMembers.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string", staleTime: 1000 * 60 * 5 })


    if (typeof guildid !== "string") {
        return (<LoadingIcon className="h-20 w-20" />)
    }

    if (announcementsQuery.error?.data?.code === "PRECONDITION_FAILED"
        || soundsQuery.error?.data?.code === "PRECONDITION_FAILED"
        || guildQuery.error?.data?.code === "PRECONDITION_FAILED"
        || guildMembersQuery.error?.data?.code === "PRECONDITION_FAILED"
    ) {
        router.push("/")
    }

    if (sessionData && !sessionData.user) {
        signIn()
    }

    const guildMembersMap = guildMembersQuery.data?.reduce((acc, member) => {
        return acc.set(member.userid, member)
    }, new Map<string, User>())

    return (
        <div className={pageClasses}>

            <Head>
                <title>Dwight - {guildQuery.data?.guild.name ?? ""} - Announcements</title>
            </Head>

            {/* NAV HEADER */}
            <NavHeader elements={[
                { label: "Servers", href: "/servers" },
                { label: "" + guildQuery.data?.guild.name, href: "/servers/" + guildQuery.data?.guild.id, loading: !guildQuery.data },
                { label: "Announcements", href: "/servers/" + guildQuery.data?.guild.id + "/announcements" }
            ]} />

            {/* PAGE HEADER */}
            <div className="flex flex-row flex-wrap w-full justify-between gap-2">
                <p className="font-bold text-4xl">Announcements</p>
                <DefaultButton onClick={() => {
                    dispatchAnnouncementAction({ type: "init" })
                    setShowAnnouncementDialog(true)
                    upsertAnnouncement.reset()
                    setAnnoucementDialogType("create")
                }}><PlusCircleIcon className="w-5 h-5 mr-1" />Create</DefaultButton>
            </div>

            {/* DIALOG */}
            <Transition appear show={showAnnouncementDialog} as={Fragment} >
                <Dialog as="div" className="relative z-20" onClose={() => setShowAnnouncementDialog(false)}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black bg-opacity-25" />
                    </Transition.Child>
                    <div className={`fixed inset-0`}>
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className={`w-full max-w-md transform overflow-visible rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all dark:text-white ${RubikFont.variable} font-sans`}>
                                    <Dialog.Title
                                        as="h3"
                                        className="text-xl font-medium leading-6 mb-4"
                                    >
                                        Create new announcement
                                    </Dialog.Title>
                                    {announcementObject && <div className="flex flex-col gap-2">
                                        <div className="w-full flex flex-row gap-2 items-center">
                                            <label className="font-semibold">User</label>
                                            {guildMembersQuery.data ?
                                                <Listbox value={announcementObject.user} onChange={value => value && dispatchAnnouncementAction({ type: "setUser", user: value })}>
                                                    <Listbox.Button className="rounded-lg p-1 ring-1 ring-gray-500 flex flex-row items-center grow justify-end">
                                                        <span className="block truncate">{announcementObject.user?.name ?? "Select a User"}</span>
                                                        <span className="pointer-events-none inset-y-0 right-0 flex items-center pr-2">
                                                            <ChevronUpDownIcon
                                                                className="h-5 w-5 text-gray-400"
                                                                aria-hidden="true"
                                                            />
                                                        </span>
                                                    </Listbox.Button>
                                                    <Listbox.Options className="absolute right-6 mt-1 max-h-60 overflow-auto rounded-md bg-white dark:bg-gray-900 py-1 text-base shadow-lg ring-2 ring-black dark:ring-gray-500 ring-opacity-5 focus:outline-none sm:text-sm">
                                                        {guildMembersQuery.data.map(member => (
                                                            <Listbox.Option className="relative select-none py-2 pl-2 pr-4 dark:hover:bg-gray-800" key={member.userid} value={member}>
                                                                <div className="flex items-center">
                                                                    {guildMembersMap?.get(member.userid)?.userAvatar &&
                                                                        // TODO guild member avatar has different url
                                                                        <Image
                                                                            src={`https://cdn.discordapp.com/avatars/${member.userid}/${guildMembersMap?.get(member.userid)?.userAvatar}.webp?size=32`}
                                                                            alt="Userimage"
                                                                            width={32}
                                                                            height={32}
                                                                            className="mr-2"
                                                                        />
                                                                    }
                                                                    <p>{member.name}</p>
                                                                </div>
                                                            </Listbox.Option>
                                                        ))}
                                                    </Listbox.Options>
                                                </Listbox>
                                                :
                                                <LoadingIcon className="h-5 w-5" />
                                            }
                                        </div>
                                        <div className="w-full flex flex-row gap-2 items-center">
                                            <label className="font-semibold">Sound</label>
                                            {soundsQuery.data && soundsQuery.data.sounds.length > 0 &&
                                                <Listbox value={announcementObject.sound} onChange={value => value && dispatchAnnouncementAction({ type: "setSound", sound: value })}>
                                                    <Listbox.Button className="rounded-lg p-1 ring-1 ring-gray-500 flex flex-row items-center grow justify-end">
                                                        <span className="block truncate">{announcementObject.sound?.name ?? "Select a sound"}</span>
                                                        <span className="pointer-events-none inset-y-0 right-0 flex items-center pr-2">
                                                            <ChevronUpDownIcon
                                                                className="h-5 w-5 text-gray-400"
                                                                aria-hidden="true"
                                                            />
                                                        </span>
                                                    </Listbox.Button>
                                                    <Listbox.Options className="absolute right-6 mt-1 max-h-60 overflow-auto rounded-md bg-white dark:bg-gray-900 py-1 text-base shadow-lg ring-2 ring-black dark:ring-gray-500 ring-opacity-5 focus:outline-none sm:text-sm">
                                                        {soundsQuery.data.sounds.map(sound => (
                                                            <Listbox.Option className="relative select-none py-2 pl-2 pr-4 dark:hover:bg-gray-800" key={sound.soundid} value={sound}>
                                                                {sound.name}
                                                            </Listbox.Option>
                                                        ))}
                                                    </Listbox.Options>
                                                </Listbox>
                                            }
                                            {soundsQuery.isLoading && <LoadingIcon className="h-5 w-5" />}
                                            {soundsQuery.data && soundsQuery.data.sounds.length === 0 && <p>No sounds on this server.<br />Go to <Link className="font-bold" href={"/servers/" + guildQuery.data?.guild.id + "/sounds"}>Manage Sounds</Link> and create one.</p>}
                                        </div>
                                        <div className="w-full flex flex-row items-center justify-center gap-4">
                                            <PositiveButton disabled={!announcementObject.sound || !announcementObject.user} onClick={() => upsertAnnouncement.mutate({ guildid: guildid, userid: announcementObject.user?.userid ?? "", soundid: announcementObject.sound?.soundid ?? "" }, {
                                                onSuccess: () => {
                                                    announcementsQuery.refetch()
                                                    setShowAnnouncementDialog(false)
                                                }
                                            })}>{(announcementDialogType === "create" ? "Create" : "Edit") + " Announcement"}</PositiveButton>
                                            <NegativeButton onClick={() => setShowAnnouncementDialog(false)}>Cancel</NegativeButton>
                                        </div>
                                    </div>}
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* PAGE CONTENT */}
            <div className="w-full h-full overflow-visible">
                {announcementsQuery.isLoading && <p>Loading ...</p>}
                {announcementsQuery.data && !announcementsQuery.isError &&
                    <div className="flex flex-col h-full overflow-visible">
                        {announcementsQuery.data.announcements.length > 0 ?
                            <div className="overflow-x-auto grow h-full overflow-visible">
                                <table className="table-auto border border-collapse border-black dark:border-white m-1 divide-x overflow-visible">
                                    <thead className="border-b border-black dark:border-white">
                                        <tr>
                                            <th>User</th>
                                            <th>Sound</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y border-black dark:border-white overflow-visible">
                                        {announcementsQuery.data.announcements.map(announcement => (
                                            <tr className="divide-x border-black dark:border-white overflow-visible" key={announcement.userid}>
                                                <td className="p-2 border-black dark:border-white">
                                                    <div className="flex items-center">
                                                        {guildMembersMap?.get(announcement.userid)?.userAvatar &&
                                                            // TODO guild member avatar has different url
                                                            <Image
                                                                src={`https://cdn.discordapp.com/avatars/${announcement.userid}/${guildMembersMap?.get(announcement.userid)?.userAvatar}.webp?size=32`}
                                                                alt="Userimage"
                                                                width={32}
                                                                height={32}
                                                                className="mr-2"
                                                            />
                                                        }

                                                        <p>{guildMembersMap?.get(announcement.userid)?.name ?? announcement.userid}</p>
                                                    </div>
                                                </td>
                                                <td className="p-2 border-black dark:border-white">{announcement.sound.name}</td>
                                                <td className="p-2 border-black dark:border-white overflow-visible">
                                                    <div className="hidden md:flex flex-row gap-2">

                                                        <DefaultButton onClick={() => {
                                                            const guildMember = guildMembersMap?.get(announcement.userid)
                                                            if (!guildMember) return
                                                            dispatchAnnouncementAction({
                                                                type: "edit",
                                                                sound: announcement.sound,
                                                                user: guildMember
                                                            })
                                                            setShowAnnouncementDialog(true)
                                                            upsertAnnouncement.reset()
                                                            setAnnoucementDialogType("edit")
                                                        }}><p>Edit Sound</p><PencilSquareIcon className="h-5 w-5 ml-2" /></DefaultButton>
                                                        <DefaultButton
                                                            onClick={() => deleteAnnouncement.mutate({ guildid: guildid, userid: announcement.userid }, { onSuccess: () => announcementsQuery.refetch() })}
                                                        ><p>Delete</p><TrashIcon className="w-5 h-5 ml-2" /></DefaultButton>
                                                    </div>
                                                    <div className="md:hidden overflow-visible">
                                                        <Menu as="div" className="relative inline-block text-left">
                                                            <div>
                                                                <Menu.Button className="inline-flex w-full justify-center rounded-md bg-black bg-opacity-20 px-4 py-2 text-sm font-medium text-white hover:bg-opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75">
                                                                    Actions
                                                                    <ChevronDownIcon
                                                                        className="ml-2 -mr-1 h-5 w-5 text-violet-200 hover:text-violet-100"
                                                                        aria-hidden="true"
                                                                    />
                                                                </Menu.Button>
                                                            </div>
                                                            <Transition
                                                                as={Fragment}
                                                                enter="transition ease-out duration-100"
                                                                enterFrom="transform opacity-0 scale-95"
                                                                enterTo="transform opacity-100 scale-100"
                                                                leave="transition ease-in duration-75"
                                                                leaveFrom="transform opacity-100 scale-100"
                                                                leaveTo="transform opacity-0 scale-95"
                                                            >
                                                                <Menu.Items className="absolute right-0 mt-1 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white dark:bg-gray-900 dark:text-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                                                    <div className="p-1">
                                                                        <Menu.Item>
                                                                            <button className={`group flex w-full items-center rounded-md px-2 py-2 text-sm`} onClick={() => deleteAnnouncement.mutate({ guildid: guildid, userid: announcement.userid }, { onSuccess: () => announcementsQuery.refetch() })}>
                                                                                <TrashIcon className="h-5 w-5 mr-2" />
                                                                                Delete
                                                                            </button>
                                                                        </Menu.Item>
                                                                        <Menu.Item>
                                                                            <button className={`group flex w-full items-center rounded-md px-2 py-2 text-sm`} onClick={() => {
                                                                                const guildMember = guildMembersMap?.get(announcement.userid)
                                                                                if (!guildMember) return
                                                                                dispatchAnnouncementAction({
                                                                                    type: "edit",
                                                                                    sound: announcement.sound,
                                                                                    user: guildMember
                                                                                })
                                                                                setShowAnnouncementDialog(true)
                                                                                upsertAnnouncement.reset()
                                                                                setAnnoucementDialogType("edit")
                                                                            }} >
                                                                                <PencilSquareIcon className="h-5 w-5 mr-2" />
                                                                                Edit Sound
                                                                            </button>
                                                                        </Menu.Item>
                                                                    </div>

                                                                </Menu.Items>
                                                            </Transition>
                                                        </Menu>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            :
                            <p>There seem to be no announcements. How about you create one?</p>
                        }
                    </div>
                }
            </div>

        </div >
    )
}

export default AnnouncementPage