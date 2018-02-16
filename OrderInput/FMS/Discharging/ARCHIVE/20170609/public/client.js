// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {

  var packinglistdata = [];
  var defaultColValues = new Array(
    "Rollen [FMSROL]",
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

  defaultRowRenderer = function (instance, td, row, col, prop, value, cellProperties) {
    Handsontable.renderers.TextRenderer.apply(this, arguments);
    if (col === 0 || col === 1 || col === 9 || col === 10 || col === 11 || col === 12 || col === 16 || col === 17 || col === 21 || col === 24 || col === 25)
    {
      if (!value || value === '' || value == null ) {
          td.innerHTML = defaultColValues[col];
      } else { defaultColValues[col] = value; }
    }
  }

  var packinglist;

  async.series({
      FMSCategories: (cb) => {loadComboValues('FMSCategory.txt', cb);},
      FMSQuality: (cb) => {loadComboValues('FMSQuality.txt', cb);},
      FMSCustoms: (cb) => {loadComboValues('FMSCustoms.txt', cb);},
      FMSProducts: (cb) => {loadComboValues('FMSProducts.txt', cb);}
  },
  function(err, results) {

      var pl = document.getElementById('packinglist');

      packinglist = new Handsontable(pl, {
        data: packinglistdata,
        columns: [

          {title: "Product", type: 'dropdown', source: results.FMSProducts},
          {title: "LOT"},
          {title: "Item#"},
          {title: "Inventory#"},
          {title: "Nett", type: 'numeric', format: '0.00'},
          {title: "Gross", type: 'numeric', format: '0.00'},
          {title: "Length", type: 'numeric', format: '0.00'},
          {title: "Width", type: 'numeric', format: '0.00'},
          {title: "Height", type: 'numeric', format: '0.00'},
          {title: "Inbound Order"},
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
          {title: "Diameter Core"},
          {title: "Color"},
          {title: "Store Comment"},
          {title: "Remark"},
          {title: "Customer Ref"},
          {title: "Transp Ref"}
                ],
        minSpareRows: 1,
        rowHeaders: true,
        colHeaders: true,
        dropdownMenu: true,
        cells: function (row, col, prop,value) {
                  var cellProperties = {};
                  cellProperties.renderer = defaultRowRenderer;
                  return cellProperties; }
    });

    });

  $('form#oi').submit(function(event) {
    event.preventDefault();
    var fdata = loadFormData($('form#oi'),packinglist);
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


var loadFormData = function(form, packinglist) {
  var fdata = {
    custcode: form.find( "input[name='order[custcode]']" ).val(),
    extid: form.find( "input[name='order[extid]']" ).val(),
    // oiextid: $form.find( "input[name='order[oiextid]']" ).val(),
    costcenter: form.find( "input[name='order[costcenter]']" ).val(),
    opcode: form.find( "input[name='order[opcode]']" ).val(),
    planneddate: form.find( "input[name='order[planneddate]']" ).val(),
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

ionValidateContainer = function(value, callback) {
  var myValidator = new ContainerValidator();
  var myBool;

  //myBool = myValidator.isValid('TEXU3070079');   // true
  //myBool = myValidator.isValid('TEXU3070070');   // false

  myBool = myValidator.isValid(value);

  callback(myBool);
}
