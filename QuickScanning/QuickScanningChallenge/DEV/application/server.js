// server.js
// where your node app starts
process.chdir(__dirname);
const fs = require('fs');
const path = require('path');

var SERVICE_NAME = "QuickScanningChallenge";

var main = function() {
  // init project
  const DB_USER = "quickstock";
  const DB_PASS = "quickstock";

  var PORT = 8801;
  var SQL_LOGGING = false; // true;

  var express = require('express');
  var Sequelize = require('sequelize');
  var http = require("https");
  var qs = require('querystring');

  let app = express();

  var Stock; // to save submitted entries

  app.set("view engine", "pug");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/", function (request, response) {
    response.sendFile(__dirname + '/views/index.html');
  });

  app.get("/stock", function (request, response) {
    var dbStocks=[];
    Stock.findAll({order: [['id', 'DESC']]}).then(function(stocks) { // find all entries in the barcodes tables
      stocks.forEach(function(stock) {
        dbStocks.push([stock.id,stock.direction, stock.orderno, stock.vehicleno, stock.location, stock.inventorynumber,stock.remark,stock.createdAt]); // adds their info to the dbBarcodes value
      });
      response.send(dbStocks); // sends dbStocks back to the page
    });
  });

  // creates a new entry in the users table with the submitted values
  app.post("/stock", function (request, response) {
    console.log(request.query);
    // var extra = new Date().toISOString();
    Stock.count({ where: {inventorynumber: request.query.fInventorynumber }}).then(function(c) {
      if (c > 0 && request.query.fInventorynumber !== '') {
        console.log("There are " + c + " inventorynumbers with this value.");
        response.statusCode = 419;
        response.end("Inventorynumber already scanned");
      } else {
        Stock.create({direction: request.query.fDirection, orderno: request.query.fOrderNo, vehicleno: request.query.fVehicleNo,
                      location: request.query.fLocation, inventorynumber: request.query.fInventorynumber,
                      remark: request.query.fRemark})
          .then(function(stock) {
            response.statusCode = 200;
            response.end(JSON.stringify(stock));
        });
      }
    })
  });

  app.get("/inventory", function(request, response) {
    console.log(request.query.fInventorynumber);
    console.log('getting inventory');

    var today = new Date();

    var opdate = today.getFullYear() + '-' +
      (today.getMonth()<10 ? '0' : '') + (today.getMonth() + 1) + '-' +
      (today.getDate()<10 ? '0' : '') + today.getDate();

    console.log(opdate);

    console.log( qs.stringify({InternalCompanyId:299, OperationalDate:opdate, InventoryNumber:request.query.fInventorynumber}))

    var options = {
      host: 'itos-api.vanmoergroup.com',
      method: 'GET',
      path: '/api/InventoryStock?' + qs.stringify({InternalCompanyId:299, OperationalDate:opdate, InventoryNumber: request.query.fInventorynumber}),
      headers: {
        'Authorization': "Basic S1ZMRUVNUFVUOjNOQXc2Q3c3",
        "content-type": "application/json",
        "cache-control": "no-cache",
        "postman-token": "1d3eb3c5-cec0-9dc6-4c8b-6622e7de8ff6"
      }
    };

    var itosreq = http.request(options, function (itosres) {
      console.log("doing itosreq");
      var chunks = [];

      itosres.on("data", function (chunk) {
        chunks.push(chunk);
      });

      itosres.on("end", function () {
        var body = Buffer.concat(chunks);
        console.log(body.toString());
        response.statusCode = 200;
        response.end(body.toString());
      });

      itosres.on("error", function (e) {
        var body = Buffer.concat(chunks);
        console.log(chunks);
        console.error(e);
      });
    });

    itosreq.on('error', function(e) {
      console.log('caught error');
      console.error(e);
    });

    //  itosreq.write(itosreqdata);
    itosreq.end();

      /* $.ajax({
        "method": "GET",

        "headers": {
          "authorization": "Basic S1ZMRUVNUFVUOjNOQXc2Q3c3",
          "content-type": "application/json",
          "cache-control": "no-cache",
          "postman-token": "1d3eb3c5-cec0-9dc6-4c8b-6622e7de8ff6"
        }
      }).done(function(response) {
        console.log(response);
      }); */

  })

  app.post("/query", function(request, response) {
     /* sequelize.query("DELETE FROM stocks where id > 0").spread(function(results, metadata) {
      console.log(results);
      console.log(metadata);
      response.statusCode = 200;
      response.end("Query performed");
    }); */
  })

  app.post("/clear", function(request, response) {
     sequelize.query("DELETE FROM stocks where id > 0").spread((results, metadata) => {
      console.log(results);
      console.log(metadata);
       sequelize.query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='stocks'").spread((results, metadata) => {
        console.log(results);
        console.log(metadata);
        response.statusCode = 200;
        response.end("Table cleared!");
      });
    });
  })

  // setup database
  var sequelize = new Sequelize('quickstockscanningdb', DB_USER, DB_PASS, {
    host: '0.0.0.0',
    dialect: 'sqlite',
    logging: SQL_LOGGING,
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    },
    storage: 'data/database.sqlite'
  });

  // authenticate with the database
  sequelize.authenticate()
    .then(function(err) {
      console.log('Connection has been established successfully.');
      // define a new table 'stock'
      Stock = sequelize.define('stock', {
        direction: {
          type: Sequelize.STRING
        },
        orderno: {
          type: Sequelize.STRING
        },
        vehicleno: {
          type: Sequelize.STRING
        },
        location: {
          type: Sequelize.STRING
        },
        inventorynumber: {
          type: Sequelize.STRING
        },
        remark: {
          type: Sequelize.STRING
        }
      });

      setup();
    })
    .catch(function (err) {
      console.log('Unable to connect to the database: ', err);
    });

  // populate table with default users
  function setup(){
    Stock.sync({}) // {force: true} // using 'force' it drops the table barcodes if it already exists, and creates a new one
      .then(function(){
        console.log('synced');
      });
  }

  // listen for requests :)
  var listener = app.listen(PORT, function () {
    console.log('Your app is listening on port ' + listener.address().port);
  });
}

// local or Windows service
// -- execute npm install –msvs_version=2015 os-service for Windows
var printUsage = function() {
  console.log("Use (--run-process|--add-win-service|--remove-win-service|--run-win-service)");
}

if (process.argv[2] === undefined) {
  printUsage();
  process.exit();
}

if (process.argv[2] == "--run-process") {
  console.log("Running as process");
  main();
} else if (process.platform === 'win32') {
  // windows service
  var service = require ("os-service");
  var serviceName = SERVICE_NAME;

  if (process.argv[2] == "--add-win-service") {
    console.log("Adding Windows service " + serviceName);
    service.add (serviceName, {programArgs: ["--run-win-service"]}, function(error){
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
