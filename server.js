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
;

const DBHOST  = "https://new.apex.digitalpracticespain.com";
const GET     = 'GET';
const POST    = 'POST';
const PUT     = 'PUT';
const DELETE  = 'DELETE';
const URI     = '/';

// Custom headers
const WEDOTARGET = 'wedo-target'
    , WEDONGROK  = 'wedo-ngrok-proxy'
;

log.stream = process.stdout;
log.timestamp = true;
log.level = 'verbose';

// Instantiate classes & servers
var app    = express()
  , router = express.Router()
/**
  , osaClient = restify.createJsonClient({
    url: OSAHOST,
    headers: {
      'Content-Type': 'application/json'
    }
  })
**/
  , server = http.createServer(app)
;

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

/**
  console.log(util.inspect(req.headers, true, null));
  console.log(util.inspect(req.url, true, null));
  console.log(util.inspect(req.method, true, null));
  console.log(util.inspect(req.body, true, null));
**/

  // Get our custom headers before removing them
  const TARGETURI = req.headers[WEDOTARGET];

  if (!TARGETURI) {
    res.status(400).send("wedo-target header not set");
    res.end();
    return;
  }

  log.info("", "Incoming request with verb: %s, target: %s, url: %s", req.method, TARGETURI, req.url);

  var customHeaders = {};
  customHeaders[WEDOTARGET] = null;
  customHeaders[WEDONGROK] = null;

  var headers = _.clone(req.headers);
  headers = _.omit(headers, _.keys(customHeaders));

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  var options = {
    headers: headers,
    data: req.body
  }

  client.registerMethod("CALL", TARGETURI + req.url, req.method);
  client.methods.CALL(options, function (data, response) {
    var responseHeader = response.header;
    res.status(response.statusCode).send(data);
    res.end();
  });

});

app.use(URI, router);

// REST stuff - END

server.listen(PORT, () => {
  log.info("","Listening for any request at http://localhost:%s%s/*", PORT, URI);
});
