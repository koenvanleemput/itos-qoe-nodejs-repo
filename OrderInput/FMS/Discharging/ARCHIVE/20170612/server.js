// server.js
// where your node app starts
process.chdir(__dirname);

var main = function() {
  // init project
  const PORT = 8877;
  const HOSTNAME = "itos-api-uat.vanmoergroup.com";
  const DOMAIN = "itos-uat.vanmoergroup.com";
  const DB_USER = "FMS";
  const DB_PASS = "FMS";

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

  // http://expressjs.com/en/starter/basic-routing.html
  app.get("/", function (request, response) {
    response.sendFile(__dirname + '/views/index.html');
  });

  // submit requests to iTOS
  app.post("/data", function(req,response) {
    // console.log("data post");
    // console.log(req.body.data);

    var data = JSON.parse(req.body.data);

    // clean empty rows from table
    data.table = data.table.filter(function(item, index, array){
      if (item[2] !== null && item[2] !== "")
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
    console.log(" ***** TODO FOR LINKING TR AND OI *****");
    // console.log(Array.isArray(result));
    // console.log(result);
    // console.log("length = "+result.length);
    var summary = [];
    result.forEach(function(item){
      // console.log("==== item ====");
      // console.log(item);
      if (item["TransportTypeCode"]) {
        summary.push('Transport <a href=\"https://' + DOMAIN + '/Stevedoring/Transport/Detail?Id=' + item.Id + '\">' + item.Reference + "</a> created.");
      } else if (item["DischargingOrderItems"]) {
        //summary.push("OrderItem " + item.DischargingOrderItems[0].ExternalId + " created.");
        summary.push('OrderItem <a target=\"_blank\" href=\"https://' + DOMAIN + '/Stevedoring/Order/Detail?Id=' + item.Id + '\">' + item.DischargingOrderItems[0].ExternalId + "</a> created.");
      } else {
        summary.push("ERROR RESPONSE: " + JSON.stringify(item).substr(0,256) + "\n");
      };
    });
    return summary;
  }

  var calliTOSAPI = function (data, callback) {
    // create TR and OI JSON and send requests
    async.series(
      {
        transport: (cb) => { createTransportJSON(data, cb) },
        orderitem: (cb) => { createOrderItemJSON(data, cb) },
        link: (cb) => { createLinkJSON(data, cb) },
      }, (err, jsonData) => sendRequests(err, jsonData, callback));
  }

  var sendRequests = function (err, jsonData, callback) {
    // console.log("====== sending requests");
    // console.log(jsonData);
    async.series(
      [
        (cb) => { sendTransportRequest(jsonData.transport, cb) },
        (cb) => { sendOrderItemRequest(jsonData.orderitem, cb) },
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
  var createTransportJSON = function(data, callback) {
    console.log("===== Creating TR JSON ======");
    // console.log(data.container);

    var transportReq = JSON.stringify({
      TransportTypeCode: "TR",  // TODO => in geval van andere opcode?
      InternalCompanyCode: 'IC_VMHZP',
      Reference: data.extid + '/' + data.lictruck,
      Carrier: data.tptcompany,
      Direction: 0,
      PublicId: data.lictruck,
      CostCentre: data.costcenter,
      EstimatedArrival: data.planneddate,
      EstimatedDeparture: data.planneddate,
      Properties: [
        { Propertycode: "TRKPLNO", Value: data.lictruck },
        { Propertycode: "TRLRPLNO", Value: data.lictrail },
        { Propertycode: "COMPNAM", Value: data.tptcompany }
      ]
    });

    // console.log(transportReq);
    callback(null, transportReq);
  }

  var createOrderItemJSON = function(data, callback) {
      console.log("===== Creating OI JSON ========");
      // console.log(data);

      // find goods for order item
      var goods = [];

      data.table.forEach(function(value){
        var unitcode;
        if (value[0] === 'FMSROL') {
          unitcode = 'ROLL';
        } else if (value[0] === 'FMSPAL') {
          unitcode = 'PAL';
        } else {
          unitcode = 'ERROR';
        }
        goods.push(
          {
            Status: 'Available',
            ProductCode: value[0],
            Lot: value[1],
            LocationAddress: value[23],
            ItemNumber: value[2],
            BaseQuantity: { UnitCode: unitcode, Quantity: 1, Recalculate: null },
            StorageQuantity: { UnitCode: "PCS", Quantity: 1 },
            ExtraQuantities: [
              {
                "UnitCode": "Net",
                "Quantity": parseFloat(value[3]),
                "MeasurementUnitCode": "KG",
                "Recalculate": null
              },
              {
                "UnitCode": "Gross",
                "Quantity": parseFloat(value[4]),
                "MeasurementUnitCode": "KG",
                "Recalculate": null
              }
            ],
            Sids: [
              {
                "Code": "LEN", // Length - Number
                "Value": value[5]
              },
              {
                "Code": "WID", // Width - Number
                "Value": value[6]
              },
              {
                "Code": "HGHT", // Height - Number
                "Value": value[7]
              },
              {
                "Code": "CAT", // Category - Combo
                "Value": value[8]
              },
              {
                "Code": "CON", // Contract - Text box
                "Value": value[9]
              },
              {
                "Code": "CPO", // Customer Purchase Order - Text box
                "Value": value[10]
              },
              {
                "Code": "DIA", // Diameter - Number
                "Value": value[11]
              },
              {
                "Code": "GRM", // Grammage - Number
                "Value": value[12]
              },
              {
                "Code": "QUA", // Quality - Combo box
                "Value": value[13]
              },
              {
                "Code": "CUST", // Customs Status - Combo box
                "Value": value[14]
              },
              {
                "Code": "DNR", // Document Number - Text box
                "Value": value[15]
              },
              {
                "Code": "NRSH", // Number of Sheets - Number
                "Value": value[16]
              },
              {
                "Code": "CRCD", // Core Code - Text box
                "Value": value[17]
              },
              {
                "Code": "DIAC", // Diameter Core - Number
                "Value": value[18]
              },
              {
                "Code": "PRDC", // Product Color - Text box
                "Value": value[19]
              },
              {
                "Code": "STRC", // Store Comment - Text box
                "Value": value[20]
              },
              {
                "Code": "REM", // Remark - Text box
                "Value": value[21]
              },
              {
                "Code": "CUSTREF", // Customer Reference - Text box
                "Value": value[22]
              },
            ],
            OwnerCode: data.custcode,
          }
        );
      });

      var oiref = createOIReference(data);

      var itosreqdata = JSON.stringify({
        Date: data.planneddate,
        InternalCompanyCode: 'IC_VMHZP',
        CustomerCode: data.custcode,
        ExternalId: data.extid,
        CostCentre: data.costcenter,
        DischargingOrderItems: [
          {  ExternalId: createOIReference(data),
             OperationCode: data.opcode,
             Priority: 'Normal',
             Status: 'Open',
             PlannedDate: data.planneddate,
             Goods: goods
          }
        ]
      });

      callback(null, itosreqdata);
  }

  var createOIReference = function(data) {
    var grossweights = data.table.map(row => row[4]); // 4th column
    var sum = grossweights.reduce((a,b) => parseFloat(a)+parseFloat(b), 0); // sum of weights
    var ref = data.extid + '/' + data.table.length + '/' + sum;
    return ref;
  }

  var createLinkJSON = function(data, callback) {
    console.log("===== Creating Linking JSON ========");
    // console.log(data);

    var linkingReq = JSON.stringify({
      TransportReference: data.extid + '/' + data.lictruck,
      OrderItemExternalIds: [ createOIReference(data) ]
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
      "authorization": "Basic S1ZMRUVNUFVUOjNOQXc2Q3c3",
      "content-type": "application/json"
    });

    req.type("json");
    req.send(itosreqdata);

    req.end(function (res) {
      console.log("===== iTOS Response ============");
      console.log(res.body);
      callback(res.error, res.body);
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
    // console.log(d);

    Entry.count({
      where: {
        custcode: d.custcode,
        extid: d.extid
      }}).then(count => {
      // console.log("***** count ****");
      // console.log(count);
      Entry.create({
        custcode: d.custcode,
        extid: d.extid,
        requestno: count + 1,
        costcenter: d.costcenter,
        opcode: d.opcode,
        planneddate: d.planneddate,
        lictruck: d.lictruck,
        lictrail: d.lictrail,
        tptcompany: d.tptcompany,
        tabledata: JSON.stringify(d.table)
        }).then(function(entry) {
          response.statusCode = 200;
          response.end(JSON.stringify([entry]));
        })
    });
  });

  // setup a new database
  // using database credentials set in .env
  var sequelize = new Sequelize('FMS_quick_order_entry', DB_USER, DB_PASS, {
    host: '0.0.0.0',
    dialect: 'sqlite',
    pool: {
      max: 5,
      min: 0,
      idle: 10000
    },
    // Security note: the database is saved to the file `*.sqlite` on the local filesystem.
    storage: 'data/FMS_quick_order_entry.sqlite'
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
        lictruck: {type: Sequelize.STRING},
        lictrail: {type: Sequelize.STRING},
        tptcompany: {type: Sequelize.STRING},
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
}

// local or Windows service
// -- execute npm install –msvs_version=2015 os-service for Windows
if(process.platform === 'darwin') {
  console.log("Running on OS X");
  main();
} else if (process.platform === 'win32') {
  // windows service
  var fs = require ("fs");
  var service = require ("os-service");

  if (process.argv[2] == "--add") {
    service.add ("QuickOrderEntryFMS", {programArgs: ["--run"]}, function(error){
       if (error)
          console.trace(error);
    });
  } else if (process.argv[2] == "--remove") {
    service.remove ("QuickOrderEntryFMS", function(error){
       if (error)
          console.trace(error);
    });
  } else if (process.argv[2] == "--run") {
    console.log("Starting as service");
    var logStream = fs.createWriteStream (process.argv[1] + ".log");

    service.run (logStream, function () {
        service.stop (0);
    });

    main();
  } else {
    console.log("Use --add or --remove or --run");
  }
} else {
  console.log("Platform not supported");
}
