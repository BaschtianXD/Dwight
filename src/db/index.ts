import { Pool } from "pg"

const pool = new Pool()

export function query(text: string, params: string[] = []) {
	return pool.query(text, params)
}

export function getClient() {
	return pool.connect()
}