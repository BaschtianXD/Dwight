"use client"

import { SessionProvider } from "next-auth/react";
import { trpc } from "../utils/trpc";

type Props = {
    children?: React.ReactNode;
};

export const NextAuthProvide = ({ children }: Props) => {
    return <SessionProvider>{children}</SessionProvider>
}