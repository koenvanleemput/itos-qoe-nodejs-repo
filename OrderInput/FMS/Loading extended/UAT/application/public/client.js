// client-side js
// run by the browser each time your view template is loaded

// FMS Outbound

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

const HOSTNAME = "itos-api-uat.vanmoer.com";

/*** initialize data ***/
/*** packing list columns ***/
const PL_NUMBER_OF_COLS = 16;
const COL_PL_PRODUCT = 0;
const COL_PL_INBOUNDTR = 1;
const COL_PL_DATEIN = 2;
const COL_PL_QOE_NR = 3;
const COL_PL_ITEM_NO = 4;
const COL_PL_LOT = 5;
const COL_PL_QUALITY = 6;
const COL_PL_REMARK = 7;
const COL_PL_UNWIND = 8;
const COL_PL_LOCATION = 9;
const COL_PL_NET = 10;
const COL_PL_GROSS = 11;
const COL_PL_LENGTH = 12;
const COL_PL_WIDTH = 13;
const COL_PL_GRAMMAGE = 14;
const COL_PL_INVENTORYNO = 15;

/*** transport list columns ***/
const TL_NUMBER_OF_COLS = 5;
const COL_TL_REF = 0;
const COL_TL_QOE_NR = 1;
const COL_TL_ITEMS = 2;
const COL_TL_GROSS = 3;
const COL_TL_VGM = 4;

/*** planned goods list columns ***/
const PG_NUMBER_OF_COLS = 10;
const COL_PG_PRODUCT = 0;
const COL_PG_LOT = 1;
const COL_PG_QUALITY = 2;
const COL_PG_LENGTH = 3;
const COL_PG_WIDTH = 4;
const COL_PG_GRAMMAGE = 5;
const COL_PG_CUSTSTATUS = 6;
const COL_PG_REQ_AMNT = 7;
const COL_PG_SEL_AMNT = 8;
const COL_PG_GROSS_SUM = 9;

/*** transport summary list columns ***/
const TS_NUMBER_OF_COLS = 3;
const COL_TS_REF = 0;
const COL_TS_ITEMS = 1;
const COL_TS_GROSS = 3;

const MIN_SPARE_ROWS = 1;

