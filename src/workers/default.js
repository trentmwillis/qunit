class DefaultWorker {
	constructor( QUnit ) {
		const worker = QUnit.startAsWorker();
		this.internalRunTest = worker.runTest;
	}

	runTest( testId ) {
		return this.internalRunTest( testId );
	}
}

function defaultWorkerFactory( ...args ) {
	const worker = new DefaultWorker( ...args );
	return Promise.resolve( worker );
}

export default defaultWorkerFactory;
