// server.js
// where your node app starts

// init project
const PORT = 8877;
const HOSTNAME = "itos-api-uat.vanmoergroup.com";
var express = require('express');
var async = require('async');
var bodyParser = require('body-parser');
var http = require("https");

var app = express();

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
  console.log(req.body.data);

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
    console.log('======== iTOS API called =========');
    if (err) {
      console.log('******* ERROR ********');
      console.error(err.stack);
      console.log('******* END ERROR ********');
      response.end(err);
    }
    console.log(JSON.stringify(result));
    response.end(result.toString('utf-8'));
  });
})

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
  sendITOSRequest3(HOSTNAME, "/api/ImportTransports", transportJSON, callback);
}

// callback(err, result)
var sendOrderItemRequest = function(orderItemJSON, callback) {
  sendITOSRequest3(HOSTNAME, "/api/OrderImport", orderItemJSON, callback);
}

// callback(err, result)
var createTransportJSON = function(container, data, callback) {
  console.log("===== Creating TR JSON ======");
  // console.log(data.containerTables[container]);

  var transportReq = JSON.stringify({
    TransportTypeCode: "GCTNI",
    InternalCompanyCode: 'IC_VMHZP',
    Direction: 0,
    Reference: data.containerTables[container][0][0],
    PublicId: data.containerTables[container][0][0],
    CostCentre: "O-VMROKAAI1779", // TODO
    Properties: [
      { Propertycode: "CNTRNO", Value: data.containerTables[container][0][0] }
    ]
  });

  // console.log(transportReq);
  callback(null, transportReq);
}

var createOrderItemJSON = function(container, data, callback) {
    console.log("===== Creating OI JSON");
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
      DischargingOrderItems: [
        {  ExternalId: data.containerTables[container][0][0],
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
  console.log("===== Sending iTOS Request ============");
  console.log(itosreqdata);
  var options = {
    "method": "POST",
    "hostname": hostname,
    "port": null,
    "path": path,
    "headers": {
      "authorization": "Basic S1ZMRUVNUFVUOjNOQXc2Q3c3",
      "content-type": "application/json; charset=utf-8",
      // "cache-control": "no-cache",
      // "postman-token": "1d3eb3c5-cec0-9dc6-4c8b-6622e7de8ff6"
    }
  };

  var itosreq = http.request(options, function (res) {
    var body;
    var chunks = [];

    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", function () {
      body = Buffer.concat(chunks);
      console.log("===== iTOS Response ============");
      console.log(body.toString('utf-8'));
      console.log("===== END iTOS Response ============");
      callback(null, body);
    });

    res.on("error", function (err) {
      console.log(err.message)
      callback(err, body);
    });
  });

  console.log("===== iTOS Req Data ============");
  console.log(JSON.stringify(JSON.parse(itosreqdata)));
  console.log("===== stop iTOS Req Data ============");
  itosreq.write(JSON.stringify(JSON.parse(itosreqdata)));
  itosreq.end();
}

// callback(err, result)
var sendITOSRequest2 = function(hostname, path, itosreqdata, callback) {
  console.log("===== Sending iTOS Request 2 ============");
  console.log(itosreqdata);

  var request = require("request");

  var options = { method: 'POST',
    url:  'https://' + hostname + path,
    headers:
     { 'cache-control': 'no-cache',
       authorization: 'Basic S1ZMRUVNUFVUOjNOQXc2Q3c3',
       'content-type': 'application/json' },
    body: itosreqdata,
    json: true };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    console.log(body);
    // console.log(body);
    callback(error, body);
  });
}

// callback(err, result)
var sendITOSRequest3 = function(hostname, path, itosreqdata, callback) {
  console.log("===== Sending iTOS Request 3 ============");
  console.log(itosreqdata);
  var unirest = require("unirest");
  var url = "https://" + hostname + path;
  console.log("url: "+url);

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
    if (res.error) throw new Error(res.error);
    console.log("===== iTOS Request 3 RESPONSE ============");
    console.log(res.body);
    callback(res.error, res.body);
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
