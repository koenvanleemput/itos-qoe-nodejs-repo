// server.js
// where your node app starts
process.chdir(__dirname);
const fs = require('fs');

var ENVIRONMENT;

var main = function() {
  // init project
  const DB_USER = "braskem";
  const DB_PASS = "braskem";

  var PORT;
  var HOSTNAME;
  var DOMAIN;
  var SQL_LOGGING; // true;

  if (ENVIRONMENT === "UAT") {
    console.log("==== Running on UAT ===");
    PORT = 8877;
    HOSTNAME = "itos-api-uat.vanmoergroup.com";
    DOMAIN = "itos-uat.vanmoergroup.com";
    SQL_LOGGING = false; // true;
  } else if (ENVIRONMENT === "PRD") {
    console.log("******** Running on PRD ********");
    PORT = 8878;
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

    // find unique containers
    console.log("==== unique containers === ");
    data.containers = data.table.getColumn(0).unique();
    console.log(data.containers);

    // split table per container
    data.containerTables = {};
    data.containers.forEach(function(container){
      // console.log("======= filtering container: " + container + " =========");
      data.containerTables[container] = data.table.filter(function(item, index, array){
        if (item[0] === container)
        return item;
      });
    });

    // console.log("====== prepared data ======");
    // console.log(data);

    // Create TR and OI and link them
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
    result.forEach(function(resultSet){
      // console.log("==== pair ====");
      // console.log(pair);
      resultSet.forEach(function(item) {
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
          summary.push('<font color="red">ERROR RESPONSE: </font>' + JSON.stringify(item).substr(0,256) + "\n");
        };
      })
    });
    return summary;
  }

  var calliTOSAPI = function (data, callback) {
    // TR and OI request for each container
    async.mapSeries(
      data.containers,
      (item, cb) => {performContainerRequest(item, data, cb);},
      callback
    );
  }

  var performContainerRequest = function(container, data, callback) {
    // create TR and OI JSON and send requests
    async.series(
      {
        transport: (cb) => { createTransportJSON(container, data, cb) },
        orderitem: (cb) => { createOrderItemJSON(container, data, cb) },
        link: (cb) => { createLinkJSON(container, data, cb) },
      }, (err, jsonData) => sendRequests(err, jsonData, callback));
  }

  var sendRequests = function (err, jsonData, callback) {
    // console.log("====== sending requests");
    // console.log(jsonData);
    async.series(
      [
        (cb) => { sendTransportRequest(jsonData.transport, cb) },
        (cb) => { sendOrderItemRequest(jsonData.orderitem, cb) },
        (cb) => { sendLinkRequest(jsonData.link, cb) },
      ], callback
    );
  }

  // callback(err, result)
  var sendTransportRequest = function(transportJSON, callback) {
    sendITOSRequest(HOSTNAME, "/api/ImportTransports", transportJSON, callback);
  }

  // callback(err, result)
  var sendOrderItemRequest = function(orderItemJSON, callback) {
    sendITOSRequest(HOSTNAME, "/api/OrderImport", orderItemJSON, callback);
  }

  // callback(err, result)
  var sendLinkRequest = function(transportLinkJSON, callback) {
    sendITOSRequest(HOSTNAME, "/api/TransportLink", transportLinkJSON, callback);
  }

  // callback(err, result)
  var createTransportJSON = function(container, data, callback) {
    // console.log("===== Creating TR JSON ======");
    // console.log(data.containerTables[container]);

    var transportReq = JSON.stringify({
      TransportTypeCode: "GCTNI",
      InternalCompanyCode: 'IC_VMHZP',
      Direction: 0,
      Reference: data.containerTables[container][0][0],
      PublicId: data.containerTables[container][0][0],
      CostCentre: data.costcenter,
      EstimatedArrival: data.containerTables[container][0][8],
      Properties: [
        { Propertycode: "CNTRNO", Value: data.containerTables[container][0][0] },
        { Propertycode: "CNTRTYPE", Value: data.containerTables[container][0][6] },
        { Propertycode: "PCKT", Value: data.containerTables[container][0][7] },
        { Propertycode: "PIN", Value: data.containerTables[container][0][9] },
        { Propertycode: "DRPD", Value: data.containerTables[container][0][10] },
        { Propertycode: "DRPREF", Value: data.containerTables[container][0][11] },
        { Propertycode: "WRH", Value: data.containerTables[container][0][12] },
        { Propertycode: "SHIPLINE", Value: data.containerTables[container][0][13] },
        { Propertycode: "ORIGCC", Value: data.containerTables[container][0][14] },
        { Propertycode: "CPUR", Value: "Containerplanning" }
      ]
    });

    // console.log(transportReq);
    callback(null, transportReq);
  }

  var createOrderItemJSON = function(container, data, callback) {
      // console.log("===== Creating OI JSON ========");
      // console.log(data.containerTables[container]);

      // find goods for order item
      var goods = [];

      data.containerTables[container].forEach(function(value){
        goods.push(
          {
            Status: 'Available',
            ProductCode: value[1],
            Lot: value[2],
            BaseQuantity: { UnitCode: value[4], Quantity: parseFloat(value[3]), Recalculate: true },
            StorageQuantity: { UnitCode: "PAL", Quantity: 0 },
            ExtraQuantities: [
              {
                "UnitCode": "Net",
                "Quantity": 0,
                "MeasurementUnitCode": "KG",
                "Recalculate": null
              }
            ],
            OwnerCode: data.custcode,
            Sids: [
              {
                "Code": "UNITPRICE",
                "Value": parseFloat(value[5])
              }
            ]
          }
        );
      });

      var orderItemReq = JSON.stringify({
        Date: data.planneddate,
        InternalCompanyCode: 'IC_VMHZP',
        CustomerCode: data.custcode,
        ExternalId: data.extid,
        CostCentre: data.costcenter,
        ReferenceValues: [
          {Code: "INVNUM" , Value: data.invoicenumber},
          {Code: "INVDATE" , Value: data.invoicedate},
          {Code: "IVAL" , Value: data.invoicevalue},
          {Code: "IVALCUR" , Value: data.invoicecurrency},
          {Code: "FOBANR" , Value: data.invoicefob},
          {Code: "FRC" , Value: data.invoicefrc},
          {Code: "INSR" , Value: data.invoiceinsurance},
          {Code: "CIFANR" , Value: data.invoicecif},
          {Code: "INVFROM" , Value: data.invoicefrom},
          {Code: "INVTOTAL" , Value: data.invoicetotal},
          {Code: "DOCNR" , Value: data.customsdocnr}
        ],
        DischargingOrderItems: [
          {  ExternalId: data.containerTables[container][0][0] + "/" + data.extid,
             OperationCode: data.opcode,
             Priority: 'Normal',
             Status: 'Open',
             PlannedDate: data.planneddate,
             Goods: goods
          }
        ]
      });

      callback(null, orderItemReq);
  }


  var createLinkJSON = function(container, data, callback) {
    console.log("===== Creating Linking JSON ========");
    // console.log(data.containerTables[container]);

    var tRef = data.containerTables[container][0][0];

    var linkingReq = JSON.stringify({
      TransportReference: tRef,
      OrderItemExternalIds: [ tRef + "/" + data.extid ]
    });

    callback(null, linkingReq);
  }

  // callback(err, result)
  var sendITOSRequest = function(hostname, path, itosreqdata, callback) {
    var url = "https://" + hostname + path;
    console.log("===== Sending iTOS " + url + " Request ============");
    console.log(itosreqdata);

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
      console.log(res.body);
      // ignore error where Transport is already linked - for updates !
      if (res.error && !res.body.Message && res.body.indexOf("because already have transport.") !== -1) {
        let re = /Order Item (\d+)/;
        let orderItemId = res.body.match(re)[1];
        res.body = {alreadyLinked: true, orderItemId: orderItemId};
        callback(null, res.body);
      } else {
        callback(res.error, res.body);
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
          custcode: d.custcode,
          extid: d.extid,
          requestno: count + 1,
          costcenter: d.costcenter,
          opcode: d.opcode,
          planneddate: d.planneddate,
          invoicenumber: d.invoicenumber,
          invoicedate: d.invoicedate,
          invoicevalue: d.invoicevalue,
          invoicecurrency: d.invoicecurrency,
          invoicefob: d.invoicefob,
          invoicefrc: d.invoicefrc,
          invoiceinsurance: d.invoiceinsurance,
          invoicecif: d.invoicecif,
          invoicefrom: d.invoicefrom,
          invoicetotal: d.invoicetotal,
          customsdocnr:d.customsdocnr,
          tabledata: JSON.stringify(d.table)
          }).then(function(entry) {
            response.statusCode = 200;
            response.end(JSON.stringify([entry]));
          })
      });
    });

  // setup a new database
  // using database credentials set in .env
  var sequelize = new Sequelize('braskem_quick_order_entry', DB_USER, DB_PASS, {
    host: '0.0.0.0',
    dialect: 'sqlite',
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    },
    // Security note: the database is saved to the file `*.sqlite` on the local filesystem.
    storage: 'data/braskem_quick_order_entry_' + ENVIRONMENT + '.sqlite'
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
        planneddate: {type: Sequelize.STRING},
        invoicenumber: {type: Sequelize.STRING},
        invoicedate: {type: Sequelize.STRING},
        invoicevalue: {type: Sequelize.STRING},
        invoicecurrency: {type: Sequelize.STRING},
        invoicefob: {type: Sequelize.STRING},
        invoicefrc: {type: Sequelize.STRING},
        invoiceinsurance: {type: Sequelize.STRING},
        invoicecif: {type: Sequelize.STRING},
        invoicefrom: {type: Sequelize.STRING},
        invoicetotal: {type: Sequelize.STRING},
        customsdocnr: {type: Sequelize.STRING},
        tabledata: {type: Sequelize.STRING}

       /*
        Container
        Product Code
        LOT
        Net kg
        Qty Bags
        Container Type
        Pick-Up Terminal
        Pick-Up Date
        Pick-Up Reference
        Drop-Off Depot
        Drop-Off Reference
        Warehouse
        Shipping Line
        Origin Country Code
        */
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

  // Socket.io communication
  var io = require('socket.io')(listener);

  io.on('connection', function (socket) {
    console.log("someone connected: " + socket.id);
    socket.on('message', function (data) {
      console.log("Received: " + data);
      console.log("Sending back");
      socket.emit('update', "Got message " + data);
      console.log("Have sent");
    });
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
  var serviceName = "QuickOrderEntryBraskem-" + ENVIRONMENT;

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
