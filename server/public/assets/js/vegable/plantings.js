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
              var zone = value;
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
              var crop = value;
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
  //var started = (value == 0 ? "" : new Date(value).toLocaleString());
  var started = (value == 0 ? '' : moment(value).format('MM/DD/YYYY'));
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
    var inst = $('[data-remodal-id=editPlantingModal]').remodal();

    $('[data-remodal-id=editPlantingModal] #remodalTitle').text('Edit: ' + row.title);
    $('[data-remodal-id=editPlantingModal] #id').val(row.id);
    $('[data-remodal-id=editPlantingModal] #title').val(row.title);
    $('[data-remodal-id=editPlantingModal] #zid').selectpicker('val', row.zid);
    $('[data-remodal-id=editPlantingModal] #cid').selectpicker('val', (typeof row.cid === 'undefined') ? '' : row.cid);
    $('[data-remodal-id=editPlantingModal] #date').val(moment(row.date).format('MM/DD/YYYY'));
    $('[data-remodal-id=editPlantingModal] #count').val(row.count);
    $('[data-remodal-id=editPlantingModal] #spacing').val(row.spacing);
    $('[data-remodal-id=editPlantingModal] #age').val(row.age);
    $('[data-remodal-id=editPlantingModal] #mad').val(row.mad);

    inst.open();
    $('[data-remodal-id=editPlantingModal] #delete_action').removeClass('hide-form-button');
  });

  $(document).on('closing', '.remodal', function (e) {
    $('[data-remodal-id=editPlantingModal] #plantingForm')[0].reset();
    $('[data-remodal-id=editPlantingModal] #zid').selectpicker('val', 1);
    $('[data-remodal-id=editPlantingModal] #cids').selectpicker('val', '');
    $('[data-remodal-id=editPlantingModal] #delete_action').addClass('hide-form-button');
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
