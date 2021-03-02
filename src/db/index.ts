import { Pool } from "pg"

const pool = new Pool()

export function query<T>(text: string, params: string[] = []) {
	return pool.query<T>(text, params)
}

export function getClient() {
	return pool.connect()
}

process.on("exit", code => {
	pool.end()
})