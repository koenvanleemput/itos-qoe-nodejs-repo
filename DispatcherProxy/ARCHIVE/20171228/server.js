// server.js
// where your node app starts
process.chdir(__dirname);
const fs = require('fs');

// init service
const SERVICE_NAME = "QuickOrderEntryDispatcher";

var ENVIRONMENT;

/*** initialize constants ***/

var WEBSERVER = '10.3.149.31'

var SITES_UAT = {
  'Braskem': 8877,
  'FMS Inbound': 8880,
  'FMS Outbound': 8890,
  'Carpenter': 8867,
}

var SITES_PRD = {
  'Braskem': 8878,
  'FMS Inbound': 8881,
  'FMS Outbound': 8891,
  'Carpenter': 8868,
  'HHT Stock Inventory': 8800,
  'HHT Challenge': 8801,
}

var main = function() {
  // init project
  var PORT;
  var HOSTNAME;
  var DOMAIN;
  var SITES;

  if (ENVIRONMENT === "UAT") {
    console.log("==== Running on UAT ===");
    PORT = 8887;
    HOSTNAME = "itos-api-uat.vanmoer.com";
    DOMAIN = "itos-uat.vanmoer.com";
    SITES = SITES_UAT;
  } else if (ENVIRONMENT === "PRD") {
    console.log("******** Running on PRD ********");
    PORT = 8888;
    HOSTNAME = "itos-api.vanmoer.com";
    DOMAIN = "itos.vanmoer.com";
    SITES = SITES_PRD;
  }

  var express = require('express');
  var bodyParser = require('body-parser');

  var app = express();

  app.use(express.static('public'));
  app.use(bodyParser.urlencoded({
      extended: true
  }));
  app.use(bodyParser.json());
  app.set('view engine', 'pug');
  app.set('views', './views');

  // http://expressjs.com/en/starter/basic-routing.html
  app.get("/", function (request, response) {
    // response.sendFile(__dirname + '/views/index.html');
    response.render('index', {environment: ENVIRONMENT, webserver: WEBSERVER, sites: SITES});
  });

  // listen for requests :)
  var listener = app.listen(PORT, function () {
    console.log('Your app is listening on port ' + listener.address().port);
  });

}

// local or Windows service
// -- execute npm install –msvs_version=2015 os-service for Windows
var printUsage = function() {
  console.log("Use (--run-process|--add-win-service|--remove-win-service|--run-win-service) --environment=<UAT|PRD>");
}

if (process.argv[2] === undefined || process.argv[3] === undefined) {
  printUsage();
  process.exit();
} else {
  ENVIRONMENT = process.argv[3].slice(-3);
}

if (process.argv[2] == "--run-process") {
  console.log("Running as process");
  main();
} else if (process.platform === 'win32') {
  // windows service
  var service = require ("os-service");
  var serviceName = SERVICE_NAME + "-" + ENVIRONMENT;

  if (process.argv[2] == "--add-win-service") {
    console.log("Adding Windows service " + serviceName);
    service.add (serviceName, {programArgs: ["--run-win-service", "--environment=" + ENVIRONMENT]}, function(error){
       if (error)
          console.trace(error);
    });
  } else if (process.argv[2] == "--remove-win-service") {
    console.log("Removing Windows service " + serviceName);
    service.remove (serviceName, function(error){
       if (error)
          console.trace(error);
    });
  } else if (process.argv[2] == "--run-win-service") {
    // redirect stdout / stderr to file
    var logStream = fs.createWriteStream (serviceName + ".log");
    process.stdout.write = process.stderr.write = logStream.write.bind(logStream);

    process.on('uncaughtException', function(err) {
      console.error((err && err.stack) ? err.stack : err);
    });

    console.log("Starting Windows service " + serviceName);
    service.run (logStream, function () {
        service.stop (0);
    });

    main();
  };
}
