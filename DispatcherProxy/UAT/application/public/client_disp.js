// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {

  /*** initialize data ***/
  const SOME_CONSTANT = 2;

  // document.getElementById('order-planneddate').value = new Date().toDateInputValue();

  /*** Submit Form Data ***/

  /*** Event handlers ***/

  $(document).on({
    ajaxStart: function() {  $('#busyindicator').show(); },
    ajaxStop: function() { $('#busyindicator').hide(); }
  });

});

/*** Functions ****/

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

var getStockInfo = function(itemno, callback) {
  let url = "/stockinfo/" + itemno;

  $.get(url).done(function(response) {
    // console.log(response);
    var res = $.parseJSON(response)[0];
    if (res) {
      var gross = res.ExtraQuantities.filter(eq => eq.UnitDescription === 'Gross')[0].Quantity;
      callback(gross);
    } else {
      callback("not found");
    };
  });
}
