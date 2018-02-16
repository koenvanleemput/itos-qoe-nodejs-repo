// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {

  /*** initialize data ***/

  var packinglistdata = [];
  var defaultColValues = new Array(
    "FMSROL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "Free",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  );

  var defaultRowRenderer = function (instance, td, row, col, prop, value, cellProperties) {
    if (col === 0 || col === 1 || col === 8 || col === 9 || col === 10 || col === 14 || col === 15 || col === 19 || col === 22 || col === 23 || col === 24)
    {
      if (!value || value === '' || value == null ) {
          //td.innerHTML = defaultColValues[col];
          value = defaultColValues[col];
      } else { defaultColValues[col] = value; }
    }
    if (col === 0 ) {
      Handsontable.renderers.DropdownRenderer.apply(this, arguments);
    } else {
      Handsontable.renderers.TextRenderer.apply(this, arguments);
    }
  }

  function defaultValueRenderer(instance, td, row, col, prop, value, cellProperties) {
    var args = arguments;

    if (args[5] === null && isEmptyRow(instance, row)) {
      args[5] = tpl[col];
      td.style.color = '#999';
    }
    else {
      td.style.color = '';
    }
    Handsontable.renderers.TextRenderer.apply(this, args);
  }

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
          {title: "Product", type: 'dropdown', source: results.FMSProducts},
          {title: "LOT"},
          {title: "Item#"},
        //  {title: "Inventory#"},
          {title: "Nett", type: 'numeric', format: '0.00'},
          {title: "Gross", type: 'numeric', format: '0.00'},
          {title: "Length", type: 'numeric', format: '0.00'},
          {title: "Width", type: 'numeric', format: '0.00'},
          {title: "Height", type: 'numeric', format: '0.00'},
        //  {title: "Inbound Order"},
          {title: "Category", type: 'dropdown', source: results.FMSCategories},
          {title: "Contract"},
          {title: "Customer PO"},
          {title: "Diameter", type: 'numeric', format: '0.00'},
          {title: "Grammage", type: 'numeric', format: '0.00'},
          {title: "Quality", type: 'dropdown', source: results.FMSQuality},
          {title: "Customs", type: 'dropdown', source: results.FMSCustoms},
          {title: "Doc #"},
          {title: "# of Sheets", type: 'numeric', format: '0.00'},
          {title: "Core Code"},
          {title: "Diameter Core", type: 'numeric', format: '0.00'},
          {title: "Color"},
          {title: "Store Comment"},
          {title: "Remark"},
          {title: "Customer Ref"},
          {title: "Location", type: 'dropdown', source: results.FMSLocations}
        ],
        minSpareRows: 1,
        rowHeaders: true,
        colHeaders: true,
        dropdownMenu: true,
        /*cells: function (row, col, prop,value) {
                  var cellProperties = {};
                  cellProperties.renderer = defaultRowRenderer;
                  return cellProperties; }*/
    });

    });

  document.getElementById('order-planneddate').value = new Date().toDateInputValue();

  /*** Submit Form Data ***/

  $('form#oi').submit(function(event) {
    event.preventDefault();
    var fdata = loadFormData($('form#oi'),packinglist);

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

  $('a#retrieve').click(function(event) {
   event.preventDefault();
   var fdata = loadFormData($('form#oi'),packinglist);
   retrieveFormData(fdata, packinglist);
  });

  $('a#save').click(function(event) {
   event.preventDefault();
   var fdata = loadFormData($('form#oi'),packinglist);
   saveFormData(fdata);
  });

  $('a#testlink').click(function(event) {
   event.preventDefault();
   alert("test");
   console.log("test");
  });
});

/*** Functions ****/

var loadFormData = function(form, packinglist) {
  var fdata = {
    custcode: form.find( "input[id='order-custcode']" ).val(),
    extid: form.find( "input[id='order-extid']" ).val(),
    // oiextid: $form.find( "input[id='order-oiextid']" ).val(),
    costcenter: form.find( "input[id='order-costcenter']" ).val(),
    opcode: form.find( "select[id='order-opcode']" ).val(),
    planneddate: form.find( "input[id='order-planneddate']" ).val(),
    lictruck: form.find( "input[id='tpt-lictruck']" ).val(),
    lictrail: form.find( "input[id='tpt-lictrail']" ).val(),
    tptcompany: form.find( "input[id='tpt-company']" ).val(),
    table: packinglist.getData()
  }
  return fdata;
}

var retrieveFormData = function(fdata, packinglist) {
  // alert("saving order entry data for " + fdata.extid);
  var url = "/entries/" + fdata.custcode + "/" + fdata.extid;

  $('#serverresponse').html("");
  packinglist.loadData([]);
  $.get(url).done(function(response) {
    console.log(response);
    var res = $.parseJSON(response);
    if (res[0] === null) {
      $('#serverresponse').html("No data found for this Order.");
    } else {
      var data = $.parseJSON(res[0].tabledata);
      // console.log(data);
      packinglist.loadData(data);

      document.getElementById('order-costcenter').value  = res[0].costcenter;
      document.getElementById('order-opcode').value  = res[0].opcode;
      document.getElementById('order-planneddate').value  = res[0].planneddate;
      document.getElementById('tpt-lictruck').value  = res[0].lictruck;
      document.getElementById('tpt-lictrail').value  = res[0].lictrail;
      document.getElementById('tpt-company').value  = res[0].tptcompany;

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

var ionContainerValidator = function(value, callback) {
    callback(containerValidator.isValid(value));
};
