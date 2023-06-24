"use client"

import { signIn, useSession } from "next-auth/react"
import { DefaultButton } from "../../components/form"
import React from "react"

export default function Step2() {
    const session = useSession()
    return (<>{
        session.data ?
            <p>You are already logged in. Go to step 3.</p>
            :
            <div className="w-full flex flex-row items-center justify-center mt-4">
                <DefaultButton onClick={() => signIn("discord")}>Sign In</DefaultButton>
            </div>
    }</>)
}