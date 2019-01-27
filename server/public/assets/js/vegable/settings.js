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
      detailOpen: 'fas fa-chevron-right',
      detailClose: 'fas fa-chevron-down'
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
          return ((row.initDay * row.initKc + row.devDay * row.devKc +
                 row.midDay * row.midKc + row.lateDay * row.lateKc).toFixed(0));
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
        html.push('<b>    ' + key + ':</b> ' + value);
        break;
    };
  });

  html.push('</p>');

  return html.join('');
}

$().ready(function() {
  $table.on('click-row.bs.table', function (e, row, $element) {
    var inst = $('[data-remodal-id=editCropModal]').remodal();

    $('[data-remodal-id=editCropModal] #remodalTitle').text('Edit: ' + row.name);
    $('[data-remodal-id=editCropModal] #id').val(row.id);
    $('[data-remodal-id=editCropModal] #name').val(row.name);
    $('[data-remodal-id=editCropModal] #initDay').val(row.initDay);
    $('[data-remodal-id=editCropModal] #initKc').val(row.initKc);
    $('[data-remodal-id=editCropModal] #initN').val(row.initN);
    $('[data-remodal-id=editCropModal] #initP').val(row.initP);
    $('[data-remodal-id=editCropModal] #initK').val(row.initK);
    $('[data-remodal-id=editCropModal] #initFreq').val(row.initFreq);
    $('[data-remodal-id=editCropModal] #devDay').val(row.devDay);
    $('[data-remodal-id=editCropModal] #devKc').val(row.devKc);
    $('[data-remodal-id=editCropModal] #devN').val(row.devN);
    $('[data-remodal-id=editCropModal] #devP').val(row.devP);
    $('[data-remodal-id=editCropModal] #devK').val(row.devK);
    $('[data-remodal-id=editCropModal] #devFreq').val(row.devFreq);
    $('[data-remodal-id=editCropModal] #midDay').val(row.midDay);
    $('[data-remodal-id=editCropModal] #midKc').val(row.midKc);
    $('[data-remodal-id=editCropModal] #midN').val(row.midN);
    $('[data-remodal-id=editCropModal] #midP').val(row.midP);
    $('[data-remodal-id=editCropModal] #midK').val(row.midK);
    $('[data-remodal-id=editCropModal] #midFreq').val(row.midFreq);
    $('[data-remodal-id=editCropModal] #lateDay').val(row.lateDay);
    $('[data-remodal-id=editCropModal] #lateKc').val(row.lateKc);
    $('[data-remodal-id=editCropModal] #lateN').val(row.lateN);
    $('[data-remodal-id=editCropModal] #lateP').val(row.lateP);
    $('[data-remodal-id=editCropModal] #lateK').val(row.lateK);
    $('[data-remodal-id=editCropModal] #lateFreq').val(row.lateFreq);

    inst.open();
    $('[data-remodal-id=editCropModal] #delete_action').removeClass('hide-form-button');
  });

  $(document).on('closing', '.remodal', function (e) {
    $('[data-remodal-id=editCropModal] #cropForm')[0].reset();
    $('[data-remodal-id=editCropModal] #delete_action').addClass('hide-form-button');
  });

  initBootstrapTable();

  //activate the tooltips after the data table is initialized
  $('[rel="tooltip"]').tooltip();

  $(window).resize(function () {
    $table.bootstrapTable('resetView');
  });
});
