// server.js
// where your node app starts

// init project
const PORT = 8877;
const HOSTNAME = "itos-api-uat.vanmoergroup.com";
const DOMAIN = "itos-uat.vanmoergroup.com";
const DB_USER = "braskem";
const DB_PASS = "braskem";

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
  result.forEach(function(pair){
    // console.log("==== pair ====");
    // console.log(pair);
    pair.forEach(function(item) {
      // console.log("==== item ====");
      // console.log(item);
      if (item["TransportTypeCode"]) {
        summary.push('Transport <a href=\"https://' + DOMAIN + '/Stevedoring/Transport/Detail?Id=' + item.Id + '\">' + item.Reference + "</a> created.");
      } else if (item["DischargingOrderItems"]) {
        summary.push("OrderItem " + item.DischargingOrderItems[0].ExternalId + " created.");
      } else {
        summary.push("ERROR RESPONSE: " + JSON.stringify(item).substr(0,256) + "\n");
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
    EstimatedArrival: data.containerTables[container][0][7],
    Properties: [
      { Propertycode: "CNTRNO", Value: data.containerTables[container][0][0] },
      { Propertycode: "CNTRTYPE", Value: data.containerTables[container][0][5] },
      { Propertycode: "PCKT", Value: data.containerTables[container][0][6] },
      { Propertycode: "PIN", Value: data.containerTables[container][0][8] },
      { Propertycode: "DRPD", Value: data.containerTables[container][0][9] },
      { Propertycode: "DRPREF", Value: data.containerTables[container][0][10] },
      { Propertycode: "WRH", Value: data.containerTables[container][0][11] },
      { Propertycode: "SHIPLINE", Value: data.containerTables[container][0][12] },
      { Propertycode: "ORIGCC", Value: data.containerTables[container][0][13] }
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
          BaseQuantity: { UnitCode: "BBG", Quantity: parseFloat(value[4]), Recalculate: true },
          StorageQuantity: { UnitCode: "PAL", Quantity: 0 },
          ExtraQuantities: [
            {
              "UnitCode": "Net",
              "Quantity": parseFloat(value[3]),
              "MeasurementUnitCode": "KG",
              "Recalculate": false
            }
          ],
          OwnerCode: data.custcode,
        }
      );
    });

    var itosreqdata = JSON.stringify({
      Date: data.planneddate,
      InternalCompanyCode: 'IC_VMHZP',
      CustomerCode: data.custcode,
      ExternalId: data.extid,
      CostCentre: data.costcenter,
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

    callback(null, itosreqdata);
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
  // console.log("d.custcode");
  // console.log(d.custcode);

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
  storage: 'data/braskem_quick_order_entry.sqlite'
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
