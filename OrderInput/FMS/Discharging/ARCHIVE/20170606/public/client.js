// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {
  console.log('hello world :o');

  var data = [
    ["FMSPAL", "PAL", 20],
  ];

  var container = document.getElementById('hstable');

  var hot = new Handsontable(container, {
    data: data,
    columns: [{title: "Product"}, {title: "Unit"}, {title: "Amount"}],
    minSpareRows: 1,
    rowHeaders: true,
    colHeaders: true,
    dropdownMenu: true
  });

  $('form#oi').submit(function(event) {
    event.preventDefault();
    var $form = $( this );
    var fdata = {
      custcode: $form.find( "input[name='order[custcode]']" ).val(),
      extid: $form.find( "input[name='order[extid]']" ).val(),
      oiextid: $form.find( "input[name='order[oiextid]']" ).val(),
      costcenter: $form.find( "input[name='order[costcenter]']" ).val(),
      opcode: $form.find( "input[name='order[opcode]']" ).val(),
      planneddate: $form.find( "input[name='order[planneddate]']" ).val(),
      products: hot.getData()
    }
    var url = $form.attr( "action" );

    $.post( url, { data: JSON.stringify(fdata) } ).done(function( data ) {
      alert("Order submitted");
      alert(data);
    });
  });

  Date.prototype.toDateInputValue = (function() {
    var local = new Date(this);
    local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
    return local.toJSON().slice(0,10);
  });

  document.getElementById('planneddate').value = new Date().toDateInputValue();

});
