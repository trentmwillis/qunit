import { document } from "../globals";
import relayCallbackEvents from "./relay-callback-events";

class IFrameWorker {
	constructor( QUnit ) {

		this.iframe = document.createElement( "iframe" );
		this.iframe.src = document.location.href;

		this.iframe.width = 1000;
		this.iframe.height = 800;
		this.iframe.style.opacity = 0;

		document.body.appendChild( this.iframe );

		this.ready = new Promise( resolve => {
			this.iframe.onload = () => {
				const iframeQUnit = this.iframe.contentWindow.QUnit;
				const worker = iframeQUnit.startAsWorker();

				relayCallbackEvents( iframeQUnit );

				this.internalRunTest = worker.runTest;

				iframeQUnit.on( "runStart", () => {

					resolve( this );

				} );

			};
		} );

		// Setup QUnit callbacks/event handlers

	}


	runTest( testId ) {

		console.log( `Worker #${this.id} running test ${testId}` );
		return this.internalRunTest( testId );

	}
}

function iframeWorkerFactory() {
	const worker = new IFrameWorker();
	return worker.ready;
}

export default iframeWorkerFactory;