$(function() {

  var packinglist;
  var transportlist;
  var plannedgoods;
  var transportsummary;
  var containerValidator = new ContainerValidator();

  async.series({
      // FMSCategories: (cb) => {loadComboValues('FMSCategory.txt', cb);},
      FMSQuality: (cb) => {loadComboValues('FMSQuality.txt', cb);},
      FMSCustoms: (cb) => {loadComboValues('FMSCustoms.txt', cb);},
      FMSProducts: (cb) => {loadComboValues('FMSProducts.txt', cb);},
      // FMSLocations: (cb) => {loadComboValues('FMSLocations.txt', cb);}
  },
  function(err, results) {
      // -----------------  Set up packing list table ------------------- //
      var pl = document.getElementById('packinglist');

      packinglist = new Handsontable(pl, {
        data: [],
        columns: [
          {title: "Product", readOnly: true},
          {title: "Inbound Transport", readOnly: true},
          {title: "DateIn", readOnly: true},
          {title: "QoE no."},
          {title: "Item no.", readOnly: true},
          {title: "Lot", readOnly: true},
          {title: "Quality", readOnly: true},
          {title: "Remark", readOnly: true},
          {title: "Unwind", readOnly: true},
          {title: "Location", readOnly: true},
          {title: "Net wt.", readOnly: true},
          {title: "Gross wt.", readOnly: true},
          {title: "Length", readOnly: true},
          {title: "Width", readOnly: true},
          {title: "Grammage", readOnly: true},
          {title: "Inventory no.", readOnly: true},
          // {title: "Container", width: 80, validator: (value, callback) => { callback(containerValidator.isValid(value)); }},
        // Product	Inbound Transport	DateIn	QoE nbr	Item Nbr	Lot	Quality	Remark	Unwind	Location	Net	Gross	Length	Width	Grammage	Inventory No.
        ],
        minSpareRows: MIN_SPARE_ROWS,
        rowHeaders: true,
        colHeaders: true,
        dropdownMenu: true
      });

      packinglist.addHook('beforeValidate', function(val, row, prop) {
        // don't fail validation for spare row at the bottom
        if (row === packinglist.countRows() - 1) {
          if ([0].includes(prop)) { // dropdown cells
            // console.log(packinglist.getCellMeta(row, prop));
            return packinglist.getCellMeta(row, prop).source[0];
          } else {
            return 'ok';
          }
        }
      });

      // -----------------  Set up transport list table ------------------- //
      var tl = document.getElementById('transportlist');

      transportlist = new Handsontable(tl, {
        data: [],
        columns: [
          {title: "Reference", width: 100},
          {title: "QoE No.", type: 'numeric'},
          {title: "#Items", readOnly: true},
          {title: "Product Gross", readOnly: true},
          {title: "VGM", readOnly: true},
        ],
        minSpareRows: MIN_SPARE_ROWS,
        rowHeaders: true,
        colHeaders: true,
        dropdownMenu: true
      });

      // -----------------  Set up planned goods / stock filter table ------------------- //
      var pg = document.getElementById('plannedgoods');

      plannedgoods = new Handsontable(pg, {
        data: [],
        columns: [
          {title: "Product", width: 80, type: 'dropdown', source: results.FMSProducts},
          {title: "Lot", width: 100},
          {title: "Quality", width: 150, type: 'dropdown', source: results.FMSQuality},
          {title: "Length", type: 'numeric', numericFormat: {pattern: '0'}},
          {title: "Width", type: 'numeric', numericFormat: {pattern: '0'}},
          {title: "Grammage", type: 'numeric', numericFormat: {pattern: '0.00'}},
          {title: "Customs status", width: 80, type: 'dropdown', source: results.FMSCustoms},
          {title: "# Requested", type: 'numeric', numericFormat: {pattern: '0'}},
          {title: "# Selected", type: 'numeric', numericFormat: {pattern: '0'}, readOnly: true},
          {title: "Sum Gross", type: 'numeric', numericFormat: {pattern: '0.00'}, readOnly: true},
        ],
        minSpareRows: MIN_SPARE_ROWS,
        rowHeaders: true,
        colHeaders: true,
        dropdownMenu: true
      });

      // -----------------  Set up transport summary table ------------------- //
      var ts = document.getElementById('transportsummary');

      transportsummary = new Handsontable(ts, {
        data: [],
        columns: [
          {title: "Reference", width: 100, readOnly: true},
          {title: "#Items", readOnly: true},
          {title: "Gross", readOnly: true},
        ],
        minSpareRows: MIN_SPARE_ROWS,
        rowHeaders: true,
        colHeaders: true,
        dropdownMenu: true
      });


  });

  document.getElementById('order-planneddate').value = new Date().toDateInputValue();

  /*** Submit Form Data ***/

  $('form#oi').submit(function(event) {
    event.preventDefault();
    var fdata = loadFormData($('form#oi'),transportlist, plannedgoods, transportsummary, packinglist);

    // checks on input fields
    var formInputValid = true;
    if ((fdata.custcode === undefined || fdata.custcode === null || fdata.custcode === '') ||
        (fdata.opcode === undefined || fdata.opcode === null || fdata.opcode === '') ||
        (fdata.costcenter === undefined || fdata.costcenter === null || fdata.costcenter === '') ||
        (fdata.extid === undefined || fdata.extid === null || fdata.extid === '') ||
        (fdata.planneddate === undefined || fdata.planneddate === null || fdata.planneddate === '')
    ) {
       formInputValid = false;
       alert("Please fill in FMS Order Number!");
       return;
    }

    // get Transport References
    let qoeTransports = {};
    let transportlistdata = transportlist.getSourceData();
    for (let i = 0; i < transportlistdata.length; i++) {
      let tref = transportlistdata[i][COL_TL_REF];
      let tnr = transportlistdata[i][COL_TL_QOE_NR];
      if (tref !== undefined && tref !== null && tref !== '' &&
          tnr !== undefined && tnr !== null && tnr !== '') {
        qoeTransports[tnr] = tref;
      }
    };
    console.log("Transports: " + JSON.stringify(qoeTransports));

    // clean empty rows from table
    let pl = packinglist.getSourceData();
    pl = pl.filter(function(item, index, array){
      if (item[COL_PL_PRODUCT] !== null && item[COL_PL_PRODUCT] !== "")
      return item;
    });
    packinglist.loadData(pl);

    packinglist.validateCells((tableInputValid) => {
      // console.log("validateCells: "+ tableInputValid);
      if (tableInputValid){
        // save form data  in SQLite DB
        saveFormData(fdata);

        // post data to server
        var url = $('form#oi').attr( "action" );  // url = "/data"
        $('#serverresponse').html("");

        async.eachOfSeries(qoeTransports,(tref, key, callback) => {
          console.log(JSON.stringify(tref));

          // filter goods on this transport from packing list
          let transportgoods = packinglist.getSourceData().filter(function(item, index, array){
            if (item[COL_PL_QOE_NR] === key)
              return item;
          });
          // console.log('filtered data for this transport');
          // console.log(JSON.stringify(transportgoods));

          let transportdata = {
            custcode: fdata.custcode,
            extid: fdata.extid,
            costcenter: fdata.costcenter,
            opcode: fdata.opcode,
            tptreference: tref,
            planneddate: fdata.planneddate,
            packinglist: transportgoods,
            socketid: fdata.socketid
          };

          document.getElementById('totalgross').innerHTML  = "Submitting Transport " + key + " " + tref;
          $.post( url, { data: JSON.stringify(transportdata) } ).done((res) => {
            displayResponse(res);
            callback(null); // no error
          });
        }, (err) => {
          if (err) console.log(err);
          document.getElementById('totalgross').innerHTML  = "Submitted all...";
        });

      } else {
        alert("Please fill in required table data correctly!");
        return;
      }
    });
  });

  /*** Event handlers ***/

  $(document).on({
    ajaxStart: function() {  $('#busyindicator').show(); },
    ajaxStop: function() { $('#busyindicator').hide(); }
  });

  $('input#order-extid').focusout(function (event) {
      event.preventDefault();
      $('a#retrieve').trigger("click");
  });

  $('a#retrieve').click(function(event) {
   event.preventDefault();
   $('#serverresponse').html("");

   var fdata = loadFormData($('form#oi'),transportlist, plannedgoods, transportsummary, packinglist);
   retrieveFormData(fdata, transportlist, plannedgoods, transportsummary, packinglist);
  });

  $('a#save').click(function(event) {
   event.preventDefault();
   $('#serverresponse').html("");

   var fdata = loadFormData($('form#oi'),transportlist, plannedgoods, transportsummary, packinglist);
   saveFormData(fdata);
  });

  $('a#addrows').click(function(event) {
    event.preventDefault();
    var userinput=prompt("How many rows to add ?\nNew rows will copy data from last entered row.");
    var howmanyrows = parseInt(userinput);
    if (isNaN(howmanyrows) || howmanyrows < 1) {
     alert("invalid number !");
    }

    var data = packinglist.getSourceData();

    data.pop(); // remove last row
    var lastrow = data[data.length-1];
    var newrow = [];
    if (!Array.isArray(lastrow)) {
      // object
      for (let i = 0; i < PL_NUMBER_OF_COLS; i++) { newrow.push(lastrow[i]); }
    } else {
      // array
      newrow = lastrow.slice();
    };
    // var t1 = performance.now();
    for (var i = 0; i < howmanyrows; i++) {
      // data.push(Array.from(newrow)); //
       data.push(newrow.slice()); // much faster
    }
    // var t2 = performance.now();
    packinglist.render();
    packinglist.updateSettings({minSpareRows: 1}); // make sure we have empty row at end
  });

  $('a#searchstock').click(function(event) {
    event.preventDefault();

    packinglist.loadData([]);
    document.getElementById('totalgross').innerHTML  = "Getting stock...";

    let searchResults = {};

    let plannedgoodsdata = plannedgoods.getSourceData();

    async.eachOf(plannedgoodsdata,(plannedgood, key, callback) => {
      if (key < (plannedgoodsdata.length - MIN_SPARE_ROWS)) {
        let productid;
        if (plannedgoodsdata[key][COL_PG_PRODUCT] == 'FMSROL') {
          productid = 7183;
        } else if (plannedgoodsdata[key][COL_PG_PRODUCT] === 'FMSPAL') {
          productid = 7182;
        }

        let filter = {
          ProductId: productid,
          Lot: plannedgoodsdata[key][COL_PG_LOT],
          Sids: [
            {SidId: 62, Value: plannedgoodsdata[key][COL_PG_QUALITY], ExactMatch: false},
            {SidId: 79, Value: plannedgoodsdata[key][COL_PG_LENGTH], ExactMatch: false},
            {SidId: 50, Value: plannedgoodsdata[key][COL_PG_WIDTH], ExactMatch: false},
            {SidId: 60, Value: plannedgoodsdata[key][COL_PG_GRAMMAGE], ExactMatch: false},
            {SidId: 13, Value: plannedgoodsdata[key][COL_PG_CUSTSTATUS], ExactMatch: false},
          ]
        }

        // clear empty values
        for (let key in filter) {
          if (filter[key] === undefined || filter[key] === null || filter[key] === '') {
            delete filter[key];
          }
        }
        filter.Sids = filter.Sids.filter(function(item, index, array){
          if (item.Value !== undefined && item.Value !== null && item.Value !== '')
            return item;
        });

        getStock(filter, (stock) => {
          console.log("received stock");
          document.getElementById('totalgross').innerHTML  = "Received stock...";
          let data = [];

          stock.forEach((item) => {
            // console.log(item);
            let gross = item.ExtraQuantities.filter(eq => eq.UnitDescription === 'Gross')[0].Quantity;
            let net = item.ExtraQuantities.filter(eq => eq.UnitDescription === 'Net')[0].Quantity;
            let sids = {};
            item.Sids.forEach((sid) => {
              sids[sid.Description] = sid.Value;
            });
            data.push([item.ProductCode, sids["Transport reference"], item.DateIn, '', item.ItemNumber, item.Lot,
              sids["Quality"], sids["Remark"], sids["Unwind"], item.LocationName, net, gross, sids["Length"],
              sids["Width"], sids["Grammage"], item.InventoryNumber ])
          });
          searchResults[key] = data;
          callback(null);
        });
      } else {
        // SPARE ROWS
        callback(null);
      }
    }, (err) => {
      if (err) console.log(err);
      let data = [];
      for (let i = 0; i < plannedgoodsdata.length - MIN_SPARE_ROWS; i++) {
        searchResults[i].forEach((row) => {
          data.push(row);
        })
      }
      packinglist.loadData(data);
      $('a#unique').trigger("click");
      $('a#sort').trigger("click");

      document.getElementById('totalgross').innerHTML  = "Loaded stock...";
    });
  });

  // Filter Unique 2D array
  $('a#unique').click(function(event) {
    event.preventDefault();

    let packinglistdata = packinglist.getSourceData();
    packinglist.loadData(filterUniquePackingList(packinglistdata));
  });

  $('a#sort').click(function(event) {
    event.preventDefault();

    let packinglistdata = packinglist.getSourceData();
    sortPackingList(packinglistdata);
    packinglist.render();
  });


  $('a#testlink').click(function(event) {
    event.preventDefault();

    document.getElementById('totalgross').innerHTML  = "Calculating..";

    let data = packinglist.getData();
    let itemnumbers = data.map(row => row[COL_ITEM_NR]);
    for (let i = 0; i < MIN_SPARE_ROWS; i++) { itemnumbers.pop(); }
    console.log(itemnumbers);
    // var sum = grossweights.reduce((a,b) => parseFloat(a)+parseFloat(b), 0); // sum of weights

    itemnumbers.forEach((itemno, idx) => {
      getStockInfo(itemno,(gross) => {
        packinglist.setDataAtCell(idx, COL_GROSS, gross);
        document.getElementById('totalgross').innerHTML  = sumGrossWeights(data);
      });
    });
  });
});

