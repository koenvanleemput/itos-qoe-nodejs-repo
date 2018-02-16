// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {

  /*** initialize data ***/
  const PL_NUMBER_OF_COLS = 24;
  const COL_PRODUCT = 0;
  const COL_LOT = 1;
  const COL_ITEM_NR = 2;
  const COL_NETT = 3;
  const COL_GROSS = 4;
  const COL_LENGTH = 5;
  const COL_WIDTH = 6;
  const COL_HEIGHT = 7;
  const COL_CATEGORY = 8;
  const COL_CONTRACT = 9;
  const COL_PO = 10;
  const COL_DIAMETER = 11;
  const COL_GRAMMAGE = 12;
  const COL_QUALITY = 13;
  const COL_CUSTOMS = 14;
  const COL_DOC_NR = 15;
  const COL_NR_OF_SHEETS = 16;
  const COL_CORE_CODE = 17;
  const COL_CORE_DIAMETER = 18;
  const COL_COLOR = 19;
  const COL_STORE_COMMENT = 20;
  const COL_REMARK = 21;
  const COL_CUSTOMER_REF = 22;
  const COL_LOCATION = 23;

  var packinglistdata = [];
  var packinglist;
  var containerValidator = new ContainerValidator();

  async.series({
      FMSCategories: (cb) => {loadComboValues('FMSCategory.txt', cb);},
      FMSQuality: (cb) => {loadComboValues('FMSQuality.txt', cb);},
      FMSCustoms: (cb) => {loadComboValues('FMSCustoms.txt', cb);},
      FMSProducts: (cb) => {loadComboValues('FMSProducts.txt', cb);},
      FMSLocations: (cb) => {loadComboValues('FMSLocations.txt', cb);}
  },
  function(err, results) {
      var pl = document.getElementById('packinglist');

      packinglist = new Handsontable(pl, {
        data: packinglistdata,
        columns: [
          {title: "Product<sup>*</sup>", type: 'dropdown', source: results.FMSProducts, validator: notEmptyDropdownValidator(results.FMSProducts)},
          {title: "LOT<sup>*</sup>", validator: notEmptyValidator},
          // {title: "Container", width: 80, validator: (value, callback) => { callback(containerValidator.isValid(value)); }},
          {title: "Item#<sup />"},
          {title: "Net<sup>*</sup>", type: 'numeric', format: '0.00', validator: notEmptyNumericValidator},
          {title: "Gross<sup>*</sup>", type: 'numeric', format: '0.00', validator: notEmptyNumericValidator},
          {title: "Length<sup />", type: 'numeric', format: '0'},
          {title: "Width<sup />", type: 'numeric', format: '0'},
          {title: "Height<sup />", type: 'numeric', format: '0'},
          {title: "Category<sup>*</sup>", type: 'dropdown', source: results.FMSCategories, validator: notEmptyDropdownValidator(results.FMSCategories)},
          {title: "Contract<sup />"},
          {title: "Customer PO<sup />"},
          {title: "Diameter<sup />", type: 'numeric', format: '0.00'},
          {title: "Grammage<sup />", type: 'numeric', format: '0'},
          {title: "Quality<sup />", type: 'dropdown', source: results.FMSQuality},
          {title: "Customs<sup />", type: 'dropdown', source: results.FMSCustoms},
          {title: "Doc #<sup />"},
          {title: "# of Sheets<sup />", type: 'numeric', format: '0'},
          {title: "Core Code<sup />"},
          {title: "Diameter Core<sup />", type: 'numeric', format: '0.00'},
          {title: "Color<sup />"},
          {title: "Store Comment<sup />"},
          {title: "Remark<sup />"},
          {title: "Customer Ref<sup />"},
          {title: "Location<sup />", type: 'dropdown', source: results.FMSLocations},
        ],
        minSpareRows: 1,
        rowHeaders: true,
        colHeaders: true,
        dropdownMenu: true
      });

      packinglist.addHook('beforeValidate', function(val, row, prop) {
        // don't fail validation for spare row at the bottom
        if (row === packinglist.countRows() - 1) {
          if ([0, 8, 13, 14, 23].includes(prop)) { // dropdown cells
            // console.log(packinglist.getCellMeta(row, prop));
            return packinglist.getCellMeta(row, prop).source[0];
          } else if ([3, 4, 5, 6, 7, 11, 12, 16, 18]) { // numeric cells
            return 0;
          } else {
            return 'ok';
          }
        }
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
        (fdata.planneddate === undefined || fdata.planneddate === null || fdata.planneddate === '') ||
        (fdata.lictruck === undefined || fdata.lictruck === null || fdata.lictruck === '') ||
        (fdata.tptsequence === undefined || fdata.tptsequence === null || fdata.tptsequence === '')
    ) {
       formInputValid = false;
       alert("Please fill in Planned Date, FMS Order Number AND License Plate Truck!");
       return;
    }

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

  $('input#tpt-lictruck').focusout(function (event) {
      event.preventDefault();
      $('a#retrieve').trigger("click");
  });

  $('input#tpt-sequence').focusout(function (event) {
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
    newrow[COL_ITEM_NR] = "";
    newrow[COL_NETT] = "";
    newrow[COL_GROSS] = "";
    newrow[COL_WIDTH] = "";
    newrow[COL_DIAMETER] = "";
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
   socket.send("test");
  });
});

/*** Functions ****/

var loadFormData = function(form, packinglist) {
  var fdata = {
    custcode: form.find( "input[id='order-custcode']" ).val(),
    extid: form.find( "input[id='order-extid']" ).val(),
    createtransport: form.find( "input[id='tpt-create']" ).is(':checked'),
    // oiextid: $form.find( "input[id='order-oiextid']" ).val(),
    costcenter: form.find( "input[id='order-costcenter']" ).val(),
    opcode: form.find( "select[id='order-opcode']" ).val(),
    planneddate: form.find( "input[id='order-planneddate']" ).val(),
    lictruck: form.find( "input[id='tpt-lictruck']" ).val(),
    lictrail: form.find( "input[id='tpt-lictrail']" ).val(),
    tptcompany: form.find( "input[id='tpt-company']" ).val(),
    tptsequence: form.find( "input[id='tpt-sequence']" ).val(),
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
    fdata.lictruck + "/" +
    fdata.tptsequence + "?id=" + socket.id;

  $('#orderItemExternalId').html("");
  $('#transportReference').html("");
  packinglist.loadData([]);
  $.get(url).done(function(response) {
    // console.log(response);
    var res = $.parseJSON(response)[0];
    res = $.parseJSON(response);
    var row = res[0];
    var tref = res[1];
    if (row === null) {
      $('#serverresponse').append("No data found for this Order.");
    } else {
      var data = $.parseJSON(row.tabledata);

      document.getElementById('order-costcenter').value  = row.costcenter;
      document.getElementById('order-opcode').value  = row.opcode;
      document.getElementById('order-planneddate').value  = row.planneddate;
      document.getElementById('tpt-create').checked  = row.createtransport;
      document.getElementById('tpt-lictruck').value  = row.lictruck;
      document.getElementById('tpt-lictrail').value  = row.lictrail;
      document.getElementById('tpt-company').value  = row.tptcompany;
      document.getElementById('tpt-sequence').value  = row.tptsequence;
      $('#orderItemExternalId').html(row.extid + "/" + data.length + "/" + sumWeights(data));
      $('#transportReference').html(tref);

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
    $('#orderItemExternalId').html(row.extid + "/" + data.length + "/" + sumWeights(data));
    $('#transportReference').html(tref);
    $('#serverresponse').append("Saved data.</br>");
  });
}

var sumWeights = function(data) {
  // console.log("Summing weights");
  // console.log(data);
  var grossweights = data.map(row => row[4]); // 5th column in grid (but array is zero-based)
  var sum = grossweights.reduce((a,b) => parseFloat(a)+parseFloat(b), 0); // sum of weights
  return sum;
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
