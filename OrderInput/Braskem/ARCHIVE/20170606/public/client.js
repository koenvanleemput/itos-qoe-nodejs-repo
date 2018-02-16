// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {
  var tabledata = [
//    ["BRASKEM_TEST_CONTAINER5", "UTEC6540 BR25", "LOT", 25000, 20],
//    ["BRASKEM_TEST_CONTAINER6", "UTEC6540 BR25", "LOT", 12500, 10],
//    ["BRASKEM_TEST_CONTAINER6", "UTEC6540 BR25", "LOT", 5000, 8],
  ];

  // var colors = $.get
  var hot;

  async.series({
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
        columns: [{title: "Container"},
                  {title: "Product Code"},
                  {title: "LOT"},
                  {title: "Net kg", type: 'numeric', format: '0.00'},
                  {title: "Qty Bags", type: 'numeric', format: '0.00'},
                  {title: "Container Type", type: 'dropdown', source: results.containertypes},
                  {title: "Pick-Up Terminal", width: 150, type: 'dropdown', source: results.terminals},
                  {title: "Pick-Up Date", type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true},
                  {title: "Pick-Up Reference"},
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

  $('form#oi').submit(function(event) {
    event.preventDefault();
    var fdata = loadFormData($('form#oi'),hot);
    var url = $('form#oi').attr( "action" );

    var inputvalid = true;

    if (fdata.extid === undefined || fdata.extid === null || fdata.extid === '') {
       inputvalid = false;
       alert("Please fill in Order External Id!");
    }

    if (inputvalid){
      $('#serverresponse').html("");
      $.post( url, { data: JSON.stringify(fdata) } ).done(displayResponse);
    }
  });

  document.getElementById('planneddate').value = new Date().toDateInputValue();

  $(document).on({
    ajaxStart: function() {  $('#busyindicator').show(); },
    ajaxStop: function() { $('#busyindicator').hide(); }
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


var loadFormData = function(form, hot) {
  var fdata = {
    custcode: form.find( "input[name='order[custcode]']" ).val(),
    extid: form.find( "input[name='order[extid]']" ).val(),
    // oiextid: $form.find( "input[name='order[oiextid]']" ).val(),
    costcenter: form.find( "input[name='order[costcenter]']" ).val(),
    opcode: form.find( "input[name='order[opcode]']" ).val(),
    planneddate: form.find( "input[name='order[planneddate]']" ).val(),
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
    var res = $.parseJSON(response);
    if (res[0] === null) {
      $('#serverresponse').html("No data found for this Order.");
    } else {
      var data = $.parseJSON(res[0].tabledata);
      // console.log(data);
      hot.loadData(data);
      $('#serverresponse').html("Retrieved data.");
    }
  });
}

var saveFormData = function(fdata) {
  // alert("saving order entry data for " + fdata.extid);
  var url = "/entries";

  $('#serverresponse').html("");
  $.post( url, { data: JSON.stringify(fdata) } ).done(displayResponse);
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
