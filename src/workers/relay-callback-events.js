import { runLoggingCallbacks } from "../core/logging";
import { emit } from "../events";


export default function relayCallbackEvents( otherQUnit ) {

	otherQUnit.moduleStart( ( ...args ) => runLoggingCallbacks( "moduleStart", ...args ) );
	otherQUnit.testStart( ( ...args ) => runLoggingCallbacks( "testStart", ...args ) );
	otherQUnit.log( ( ...args ) => runLoggingCallbacks( "log", ...args ) );
	otherQUnit.testDone( ( ...args ) => runLoggingCallbacks( "testDone", ...args ) );
	otherQUnit.moduleDone( ( ...args ) => runLoggingCallbacks( "moduleStart", ...args ) );

}
