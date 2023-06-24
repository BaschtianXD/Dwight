import type { Metadata } from 'next'
import { NextAuthProvide } from './NextAuthProvider'
import Header from './Header'
import { RubikFont } from "../common";
import "../styles/globals.css";

export const metadata: Metadata = {
    title: 'Dwight',
    description: 'Discord Sound Bot',
}

export default function RootLayout({
    // Layouts must accept a children prop.
    // This will be populated with nested layouts or pages
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={`${RubikFont.variable} font-sans flex flex-col h-screen w-screen bg-gradient-to-r from-rose-200 to-teal-200 dark:from-black dark:to-gray-700 dark:bg-gradient-to-bl dark:text-white bg-fixed overflow-hidden`}>
                <NextAuthProvide>
                    <div>
                        <Header />
                        {children}
                    </div>
                </NextAuthProvide>
            </body>
        </html>
    )
}