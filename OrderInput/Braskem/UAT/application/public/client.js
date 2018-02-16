// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {
  /*** initialize data ***/

  var tabledata = [
//    ["BRASKEM_TEST_CONTAINER5", "UTEC6540 BR25", "LOT", 25000, 20],
//    ["BRASKEM_TEST_CONTAINER6", "UTEC6540 BR25", "LOT", 12500, 10],
//    ["BRASKEM_TEST_CONTAINER6", "UTEC6540 BR25", "LOT", 5000, 8],
  ];

  var hot;
  var containerValidator = new ContainerValidator();

  async.series({
      units: (cb) => {loadComboValues('units.txt', cb);},
      containertypes: (cb) => {loadComboValues('containertypes.txt', cb);},
      // terminals: (cb) => {loadComboValues('terminals.txt', cb);},
      // depots: (cb) => {loadComboValues('depots.txt', cb);},
      warehouses: (cb) => {loadComboValues('warehouses.txt', cb);},
      // shippinglines: (cb) => {loadComboValues('shippinglines.txt', cb);},
      countrycodes: (cb) => {loadComboValues('countrycodes.txt', cb);}
  },
  function(err, results) {
    var container = document.getElementById('hstable');

    hot = new Handsontable(container, {
      data: tabledata,
      columns: [{title: "PO Number"},
                {title: "Invoice Number"},
                {title: "Invoice From", type: 'numeric', format: '0'},
                {title: "Invoice Total", type: 'numeric', format: '0'},
                {title: "Invoice Date", width: 80, type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true},
                {title: "Invoice Amount", type: 'numeric', format: '0.00'},
                {title: "Invoice Currency", type: 'dropdown', source: ['EUR', 'USD']},
                {title: "Incoterms", type: 'dropdown', source: ['C&F', 'DDP', 'CFR', 'CIF', 'FOB']},
                {title: "FOB Antwerp", type: 'numeric', format: '0.00'},
                {title: "CIF Antwerp", type: 'numeric', format: '0.00'},
                {title: "Drop-Off Warehouse", type: 'dropdown', source: results.warehouses},
                {title: "Other Remarks"},
                {title: "Article No."},
                {title: "Item No."},
                {title: "Container", width: 80, validator: (value, callback) => { callback(containerValidator.isValid(value)); }},
                {title: "Container Type", type: 'dropdown', source: results.containertypes},
                {title: "Product Code"},
                {title: "LOT"},
                {title: "Qty Bags", type: 'numeric', format: '0.00'},
                {title: "Unit", type: 'dropdown', source: results.units},
                {title: "Origin Country Code", type: 'dropdown', source: results.countrycodes},
                {title: "UnitPrice", type: 'numeric', format: '0.00'},
                ],
      minSpareRows: 1,
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
      document.getElementById('order-voyage').value  = res.voyage;
      document.getElementById('order-billoflading').value  = res.billoflading;
      document.getElementById('order-quay').value  = res.quay;
      document.getElementById('order-lloyd').value  = res.lloyd;
      document.getElementById('order-pickup').value  = res.pickup;
      document.getElementById('order-shipno').value  = res.shipno;
      document.getElementById('order-agentcode').value  = res.agentcode;
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

var socket = io.connect();

socket.on('connect', () => {
    console.log("Created socket: " + socket.id);
});

socket.on('update', function (data) {
   console.log("Received: " + data);
   $('#serverresponse').append(data + "</br>");
   // socket.emit('my other event', { my: 'data' });
 });
