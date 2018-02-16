// server.js
// where your node app starts
process.chdir(__dirname);
const fs = require('fs');

// init service
const SERVICE_NAME = "QuickOrderEntryLoadingFMS";

var ENVIRONMENT;

/*** initialize constants ***/
const PL_NUMBER_OF_COLS = 2;
const COL_PRODUCT = 0;
const COL_ITEM_NR = 1;

var main = function() {
  // init project
  const DB_USER = "FMS";
  const DB_PASS = "FMS";

  var PORT;
  var HOSTNAME;
  var DOMAIN;
  var SQL_LOGGING; // true;

  if (ENVIRONMENT === "UAT") {
    console.log("==== Running on UAT ===");
    PORT = 8890;
    HOSTNAME = "itos-api-uat.vanmoer.com";
    DOMAIN = "itos-uat.vanmoergroup.com";
    SQL_LOGGING = console.log; // false
  } else if (ENVIRONMENT === "PRD") {
    console.log("******** Running on PRD ********");
    PORT = 8891;
    HOSTNAME = "itos-api.vanmoergroup.com";
    DOMAIN = "itos.vanmoergroup.com";
    SQL_LOGGING = false; // console.log;
  }

  var express = require('express');
  var async = require('async');
  var bodyParser = require('body-parser');
  var unirest = require("unirest");
  var Sequelize = require('sequelize');

  var app = express();

  var Entry; // to save submitted entries

  // we've started you off with Express,
  // but feel free to use whatever libs or frameworks you'd like through `package.json`.

  // http://expressjs.com/en/starter/static-files.html
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
    response.render('index', {environment: ENVIRONMENT});
  });

  // submit requests to iTOS
  app.post("/data", function(req,response) {
    // console.log("data post");
    // console.log(req.body.data);

    var data = JSON.parse(req.body.data);

    // clean empty rows from table
    data.table = data.table.filter(function(item, index, array){
      if (item[0] !== null && item[0] !== "")
      return item;
    });

    // console.log("====== prepared data ======");
    // console.log(data);

    // Create TR and OI
    calliTOSAPI(data, (err, result) => {
      // console.log('======== iTOS API called =========');
      if (err) {
        console.log('******* ERROR ********');
        console.error(err.stack);
        console.log('******* END ERROR ********');
      }
      // console.log(JSON.stringify(result));
      var res = parseResult(result);
      console.log("======= result ======");
      console.log(res);
      response.end(JSON.stringify(res));
    });
  })

  var parseResult = function (result) {
    console.log("====== parsing results =====");
    // console.log(Array.isArray(result));
    // console.log("length = "+result.length);
    var summary = [];
    // console.log(result);
    result.forEach(function(item) {
      // console.log("==== item ====");
      // console.log(item);
      if (item["TransportTypeCode"]) {
        summary.push('Transport <a target=\"_blank\" href=\"https://' + DOMAIN + '/Stevedoring/Transport/Detail?Id=' + item.Id + '\">' + item.Reference + "</a> created.");
      } else if (item["LoadingOrderItems"]) {
        summary.push('OrderItem <a target=\"_blank\" href=\"https://' + DOMAIN + '/Stevedoring/Order/Detail?Id=' + item.Id + '\">' + item.LoadingOrderItems[0].ExternalId + "</a> created.");
      } else if (item["TransportReference"]) {
        summary.push("Linked Transport " + item.TransportReference + ".");
        // summary.push('Linked Transport <a target=\"_blank\" href=\"https://' + DOMAIN + '/Stevedoring/Transport/Detail?Id=' + item.TransportReference + '\">' + item.TransportReference + "</a>.");
      } else if (item["transportNotFound"]) {
        summary.push('Transport could not be found.');
      } else if (item["alreadyLinked"]) {
        summary.push('<font color="red">ATTENTION: </font>OrderItem <a target=\"_blank\" href=\"https://' + DOMAIN +  '/Stevedoring/OrderItem/Loading?Id=' + item.orderItemId + '\">' + item.orderItemId + '</a> already linked to Transport and could not be relinked. Please check manually if necessary.');
      } else {
        summary.push('<font color="red">ERROR RESPONSE: </font>' + JSON.stringify(item).substr(0,256) + "\n");
      };
    });
    return summary;
  }

  // callback (err, result)
  var calliTOSAPI = function(data, callback) {
    async.series(
      {
        orderitem: (cb) => { createOrderItemJSON(data, cb) },
        // transport: (cb) => { createTransportJSON(data, cb) },  => should already exist
        link: (cb) => { createLinkJSON(data, cb) },
      }, (err, jsonData) => sendRequests(err, jsonData, callback, data.socketid));
  }

  var sendRequests = function (err, jsonData, callback, clientid) {
    // console.log("====== sending requests");
    // console.log(jsonData);
    async.series(
      [
        (cb) => { sendOrderItemRequest(jsonData.orderitem, cb, clientid) },
        // (cb) => { sendTransportRequest(jsonData.transport, cb, clientid) },
        (cb) => { sendLinkRequest(jsonData.link, cb, clientid) },
      ], callback
    );
  }

  // callback(err, result)
  var sendTransportRequest = function(transportJSON, callback, clientid) {
    sendITOSRequest(HOSTNAME, "/api/ImportTransports", transportJSON, callback, clientid);
  }

  // callback(err, result)
  var sendOrderItemRequest = function(orderItemJSON, callback, clientid) {
    sendITOSRequest(HOSTNAME, "/api/OrderImport", orderItemJSON, callback, clientid);
  }

  // callback(err, result)
  var sendLinkRequest = function(transportLinkJSON, callback, clientid) {
    sendITOSRequest(HOSTNAME, "/api/TransportLink", transportLinkJSON, callback, clientid);
  }

  var createOrderItemJSON = function(data, callback) {
      console.log("===== Creating OI JSON ========");
      // console.log(data);

      // find goods for order item
      var goods = [];
      var current_date = new Date().toISOString().slice(0,10);

      data.table.forEach(function(value){
        var unitcode;

        if (value[COL_PRODUCT] === 'FMSROL') {
          unitcode = 'ROLL';
        } else if (value[COL_PRODUCT] === 'FMSPAL') {
          unitcode = 'PAL';
        } else {
          unitcode = 'ERROR';
        }

        goods.push(
          {
            Status: 'Available',
            ProductCode: value[COL_PRODUCT],
            ItemNumber: value[COL_ITEM_NR],
            BaseQuantity: { UnitCode: unitcode, Quantity: 1, MeasurementUnitCode: "", Recalculate: null },
            StorageQuantity: { UnitCode: "PCS", Quantity: 1, Recalculate: true },
            ExtraQuantities: [
              {
                UnitCode: "Net",
                Quantity: 1,
                MeasurementUnitCode: "KG",
                Recalculate: null
              },
              {
                UnitCode: "Gross",
                Quantity: 1,
                MeasurementUnitCode: "KG",
                Recalculate: null
              }
            ],
            Sids: [],
            OwnerCode: data.custcode,
          }
        );
      });

      var oiref = createOIExternalId(data);

      var itosreqdata = JSON.stringify({
        Date: current_date,
        InternalCompanyCode: 'IC_VMHZP',
        CustomerCode: data.custcode,
        ExternalId: data.extid,
        CostCentre: data.costcenter,
        LoadingOrderItems: [
          {  ExternalId: createOIExternalId(data),
             UseStockSelectionForThisOI: true,
             OperationCode: data.opcode,
             Priority: 'Normal',
             Status: 'Approved',
             PlannedDate: current_date,
             ReferenceValues: [],
             Goods: goods
          }
        ]
      });

      callback(null, itosreqdata);
  }

  var createOIExternalId = function(data) {
    var oi_extid = data.extid + '-' + data.tptreference;
    return oi_extid;
  }

  var createLinkJSON = function(data, callback) {
    console.log("===== Creating Linking JSON ========");
    // console.log(data);

    var linkingReq = JSON.stringify({
      TransportReference: data.tptreference,
      OrderItemExternalIds: [ createOIExternalId(data) ]
    });

    callback(null, linkingReq);
  }

  // callback(err, result)
  var sendITOSRequest = function(hostname, path, itosreqdata, callback, clientid) {
    var url = "https://" + hostname + path;
    console.log("===== Sending iTOS " + url + " Request ============");
    console.log(itosreqdata);

    if (clientid !== undefined) {
      notifyClient(clientid, "Sending iTOS " + url + " Request.");
    }

    var req = unirest("POST", url);

    req.headers({
      // "postman-token": "2aeab68e-429d-fc60-3941-ee1a5da43f61",
      "cache-control": "no-cache",
      "authorization": "Basic UU9FX0lOVDoxMjM0NTY=",
      "content-type": "application/json"
    });

    req.type("json");
    req.send(itosreqdata);

    req.end(function (res) {
      console.log("===== iTOS Response ============");
      // ignore error where Transport is already linked - for updates !
      // ignore error where Transport does not exist!
      // console.log("===== res ============");
      // console.log(res);
      if (res.error && res.body && !res.clientError && !res.body.ErrorMessage && res.body.indexOf("because already have transport.") !== -1) {
        console.log(res.body);
        let re = /Order Item (\d+)/;
        let orderItemId = res.body.match(re)[1];
        res.body = {alreadyLinked: true, orderItemId: orderItemId};
        callback(null, res.body);
      } else if (res.error && res.body && !res.clientError && res.serverError && res.body.ErrorMessage && res.body.ErrorMessage.indexOf("can not be found.") !== -1) {
        console.log(res.body);
        res.body = {transportNotFound: true};
        callback(null, res.body);
      } else {
        if (res.body && !res.clientError && !res.serverError) {
          console.log(res.body);
          callback(null, res.body);
        } else if (res.body && (res.clientError || res.serverError)) {
          console.log("res.clientError: " + res.clientError);
          console.log("res.serverError: " + res.serverError);
          console.log(res.error);
          console.log(res.body);
          callback(res.error, res.body);
        } else if (res.statusMessage){
          console.log(res.statusCode);
          console.log(res.statusMessage);
          callback(res.error, res.statusMessage);
        } else if (res.body) {
          console.log(res.body);
          callback(null, res.body);
        } else {
          console.log(res.error);
          callback(res.error, res.error);
        }
      }
    });
  }

  // get latest entry for this order external id
  app.get("/entries/:custcode/:extid/:planneddate/:tptreference", function (request, response) {
    console.log("#####  getting entry ####### ");

    var d = request.params;
    d.socketid = request.query.id;

    Entry.count({
      where: {
        custcode: d.custcode,
        extid: d.extid,
        planneddate: d.planneddate,
        tptreference: d.tptreference,
      }}).then(count => {
        Entry.findOne({
          where: {
            custcode: d.custcode,
            extid: d.extid,
            planneddate: d.planneddate,
            tptreference: d.tptreference,
            requestno: count
          }}).then(entry => {
            response.end(JSON.stringify([entry]));
        });
      });
  });

  // save new entry
  app.post("/entries", function(req,response) {
    console.log("##### saving entry ###### ");

    var d = JSON.parse(req.body.data);

    // clean empty rows from table
    d.table = d.table.filter(function(item, index, array){
      if (item[0] !== null && item[0] !== "")
      return item;
    });

    Entry.count({
      where: {
        custcode: d.custcode,
        extid: d.extid,
        planneddate: d.planneddate,
        tptreference: d.tptreference
      }}).then(count => {
      Entry.create({
        custcode: d.custcode,
        extid: d.extid,
        requestno: count + 1,
        costcenter: d.costcenter,
        opcode: d.opcode,
        planneddate: d.planneddate,
        tptreference: d.tptreference,
        tabledata: JSON.stringify(d.table)
        }).then(function(entry) {
          response.statusCode = 200;
          response.end(JSON.stringify([entry]));
        });
    });
  });

  //
  app.get("/stockinfo/:itemno", function(request, response) {
    console.log("#####  getting stockinfo ####### ");

    // TODO Get Inventory Numbers from Stock api
    // https://itos-api-uat.vanmoergroup.com/api/InventoryStock?InternalCompanyId=299&OperationalDate=2017-12-06&ItemNumber=S162922-879

    let req = unirest("GET", "https://" + HOSTNAME + "/api/InventoryStock");
    let current_date = new Date().toISOString().slice(0,10);

    req.query({
      "InternalCompanyId": "299",
      "OwnerIds": "559",
      "OperationalDate": current_date,
      "ItemNumber": request.params.itemno
    });

    req.headers({
      "Cache-Control": "no-cache",
      "Authorization": "Basic UU9FX0lOVDoxMjM0NTY="
    });

    console.log(req.options.url);

    req.end(function (res) {
      // console.log(res);
      response.statusCode = 200;
      response.end(JSON.stringify(res.body));
    });
  });

  // setup a new database
  // using database credentials set in .env
  var sequelize = new Sequelize('FMS_quick_order_entry', DB_USER, DB_PASS, {
    host: '0.0.0.0',
    dialect: 'sqlite',
    logging: SQL_LOGGING,
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    },
    // Security note: the database is saved to the file `*.sqlite` on the local filesystem.
    storage: 'data/FMS_quick_order_entry_' + ENVIRONMENT + '.sqlite'
  });

  // authenticate with the database
  sequelize.authenticate()
    .then(function(err) {
      console.log('========= DB connection has been established successfully. ==========');
      // define a new table 'entries'
      Entry = sequelize.define('entries', {
        custcode: {type: Sequelize.STRING},
        extid: {type: Sequelize.STRING},
        requestno: {type: Sequelize.INTEGER},
        costcenter: {type: Sequelize.STRING},
        opcode: {type: Sequelize.STRING},
        tptreference: {type: Sequelize.STRING},
        planneddate: {type: Sequelize.STRING},
        tabledata: {type: Sequelize.STRING}
      });

      dbSetup();
    })
    .catch(function (err) {
      console.log('Unable to connect to the database: ', err);
    });

  function dbSetup(){
    sequelize.sync() // {force: true}) // using 'force' drops the table if it already exists, and creates a new one
      .then(function(){
        console.log('======= db synced =======');
      });
  }

  Array.prototype.getColumn = function(n) {
    r=[];
    for(var i = 0; i < this.length; i++)
  	{
  		r.push(this[i][n]);
  	}
  	return r;
  }

  Array.prototype.unique = function() {
  	var n = {},r=[];
  	for(var i = 0; i < this.length; i++)
  	{
  		if (!n[this[i]])
  		{
  			n[this[i]] = true;
  			r.push(this[i]);
  		}
  	}
  	return r;
  }

  // listen for requests :)
  var listener = app.listen(PORT, function () {
    console.log('Your app is listening on port ' + listener.address().port);
  });

  // Set up Socket.io communication
  var io = require('socket.io')(listener);

  io.on('connection', function (client) {
    console.log("Client connected: " + client.id);
    client.on('message', function (data) {
      console.log("Received message from " + client.id + ": " + data);
      client.emit('update', "Got message " + data);
    });
  });

  var notifyClient = function(id, message) {
    console.log("Notifying Client: " + id);
    io.of("/").to(id).emit('update', message);
  }
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
