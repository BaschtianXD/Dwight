import { ConnectionConfig, Request, TediousType } from "tedious"
import * as ConnectionPool from "tedious-connection-pool"

const poolConfig: ConnectionPool.PoolConfig = {
	min: 2,
	max: 4
};

const connectionConfig: ConnectionConfig = {
	server: process.env.HOST,
	authentication: {
		type: 'default',
		options: {
			userName: process.env.DBUSER, // update me
			password: process.env.DBPASSWORD // update me
		}
	},
	options: {
		database: process.env.DBDATABASE
	}
}

const pool = new ConnectionPool(poolConfig, connectionConfig);

/**
 * Wrappter function that allows to use tedious like pg
 * @param text SQL script to execute
 * @param params paramters to insert
 * @returns A promise
 */
export async function query<T>(text: string, params: requestParameter[] = []): Promise<QueryResult<T>> {

	return new Promise((resolve, reject) => {
		pool.acquire((err, connection) => {
			if (err) {
				return reject(err)
			}
			const request = new Request(text, (err, rowCount, rows) => {
				if (err) {
					return reject(err)
				}
				const result: QueryResult<T> = {
					rows: rows as T[],
					rowCount: rowCount
				}
				connection.release()
				resolve(result)
			})
			for (var i = 0; i < params.length; i++) {
				request.addParameter(String(i + 1), params[i].type, params[i].value)
			}
			connection.execSql(request)
		})
	})


}

/**
 * When a simple 
 * @returns A promise that resolves to a PooledConnection
 */
export async function getClient(): Promise<ConnectionPool.PooledConnection> {
	return new Promise((resolve, reject) => {
		pool.acquire((err, connection) => {
			if (err) {
				return reject(err)
			}
			return resolve(connection)
		})
	})
}

export type requestParameter = {
	value: any,
	type: TediousType
}

export type QueryResult<T> = {
	rowCount: number,
	rows: T[]
}

process.on("exit", code => {
	pool.drain()
})