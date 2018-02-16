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
          {title: "Product", type: 'dropdown', source: results.FMSProducts},
          {title: "LOT"},
          {title: "Item#"},
          {title: "Nett", type: 'numeric', format: '0.00'},
          {title: "Gross", type: 'numeric', format: '0.00'},
          {title: "Length", type: 'numeric', format: '0.00'},
          {title: "Width", type: 'numeric', format: '0.00'},
          {title: "Height", type: 'numeric', format: '0.00'},
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
        dropdownMenu: true
    });

    });

  document.getElementById('order-planneddate').value = new Date().toDateInputValue();

  /*** Submit Form Data ***/

  $('form#oi').submit(function(event) {
    event.preventDefault();
    var fdata = loadFormData($('form#oi'),packinglist);

    // checks on input
    var inputvalid = true;
    if (fdata.extid === undefined || fdata.extid === null || fdata.extid === '' || fdata.lictruck === undefined || fdata.lictruck === null || fdata.lictruck === '' ) {
       inputvalid = false;
       alert("Please fill in FMS Order Number AND License Plate Truck!");
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

  $('input#tpt-lictruck').focusout(function (event) {
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

  $('a#addrows').click(function(event) {
   event.preventDefault();
   var indexoflastdatarow=packinglist.countRows()-2;
   var howmanyrows=prompt("How many rows to add ?\nNew rows will copy data from last entered row.");
   if (+howmanyrows === +howmanyrows)  //Check if valid number is given
      {
        var i = 1;
        while (i <= howmanyrows)
        {
          packinglist.alter('insert_row', null, 1);
          var x = 0;
          var celldata;
          while (x <= PL_NUMBER_OF_COLS)
          {
            if (x != COL_ITEM_NR && x!= COL_NETT && x!= COL_GROSS && x!= COL_WIDTH && x!= COL_DIAMETER)
            {
            celldata = packinglist.getDataAtCell(indexoflastdatarow,x);
            packinglist.setDataAtCell(indexoflastdatarow+i,x,celldata);
            };
            x++;
          };
          i++;
        };
      }
      else {alert("invalid number !");};
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
  var url = "/entries/" + fdata.custcode + "/" + fdata.extid + "/" + fdata.lictruck;

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
