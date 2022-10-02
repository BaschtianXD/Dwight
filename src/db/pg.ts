import { Pool, QueryResultRow } from "pg"

const pool = new Pool()

export function query<T extends QueryResultRow = any>(text: string, params: string[] = []) {
	return pool.query<T>(text, params)
}

export function getClient() {
	return pool.connect()
}

process.on("exit", code => {
	pool.end()
})