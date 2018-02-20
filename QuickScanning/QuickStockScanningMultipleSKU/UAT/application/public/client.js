// client-side js
// run by the browser each time your view template is loaded

// by default, you've got jQuery,
// add other scripts at the bottom of index.html

$(function() {
  $('#stockinfo').hide();

  $('input#fLocation').focus();

  loadData();

  $('form#formNippon').submit(function(event) {
    event.preventDefault();
    var fLocation = $('input#fLocation').val();
    var fInventorynumber = $('input#fInventorynumber').val();
    var fRemark = $('input#fRemark').val();
    var inputvalid = true;

    if (fRemark === undefined || fRemark === null || fRemark === '') {
      if (fInventorynumber === undefined || fInventorynumber === null || fInventorynumber === '' ||
          fLocation === undefined || fLocation === null || fLocation === '') {
        inputvalid = false
        alert("Fill in location and inventorynumber!");
      }
    } else {
      if ((fInventorynumber === undefined || fInventorynumber === null || fInventorynumber === '') &&
          (fLocation === undefined || fLocation === null || fLocation === '')) {
        inputvalid = false;
        alert("Fill in location OR inventorynumber!");
      }
    }

    if (inputvalid) {
      // clear inventory number field - leave location
      $('input#fInventorynumber').val('');
      // $('input#fLocation').val('');

      // Give inventory number focus
      $('input#fInventorynumber').focus();
      // $('input#fLocation').focus();

      $.post('/stock?' + $.param({fInventorynumber:fInventorynumber,fLocation:fLocation,fRemark:fRemark}), function(response) {
        var rStock = $.parseJSON(response);
        // console.log(response);
        // console.log(rStock);
        $('<li></li>').text(rStock.id + ";" + rStock.location + ";" + rStock.inventorynumber + ";" + rStock.remark + ";" + rStock.createdAt).prependTo('ul#stock');

        $('input#fRemark').val('');

      }).fail(function(response) {
        // console.log(response);
        alert(response.responseText);
      });
    }
  });

  $('input#fLocation').click(function (event) {
    event.preventDefault();
    this.setSelectionRange(0, this.value.length);
  });

  $('input#fInventorynumber').click(function (event) {
    event.preventDefault();
    this.setSelectionRange(0, this.value.length);
  });

  $('input#fLocation').keydown(function (event) {
    if (event.which == 13) {
        // alert('enter pressed');
        event.preventDefault();
        $('input#fInventorynumber').focus();
    }
  });

  $('a#aQuery').click(function(event) {
    event.preventDefault();
    $.post('/query', function(response) {
      // console.log(response);
      alert(response);
    });
  });

  $('a#aClear').click(function(event) {
    event.preventDefault();
    if (confirm("Are you sure?")) {
      $.post('/clear', function(response) {
        // console.log(response);
        alert(response);
        loadData();
      });
    } else {
      alert("You cancelled the deletion of data.  No data deleted!");
    }
  });

  $('a#aShow').click(function(event) {
    event.preventDefault();
    var fInventorynumber = $('input#fInventorynumber').val();
    $.get('/inventory?' + $.param({fInventorynumber:fInventorynumber}),  function(response) {
      console.log(response);
      // alert('gotten');
      $('#stockdetails').text(JSON.stringify(JSON.parse(response),undefined,2));
      $('#stockinfo').show();
    });
  });

  $('a#aHide').click(function(event) {
    event.preventDefault();
    $('#stockdetails').text('');
    $('#stockinfo').hide();
  });

});

/*** Functions ****/

var loadData = function() {
  document.getElementById("stock").innerHTML = "";
  $.get('/stock', function(stocks) {
    stocks.forEach(function(stock) {
      // [id, location, inventorynumber, remark, createdAt]
      $('<li></li>').text(stock[0] + ";" + stock[1]+ ";" + stock[2]+ ";" + stock[3] + ";" + stock[4]).appendTo('ul#stock');
    });
  });
}
