import { window, setTimeout } from "./globals";

import equiv from "./equiv";
import dump from "./dump";
import Assert from "./assert";
import Test, { test, skip, only, todo, pushFailure } from "./test";
import exportQUnit from "./export";
import Logger from "./logger";

import config from "./core/config";
import { defined, extend, objectType, is, now, generateHash } from "./core/utilities";
import { registerLoggingCallbacks, runLoggingCallbacks } from "./core/logging";
import { sourceFromStacktrace } from "./core/stacktrace";
import ProcessingQueue from "./core/processing-queue";

import SuiteReport from "./reports/suite";

import { on, emit } from "./events";
import onError from "./core/onerror";
import onUnhandledRejection from "./core/on-unhandled-rejection";

let focused = false;
const QUnit = {};
export const globalSuite = new SuiteReport();

// The initial "currentModule" represents the global (or top-level) module that
// is not explicitly defined by the user, therefore we add the "globalSuite" to
// it since each module has a suiteReport associated with it.
config.currentModule.suiteReport = globalSuite;

const moduleStack = [];
let runStarted = false;

// Figure out if we're running the tests from a server or not
QUnit.isLocal = !( defined.document && window.location.protocol !== "file:" );

// Expose the current QUnit version
QUnit.version = "@VERSION";

function createModule( name, testEnvironment, modifiers ) {
	const parentModule = moduleStack.length ? moduleStack.slice( -1 )[ 0 ] : null;
	const moduleName = parentModule !== null ? [ parentModule.name, name ].join( " > " ) : name;
	const parentSuite = parentModule ? parentModule.suiteReport : globalSuite;

	const skip = parentModule !== null && parentModule.skip || modifiers.skip;
	const todo = parentModule !== null && parentModule.todo || modifiers.todo;

	const module = {
		name: moduleName,
		parentModule: parentModule,
		tests: [],
		moduleId: generateHash( moduleName ),
		testsRun: 0,
		unskippedTestsRun: 0,
		childModules: [],
		suiteReport: new SuiteReport( name, parentSuite ),

		// Pass along `skip` and `todo` properties from parent module, in case
		// there is one, to childs. And use own otherwise.
		// This property will be used to mark own tests and tests of child suites
		// as either `skipped` or `todo`.
		skip: skip,
		todo: skip ? false : todo
	};

	const env = {};
	if ( parentModule ) {
		parentModule.childModules.push( module );
		extend( env, parentModule.testEnvironment );
	}
	extend( env, testEnvironment );
	module.testEnvironment = env;

	config.modules.push( module );
	return module;
}

function processModule( name, options, executeNow, modifiers = {} ) {
	let module = createModule( name, options, modifiers );

	// Move any hooks to a 'hooks' object
	const testEnvironment = module.testEnvironment;
	const hooks = module.hooks = {};

	setHookFromEnvironment( hooks, testEnvironment, "before" );
	setHookFromEnvironment( hooks, testEnvironment, "beforeEach" );
	setHookFromEnvironment( hooks, testEnvironment, "afterEach" );
	setHookFromEnvironment( hooks, testEnvironment, "after" );

	function setHookFromEnvironment( hooks, environment, name ) {
		const potentialHook = environment[ name ];
		hooks[ name ] = typeof potentialHook === "function" ? [ potentialHook ] : [];
		delete environment[ name ];
	}

	const moduleFns = {
		before: setHookFunction( module, "before" ),
		beforeEach: setHookFunction( module, "beforeEach" ),
		afterEach: setHookFunction( module, "afterEach" ),
		after: setHookFunction( module, "after" )
	};

	const currentModule = config.currentModule;
	if ( objectType( executeNow ) === "function" ) {
		moduleStack.push( module );
		config.currentModule = module;
		executeNow.call( module.testEnvironment, moduleFns );
		moduleStack.pop();
		module = module.parentModule || currentModule;
	}

	config.currentModule = module;
}

// TODO: extract this to a new file alongside its related functions
function module( name, options, executeNow ) {
	if ( focused ) {
		return;
	}

	if ( arguments.length === 2 ) {
		if ( objectType( options ) === "function" ) {
			executeNow = options;
			options = undefined;
		}
	}

	processModule( name, options, executeNow );
}

module.only = function() {
	if ( focused ) {
		return;
	}

	config.modules.length = 0;
	config.queue.length = 0;

	module( ...arguments );

	focused = true;
};

module.skip = function( name, options, executeNow ) {
	if ( focused ) {
		return;
	}

	if ( arguments.length === 2 ) {
		if ( objectType( options ) === "function" ) {
			executeNow = options;
			options = undefined;
		}
	}

	processModule( name, options, executeNow, { skip: true } );
};

module.todo = function( name, options, executeNow ) {
	if ( focused ) {
		return;
	}

	if ( arguments.length === 2 ) {
		if ( objectType( options ) === "function" ) {
			executeNow = options;
			options = undefined;
		}
	}

	processModule( name, options, executeNow, { todo: true } );
};

extend( QUnit, {
	on,

	module,

	test: test,

	todo: todo,

	skip: skip,

	only: only,

	start() {
		if ( config.current ) {
			throw new Error( "QUnit.start() cannot be called inside a test" );
		} else if ( runStarted ) {
			throw new Error( "Called QUnit.start() after test already started running" );
		}

		// Initialize the configuration options
		extend( config, {
			stats: { all: 0, bad: 0 },
			started: 0,
			updateRate: 1000,
			autostart: true,
			filter: ""
		}, true );

		config.blocking = false;

		scheduleBegin();
	},

	config: config,

	is: is,

	objectType: objectType,

	extend: extend,

	load() {
		Logger.warn( "QUnit.load() is deprecated and will be removed in QUnit 3.0. " +
			"Please use QUnit.start() instead." );

		QUnit.start();
	},

	stack: function( offset ) {
		offset = ( offset || 0 ) + 2;
		return sourceFromStacktrace( offset );
	},

	onError,

	onUnhandledRejection
} );

QUnit.pushFailure = pushFailure;
QUnit.assert = Assert.prototype;
QUnit.equiv = equiv;
QUnit.dump = dump;

registerLoggingCallbacks( QUnit );

function scheduleBegin() {

	runStarted = true;

	// Add a slight delay to allow definition of more modules and tests.
	if ( defined.setTimeout ) {
		setTimeout( function() {
			begin();
		} );
	} else {
		begin();
	}
}

export function begin() {
	var i, l,
		modulesLog = [];

	// If the test run hasn't officially begun yet
	if ( !config.started ) {

		// Record the time of the test run's beginning
		config.started = now();

		// Delete the loose unnamed module if unused.
		if ( config.modules[ 0 ].name === "" && config.modules[ 0 ].tests.length === 0 ) {
			config.modules.shift();
		}

		// Avoid unnecessary information by not logging modules' test environments
		for ( i = 0, l = config.modules.length; i < l; i++ ) {
			modulesLog.push( {
				name: config.modules[ i ].name,
				tests: config.modules[ i ].tests
			} );
		}

		// The test run is officially beginning now
		emit( "runStart", globalSuite.start( true ) );
		runLoggingCallbacks( "begin", {
			totalTests: Test.count,
			modules: modulesLog
		} );
	}

	config.blocking = false;
	ProcessingQueue.advance();
}

function setHookFunction( module, hookName ) {
	return function setHook( callback ) {
		module.hooks[ hookName ].push( callback );
	};
}

exportQUnit( QUnit );

export default QUnit;
