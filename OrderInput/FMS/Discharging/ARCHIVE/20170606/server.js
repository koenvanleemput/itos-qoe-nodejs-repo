// server.js
// where your node app starts

// init project
const PORT = 8877;
var express = require('express');
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

app.post("/data", function(req,response) {
  console.log("data post");
  var data = JSON.parse(req.body.data);
  console.log(data);

  data.products = data.products.filter(function(item, index, array){
    if (item[0] !== null && item[0] !== "")
    return item;
  });

  // console.log(data.products);

  var goods = [];

  data["products"].forEach(function(value){
    goods.push(
      {
        Status: 'Available',
        ProductCode: value[0],
        BaseQuantity: { UnitCode: value[1], Quantity: value[2] },
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
      {  ExternalId: data.oiextid,
         OperationCode: data.opcode,
         Priority: 'Normal',
         Status: 'Open',
         PlannedDate: data.planneddate,
         Goods: goods
      }
    ]
  });

  console.log(itosreqdata);

  var options = {
    "method": "POST",
    "hostname": "itos-api-uat.vanmoergroup.com",
    "port": null,
    "path": "/api/OrderImport",
    "headers": {
      "authorization": "Basic S1ZMRUVNUFVUOjNOQXc2Q3c3",
      "content-type": "application/json",
      "cache-control": "no-cache",
      "postman-token": "1d3eb3c5-cec0-9dc6-4c8b-6622e7de8ff6"
    }
  };

  var body;

  var itosreq = http.request(options, function (res) {
    var chunks = [];

    res.on("data", function (chunk) {
      chunks.push(chunk);
    });

    res.on("end", function () {
      body = Buffer.concat(chunks);
      console.log("======= in res.end =======");
      console.log(body.toString());
      response.end(body);
      // response.redirect("/");
    });
  });

  itosreq.write(itosreqdata);
  itosreq.end();


})




// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/dreams", function (request, response) {
  response.send(dreams);
  response.sendStatus(200);
});

// could also use the POST body instead of query string: http://expressjs.com/en/api.html#req.body
app.post("/dreams", function (request, response) {
  dreams.push(request.query.dream);
  response.sendStatus(200);
});

// Simple in-memory store for now
var dreams = [
  "Find and count some sheep",
  "Climb a really tall mountain",
  "Wash the dishes"
  ];

// listen for requests :)
var listener = app.listen(PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
