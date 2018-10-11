import QUnit from "../src/core";
import "./diff";
import "./html";

import iframeWorkerFactory from "../src/workers/iframe";
QUnit.registerWorkerFactory( iframeWorkerFactory );