/*** Functions ****/

var loadFormData = function(form, transportlist, plannedgoods, transportsummary, packinglist) {
  var fdata = {
    custcode: form.find( "input[id='order-custcode']" ).val(),
    extid: form.find( "input[id='order-extid']" ).val(),
    costcenter: form.find( "input[id='order-costcenter']" ).val(),
    opcode: form.find( "select[id='order-opcode']" ).val(),
    tptreference: form.find( "input[id='tpt-reference']" ).val(),
    planneddate: form.find( "input[id='order-planneddate']" ).val(),
    transportlist: transportlist.getData(),
    plannedgoods: plannedgoods.getData(),
    transportsummary: transportsummary.getData(),
    packinglist: packinglist.getData(),
    socketid: socket.id
  }
  return fdata;
}

var retrieveFormData = function(fdata, transportlist, plannedgoods, transportsummary, packinglist) {
  // alert("retrieving order entry data for " + fdata.extid);
  var url = "/entries/" +
    fdata.custcode + "/" +
    fdata.extid + "/" +
    fdata.planneddate + "?id=" + socket.id;

  transportlist.loadData([]);
  plannedgoods.loadData([]);
  transportsummary.loadData([]);
  packinglist.loadData([]);

  $.get(url).done(function(response) {
    // console.log(response);
    // var res = $.parseJSON(response)[0];
    let res = $.parseJSON(response);
    let row = res[0];
    if (row === null) {
      $('#serverresponse').append("No data found for this Order.");
    } else {
      document.getElementById('order-costcenter').value  = row.costcenter;
      document.getElementById('order-opcode').value  = row.opcode;
      document.getElementById('order-extid').value  = row.extid;
      document.getElementById('order-planneddate').value  = row.planneddate;

      transportlist.loadData($.parseJSON(row.transportlist));
      plannedgoods.loadData($.parseJSON(row.plannedgoods));
      transportsummary.loadData($.parseJSON(row.transportsummary));
      packinglist.loadData($.parseJSON(row.packinglist));
      $('#serverresponse').append("Retrieved data.</br>");
    }
  });
}

