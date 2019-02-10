/**
 * @file Plantings page javascript
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const $table = $('#bootstrap-table');

function initBootstrapTable() {
  $.getJSON('/api/zones/get', (zones) => {
    $.getJSON('/api/crops/get', (crops) => {
      $table.bootstrapTable({
        url: '/api/plantings/get',
        columns: [
          {
            field: 'date',
            title: 'Planting Date',
            sortable: true,
            formatter: dateFormatter
          },
          {
            field: 'title',
            title: 'Title',
            sortable: true
          },
          {
            field: 'zid',
            title: 'Zone',
            sortable: true,
            formatter: function (value) {
              let zone = value;
              for (let i = 0; i < zones.length; i++) {
                if (zones[i].id === value) {
                  zone = zones[i].name;
                  break;
                }
              }
              return `<span>${zone}</span>`;
            }
          },
          {
            field: 'cid',
            title: 'Crop',
            sortable: true,
            formatter: function (value) {
              let crop = value;
              for (let i = 0; i < crops.length; i++) {
                if (crops[i].id === value) {
                  crop = crops[i].name;
                  break;
                }
              }
              return `<span>${crop}</span>`;
            }
          },
          {
            field: 'count',
            title: 'Count',
            sortable: true
          }
        ]
      });
    });
  });
}

function dateFormatter(value) {
  const started = (value == 0 ? '' : moment(value).format('MM/DD/YYYY'));
  return `<span>${started}</span>`;
}

$().ready(function () {
  const skycons = new Skycons();
  $.getJSON('/api/weather/get', (conditions) => {
    $('#weatherString').replaceWith(`<p id="weatherString" class="lead">${conditions.summary}, ${conditions.temperature.toFixed(1)}˚F</p>`);
    skycons.add('weatherIcon', conditions.icon);
    skycons.play();
  });

  $table.on('click-row.bs.table', function (e, row, $element) {
    $('[id=editPlantingModal] #editPlantingModalLabel').text('Edit: ' + row.title);
    $('[id=editPlantingModal] #id').val(row.id);
    $('[id=editPlantingModal] #title').val(row.title);
    $('[id=editPlantingModal] #zid').selectpicker('val', row.zid);
    $('[id=editPlantingModal] #cid').selectpicker('val', (typeof row.cid === 'undefined') ? '' : row.cid);
    $('[id=editPlantingModal] #date').val(moment(row.date).format('MM/DD/YYYY'));
    $('[id=editPlantingModal] #count').val(row.count);
    $('[id=editPlantingModal] #spacing').val(row.spacing);
    $('[id=editPlantingModal] #age').val(row.age);
    $('[id=editPlantingModal] #mad').val(row.mad);

    $('[id=editPlantingModal] #deletePlantingButton').removeClass('d-none');

    $('[id=editPlantingModal]').modal();
  });

  $('#editPlantingModal').on('hidden.bs.modal', function (e) {
    $('[id=editPlantingModal] #plantingForm')[0].reset();
    $('[id=editPlantingModal] #zid').selectpicker('val', 1);
    $('[id=editPlantingModal] #cids').selectpicker('val', '');
    $('[id=editPlantingModal] #deletePlantingButton').addClass('d-none');
  });

  initBootstrapTable();

  //activate the tooltips after the data table is initialized
  $('[rel="tooltip"]').tooltip();

  $(window).resize(function () {
    $table.bootstrapTable('resetView');
  });

  $('#starttimepicker').datetimepicker({
    format: 'MM/DD/YYYY'
  });
});
