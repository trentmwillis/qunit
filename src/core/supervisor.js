import ProcessingQueue from "./processing-queue";
import defaultWorkerFactory from "../workers/default";

export default {
	workers: [],

	factory: defaultWorkerFactory,

	disable() {
		this.disabled = true;
	},

	start( numWorkers, QUnit ) {
		if ( this.disabled ) {
			return;
		}

		this.testQueue = QUnit.config.queue;
		for ( let i = 0; i < numWorkers; i++ ) {
			this.factory( QUnit ).then( worker => this.startWorker( worker ) );
		}
	},

	startWorker( worker ) {
		this.workers.push( worker );
		worker.id = this.workers.length;
		this.runNextTest( worker );
	},

	runNextTest( worker ) {
		const nextTestId = this.getNextTestId();
		if ( !nextTestId ) {
			ProcessingQueue.done();
			return;
		}
		worker.runTest( nextTestId ).then( () => this.runNextTest( worker ) );
	},

	currentTestId: null,

	getNextTestId() {
		let nextTest = this.testQueue[ 0 ];
		if ( nextTest && this.currentTestId === nextTest.id ) {
			this.testQueue.shift();
			nextTest = this.testQueue[ 0 ];
		}

		const nextTestId = nextTest && nextTest.id;

		this.currentTestId = nextTestId;

		return nextTestId;
	}
};
