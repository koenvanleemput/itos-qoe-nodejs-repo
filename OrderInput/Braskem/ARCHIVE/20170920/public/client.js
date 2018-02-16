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
      terminals: (cb) => {loadComboValues('terminals.txt', cb);},
      depots: (cb) => {loadComboValues('depots.txt', cb);},
      warehouses: (cb) => {loadComboValues('warehouses.txt', cb);},
      shippinglines: (cb) => {loadComboValues('shippinglines.txt', cb);},
      countrycodes: (cb) => {loadComboValues('countrycodes.txt', cb);}
  },
  function(err, results) {
    var container = document.getElementById('hstable');

    hot = new Handsontable(container, {
      data: tabledata,
      columns: [{title: "Container",
                validator: (value, callback) => {
                  callback(containerValidator.isValid(value));
                }},
                {title: "Product Code"},
                {title: "LOT"},
                {title: "Qty Bags", type: 'numeric', format: '0.00'},
                {title: "Unit", type: 'dropdown', source: results.units},
                {title: "Container Type", type: 'dropdown', source: results.containertypes},
                {title: "Pick-Up Terminal", width: 150, type: 'dropdown', source: results.terminals},
                {title: "Pick-Up Date", type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true},
                {title: "Pin Code"},
                {title: "Drop-Off Depot", type: 'dropdown', source: results.depots},
                {title: "Drop-Off Reference"},
                {title: "Warehouse", type: 'dropdown', source: results.warehouses},
                {title: "Shipping Line", type: 'dropdown', source: results.shippinglines},
                {title: "Origin Country Code", type: 'dropdown', source: results.countrycodes}],
      minSpareRows: 1,
      rowHeaders: true,
      colHeaders: true,
      dropdownMenu: true });
  });

  /**  Initialize input fields **/
  document.getElementById('order-planneddate').value = new Date().toDateInputValue();
  $("input.datepicker").datepicker({dateFormat: "yy-mm-dd"});
  // $.datepicker.setDefaults({dateFormat: "yy-mm-dd"});


  $("input.number").number(true, 2);

  /*** Submit Form Data ***/

  $('form#oi').submit(function(event) {
    event.preventDefault();
    var fdata = loadFormData($('form#oi'),hot);

    // checks on input
    var inputvalid = true;

    if (fdata.extid === undefined || fdata.extid === null || fdata.extid === '') {
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
   alert("test");
   console.log("test");
  });
});

/*** Functions ****/

var loadFormData = function(form, hot) {
  var fdata = {
    custcode: form.find( "input[id='order-custcode']" ).val(),
    opcode: form.find( "input[id='order-opcode']" ).val(),
    costcenter: form.find( "input[id='order-costcenter']" ).val(),
    extid: form.find( "input[id='order-extid']" ).val(),
    planneddate: form.find( "input[id='order-planneddate']" ).val(),
    invoicenumber: form.find("input[id='invoice-number']").val(),
    invoicedate: form.find("input[id='invoice-date']").val(),
    invoicevalue: form.find("input[id='invoice-value']").val(),
    invoicecurrency: form.find("select[id='invoice-currency']").val(),
    invoicefob: form.find("input[id='invoice-fob']").val(),
    invoicefrc: form.find("input[id='invoice-frc']").val(),
    invoiceinsurance: form.find("input[id='invoice-insurance']").val(),
    invoicecif: form.find("input[id='invoice-cif']").val(),
    customsdocnr: form.find("input[id='customs-docnr']").val(),
    table: hot.getData()
  }
  return fdata;
}

var retrieveFormData = function(fdata, hot) {
  // alert("saving order entry data for " + fdata.extid);
  var url = "/entries/" + fdata.custcode + "/" + fdata.extid;

  $('#serverresponse').html("");
  hot.loadData([]);
  $.get(url).done(function(response) {
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
      document.getElementById('order-planneddate').value  = res.planneddate;

      document.getElementById('invoice-number').value  = res.invoicenumber;
      document.getElementById('invoice-date').value  = res.invoicedate;
      document.getElementById('invoice-value').value  = res.invoicevalue;
      document.getElementById('invoice-currency').value  = res.invoicecurrency;
      document.getElementById('invoice-fob').value  = res.invoicefob;
      document.getElementById('invoice-frc').value  = res.invoicefrc;
      document.getElementById('invoice-insurance').value  = res.invoiceinsurance;
      document.getElementById('invoice-cif').value  = res.invoicecif;

      document.getElementById('customs-docnr').value  = res.customsdocnr;

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
    $('#serverresponse').html("Saved data. Order " + res.extid + " request no. " + res.requestno + ".");
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