var saveFormData = function(fdata) {
  // alert("saving order entry data for " + fdata.extid);
  var url = "/entries";

  $.post( url, { data: JSON.stringify(fdata) } ).done(function(response){
    // console.log(response);
    res = $.parseJSON(response);
    $('#serverresponse').append("Saved data.</br>");
  });
}

var displayResponse = function(response) {
  console.log(response);
  var res = $.parseJSON(response);
  s = "";
  res.forEach(function(value) {
   s += value + "</br>";
  });
  $('#serverresponse').append(s);
}

var sumGrossWeights = function(data) {
  // console.log("Summing weights");
  // console.log(data);
  var grossweights = data.map(row => row[COL_GROSS]);
  var sum = grossweights.reduce((a,b) => parseFloatOrZero(a)+parseFloatOrZero(b), 0); // sum of weights
  return sum;
}

var sortPackingList = function(packinglist) {
  console.log("starting sort");
  // console.log(packinglist);

  // sort first by TREF then by ITEMNO.
  packinglist.sort(function (a, b) {
    if (a[COL_PL_PRODUCT] === null) return 1;
    if (b[COL_PL_PRODUCT] === null) return -1;

    let aRef = a[COL_PL_INBOUNDTR];
    let bRef = b[COL_PL_INBOUNDTR];
    if (aRef === null) {
      if (bRef === null) {
        return 0;
      }
      return -1;
    } else if (bRef === null) {
      return 1;
    }
    let tRefComp = aRef.localeCompare(bRef);
    if (tRefComp === 0) {
      let aItem = a[COL_PL_ITEM_NO];
      let bItem = b[COL_PL_ITEM_NO];
      if (aItem === null) {
        if (bItem === null) {
          return 0;
        }
        return -1;
      } else if (bItem === null) {
        return 1;
      }
      return aItem.localeCompare(bItem);
    }
    return tRefComp;
  });

  console.log('done sorting');
  // console.log(packinglist);
}

