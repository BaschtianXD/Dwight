import { ChevronRightIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import type { FC } from "react";

type NavHeaderProps = {
    elements: {
        label: string,
        href: string,
        loading?: boolean
    }[]
}

const NavHeader: FC<NavHeaderProps> = (props) => {

    return (
        <ul className="flex flex-wrap gap-2 items-center m-2">
            {props.elements.map((link, index) => (
                <li key={index} className="inline-flex gap-2 items-center">
                    <ChevronRightIcon className="h-4" />
                    {link.loading ?
                        <div className="h-6 w-24 bg-gray-500/50 animate-pulse rounded ml-1" />
                        :
                        <Link href={link.href}>{link.label}</Link>
                    }

                </li>
            ))}
        </ul>
    )
}

export default NavHeader