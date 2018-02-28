// server.js
// where your node app starts
process.chdir(__dirname);
const fs = require('fs');

// init service
const SERVICE_NAME = "QuickOrderEntryDispatcherProxy";

var ENVIRONMENT;

/*** initialize constants ***/

var WEBSERVER = 'localhost' // '10.3.149.31';

var SITES_UAT = [
  {name: 'Braskem', basepath: 'Braskem_Inbound', port: 8877},
  {name: 'FMS Inbound', basepath: 'FMS_Inbound', port: 8880},
  {name: 'FMS Outbound', basepath: 'FMS_Outbound', port: 8890},
  {name: 'FMS Outbound Extended', basepath: 'FMS_ExtOutbound', port: 8900},
  {name: 'Carpenter', basepath: 'Carpenter_Inbound', port: 8867},
  {name: 'HHT Stock Inventory', basepath: 'HHT_Stock_Inventory', port: 8799},
];

var SITES_PRD = [
  {name: 'Braskem', basepath: 'Braskem_Inbound', port: 8878},
  {name: 'FMS Inbound', basepath: 'FMS_Inbound', port: 8881},
  {name: 'FMS Outbound', basepath: 'FMS_Outbound', port: 8891},
  {name: 'FMS Outbound Extended', basepath: 'FMS_ExtOutbound', port: 8901},
  {name: 'Carpenter', basepath: 'Carpenter_Inbound', port: 8868},
  {name: 'HHT Stock Inventory', basepath: 'HHT_Stock_Inventory', port: 8800},
  {name: 'HHT Challenge', basepath: 'HHT_Challenge', port: 8801},
];

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

  // use referer to rewrite base url for reverse proxy - a bit hacky for my taste
  app.use(function(request, response, next) {
    // console.log(request.method + " " + request.url);
    if (request.headers.referer !== undefined) {
      let basepath = request.headers.referer.split('/')[3];
      if (basepath !== undefined && basepath !== '') {
        request.url = '/' + basepath + request.url;
      }
    }
    next();
  });

  app.set('view engine', 'pug');
  app.set('views', './views');

  // set up basic routing to index page
  app.get("/", function (request, response) {
    // response.sendFile(__dirname + '/views/index.html');
    response.render('index', {environment: ENVIRONMENT, webserver: WEBSERVER, sites: SITES});
  });

  // set up proxy server
  var httpProxy = require('http-proxy');
  var proxy = httpProxy.createProxyServer({prependPath: false, ws: false});

  // set up reverse proxy routes for all sites
  SITES.forEach((site) => {
    let route = '/' + site.basepath + '*';
    let targeturl = 'http://' + WEBSERVER + ':' + site.port;
    console.log("Setting up proxy to " + site.name + ' via ' + route + ' on ' + targeturl);

    app.all(route, function(req, res) {
      req.url = req.url.replace('/' + site.basepath, '');
      proxy.web(req, res, {target: targeturl});
    });
  });

  // set up proxy error handling
  proxy.on('error', function (err, req, res) {
    res.writeHead(500, {
      'Content-Type': 'text/plain'
    });

    res.end('Error occured on node.js proxy request. Please contact support.');
  });

  // JSON bodyparser
  app.use(bodyParser.urlencoded({
      extended: true
  }));
  app.use(bodyParser.json());

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
