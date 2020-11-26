import { Pool } from "pg"
import createSubscriber from "pg-listen"

const pool = new Pool()
const subscriber = createSubscriber()

export function query<T>(text: string, params: string[] = []) {
	return pool.query<T>(text, params)
}

export function getClient() {
	return pool.connect()
}

export function getDbSubscriber() {
	return subscriber
}

process.on("exit", code => {
	pool.end()
})