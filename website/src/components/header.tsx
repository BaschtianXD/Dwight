import Link from "next/link"
import { signIn, signOut, useSession } from "next-auth/react";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/20/solid";
import { UserIcon } from "@heroicons/react/24/outline";

const Header = () => {
    const { data: sessionData } = useSession();
    const [menuExpanded, setMenuExpanded] = useState(false)

    return (
        <header>
            <nav className="bg-white border-gray-200 px-4 lg:px-6 py-2.5 dark:bg-gray-800">
                <div className="flex flex-wrap justify-between items-center mx-auto max-w-screen-xl">
                    <Link href="/" className="flex items-center">
                        <span className="self-center text-xl font-semibold whitespace-nowrap dark:text-white">Dwight</span>
                    </Link>
                    <div className="flex items-center lg:order-2">
                        <button onClick={() => setMenuExpanded(!menuExpanded)} type="button" className="inline-flex items-center p-2 ml-1 text-sm text-gray-500 rounded-lg lg:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600" aria-controls="mobile-menu-2" aria-expanded="false">
                            <span className="sr-only">Open main menu</span>
                            {menuExpanded ?
                                <XMarkIcon key="close" className="h-6 w-6" />
                                :
                                <Bars3Icon key="open" className="h-6 w-6" />
                            }

                        </button>
                    </div>
                    <div className={"justify-between items-center w-full lg:flex lg:w-auto lg:order-1 " + (!menuExpanded ? "hidden" : "")} id="mobile-menu-2">
                        <ul className="flex flex-col mt-4 font-medium lg:flex-row lg:space-x-8 lg:mt-0">
                            <HeaderItem key="0" href="/">Home</HeaderItem>
                            <HeaderItem key="1" href="/getstarted">Get Started</HeaderItem>
                            {sessionData &&
                                <HeaderItem key="2" href="/servers">Servers</HeaderItem>
                            }


                            {sessionData &&
                                <li key="3">
                                    <button onClick={() => signOut()} className="block w-full text-left py-2 pr-4 pl-3 text-gray-700 border-b border-gray-100 hover:bg-gray-50 lg:hover:bg-transparent lg:border-0 lg:hover:text-primary-700 lg:p-0 dark:text-gray-400 lg:dark:hover:text-white dark:hover:bg-gray-700 dark:hover:text-white lg:dark:hover:bg-transparent dark:border-gray-700">Sign Out</button>
                                </li>
                            }
                            {sessionData &&
                                <li key="4">
                                    <p className="py-2 pr-4 pl-3 text-gray-700 border-b border-gray-100 lg:border-0 lg:p-0 lg:mr-2 dark:text-gray-400 dark:border-gray-700 flex">
                                        <UserIcon className="h-6 w-6" />{sessionData.user?.name}
                                    </p>
                                </li>
                            }

                            {!sessionData &&
                                <li key="5">
                                    <button onClick={() => signIn("discord")} className="block w-full text-left py-2 pr-4 pl-3 text-gray-700 border-b border-gray-100 hover:bg-gray-50 lg:hover:bg-transparent lg:border-0 lg:hover:text-primary-700 lg:p-0 dark:text-gray-400 lg:dark:hover:text-white dark:hover:bg-gray-700 dark:hover:text-white lg:dark:hover:bg-transparent dark:border-gray-700">Sign In</button>
                                </li>
                            }
                        </ul>
                    </div>
                </div>
            </nav>
        </header>
    )
}

export default Header

type HeaderItemProps = {
    href: string
    children: ReactNode
}

const HeaderItem: FC<HeaderItemProps> = (props) => {
    return (
        <li>
            <Link href={props.href} className="block py-2 pr-4 pl-3 text-gray-700 border-b border-gray-100 hover:bg-gray-50 lg:hover:bg-transparent lg:border-0 lg:hover:text-primary-700 lg:p-0 dark:text-gray-400 lg:dark:hover:text-white dark:hover:bg-gray-700 dark:hover:text-white lg:dark:hover:bg-transparent dark:border-gray-700">{props.children}</Link>
        </li>
    )
}