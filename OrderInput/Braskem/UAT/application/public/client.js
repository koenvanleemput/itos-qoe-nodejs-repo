// client-side js
// run by the browser each time your view template is loaded

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

const MIN_SPARE_ROWS = 1;

$(function() {
  /*** initialize data ***/

  var tabledata = [
//    ["BRASKEM_TEST_CONTAINER5", "UTEC6540 BR25", "LOT", 25000, 20],
//    ["BRASKEM_TEST_CONTAINER6", "UTEC6540 BR25", "LOT", 12500, 10],
//    ["BRASKEM_TEST_CONTAINER6", "UTEC6540 BR25", "LOT", 5000, 8],
  ];

  var hot;
  var containerValidator = new ContainerValidator();
  var warehouseaddresses;

  async.series({
      units: (cb) => {loadComboValues('units.txt', cb);},
      containertypes: (cb) => {loadComboValues('containertypes.txt', cb);},
      // terminals: (cb) => {loadComboValues('terminals.txt', cb);},
      // depots: (cb) => {loadComboValues('depots.txt', cb);},
      warehouses: (cb) => {loadComboValues('warehouses.txt', cb);},
      // shippinglines: (cb) => {loadComboValues('shippinglines.txt', cb);},
      countrycodes: (cb) => {loadComboValues('countrycodes.txt', cb);},
      addresses: (cb) => {loadWarehouseAddresses('warehouseaddresses.txt', cb);}
  },
  function(err, results) {
    var container = document.getElementById('hstable');
    warehouseaddresses = results.addresses;

    hot = new Handsontable(container, {
      data: tabledata,
      columns: [{title: "Container", width: 80, validator: (value, callback) => { callback(containerValidator.isValid(value)); }},
                {title: "Container Type", type: 'dropdown', source: results.containertypes},
                {title: "Product Code"},
                {title: "LOT"},
                {title: "Qty Bags", type: 'numeric', format: '0.00'},
                {title: "Unit", type: 'dropdown', source: results.units},
                {title: "Article No."},
                {title: "Item No."},
                {title: "Origin Country Code", type: 'dropdown', source: results.countrycodes},
                {title: "Drop-Off Warehouse", type: 'dropdown', source: results.warehouses},
                {title: "PO Number"},
                {title: "Invoice Number"},
                {title: "Invoice From", type: 'numeric', format: '0'},
                {title: "Invoice Total", type: 'numeric', format: '0'},
                {title: "Invoice Date", width: 80, type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true},
                {title: "UnitPrice", type: 'numeric', format: '0.00'},
                {title: "UnitPrice UOM", type: 'dropdown', source: ['Tons', 'Lbs', 'KGM']},
                {title: "Invoice Currency", type: 'dropdown', source: ['EUR', 'USD']},
                {title: "Invoice Amount FOB", type: 'numeric', format: '0.00'},
                {title: "Freight Costs", type: 'numeric', format: '0.00'},
                {title: "Insurance Costs", type: 'numeric', format: '0.00'},
                {title: "Total FOB + CIF Antwerp", type: 'numeric', format: '0.00'},
                {title: "Incoterms", type: 'dropdown', source: ['C&F', 'DDP', 'CFR', 'CIF', 'FOB']},
                {title: "Other Remarks"},
                ],
      minSpareRows: MIN_SPARE_ROWS,
      rowHeaders: true,
      colHeaders: true,
      dropdownMenu: true });
  });

  /**  Initialize input fields **/
  loadComboValues('warehouses.txt', (err, results) =>  {
    results.forEach( (res) => {
      $("select#order-warehouse")
        .append($("<option></option")
          .attr("value", res)
          .text(res)
        );
    });
  });

  loadComboValues('agentcodes.txt', (err, results) =>  {
    results.forEach( (res) => {
      $("select#order-agentcode")
        .append($("<option></option")
          .attr("value", res)
          .text(res)
        );
    });
  });

  loadComboValues('isoCountryCodes.txt', (err, results) =>  {
    results.forEach( (res) => {
      $("select#order-dispatchcountry")
        .append($("<option></option")
          .attr("value", res)
          .text(res)
        );
    });
  });


  // document.getElementById('order-arrived').value = new Date().toDateInputValue();
  $("input.datepicker").datepicker({dateFormat: "yy-mm-dd"});
  // $.datepicker.setDefaults({dateFormat: "yy-mm-dd"});

  $("input.number").number(true, 2);
  $("input#invoice-from").number(true, 0);
  $("input#invoice-total").number(true, 0);

  /*** Submit Form Data ***/

  $('form#oi').submit(function(event) {
    event.preventDefault();
    var fdata = loadFormData($('form#oi'),hot);

    // checks on input
    var inputvalid = true;

    if (fdata.extid === undefined || fdata.extid === null || fdata.extid === '' ) {
       inputvalid = false;
       alert("Please fill in Order External Id!");
    }

    // check total invoice price
    for (let i = 0; i < fdata.table.length - MIN_SPARE_ROWS; i++) {
      let row = fdata.table[i];
      let total = row[COL_INVAMNT] + row[COL_FREIGHT] + row[COL_INSURANCE];
      if (total != row[COL_CIF]) {
          inputvalid = false;
          alert('ROW ' + (i+1) + ': “Total FOB + CIF Antwerp” not equal to “Invoice Amount FOB” + “Freight Costs” + “Insurance Costs”!\n' +
            total + ' <> ' + row[COL_CIF] + '. Cannot submit order.');
      }
    }

    // add address info
    fdata.address = warehouseaddresses[fdata.warehouse];

    if (inputvalid){
      // save form data  in SQLite DB
      saveFormData(fdata);

      // post data to server
      var url = $('form#oi').attr( "action" );
      $('#serverresponse').html("");
      $.post( url, { data: JSON.stringify(fdata) } ).done(displayResponse);
    }
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

  $('input#invoice-value').focusout(function (event) {
      event.preventDefault();
      $('input#invoice-fob').val($('input#invoice-value').val());
      $('input#invoice-fob').number(true, 2);
  });

  $('input#invoice-insurance').focusout(function (event) {
      event.preventDefault();
      $('input#invoice-cif').val(
        parseFloat($('input#invoice-fob').val()) +
        parseFloat($('input#invoice-frc').val()) +
        parseFloat($('input#invoice-insurance').val())
      );
      $('input#invoice-cif').number(true, 2);
  });

  $('input#invoice-from').focusout(function (event) {
      event.preventDefault();
      if ($('input#invoice-from').val() > $('input#invoice-total').val()) {
        $('input#invoice-total').val($('input#invoice-from').val());
      }
      $('input#invoice-from').number(true, 0);
  });

  $('input#invoice-total').focusout(function (event) {
      event.preventDefault();
      if ($('input#invoice-from').val() > $('input#invoice-total').val()) {
        $('input#invoice-total').val($('input#invoice-from').val());
      }
      $('input#invoice-total').number(true, 0);
  });

  // EXAMPLE FOR HANDLING KEYBOARD ENTER
  $('input#fLocation').keydown(function (event) {
    if (event.which == 13) {
        // alert('enter pressed');
        event.preventDefault();
        $('input#fInventorynumber').focus();
    }
  });

  $('a#retrieve').click(function(event) {
   event.preventDefault();
   var fdata = loadFormData($('form#oi'),hot);
   retrieveFormData(fdata, hot);
  });

  $('a#save').click(function(event) {
   event.preventDefault();
   var fdata = loadFormData($('form#oi'),hot);
   saveFormData(fdata);
  });

  $('a#testlink').click(function(event) {
   event.preventDefault();
   console.log("sending test")
   socket.send("test");
  });
});

/*** Functions ****/

var loadFormData = function(form, hot) {
  var fdata = {
    custcode: form.find( "input[id='order-custcode']" ).val(),
    opcode: form.find( "select[id='order-opcode']" ).val(),
    costcenter: form.find( "input[id='order-costcenter']" ).val(),
    extid: form.find( "input[id='order-extid']" ).val(),
    eta: form.find( "input[id='order-eta']" ).val(),
    arrived: form.find( "input[id='order-arrived']" ).val(),
    vessel: form.find( "input[id='order-vessel']" ).val(),
    voyage: form.find( "input[id='order-voyage']" ).val(),
    billoflading: form.find( "input[id='order-billoflading']" ).val(),
    quay: form.find( "select[id='order-quay']" ).val(),
    lloyd: form.find( "input[id='order-lloyd']" ).val(),
    pickup: form.find( "input[id='order-pickup']" ).val(),
    shipno: form.find( "input[id='order-shipno']" ).val(),
    agentcode: form.find( "select[id='order-agentcode']" ).val(),
    dispatchcountry: form.find( "select[id='order-dispatchcountry']" ).val(),
    // articleno: form.find( "input[id='order-articleno']" ).val(),
    // itemno: form.find( "input[id='order-itemno']" ).val(),
    warehouse: form.find( "select[id='order-warehouse']" ).val(),
    table: hot.getData()
  };
  // socket communication
  fdata.socketid = socket.id;
  return fdata;
}

var retrieveFormData = function(fdata, hot) {
  // alert("saving order entry data for " + fdata.extid);
  var url = "/entries/" + fdata.custcode + "/" + fdata.extid;

  $('#serverresponse').html("");
  hot.loadData([]);
  $.get(url, {data: JSON.stringify(fdata)}).done(function(response) {
    console.log(response);
    var res = $.parseJSON(response)[0];
    if (res === null) {
      $('#serverresponse').html("No data found for this Order.");
    } else {
      var data = $.parseJSON(res.tabledata);
      // console.log(data);
      hot.loadData(data);
      document.getElementById('order-custcode').value  = res.custcode;
      document.getElementById('order-opcode').value  = res.opcode;
      document.getElementById('order-costcenter').value  = res.costcenter;
      document.getElementById('order-extid').value  = res.extid;
      document.getElementById('order-eta').value  = res.eta;
      document.getElementById('order-arrived').value  = res.arrived;
      document.getElementById('order-vessel').value  = res.vessel;
      // document.getElementById('order-voyage').value  = res.voyage;
      document.getElementById('order-billoflading').value  = res.billoflading;
      document.getElementById('order-quay').value  = res.quay;
      document.getElementById('order-lloyd').value  = res.lloyd;
      document.getElementById('order-pickup').value  = res.pickup;
      document.getElementById('order-shipno').value  = res.shipno;
      document.getElementById('order-agentcode').value  = res.agentcode;
      document.getElementById('order-dispatchcountry').value  = res.dispatchcountry;
      // document.getElementById('order-articleno').value  = res.articleno;
      // document.getElementById('order-itemno').value  = res.itemno;
      document.getElementById('order-warehouse').value  = res.warehouse;

      $("input.number").number(true, 2);
      $('#serverresponse').html("Retrieved data.");
    }
  });
}

var saveFormData = function(fdata) {
  // alert("saving order entry data for " + fdata.extid);
  var url = "/entries";

  // clean empty rows from table
  fdata.table = fdata.table.filter(function(item, index, array){
    if (item[COL_CONT] !== null && item[COL_CONT] !== "")
    return item;
  });

  $('#serverresponse').html("");
  $.post( url, { data: JSON.stringify(fdata) } ).done(function(response){
    // console.log(response);
    var res = $.parseJSON(response)[0];
    $('#serverresponse').append("Saved data. Order " + res.extid + " request no. " + res.requestno + ".");
  });
}

var displayResponse = function(response) {
  console.log(response);
  var res = $.parseJSON(response);
  s = "";
  res.forEach(function(value) {
   s += value + "</br>";
  });
  $('#serverresponse').html(s);
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

var loadWarehouseAddresses = function(path, callback) {
  $.get(path, function(data) {
    //split on new lines
    var lines = data.split('\n');
    if (lines[lines.length-1] === "") {
        lines.pop();
    }

    let addresses = {};
    for (let i = 0; i < lines.length; i++) {
      line = lines[i].split(';');
      addresses[line[0]] = {line: line[1], zip: line[2], city: line[3], countrycode: line[4]};
    }
    callback(null, addresses);
  });
}

var socket = io.connect();

socket.on('connect', () => {
    console.log("Created socket: " + socket.id);
});

socket.on('update', function (data) {
   console.log("Received: " + data);
   $('#serverresponse').append(data + "</br>");
   // socket.emit('my other event', { my: 'data' });
 });
