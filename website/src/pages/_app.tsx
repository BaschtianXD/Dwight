import { type AppType } from "next/app";
import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

import { Rubik } from "@next/font/google"

import { trpc } from "../utils/trpc";

import "../styles/globals.css";
import Header from "../components/header";

import { RubikFont } from "../common";

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <div className={`${RubikFont.variable} font-sans flex flex-col h-screen w-screen bg-gradient-to-r from-rose-200 to-teal-200 dark:from-black dark:to-gray-700 dark:bg-gradient-to-bl dark:text-white bg-fixed overflow-hidden`}>
        <Header />
        <div className="grow w-screen max-w-7xl mx-auto bg-white/40 dark:bg-black/20 overflow-y-auto">
          <Component {...pageProps} />
        </div>
      </div>

    </SessionProvider>
  );
};

export default trpc.withTRPC(MyApp);
