// server.js
// where your node app starts
process.chdir(__dirname);
const fs = require('fs');

// init service
const SERVICE_NAME = "QuickOrderEntryCarpenter";

var ENVIRONMENT;

var main = function() {
  // init project
  const DB_USER = "carpenter";
  const DB_PASS = "carpenter";

  // data table columns
  const NUMBER_OF_COLS = 8;
  const COL_LOT = 0;            // Reference => LOT in iTOS
  const COL_ITEM = 1;           // Item
  const COL_TAGNBR = 2;         // Tag numbes => item no. in iTOS
  const COL_WEIGHT = 3;         // Weight (KG)
  const COL_REF = 4;            // File Nbr => SP "Reference"
  const COL_CLIENT = 5;         // Client => not transferred in iTOS (custcode)
  const COL_ENDCLIENT = 6;      // End Client
  const COL_INSTRUCTIONS = 7;   // Instructions

  var PORT;
  var HOSTNAME;
  var DOMAIN;
  var SQL_LOGGING; // true;

  if (ENVIRONMENT === "UAT") {
    console.log("==== Running on UAT ===");
    PORT = 8867;
    HOSTNAME = "itos-api-uat.vanmoer.com";
    DOMAIN = "itos-uat.vanmoer.com";
    SQL_LOGGING = console.log; // true;
  } else if (ENVIRONMENT === "PRD") {
    console.log("******** Running on PRD ********");
    PORT = 8868;
    HOSTNAME = "itos-api.vanmoergroup.com";
    DOMAIN = "itos.vanmoergroup.com";
    SQL_LOGGING = false; // true;
  }

  var express = require('express');
  var async = require('async');
  var bodyParser = require('body-parser');
  var unirest = require("unirest");
  var Sequelize = require('sequelize');

  var app = express();

  var Entry; // to save submitted entries

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
    response.render('index', {title: "hey", environment: ENVIRONMENT});
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

    /*
    // find unique containers
    console.log("==== unique containers === ");
    data.containers = data.table.getColumn(COL_CONT).unique();
    console.log(data.containers);

    // split table per container
    data.containerTables = {};
    data.containers.forEach(function(container){
      // console.log("======= filtering container: " + container + " =========");
      data.containerTables[container] = data.table.filter(function(item, index, array){
        // TOOD CONTAINER TABLES
        if (item[COL_CONT] === container)
        return item;
      });
    });
    */

    // console.log("====== prepared data ======");
    // console.log(data);

    // Create TR and OI and link them
    calliTOSAPI(data, (err, result) => {
      // console.log('======== iTOS API called =========');
      // console.log("======= unparsed result ======");
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
    // console.log("==== result ====");
    // console.log(result);
    var summary = [];
    result.forEach(function(item){
      if (item.error) {
        console.log('******* ERROR ********');
        console.error(item.error.stack);
        console.log('******* END ERROR ********');
      }
      // console.log("==== item ====");
      // console.log(item);
      if (item["TransportTypeCode"]) {
        summary.push('Transport <a target=\"_blank\" href=\"https://' + DOMAIN + '/Stevedoring/Transport/Detail?Id=' + item.Id + '\">' + item.Reference + "</a> created.");
      } else if (item["DischargingOrderItems"]) {
        summary.push('OrderItem <a target=\"_blank\" href=\"https://' + DOMAIN + '/Stevedoring/Order/Detail?Id=' + item.Id + '\">' + item.DischargingOrderItems[0].ExternalId + "</a> created.");
      } else if (item["TransportReference"]) {
        summary.push("Linked Transport " + item.TransportReference + ".");
      } else if (item["alreadyLinked"]) {
        summary.push('<font color="red">ATTENTION: </font>OrderItem <a target=\"_blank\" href=\"https://' + DOMAIN +  '/Stevedoring/OrderItem/Discharging?Id=' + item.orderItemId + '\">' + item.orderItemId + '</a> already linked to Transport and could not be relinked. Please check manually if necessary.');
      } else {
        summary.push('<font color="red">ERROR RESPONSE: </font>' + JSON.stringify(item.error).substr(0,256) + "\n");
        summary.push('<font color="red">ERROR RES-BODY: </font>' + JSON.stringify(item.body).substr(0,256) + "\n");
      };
    });
    return summary;
  }

  /*
  var calliTOSAPI = function (data, callback) {
    // TR and OI request for each container
    async.mapSeries(
      data.containers,
      (item, cb) => {performContainerRequest(item, data, cb);},
      callback
    );
  }
  */

  var calliTOSAPI = function(data, callback) {
    // create TR and OI JSON and send requests
    async.series(
      {
        orderitem: (cb) => { createOrderItemJSON(data, cb) },
        transport: (cb) => { createTransportJSON(data, cb) },
        link: (cb) => { createLinkJSON(data, cb) },
      }, (err, jsonData) => sendRequests(err, jsonData, callback, data.socketid));
  }

  var sendRequests = function (err, jsonData, callback, clientid) {
    // console.log("====== sending requests");
    // console.log(jsonData);
    async.series(
      [
        (cb) => { sendOrderItemRequest(jsonData.orderitem, cb, clientid) },
        (cb) => { sendTransportRequest(jsonData.transport, cb, clientid) },
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
      // console.log("===== Creating OI JSON ========");
      // console.log(data);

      // find goods for order item
      var goods = [];
      var current_date = new Date().toISOString().slice(0,10);

      data.table.forEach(function(value){
        // create "Nbr of tags" goods items
        goods.push(
          {
            Status: 'Available',
            ProductCode: data.productcode,
            Lot: value[COL_LOT],
            ItemNumber: value[COL_TAGNBR],
            BaseQuantity: { UnitCode: "PCS", Quantity: 1, Recalculate: false },
            StorageQuantity: { UnitCode: "PAL", Quantity: 1, Recalculate: false},
            ExtraQuantities: [
              {
                "UnitCode": "Gross",
                "Quantity": parseFloat(value[COL_WEIGHT]),
                "MeasurementUnitCode": "KG",
                "Recalculate": false
              }
            ],
            OwnerCode: data.custcode,
            Sids: [
              {
                "Code": "REF",
                "Value": value[COL_REF]
              },
              {
                "Code": "ENDCUST",
                "Value": value[COL_ENDCLIENT]
              },
              {
                "Code": "WHS_INST",
                "Value": value[COL_INSTRUCTIONS]
              }
            ]
          }
        );
      });

      var orderItemReq = JSON.stringify({
        Date: current_date,
        InternalCompanyCode: 'IC_VMHZP',
        CustomerCode: data.custcode,
        ExternalId: data.extid,
        CostCentre: data.costcenter,
        ReferenceValues: [
          // {Code: "ETA", Value: data.eta},
        ],
        DischargingOrderItems: [
          {  ExternalId: data.extid,
             OperationCode: data.opcode,
             Priority: 'Normal',
             Status: 'Open',
             PlannedDate: current_date,
             ReferenceValues: [
               // {Code: "PONR", Value: data.containerTables[container][0][COL_PONO]},
             ],
             Goods: goods
          }
        ]
      });

      callback(null, orderItemReq);
  }

  // callback(err, result)
  var createTransportJSON = function(data, callback) {
    // console.log("===== Creating TR JSON ======");
    // console.log(data.containerTables[container]);

    var tRef = data.contno + "-" + data.extid;
    var transportReq = JSON.stringify({
      TransportTypeCode: "GCTNI",
      InternalCompanyCode: 'IC_VMHZP',
      Direction: 0,
      Reference: tRef,
      PublicId: data.contno,
      CostCentre: data.costcenter,
      // EstimatedArrival: data.eta,
      Properties: [
        { Propertycode: "CNTRNO", Value: data.contno },
        // { Propertycode: "CNTRTYPE", Value: data.containerTables[container][0][COL_CONTTYPE] },
        // { Propertycode: "PCKT", Value: data.containerTables[container][0][7] },
        // { Propertycode: "PIN", Value: data.containerTables[container][0][9] },
        // { Propertycode: "DRPD", Value: data.containerTables[container][0][10] },
        // { Propertycode: "DRPREF", Value: data.containerTables[container][0][11] },
        // { Propertycode: "WRH", Value: data.containerTables[container][0][COL_DROPOFF] },
        // { Propertycode: "SHIPLINE", Value: data.containerTables[container][0][13] },
        // { Propertycode: "ORIGCC", Value: data.containerTables[container][0][14] },
        { Propertycode: "CPUR", Value: "Rapportering Klant" }
      ]
    });

    // console.log(transportReq);
    callback(null, transportReq);
  }

  var createLinkJSON = function(data, callback) {
    console.log("===== Creating Linking JSON ========");
    // console.log(data.containerTables[container]);

    var tRef = data.contno + "-" + data.extid;

    var linkingReq = JSON.stringify({
      TransportReference: tRef,
      OrderExternalIds: [ data.extid ],
      OrderItemExternalIds: [ data.extid ]
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
      // console.log("===== res ============");
      // console.log(res);
      if (res.error && res.body && !res.clientError && !res.serverError && !res.body.ErrorMessage && res.body.indexOf("because already have transport.") !== -1) {
        console.log(res.body);
        let re = /Order Item (\d+)/;
        let orderItemId = res.body.match(re)[1];
        res.body = {alreadyLinked: true, orderItemId: orderItemId};
        callback(null, {body: res.body});
      } else {
        if (res.body && !res.clientError && !res.serverError) {
          console.log(res.body);
          callback(null, res.body);
        } else if (res.body && (res.serverError || res.clientError)){
          console.log("res.clientError: " + res.clientError);
          console.log("res.serverError: " + res.serverError);
          console.log(res.error);
          console.log(res.body);
          callback(null, {error: res.error, body: res.body});
        } else if (res.statusMessage){
          console.log(res.statusCode);
          console.log(res.statusMessage);
          callback(null, {error: res.error, body: res.statusMessage});
        } else {
          console.log(res.error);
          callback(null, res.error);
        }
      }
    });
  }

  // get latest entry for this order external id
  app.get("/entries/:custcode/:extid", function (request, response) {
    console.log("#####  getting entry ####### ");
    // console.log(request.params);

    var d = request.params;
    Entry.count({
      where: {
        custcode: d.custcode,
        extid: d.extid
      }}).then(count => {
        Entry.findOne({
          where: {
            custcode: d.custcode,
            extid: d.extid,
            requestno: count
          }}).then(entry => {
            response.end(JSON.stringify([entry]));
        });
      });
  });

  // save new entry
  app.post("/entries", function(req,response) {
    console.log("##### saving entry ###### ");
    // console.log("req body ");
    // console.log(req.body);

    var d = JSON.parse(req.body.data);
    var s = d.socketid;
    // console.log("d.custcode");
    // console.log(d.custcode);

    Entry.count({
      where: {
        custcode: d.custcode,
        extid: d.extid
      }}).then(count => {
        io.of("/").to(d.socketid).emit('update', "Saving data...");
        // console.log("***** count ****");
        // console.log(count);
        Entry.create({
          requestno: count + 1,
          custcode: d.custcode,
          extid: d.extid,
          contno: d.contno,
          productcode: d.productcode,
          costcenter: d.costcenter,
          opcode: d.opcode,
          tabledata: JSON.stringify(d.table)
          }).then(function(entry) {
            response.statusCode = 200;
            response.end(JSON.stringify([entry]));
          })
      });
    });

  // setup a new database
  // using database credentials set in .env
  var sequelize = new Sequelize('carpenter_quick_order_entry', DB_USER, DB_PASS, {
    host: '0.0.0.0',
    dialect: 'sqlite',
    logging: SQL_LOGGING,
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    },
    // Security note: the database is saved to the file `*.sqlite` on the local filesystem.
    storage: 'data/carpenter_quick_order_entry_' + ENVIRONMENT + '.sqlite'
  });

  // authenticate with the database
  sequelize.authenticate()
    .then(function(err) {
      console.log('========= DB connection has been established successfully. ==========');
      // define a new table 'entries'
      Entry = sequelize.define('entries', {
        requestno: {type: Sequelize.INTEGER},
        custcode: {type: Sequelize.STRING},
        extid: {type: Sequelize.STRING},
        contno: {type: Sequelize.STRING},
        productcode: {type: Sequelize.STRING},
        costcenter: {type: Sequelize.STRING},
        opcode: {type: Sequelize.STRING},
        tabledata: {type: Sequelize.STRING}
      });

      dbSetup();
    })
    .catch(function (err) {
      console.log('Unable to connect to the database: ', err);
    });

  // populate table with default users
  function dbSetup(){
    Entry.sync() // {force: true}) // using 'force' drops the table if it already exists, and creates a new one
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
