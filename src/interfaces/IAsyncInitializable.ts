export default interface IAsyncInitializable {

	initialize(): Promise<void>
}