// crude function to filter out duplicate lines in a packing list
var filterUniquePackingList = function(packinglist) {
  console.log('filtering unique packinglist');
  // console.log(packinglist);

  let filteredPL = packinglist.filter(function (value, index, self) {
    // check previous rows for identical row with lower index - reverse loop
    for (let i = index - 1; i >= 0; i--) {
      let row = packinglist[i];
      // first check on item no.
      if (row[COL_PL_ITEM_NO] === value[COL_PL_ITEM_NO]) {
        // then check other columns
        let identical = true;
        for (let j = 0; j < row.length; j++) {
          if (row[j] !== value[j]) {
            identical = false;
            break;
          }
        }
        if (identical) {
          // found identical row with lower index, discard this one
          return false;
        }
      }
    }
    // no identical row with lower index exists, can keep this one
    return true;
  });

  console.log('done filtering unique');
  // console.log(filteredPL);

  return filteredPL;
}

var parseFloatOrZero = function(a) {
  let r = parseFloat(a);
  if (isNaN(r)) {
    return 0.0;
  } else {
    return r;
  }
}


var loadComboValues = function(path, callback) {
  $.get(path, function(data) {
    //split on new lines
    var array = data.split('\n');
    if (array[array.length-1] === "") {
        array.pop();
    }
    // console.log(array);
    callback(null, array);
  });
}

