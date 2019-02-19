/**
 * @file Settings page javascript
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const $table = $('#bootstrap-table');

function initBootstrapTable() {
  $table.bootstrapTable({
    url: '/api/crops/get',
    icons: {
      detailOpen: 'icon icon-chevron-right',
      detailClose: 'icon icon-chevron-down'
    },
    columns: [
      {
        field: 'name',
        title: 'Name',
        sortable: true
      },
      {
        field: 'initDay',
        title: 'Total Days',
        sortable: true,
        formatter: function (value, row) {
          return (row.initDay + row.devDay + row.midDay + row.lateDay);
        }
      },
      {
        field: 'initKc',
        title: 'Total Kc',
        sortable: true,
        formatter: function (value, row) {
          return ((row.initDay * row.initKc + row.devDay * row.devKc
                 + row.midDay * row.midKc + row.lateDay * row.lateKc).toFixed(0));
        }
      }
    ]
  });
}

function detailFormatter(index, row) {
  const html = [];

  html.push('<p>    ');
  $.each(row, function (key, value) {
    switch (key) {
      case 'numSqFt':
      case 'initDay':
      case 'initKc':
      case 'initN':
      case 'initP':
      case 'initK':
      case 'initFreq':
      case 'devDay':
      case 'devKc':
      case 'devN':
      case 'devP':
      case 'devK':
      case 'devFreq':
      case 'midDay':
      case 'midKc':
      case 'midN':
      case 'midP':
      case 'midK':
      case 'midFreq':
      case 'lateDay':
      case 'lateKc':
      case 'lateN':
      case 'lateP':
      case 'lateK':
      case 'lateFreq':
      default:
        html.push('<b>    ' + key + ':</b> ' + value);
        break;
    };
  });

  html.push('</p>');

  return html.join('');
}

$().ready(function () {
  $table.on('click-row.bs.table', function (e, row, $element) {
    $('[id=editCropModal] #editCropModalLabel').text('Edit: ' + row.name);
    $('[id=editCropModal] #numSqFt').val(row.numSqFt);
    $('[id=editCropModal] #id').val(row.id);
    $('[id=editCropModal] #name').val(row.name);
    $('[id=editCropModal] #initDay').val(row.initDay);
    $('[id=editCropModal] #initKc').val(row.initKc);
    $('[id=editCropModal] #initN').val(row.initN);
    $('[id=editCropModal] #initP').val(row.initP);
    $('[id=editCropModal] #initK').val(row.initK);
    $('[id=editCropModal] #initFreq').val(row.initFreq);
    $('[id=editCropModal] #devDay').val(row.devDay);
    $('[id=editCropModal] #devKc').val(row.devKc);
    $('[id=editCropModal] #devN').val(row.devN);
    $('[id=editCropModal] #devP').val(row.devP);
    $('[id=editCropModal] #devK').val(row.devK);
    $('[id=editCropModal] #devFreq').val(row.devFreq);
    $('[id=editCropModal] #midDay').val(row.midDay);
    $('[id=editCropModal] #midKc').val(row.midKc);
    $('[id=editCropModal] #midN').val(row.midN);
    $('[id=editCropModal] #midP').val(row.midP);
    $('[id=editCropModal] #midK').val(row.midK);
    $('[id=editCropModal] #midFreq').val(row.midFreq);
    $('[id=editCropModal] #lateDay').val(row.lateDay);
    $('[id=editCropModal] #lateKc').val(row.lateKc);
    $('[id=editCropModal] #lateN').val(row.lateN);
    $('[id=editCropModal] #lateP').val(row.lateP);
    $('[id=editCropModal] #lateK').val(row.lateK);
    $('[id=editCropModal] #lateFreq').val(row.lateFreq);

    $('[id=editCropModal] #deleteCropButton').removeClass('d-none');

    $('[id=editCropModal]').modal();
  });

  $('#editCropModal').on('hidden.bs.modal', function (e) {
    $('[id=editCropModal] #cropForm')[0].reset();
    $('[id=editCropModal] #deleteCropButton').addClass('d-none');
  });

  initBootstrapTable();

  //activate the tooltips after the data table is initialized
  $('[rel="tooltip"]').tooltip();

  $(window).resize(function () {
    $table.bootstrapTable('resetView');
  });
});
