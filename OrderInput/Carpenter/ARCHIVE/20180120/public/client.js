// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {
  /*** initialize data ***/
  const NUMBER_OF_COLS = 8;
  const COL_LOT = 0;            // Reference => LOT in iTOS
  const COL_ITEM = 1;           // Item
  const COL_TAGNBR = 2;         // Tag numbes => item no. in iTOS
  const COL_WEIGHT = 3;         // Weight (KG)
  const COL_REF = 4;            // File Nbr => SP "Reference"
  const COL_CLIENT = 5;         // Client => not transferred in iTOS (custcode)
  const COL_ENDCLIENT = 6;      // End Client
  const COL_INSTRUCTIONS = 7;   // Instructions

  var tabledata = [
    ["", "", "", "", "", "", "", "VMR STOCK"],
  ];

  var hot;
  var containerValidator = new ContainerValidator();

  async.series({
      instructions: (cb) => {loadComboValues('instructions.txt', cb);},
      endclients: (cb) => {loadComboValues('endclients.txt', cb);},
      // containertypes: (cb) => {loadComboValues('containertypes.txt', cb);},
  },
  function(err, results) {
    var container = document.getElementById('hstable');

    hot = new Handsontable(container, {
      data: tabledata,
      columns: [
                {title: "Reference"},  // iTOS LOT
                {title: "Item"},       // not transferred to iTOS
                {title: "Nbr"},       // tag number => item no. in iTOS
                {title: "Weight (KG)", type: 'numeric', format: '0.00'},
                {title: "File Nbr", width: 75}, // Stock Property REF
                {title: "Client", width: 200}, // not transferred (already in clientcode)
                {title: "End Client", type: 'dropdown', source: results.endclients, width: 200}, // Stock Property ENDCUST
                {title: "Instructions", type: 'dropdown', source: results.instructions, width: 150}, // Stock Prop WHS_INT
                // {title: "Container", width: 80, validator: (value, callback) => { callback(containerValidator.isValid(value)); }},
                ],
      minSpareRows: 1,
      rowHeaders: true,
      colHeaders: true,
      dropdownMenu: true });

      var newRowsToDefault = [];

      hot.addHook('afterCreateRow', function(index, amount, source) {
        // console.log("creating row. Index = " + index + " Source = " + source);
        if (newRowsToDefault.length === 0 && index > 0) {
          newRowsToDefault.push(index - 1);
        }
        newRowsToDefault.push(index);
      });

      hot.addHook('afterRender', function(isForced){
        // leave spare rows empty
        let sentry = hot.countRows() - hot.getSettings().minSpareRows;
        newRowsToDefault.forEach((index) => {
          if (index < sentry) {
            let val = hot.getDataAtCell(index,COL_INSTRUCTIONS);
            // console.log("value: " + val);
            if (val === null || val === '') {
              // add default value in warehouse instructions column
              hot.setDataAtCell(index, COL_INSTRUCTIONS, "VMR STOCK");
            }
          }
        });
        newRowsToDefault = [];
      });
    });

  /**  Initialize input fields **/
  /*
  loadComboValues('warehouses.txt', (err, results) =>  {
    results.forEach( (res) => {
      $("select#order-warehouse")
        .append($("<option></option")
          .attr("value", res)
          .text(res)
        );
    });
  });
  */

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

    if ((fdata.extid === undefined || fdata.extid === null || fdata.extid === '')
        || (fdata.contno === undefined || fdata.contno === null || fdata.contno === '')) {
       inputvalid = false;
       alert("Please fill in Order External Id and Container Number!");
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

  $('a#splittagnumbers').click(function(event) {
    event.preventDefault();
    var data = hot.getSourceData();

    // data.pop(); // remove last row
    let numrows = data.length - 1;
    rowindex = 0;
    for (let currentrownr = 1; currentrownr <= numrows; currentrownr++ ){
      var sourcerow = data[rowindex];
      // sourcerow[COL_TAGNBR] = "";
      var newrow = [];
      if (!Array.isArray(sourcerow)) {
        // object
        for (let i = 0; i < NUMBER_OF_COLS; i++) { newrow.push(sourcerow[i]); }
      } else {
        // array
        newrow = sourcerow.slice();
      };
      // var t1 = performance.now();
      var tagCount = parseInt(sourcerow[COL_TAGNBR]);
      if (!isNaN(tagCount) && tagCount > 1) {
        for (var i = 0; i < tagCount - 1; i++) {
          // data.push(Array.from(newrow)); //
           data.splice(rowindex + 1, 0, newrow.slice()); // much faster
           rowindex++;
        }
      }
      rowindex++;
    }
    // var t2 = performance.now();
    hot.render();
    hot.updateSettings({minSpareRows: 1}); // make sure we have empty row at end
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
    custcode: form.find( "select[id='order-custcode']" ).val(),
    extid: form.find( "input[id='order-extid']" ).val(),
    contno: form.find( "input[id='order-contno']" ).val(),
    productcode: form.find( "input[id='order-productcode']" ).val(),
    costcenter: form.find( "input[id='order-costcenter']" ).val(),
    opcode: form.find( "select[id='order-opcode']" ).val(),
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
      document.getElementById('order-extid').value  = res.extid;
      document.getElementById('order-contno').value  = res.contno;
      document.getElementById('order-productcode').value  = res.productcode;
      document.getElementById('order-costcenter').value  = res.costcenter;
      document.getElementById('order-opcode').value  = res.opcode;

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
    $('#serverresponse').append("Saved data. Order " + res.extid + " request no. " + res.requestno + ".<br/>");
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
