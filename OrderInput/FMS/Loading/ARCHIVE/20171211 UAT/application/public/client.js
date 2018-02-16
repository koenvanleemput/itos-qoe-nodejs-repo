// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {

  /*** initialize data ***/
  const PL_NUMBER_OF_COLS = 2;
  const COL_PRODUCT = 0;
  const COL_ITEM_NR = 1;

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
          // {title: "Container", width: 80, validator: (value, callback) => { callback(containerValidator.isValid(value)); }},
        ],
        minSpareRows: 1,
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
   socket.send("test");
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
