import type { NextPage } from "next";
import { useRouter } from "next/router";
import { trpc } from "../../../../utils/trpc";
import { CheckCircleIcon, ChevronDownIcon, EyeIcon, EyeSlashIcon, PencilSquareIcon, PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline"
import type { Reducer } from "react";
import { Fragment } from "react";
import { useReducer, useState } from "react";
import Head from "next/head";
import { DefaultButton, LoadingIcon, NegativeButton, PositiveButton, TextInput } from "../../../../components/form";
import { Dialog, Menu, Switch, Transition } from "@headlessui/react";
import { pageClasses } from "../../../../components/shared";
import NavHeader from "../../../../components/NavHeader";
import { RubikFont } from "../../../../common";

type DragError = "TooManyFiles" | "InvalidFileType" | "InvalidType" | "Filesize"

interface SoundObject {
    soundid?: string
    name: string
    hidden: boolean
    file: File | null
}

type SoundActionCreate = {
    type: "init"
}
type SoundActionCreateFromFile = {
    type: "initFromFile"
    file: File
}
type SoundActionClear = {
    type: "clear"
}
type SoundActionSetName = {
    type: "setName"
    newName: string
}
type SoundActionToggleHidden = {
    type: "toggleHidden"
}
type SoundActionSetFile = {
    type: "setFile",
    file: File | null
}
type SoundActionEdit = {
    type: "edit"
    soundid: string
    name: string
    hidden: boolean
}

type SoundDialogType = "create" | "edit"

type NewSoundReducerAction = SoundActionCreate | SoundActionCreateFromFile | SoundActionClear | SoundActionSetName | SoundActionToggleHidden | SoundActionSetFile | SoundActionEdit

const newSoundReducer: Reducer<SoundObject | null, NewSoundReducerAction> = (prevState, action) => {
    switch (action.type) {
        case "init":
            return {
                name: "",
                hidden: false,
                file: null
            }
        case "initFromFile":
            return {
                name: action.file.name.slice(0, action.file.name.lastIndexOf(".")),
                hidden: false,
                file: action.file
            }
        case "edit":
            return {
                soundid: action.soundid,
                name: action.name,
                hidden: action.hidden,
                file: null
            }
        case "clear":
            return null
        case "setName":
            return prevState ? {
                ...prevState,
                name: action.newName
            } : null
        case "toggleHidden":
            return prevState ? {
                ...prevState,
                hidden: !prevState.hidden
            } : null
        case "setFile":
            return prevState ? {
                ...prevState,
                file: action.file
            } : null
    }
}

const MaxFileSize = 204800

const SoundsPage: NextPage = () => {
    const router = useRouter();
    const { guildid } = router.query

    const [dragging, setDragging] = useState(false)
    const [dragError, setDragError] = useState(null as DragError | null)

    const [soundObject, dispatchSoundAction] = useReducer(newSoundReducer, null as SoundObject | null)
    const [showSoundDialog, setShowSoundDialog] = useState(false)
    const [soundDialogType, setSoundDialogType] = useState("create" as SoundDialogType)

    const soundsQuery = trpc.discord.getSounds.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string" })
    const soundCreateMutation = trpc.discord.createSound.useMutation()
    const soundDeleteMutation = trpc.discord.deleteSound.useMutation()
    const soundUpdateMutation = trpc.discord.updateSound.useMutation()

    const guildQuery = trpc.discord.getGuild.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string", staleTime: 1000 * 60 * 5 })
    const limitQuery = trpc.discord.getLimit.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string" })

    const pendingChangesQuery = trpc.discord.getPendingChanges.useQuery({ guildid: typeof guildid === "string" ? guildid : "" }, { enabled: typeof guildid === "string" })
    const applyChangesMutation = trpc.discord.applyChanges.useMutation()

    if (typeof guildid !== "string") {
        return (<LoadingIcon className="h-20 w-20" />)
    }

    return (
        <div className={pageClasses}
            onDragOver={event => {
                event.preventDefault()
            }}
            onDragEnter={ev => {
                ev.preventDefault()
                setDragError(null)
                // const items = ev.dataTransfer.items
                // if (items.length !== 1 || !items[0]) {
                //     setDragError("TooManyFiles")
                //     return
                // }
                // const item = items[0]
                // if (item.kind !== "file") {
                //     console.log(item.kind)
                //     setDragError("InvalidType")
                //     return
                // }
                // if (item.type !== "audio/mpeg") {
                //     setDragError("InvalidFileType")
                //     console.log("File Type:" + item.type)
                //     return
                // }
                setDragging(true)
            }}
            onDrop={ev => {
                ev.preventDefault()
                setDragging(false)
                if (dragError) {
                    return
                }
                const items = ev.dataTransfer.items
                if (items.length !== 1 || !items[0]) {
                    setDragError("TooManyFiles")
                    return
                }
                const item = items[0]
                if (item.kind !== "file") {
                    setDragError("InvalidType")
                    return
                }
                if (item.type !== "audio/mpeg") {
                    setDragError("InvalidFileType")
                    return
                }
                const file = item.getAsFile()
                if (!file) {
                    return
                }
                if (file.size > MaxFileSize) {
                    setDragError("Filesize")
                    return
                }
                dispatchSoundAction({ type: "initFromFile", file: file })
                setShowSoundDialog(true)
                setSoundDialogType("create")
                soundCreateMutation.reset()
            }}
            onDragEnd={ev => {
                ev.preventDefault()
                setDragError(null)
                setDragging(false)
            }}
            onDragLeave={ev => {
                ev.preventDefault()
                setDragError(null)
                setDragging(false)
            }}
        >
            <Head>
                <title>Dwight - {guildQuery.data?.guild.name ?? ""} - Sounds</title>
            </Head>

            {/* NAV HEADER */}
            <NavHeader elements={[
                { label: "Servers", href: "/servers" },
                { label: "" + guildQuery.data?.guild.name, href: "/servers/" + guildQuery.data?.guild.id, loading: !guildQuery.data },
                { label: "Sounds", href: "/servers/" + guildQuery.data?.guild.id + "/sounds" }
            ]} />

            {/* PAGE HEADER */}
            <div className="flex flex-row flex-wrap w-full justify-between gap-2">
                <div className="flex gap-2 items-center">
                    <p className="font-bold text-4xl">Sounds</p>
                    {soundsQuery.data && limitQuery.data &&
                        <p>({soundsQuery.data.sounds.length}/{limitQuery.data})</p>
                    }

                </div>

                <div className="flex gap-2">
                    {pendingChangesQuery.data?.pendingChanges &&
                        <PositiveButton onClick={async () => {
                            await applyChangesMutation.mutateAsync({ guildid: guildid })
                            pendingChangesQuery.refetch()
                        }}>
                            <CheckCircleIcon className="w-5 h-5 mr-1" />
                            Apply Changes
                        </PositiveButton>
                    }

                    <DefaultButton onClick={() => {
                        dispatchSoundAction({ type: "init" })
                        setShowSoundDialog(true)
                        soundCreateMutation.reset()
                        setSoundDialogType("create")
                    }}><PlusCircleIcon className="w-5 h-5 mr-1" />Create</DefaultButton>
                </div>
            </div>

            {/* DIALOG */}
            <Transition appear show={showSoundDialog} as={Fragment} >
                <Dialog as="div" className="relative z-20" onClose={() => setShowSoundDialog(false)}>
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
                    <div className="fixed inset-0 overflow-y-auto">
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
                                        {soundDialogType === "create" ? "Create new Sound" : "Edit Sound"}
                                    </Dialog.Title>
                                    {soundObject && <div className="flex flex-col gap-2">
                                        <div>
                                            <TextInput label="Name" onChange={event => {
                                                dispatchSoundAction({ type: "setName", newName: event.target.value })
                                            }} value={soundObject.name} />
                                        </div>
                                        <div className="w-full flex flex-row gap-2 items-center">
                                            <label className="font-semibold">Visible</label>
                                            <div className="">
                                                <Switch
                                                    checked={!soundObject.hidden}
                                                    onChange={() => dispatchSoundAction({ type: "toggleHidden" })}
                                                    className={`bg-red-500 ui-checked:bg-green-500 relative inline-flex h-[38px] w-[74px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2  focus-visible:ring-white focus-visible:ring-opacity-75`}
                                                >
                                                    <span className="sr-only">Use setting</span>
                                                    <span
                                                        aria-hidden="true"
                                                        className={`translate-x-0 ui-checked:translate-x-9 pointer-events-none inline-block h-[34px] w-[34px] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
                                                    />
                                                </Switch>
                                            </div>
                                        </div>
                                        {soundDialogType === "create" &&
                                            <div className="flex items-center gap-2">
                                                <label className="font-semibold">File</label>
                                                {soundObject.file ?
                                                    <div className="flex items-center gap-2">
                                                        <p>{soundObject.file.name}</p>
                                                        <DefaultButton onClick={() => dispatchSoundAction({ type: "setFile", file: null })}>Clear file</DefaultButton>
                                                    </div>
                                                    :
                                                    <div>
                                                        <input type="file" onChange={event => dispatchSoundAction({ type: "setFile", file: event.target.files?.[0] ?? null })} accept="audio/mp3" />
                                                    </div>
                                                }
                                            </div>
                                        }
                                        {soundCreateMutation.isError && soundCreateMutation.error &&
                                            <div className="rounded border-2 border-red-600 bg-red-600/20 p-2">
                                                <p className="font-bold">Error</p>
                                                <p>{soundCreateMutation.error.message}</p>
                                            </div>
                                        }
                                        {!(soundCreateMutation.isLoading || soundUpdateMutation.isLoading) &&
                                            <div className="w-full flex flex-row items-center justify-center gap-4">
                                                <PositiveButton disabled={!soundObject.name || (soundDialogType === "create" && !soundObject.file)}
                                                    onClick={async () => {
                                                        if (soundDialogType === "create" && soundObject.file) {
                                                            const arrBuff = await soundObject.file.arrayBuffer()
                                                            const b64 = Buffer.from(arrBuff).toString("base64")
                                                            soundCreateMutation.mutate({ name: soundObject.name, guildid: guildid, hidden: soundObject.hidden, fileData: b64 }, {
                                                                onSuccess: () => {
                                                                    limitQuery.refetch()
                                                                    pendingChangesQuery.refetch()
                                                                    soundsQuery.refetch()
                                                                    setShowSoundDialog(false)
                                                                }
                                                            })
                                                        } else if (soundDialogType === "edit" && soundObject.soundid) {
                                                            await soundUpdateMutation.mutateAsync({ name: soundObject.name, hidden: soundObject.hidden, soundid: soundObject.soundid })
                                                            pendingChangesQuery.refetch()
                                                            soundsQuery.refetch()
                                                            setShowSoundDialog(false)
                                                        }
                                                    }}>{(soundDialogType === "create" ? "Create" : "Edit") + " Sound"}</PositiveButton>
                                                <NegativeButton onClick={() => setShowSoundDialog(false)}>Cancel</NegativeButton>
                                            </div>
                                        }

                                        {(soundCreateMutation.isLoading || soundUpdateMutation.isLoading) &&
                                            <LoadingIcon className="w-9 h-9 m-auto" />
                                        }
                                    </div>}
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            <Transition appear show={applyChangesMutation.isLoading} as={Fragment} >
                <Dialog as="div" className="relative z-20" onClose={() => { return }}>
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
                    <div className="fixed inset-0 overflow-y-auto">
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
                                        Applying changes
                                    </Dialog.Title>
                                    <LoadingIcon className="w-10 h-10 m-auto" />
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* PAGE CONTENT */}
            {soundsQuery.isSuccess && soundsQuery.data && !(dragging || dragError) &&
                <>
                    {soundsQuery.data.sounds.length > 0 ?
                        <div className="overflow-visible">
                            <table className="table-auto border border-collapse border-black dark:border-white m-1 divide-x overflow-visible">
                                <thead className="border-b border-black dark:border-white">
                                    <tr className="divide-x border-black dark:border-white overflow-visible">
                                        <th className="border p-1">Name</th>
                                        <th className="border p-1">Visibility</th>
                                        <th className="border p-1">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y border-black dark:border-white overflow-visible">
                                    {soundsQuery.data.sounds.map(sound => (
                                        <tr key={sound.soundid} className="divide-x border-black dark:border-white">
                                            <td className="p-2">{sound.name}</td>
                                            <td className="p-2">
                                                {sound.hidden ? <EyeSlashIcon className="max-h-6 m-auto" /> : <EyeIcon className="max-h-6 m-auto" />}
                                                {sound.hidden ? <span className="sr-only">Hidden</span> : <span className="sr-only">Visible</span>}
                                            </td>
                                            <td className="p-2">
                                                <div className="hidden md:flex flex-row gap-2">
                                                    <DefaultButton onClick={() => {
                                                        dispatchSoundAction({ type: "edit", name: sound.name, hidden: sound.hidden, soundid: sound.soundid })
                                                        setShowSoundDialog(true)
                                                        soundCreateMutation.reset()
                                                        setSoundDialogType("edit")
                                                    }}><PencilSquareIcon className="w-5 h-5 mr-2" /><p>Edit</p></DefaultButton>
                                                    <DefaultButton onClick={() => {
                                                        soundDeleteMutation.mutate({ soundid: sound.soundid }, {
                                                            onSuccess: () => {
                                                                pendingChangesQuery.refetch()
                                                                limitQuery.refetch()
                                                                soundsQuery.refetch()
                                                            }
                                                        })
                                                    }}><TrashIcon className="w-5 h-5 mr-2" /><p>Delete</p></DefaultButton>
                                                </div>
                                                <div className="md:hidden">
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
                                                                        <button className={`group flex w-full items-center rounded-md px-2 py-2 text-sm`} onClick={() => {
                                                                            dispatchSoundAction({ type: "edit", name: sound.name, hidden: sound.hidden, soundid: sound.soundid })
                                                                            setShowSoundDialog(true)
                                                                            soundCreateMutation.reset()
                                                                            setSoundDialogType("edit")
                                                                        }} >
                                                                            <PencilSquareIcon className="h-5 w-5 mr-2" />
                                                                            Edit
                                                                        </button>
                                                                    </Menu.Item>
                                                                    <Menu.Item>
                                                                        <button className={`group flex w-full items-center rounded-md px-2 py-2 text-sm`} onClick={() => {
                                                                            soundDeleteMutation.mutate({ soundid: sound.soundid }, {
                                                                                onSuccess: () => {
                                                                                    pendingChangesQuery.refetch()
                                                                                    limitQuery.refetch()
                                                                                    soundsQuery.refetch()
                                                                                }
                                                                            })
                                                                        }}>
                                                                            <TrashIcon className="h-5 w-5 mr-2" />
                                                                            Delete
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
                        <div className="m-auto">
                            <p>There seem to be no sounds on this server. How about you create one?</p>
                        </div>
                    }
                </>
            }
            {soundsQuery.isLoading &&
                <div className="m-auto flex">
                    <p className="text-xl">Loading</p>
                    <LoadingIcon className="h-6 w-6 ml-2" />
                </div>
            }

            {dragging &&
                <div className="h-full w-full m-auto">
                    <p className="text-xl">Drop your file here to create a new sound</p>
                </div>
            }
            {dragError &&
                <div className="m-auto rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all dark:text-white">
                    <p className="font-bold text-2xl text-center mb-4">Error</p>
                    {dragError === "Filesize" &&
                        <p>The file you tried to upload is too big.</p>
                    }
                    {(dragError === "InvalidFileType" || dragError === "InvalidType") &&
                        <p>The file you tried to upload has the wrong filetype.</p>
                    }
                    {dragError === "TooManyFiles" &&
                        <p>You tried to upload multiple files. We can only handle 1 at a time.</p>
                    }
                    <div className="my-4">
                        <p>The following restrictions apply:</p>
                        <ul className="list-disc list-inside">
                            <li>Maximum filesize: 100kb</li>
                            <li>Filetype: .mp3</li>
                            <li>Number of files: 1</li>
                        </ul>
                    </div>
                    <div className="w-full flex justify-center">
                        <DefaultButton onClick={() => {
                            setDragError(null)
                        }}>Dismiss</DefaultButton>
                    </div>
                </div>
            }

        </div>

    )
}

export default SoundsPage