var getStock = function(filter, callback) {
  console.log("Stock filter: " + JSON.stringify(filter));
  let url = "/stockinfo?" + $.param(filter);

  // console.log('***** ' + url + ' *****');

  $.get(url).done(function(response) {
    // console.log(response);
    let stock = $.parseJSON(response);
    callback(stock);
  });
}

var getStockInfo = function(itemno, callback) {
  let url = "/stockinfo/" + itemno;

  $.get(url).done(function(response) {
    // console.log(response);
    var res = $.parseJSON(response)[0];
    if (res) {
      var gross = res.ExtraQuantities.filter(eq => eq.UnitDescription === 'Gross')[0].Quantity;
      callback(gross);
    } else {
      callback("not found");
    };
  });
}

var ionContainerValidator = function(value, callback) {
    callback(containerValidator.isValid(value));
};

// validator that validates non-empty cells
var notEmptyValidator = function (value, callback) {
   if (value === undefined || value === null || value === '') {
     callback(false);
   } else {
     callback(true);
   }
};

// validator that validates non-empty Numeric cells
var notEmptyNumericValidator = function (value, callback) {
   if (value === undefined || value === null || value === '' || isNaN(value)) {
     callback(false);
   } else {
     callback(true);
   }
 };

// returns a validator that validates both non-emptiness and dropdown list values
var notEmptyDropdownValidator = (list) => (value, callback) => {
  if (value === undefined || value === null || value === '') {
    callback(false);
  } else if (!list.includes(value)) {
    callback(false);
  } else {
    callback(true);
  }
};

// Set up socket communication
var socket = io.connect();

socket.on('connect', () => {
    console.log("Socket connected: " + socket.id);
});

socket.on('update', function (data) {
   console.log("Received: " + data);
   $('#serverresponse').append(data + "</br>");
   // socket.emit('my other event', { my: 'data' });
 });
