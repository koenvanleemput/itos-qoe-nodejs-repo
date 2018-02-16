// client-side js
// run by the browser each time your view template is loaded

// FMS Outbound

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

const HOSTNAME = "itos-api-uat.vanmoer.com";

/*** initialize data ***/
const PL_NUMBER_OF_COLS = 3;
const COL_PRODUCT = 0;
const COL_ITEM_NR = 1;
const COL_GROSS = 2;

const MIN_SPARE_ROWS = 1;

$(function() {

  var packinglistdata = [];
  var packinglist;
  var containerValidator = new ContainerValidator();

  async.series({
      // FMSCategories: (cb) => {loadComboValues('FMSCategory.txt', cb);},
      // FMSQuality: (cb) => {loadComboValues('FMSQuality.txt', cb);},
      // FMSCustoms: (cb) => {loadComboValues('FMSCustoms.txt', cb);},
      FMSProducts: (cb) => {loadComboValues('FMSProducts.txt', cb);},
      // FMSLocations: (cb) => {loadComboValues('FMSLocations.txt', cb);}
  },
  function(err, results) {
      var pl = document.getElementById('packinglist');

      packinglist = new Handsontable(pl, {
        data: packinglistdata,
        columns: [
          {title: "Product<sup>*</sup>", width: 75, type: 'dropdown', source: results.FMSProducts, validator: notEmptyDropdownValidator(results.FMSProducts)},
          {title: "Item no.<sup> </sup>", width: 200, validator: notEmptyValidator},
          {title: "Gross wt.<sup> </sup>", width: 200, readOnly: true},
          // {title: "Container", width: 80, validator: (value, callback) => { callback(containerValidator.isValid(value)); }},
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

      packinglist.addHook('afterSetDataAtCell', function(changes, source) {
        // changes = [[row, col, oldval, newval], ...]
        changes.forEach((change) => {
          if (change[1] === COL_ITEM_NR) {
            getStockInfo(change[3],(gross) => {
              packinglist.setDataAtCell(change[0], COL_GROSS, gross);
              document.getElementById('totalgross').innerHTML  = sumGrossWeights(packinglist.getData());
            });
          }
        })
      });
  });

  document.getElementById('order-planneddate').value = new Date().toDateInputValue();

  /*** Submit Form Data ***/

  $('form#oi').submit(function(event) {
    event.preventDefault();
    var fdata = loadFormData($('form#oi'),packinglist);

    // checks on input
    var formInputValid = true;
    if ((fdata.custcode === undefined || fdata.custcode === null || fdata.custcode === '') ||
        (fdata.extid === undefined || fdata.extid === null || fdata.extid === '') ||
        (fdata.tptreference === undefined || fdata.tptreference === null || fdata.tptreference === '') ||
        (fdata.planneddate === undefined || fdata.planneddate === null || fdata.planneddate === '')
    ) {
       formInputValid = false;
       alert("Please fill in FMS Order Number AND iTOS Transport Reference!");
       return;
    }

    // clean empty rows from table
    let table = packinglist.getSourceData();
    table = table.filter(function(item, index, array){
      if (item[COL_PRODUCT] !== null && item[COL_PRODUCT] !== "")
      return item;
    });
    packinglist.loadData(table);

    packinglist.validateCells((tableInputValid) => {
      // console.log("validateCells: "+ tableInputValid);
      if (tableInputValid){
        // save form data  in SQLite DB
        saveFormData(fdata);

        // post data to server
        var url = $('form#oi').attr( "action" );
        $('#serverresponse').html("");
        $.post( url, { data: JSON.stringify(fdata) } ).done(displayResponse);
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

  $('input#tpt-reference').focusout(function (event) {
      event.preventDefault();
      $('a#retrieve').trigger("click");
  });

  $('a#retrieve').click(function(event) {
   event.preventDefault();
   $('#serverresponse').html("");

   var fdata = loadFormData($('form#oi'),packinglist);
   retrieveFormData(fdata, packinglist);
  });

  $('a#save').click(function(event) {
   event.preventDefault();
   $('#serverresponse').html("");

   var fdata = loadFormData($('form#oi'),packinglist);
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

var loadFormData = function(form, packinglist) {
  var fdata = {
    custcode: form.find( "input[id='order-custcode']" ).val(),
    extid: form.find( "input[id='order-extid']" ).val(),
    costcenter: form.find( "input[id='order-costcenter']" ).val(),
    opcode: form.find( "select[id='order-opcode']" ).val(),
    tptreference: form.find( "input[id='tpt-reference']" ).val(),
    planneddate: form.find( "input[id='order-planneddate']" ).val(),
    table: packinglist.getData(),
    socketid: socket.id
  }
  return fdata;
}

var retrieveFormData = function(fdata, packinglist) {
  // alert("saving order entry data for " + fdata.extid);
  var url = "/entries/" +
    fdata.custcode + "/" +
    fdata.extid + "/" +
    fdata.planneddate + "/" +
    fdata.tptreference + "?id=" + socket.id;

  $('#orderItemExternalId').html("");
  $('#transportReference').html("");
  packinglist.loadData([]);
  $.get(url).done(function(response) {
    // console.log(response);
    // var res = $.parseJSON(response)[0];
    var res = $.parseJSON(response);
    var row = res[0];
    var tref = res[1];
    if (row === null) {
      $('#serverresponse').append("No data found for this Order.");
    } else {
      var data = $.parseJSON(row.tabledata);

      document.getElementById('order-costcenter').value  = row.costcenter;
      document.getElementById('order-opcode').value  = row.opcode;
      document.getElementById('order-planneddate').value  = row.planneddate;
      // TODO
      // $('#orderItemExternalId').html(row.extid + "/" + data.length + "/" + sumWeights(data));
      // TODO
      // $('#transportReference').html(tref);

      packinglist.loadData(data);

      $('#serverresponse').append("Retrieved data.</br>");
    }
  });
}

var saveFormData = function(fdata) {
  // alert("saving order entry data for " + fdata.extid);
  var url = "/entries";

  $('#orderItemExternalId').html("");
  $('#transportReference').html("");
  $.post( url, { data: JSON.stringify(fdata) } ).done(function(response){
    console.log(response);
    res = $.parseJSON(response);
    var row = res[0];
    var tref = res[1];
    var data = $.parseJSON(row.tabledata);
    // TODO
    // $('#orderItemExternalId').html(row.extid + "/" + data.length + "/" + sumWeights(data));
    // TODO
    // $('#transportReference').html(tref);
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
