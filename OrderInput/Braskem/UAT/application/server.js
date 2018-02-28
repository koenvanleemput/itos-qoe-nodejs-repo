// server.js
// where your node app starts
process.chdir(__dirname);
const fs = require('fs');

var ENVIRONMENT;

var main = function() {
  // init project
  const DB_USER = "braskem";
  const DB_PASS = "braskem";

  // data table columns
  const COL_CONT = 0;         // Container
  const COL_CONTTYPE = 1;     // Container Type
  const COL_PRODCODE = 2;     // Product Code
  const COL_LOT = 3;          // LOT
  const COL_QTY = 4;          // Qty Bags
  const COL_UNIT = 5;         // Unit
  const COL_ARTNO = 6;        // Article No.
  const COL_ITEMNO = 7;       // Item No.
  const COL_COUNTRY = 8;      // Origin Country Code
  const COL_DROPOFF = 9;      // Drop-Off Warehouse
  const COL_PONO = 10;        // PO Number
  const COL_INVNO = 11;       // Invoice Number
  const COL_INVFROM = 12;     // Invoice From
  const COL_INVTOTAL = 13;    // Invoice Total
  const COL_INVDATE = 14;     // Invoice Date
  const COL_UNITPRICE = 15;   // UnitPrice
  const COL_PRICE_UOM = 16;   // Unit Price unit of measure
  const COL_INVCURR = 17;     // Invoice Currency
  const COL_INVAMNT = 18;     // Invoice Amount FOB
  const COL_FREIGHT = 19;     // Freight Costs
  const COL_INSURANCE = 20;   // Insurance Costs
  const COL_CIF = 21;         // Total FOB + CIF Antwerp
  const COL_INCO = 22;        // Incoterms
  const COL_REM = 23;         // Other Remarks

  var PORT;
  var HOSTNAME;
  var DOMAIN;
  var SQL_LOGGING; // true;

  if (ENVIRONMENT === "UAT") {
    console.log("==== Running on UAT ===");
    PORT = 8877;
    HOSTNAME = "itos-api-uat.vanmoergroup.com";
    DOMAIN = "itos-uat.vanmoergroup.com";
    SQL_LOGGING = console.log; // true;
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
      if (item[COL_CONT] !== null && item[COL_CONT] !== "")
      return item;
    });

    // find unique invoice-container combinations
    let invoice_containers = [];
    for(let i = 0; i < data.table.length; i++) {
      invoice_containers.push([data.table[i][COL_INVNO], data.table[i][COL_CONT]]);
    }
    data.invoice_containers = invoice_containers.unique();

    console.log("==== unique invoice-containers === ");
    console.log(data.invoice_containers);

    // console.log("==== unique containers === ");
    // data.containers = data.table.getColumn(COL_CONT).unique();
    // console.log(data.containers);

    // split table per unique container & invoice combination:
    //        so 1 container with 2 invoices becomes 2 order items
    data.containerTables = {};
    data.invoice_containers.forEach(function(invoice_container){
      // console.log("======= filtering invoice_container: " + invoice_container + " =========");
      data.containerTables[invoice_container] = data.table.filter(function(item, index, array){
        if ((item[COL_INVNO] === invoice_container[0]) && (item[COL_CONT] === invoice_container[1]))
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
    var summary = [];
    result.forEach(function(triplet){
      // console.log("==== triplet ====");
      // console.log(triplet);
      triplet.forEach(function(item) {
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
      data.invoice_containers,
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

    var tRef = data.containerTables[container][0][COL_CONT] + "-" + data.extid;
    var transportReq = JSON.stringify({
      TransportTypeCode: "GCTNI",
      InternalCompanyCode: 'IC_VMHZP',
      Direction: 0,
      Reference: tRef,
      PublicId: data.containerTables[container][0][COL_CONT],
      CostCentre: data.costcenter,
      EstimatedArrival: data.eta,
      Properties: [
        { Propertycode: "CNTRNO", Value: data.containerTables[container][0][COL_CONT] },
        { Propertycode: "CNTRTYPE", Value: data.containerTables[container][0][COL_CONTTYPE] },
        // { Propertycode: "PCKT", Value: data.containerTables[container][0][7] },
        // { Propertycode: "PIN", Value: data.containerTables[container][0][9] },
        // { Propertycode: "DRPD", Value: data.containerTables[container][0][10] },
        // { Propertycode: "DRPREF", Value: data.containerTables[container][0][11] },
        { Propertycode: "WRH", Value: data.containerTables[container][0][COL_DROPOFF] },
        // { Propertycode: "SHIPLINE", Value: data.containerTables[container][0][13] },
        { Propertycode: "ORIGCC", Value: data.containerTables[container][0][COL_COUNTRY] },
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
        // convert unit price to price per kg depending on UOM
        let factor = 1.00;
        if (value[COL_PRICE_UOM] === 'Tons') {
          factor =  0.001;
        }
        if (value[COL_PRICE_UOM] === 'Lbs') {
          factor =  0.45359;
        }

        goods.push(
          {
            Status: 'Available',
            ProductCode: value[COL_PRODCODE],
            Lot: value[COL_LOT],
            BaseQuantity: { UnitCode: value[COL_UNIT], Quantity: parseFloat(value[COL_QTY]), Recalculate: true },
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
                "Value": parseFloat(value[COL_UNITPRICE]) * factor
              },
              {
                "Code": "UNITPRCUOM",
                "Value": value[COL_PRICE_UOM]
              },
              {
                "Code": "ORIGCC",
                "Value": value[COL_COUNTRY]
              }
            ]
          }
        );
      });

      var orderItemReq = {
        Date: data.eta,
        InternalCompanyCode: 'IC_VMHZP',
        CustomerCode: data.custcode,
        ExternalId: data.extid,
        CostCentre: data.costcenter,
        ReferenceValues: [
          {Code: "ETA", Value: convertISODateToBelgian(data.eta)},
          {Code: "ARD", Value: convertISODateToBelgian(data.arrived)},
          {Code: "VS", Value: data.vessel},
          {Code: "VOY", Value: data.voyage},
          {Code: "BL", Value: data.billoflading},
          {Code: "QUAY", Value: data.quay},
          {Code: "LLN", Value: data.lloyd},
          {Code: "PCKUPDATE", Value: convertISODateToBelgian(data.pickup)},
          {Code: "SHN", Value: data.shipno},
          {Code: "AGC", Value: data.agentcode},
          {Code: "DSPCTRY", Value: data.dispatchcountry},
          {Code: "WHSE", Value: data.warehouse},
        ],
        PartnerAddresses: [
         {
           PartnerName: data.warehouse,
           CompanyRoleCode: "SHIP_TO",
           AddressLine: data.address.line,
           Zip: data.address.zip,
           City: data.address.city,
           CountryCode: data.address.countrycode,
         }
        ],
        DischargingOrderItems: [
          {  ExternalId: data.containerTables[container][0][COL_CONT] + "-" + data.extid + "-" + data.containerTables[container][0][COL_INVNO],
             OperationCode: data.opcode,
             Priority: 'Normal',
             Status: 'Open',
             PlannedDate: data.pickup,
             ReferenceValues: [
               {Code: "PONR", Value: data.containerTables[container][0][COL_PONO]},
               {Code: "INVNUM", Value: data.containerTables[container][0][COL_INVNO]},
               {Code: "INVFROM", Value: data.containerTables[container][0][COL_INVFROM]},
               {Code: "INVTOTAL", Value: data.containerTables[container][0][COL_INVTOTAL]},
               {Code: "INVDATE", Value: convertISODateToBelgian(data.containerTables[container][0][COL_INVDATE])},
               {Code: "IVAL", Value: data.containerTables[container][0][COL_INVAMNT]},
               {Code: "IVALCUR", Value: data.containerTables[container][0][COL_INVCURR]},
               {Code: "INCTRM", Value: data.containerTables[container][0][COL_INCO]},
               {Code: "FRGHTCOST", Value: data.containerTables[container][0][COL_FREIGHT]},
               {Code: "INSRCOST", Value: data.containerTables[container][0][COL_INSURANCE]},
               {Code: "CIFANR", Value: data.containerTables[container][0][COL_CIF]},
               {Code: "DRPOFFDEPOT", Value: data.containerTables[container][0][COL_DROPOFF]},
               {Code: "REM", Value: data.containerTables[container][0][COL_REM]},
               {Code: "ARTNUM", Value: data.containerTables[container][0][COL_ARTNO]},
               {Code: "ITNUM", Value: data.containerTables[container][0][COL_ITEMNO]}
             ],
             Goods: goods
          }
        ]
      };

      if (data.containerTables[container][0][COL_COUNTRY] === 'MX') {
        orderItemReq.DischargingOrderItems[0].ReferenceValues.push({Code: "N864", Value: data.containerTables[container][0][COL_INVNO] + "-mx/0037-17"});
        orderItemReq.DischargingOrderItems[0].ReferenceValues.push({Code: "3001", Value: "mx/0037-17"});
      }

      callback(null, JSON.stringify(orderItemReq));
  }


  var createLinkJSON = function(container, data, callback) {
    console.log("===== Creating Linking JSON ========");
    // console.log(data.containerTables[container]);

    var tRef = data.containerTables[container][0][COL_CONT] + "-" + data.extid;

    var linkingReq = JSON.stringify({
      TransportReference: tRef,
      OrderItemExternalIds: [ tRef + "-" + data.containerTables[container][0][COL_INVNO]]
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
      // ignore error where Transport is already linked - for updates !
      // console.log("===== res ============");
      // console.log(res);
      if (res.error && res.body && !res.clientError && !res.body.ErrorMessage && res.body.indexOf("because already have transport.") !== -1) {
        console.log(res.body);
        let re = /Order Item (\d+)/;
        let orderItemId = res.body.match(re)[1];
        res.body = {alreadyLinked: true, orderItemId: orderItemId};
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
          opcode: d.opcode,
          costcenter: d.costcenter,
          extid: d.extid,
          eta: d.eta,
          arrived: d.arrived,
          vessel: d.vessel,
          voyage: d.voyage,
          billoflading: d.billoflading,
          quay: d.quay,
          lloyd: d.lloyd,
          pickup: d.pickup,
          shipno: d.shipno,
          agentcode: d.agentcode,
          dispatchcountry: d.dispatchcountry,
          // articleno: d.articleno,
          // itemno: d.itemno,
          warehouse: d.warehouse,
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
    logging: SQL_LOGGING,
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    },
    operatorsAliases: false,
    // Security note: the database is saved to the file `*.sqlite` on the local filesystem.
    storage: 'data/braskem_quick_order_entry_' + ENVIRONMENT + '.sqlite'
  });

  // authenticate with the database
  sequelize.authenticate()
    .then(function(err) {
      console.log('========= DB connection has been established successfully. ==========');
      // define a new table 'entries'
      Entry = sequelize.define('entries', {
        requestno: {type: Sequelize.INTEGER},
        custcode: {type: Sequelize.STRING},
        opcode: {type: Sequelize.STRING},
        costcenter: {type: Sequelize.STRING},
        extid: {type: Sequelize.STRING},
        eta: {type: Sequelize.STRING},
        arrived: {type: Sequelize.STRING},
        vessel: {type: Sequelize.STRING},
        voyage: {type: Sequelize.STRING},
        billoflading: {type: Sequelize.STRING},
        quay: {type: Sequelize.STRING},
        lloyd: {type: Sequelize.STRING},
        pickup: {type: Sequelize.STRING},
        shipno: {type: Sequelize.STRING},
        agentcode: {type: Sequelize.STRING},
        dispatchcountry: {type: Sequelize.STRING},
        // articleno: {type: Sequelize.STRING},
        // itemno: {type: Sequelize.STRING},
        warehouse: {type: Sequelize.STRING},
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

  convertISODateToBelgian = function(datestring) {
    if (datestring == '') {
      return datestring;
    } else {
      let cs = datestring.split('-');
      return cs[2]+'/'+cs[1]+'/'+cs[0];
    }
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
