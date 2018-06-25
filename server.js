'use strict';

// Module imports
var express = require('express')
  , http = require('http')
  , Client = require('node-rest-client').Client
  , bodyParser = require('body-parser')
  , util = require('util')
  , log = require('npmlog-ts')
  , _ = require('lodash')
  , cors = require('cors')
  , isJSON = require('is-valid-json')
  , uuidv4 = require('uuid/v4')
;

const DBHOST  = "https://apex.digitalpracticespain.com";
const URI     = '/';

// Custom headers
const WEDOTARGET          = 'wedo-target'
    , WEDONGROKPROXY      = 'wedo-ngrok-proxy'
    , WEDONGROKDEMOZONE   = 'wedo-ngrok-demozone'
    , WEDONGROKSERVER     = 'wedo-ngrok-server'
    , WEDONGROKCOMPONENT  = 'wedo-ngrok-component'
;

log.stream = process.stdout;
log.timestamp = true;
log.level = 'verbose';

// Instantiate classes & servers
var app    = express()
  , router = express.Router()
  , server = http.createServer(app)
;

// We do accept self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// ************************************************************************
// Main code STARTS HERE !!
// ************************************************************************

// Main handlers registration - BEGIN
// Main error handler
process.on('uncaughtException', function (err) {
  log.error("","Uncaught Exception: " + err);
  log.error("","Uncaught Exception: " + err.stack);
});
// Detect CTRL-C
process.on('SIGINT', function() {
  log.error("","Caught interrupt signal");
  log.error("","Exiting gracefully");
  process.exit(2);
});
// Main handlers registration - END

// REST engine initial setup
const PORT = process.env.PORT;

if (!PORT) {
  log.error("", "PORT environment variable not set. Aborting.");
  process.exit(-1);
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

// REST stuff - BEGIN
var client = new Client();
router.use(function(req, res, next) {

  // Valuable attributes:
  // req.headers
  // req.url
  // req.method
  // req.body

  // Get our custom headers before removing them
  const HEADERWEDOTARGET = req.headers[WEDOTARGET]
      , HEADERWEDONGROKPROXY = req.headers[WEDONGROKPROXY]
      , HEADERWEDONGROKDEMOZONE = req.headers[WEDONGROKDEMOZONE]
      , HEADERWEDONGROKSERVER = req.headers[WEDONGROKSERVER]
      , HEADERWEDONGROKCOMPONENT = req.headers[WEDONGROKCOMPONENT]
  ;

  var customHeaders = { host: null };
  customHeaders[WEDOTARGET]         = null;
  customHeaders[WEDONGROKPROXY]     = null;
  customHeaders[WEDONGROKDEMOZONE]  = null;
  customHeaders[WEDONGROKSERVER]    = null;
  customHeaders[WEDONGROKCOMPONENT] = null;

  var headers = _.clone(req.headers);
  // Remove custom headers before forwarding them to the target service
  headers = _.omit(headers, _.keys(customHeaders));

  var options = {
    headers: headers
  }

  if (req.body) {
      options.data = (isJSON(req.body)) ? JSON.stringify(req.body) : req.body;
  }

  if (HEADERWEDONGROKPROXY && HEADERWEDONGROKDEMOZONE && HEADERWEDONGROKSERVER && HEADERWEDONGROKCOMPONENT) {
    // All NGROK headers are present, we presume we first need to obtain the current/latest NGROK URL
    log.info("", "Incoming request with verb: %s, NGROK params (%s, %s, %s, %s), url: %s", req.method, HEADERWEDONGROKPROXY, HEADERWEDONGROKDEMOZONE, HEADERWEDONGROKSERVER, HEADERWEDONGROKCOMPONENT, req.url);
    var args = {
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      path: { "demozone": HEADERWEDONGROKDEMOZONE, "server": HEADERWEDONGROKSERVER, "component": HEADERWEDONGROKCOMPONENT }
    };
    client.get(HEADERWEDONGROKPROXY + '/${demozone}/${server}/${component}', args, (data, response) => {
      if (!isJSON(data) || !data.urlhttp) {
        var message = "No NGROK data found for: " + response.responseUrl;
        res.status(400).send(message);
        res.end();
        return;
      }
      log.info("", "Redirecting to NGROK URL: %s (last updated on %s)", data.urlhttp, data.lastupdate);
      log.verbose("", "Invoking [%s] final URL: %s", req.method, data.urlhttp + req.url);
      log.verbose("", "Options: %j", options);
      var uniqueMethod = uuidv4();  // Just in case we're serving concurrent requests
      client.registerMethod(uniqueMethod, data.urlhttp + req.url, req.method);
      client.methods[uniqueMethod](options, (_data, _response) => {
        var responseHeader = _response.header;
        res.status(_response.statusCode).send(_data);
        res.end();
        log.verbose("", "Request ended with a HTTP %d", _response.statusCode);
        client.unregisterMethod(uniqueMethod);
      });
    });
  } else {
    if (!HEADERWEDOTARGET) {
      var message = "Invalid request with no custom headers!. Ignoring.";
      log.error("", message);
      res.status(400).send(message);
      res.end();
      return;
    }
    log.info("", "Incoming request with verb: %s, target: %s, url: %s", req.method, HEADERWEDOTARGET, req.url);
    var uniqueMethod = uuidv4();  // Just in case we're serving concurrent requests
    client.registerMethod(uniqueMethod, HEADERWEDOTARGET + req.url, req.method);
    client.methods[uniqueMethod](options, (data, response) => {
      var responseHeader = response.header;
      res.status(response.statusCode).send(data);
      res.end();
      log.verbose("", "Request ended with a HTTP %d", response.statusCode);
      client.unregisterMethod(uniqueMethod);
    });
  }
});

app.use(URI, router);

// REST stuff - END

server.listen(PORT, () => {
  log.info("","Listening for any request at http://localhost:%s%s*", PORT, URI);
});
