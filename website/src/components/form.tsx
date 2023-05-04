import { Listbox } from "@headlessui/react"
import Link from "next/link"
import type { ChangeEventHandler, FC, MouseEventHandler, ReactNode } from "react";
import { useId } from "react"

type TextInputProps = {
    label?: string
    value?: string
    onChange?: ChangeEventHandler<HTMLInputElement>
    key?: string
    disabled?: boolean
}

export const TextInput: FC<TextInputProps> = (props) => {
    const id = useId()
    return (
        <div className="w-full flex flex-row items-center gap-2">
            <label className="font-semibold" htmlFor={id} >{props.label}</label>
            <input
                id={id}
                className="bg-transparent rounded-lg ring-1 ring-gray-500 focus-visible:ring-2 focus-visible:ring-offset-1 p-1 grow focus-visible:outline-none"
                type="text"
                onChange={props.onChange}
                value={props.value}
                key={props.key}
                disabled={props.disabled}
            />
        </div>

    )
}

type SelectInputProps = {
    label?: string
    value?: string
    buttonText?: string
    onChange?: ChangeEventHandler<HTMLSelectElement>
    options: { key: string, text: string }[]
    placeholder?: string
}

export const SelectInput: FC<SelectInputProps> = (props) => {

    const optionsTags = props.options.map(option => <option key={option.key}>{option.text}</option>)
    if (props.placeholder) {
        optionsTags.unshift(<option key="" disabled>{props.placeholder}</option>)
    }
    return (
        <div className="w-full flex flex-row items-center gap-2">
            <label className="font-semibold">{props.label}</label>
            <Listbox value>
                <Listbox.Button>{props.buttonText}</Listbox.Button>
                <Listbox.Options>
                    {props.placeholder && <Listbox.Option key="" value="" disabled>{props.placeholder}</Listbox.Option>}
                    {props.options.map(option => (
                        <Listbox.Option key={option.key} value={option.key}>{option.text}</Listbox.Option>
                    ))}
                </Listbox.Options>

            </Listbox>
        </div>
    )
}

type ButtonProps = {
    onClick?: MouseEventHandler<HTMLButtonElement>
    children?: ReactNode
    disabled?: boolean
}

export const DefaultButton: FC<ButtonProps> = (props) => {
    return (
        <button
            type="button"
            onClick={props.onClick}
            className="inline-flex items-center justify-center rounded-md bg-gray-500 bg-opacity-60 dark:bg-opacity-40 px-4 py-2 text-sm font-medium text-white hover:bg-opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
            disabled={props.disabled}
        >
            {props.children}
        </button>
    )
}

export const PositiveButton: FC<ButtonProps> = (props) => {
    return (
        <button
            type="button"
            onClick={props.onClick}
            className={`inline-flex justify-center rounded-md bg-green-500 bg-opacity-70 px-4 py-2 text-sm font-medium ${props.disabled ? "text-white/50" : "text-white"} ${!props.disabled && "hover:bg-opacity-30"} focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75`}
            disabled={props.disabled}
        >
            {props.children}
        </button>
    )
}

export const NegativeButton: FC<ButtonProps> = (props) => {
    return (
        <button
            type="button"
            onClick={props.onClick}
            className={`inline-flex justify-center rounded-md bg-red-500 bg-opacity-70 px-4 py-2 text-sm font-medium ${props.disabled ? "text-white/50" : "text-white"} ${!props.disabled && "hover:bg-opacity-30"} focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75`}
            disabled={props.disabled}
        >
            {props.children}
        </button>
    )
}

type LinkButtonProps = {
    label: string
    href: string
    newTab?: boolean
}

export const LinkButton: FC<LinkButtonProps> = (props) => {
    return (
        <Link target={props.newTab ? "_blank" : ""} href={props.href} className="inline-flex justify-center rounded-md bg-gray-500 bg-opacity-60 dark:bg-opacity-40 px-4 py-2 text-sm font-medium text-white hover:bg-opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75">
            {props.label}
        </Link>
    )
}

type LoadingIconProps = {
    className?: string
}

export const LoadingIcon: FC<LoadingIconProps> = (props) => {
    return (

        <svg aria-hidden="true" className={`text-gray-200 animate-spin dark:text-gray-600 fill-white ${props.className}`} viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
            <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
        </svg>
    )
}