/**
 * @file Zones page javascript
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const $cntlZoneTable = $('#cntl-zone-table');
const $openZoneTable = $('#open-zone-table');

function initTables() {
  $cntlZoneTable.bootstrapTable({
    url: '/api/zones/get/control',
    columns: [
      {
        field: 'name',
        title: 'Name',
        sortable: true
      },
      {
        field: 'started',
        title: 'Start Time',
        sortable: true,
        formatter: function (value) {
          return `<span>${(value == 0 ? '' : moment(value).format('DD MMM YYYY hh:mm a'))}</span>`;
        }
      },
      {
        field: 'actions',
        title: 'Actions',
        sortable: false,
        events: operateEvents,
        formatter: cntlOperateFormatter
      }
    ]
  });

  $openZoneTable.bootstrapTable({
    url: '/api/zones/get/planting',
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
        field: 'area',
        title: 'Area (sqft)',
        sortable: true,
        formatter: function (value, row) {
          var soilWHC = [0.75, 1.25, 1.5, 2.0];
          var soilTypes = ['Coarse', 'Sandy', 'Medium', 'Fine'];
          for (let i = 0; i < soilWHC.length; i++) {
            if (row.swhc === soilWHC[i]) return `<span>${value} (${soilTypes[i]} soil)</span>`;
          }
        }
      },
      {
        field: 'emitterCount',
        title: 'Irrigation',
        sortable: true,
        formatter: function (value, row) {
          return `<span>${value} (${row.emitterRate} gph)</span>`;
        }
      },
      {
        field: 'plantings',
        title: 'Plantings',
        sortable: true,
        formatter: function (value) {
          return `<span>${(typeof value === 'undefined' ? 0 : value)}</span>`;
        }
      },
      {
        field: 'started',
        title: 'Start Time',
        sortable: true,
        formatter: function (value) {
          return `<span>${(value == 0 ? '' : moment(value).format('DD MMM YYYY hh:mm a'))}</span>`;
        }
      },
      {
        field: 'actions',
        title: 'Actions',
        sortable: false,
        events: operateEvents,
        formatter: openOperateFormatter
      }
    ]
  });
}

function cntlOperateFormatter(value, row, index) {
  const runningStyle = (row.status ? 'svg-primary' : 'svg-secondary');
  return [
    '<div class="table-icons">',
       '<a rel="tooltip" title="Power" class="power table-actions" href="javascript:void(0)">',
         '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="24px" height="24px" viewBox="0 0 217.7 280" style="enable-background:new 0 0 217.7 280;" xml:space="preserve">',
           '<g transform="translate(0,-952.36218)">',
             `<path class="${runningStyle}" d="M108,952.4c-2.1,0.2-4,1.2-5.5,2.6C49.9,1005.1,0,1068.6,0,1126.6c0,57.7,48.9,105.7,108.8,105.7 c59.9,0,108.8-48,108.8-105.7c0-48.6-35.1-101-77.2-146.3c-3.3-3.9-9.2-4.5-13.1-1.2c-3.9,3.3-4.5,9.2-1.2,13.1 c0.2,0.3,0.5,0.5,0.7,0.7c40.6,43.7,72.1,94.4,72.1,133.6c0,47.1-40.2,87.1-90.2,87.1c-49.9,0-90.2-39.9-90.2-87.1 c0-46.7,45.7-109.5,96.6-158.1c3.8-3.5,4-9.4,0.5-13.2C113.8,953.2,110.9,952.1,108,952.4z M55.9,1064.3c-3.4,0.1-6.5,2-8.1,5 c-9.7,17.6-15.9,34.8-16.7,53.8c0,0.1,0,0.2,0,0.3c-0.4,21.8,7.4,42.3,21.4,56.5c3.4,3.9,9.3,4.3,13.2,0.9s4.3-9.3,0.9-13.2 c-0.3-0.3-0.5-0.6-0.8-0.8c-10-10.1-16.2-25.7-15.9-42.8c0,0,0-0.1,0-0.1c0-0.1,0-0.1,0-0.2c0.7-15.4,5.6-29.4,14.4-45.4 c2.6-4.5,1-10.2-3.4-12.7C59.2,1064.7,57.6,1064.2,55.9,1064.3z"/>`,
           '</g>',
         '</svg>',
       '</a>',
   '</div>',
  ].join('');
}

function openOperateFormatter(value, row, index) {
  const activeStyle = (row.plantings ? 'svg-success' : 'svg-secondary');
  const runningStyle = (row.status ? 'svg-primary' : 'svg-secondary');
  return [
    '<div class="table-icons">',
       '<a rel="tooltip" title="Edit" class="edit table-actions" href="javascript:void(0)">',
         '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="24px" height="24px" viewBox="0 0 280 280" style="enable-background:new 0 0 280 280;" xml:space="preserve">',
           '<path class="svg-secondary" d="M268.5,30.1l-18.6-18.6c-15.3-15.3-40.3-15.3-55.7,0l-167,167c-1.1,1.1-1.8,2.3-2.2,3.8L0.3,268.8 c-0.9,3.1,0,6.3,2.2,8.6c1.7,1.7,3.9,2.6,6.2,2.6c0.8,0,1.6-0.1,2.4-0.3l86.6-24.7c1.4-0.4,2.7-1.2,3.8-2.2l166.9-167 c7.4-7.4,11.5-17.3,11.5-27.8S275.9,37.5,268.5,30.1z M90.7,238.7l-69.3,19.8l19.8-69.3L175.7,54.8l49.5,49.5L90.7,238.7z M256.1,73.4l-18.6,18.6l-49.5-49.5l18.6-18.6c8.5-8.5,22.4-8.5,30.9,0l18.6,18.6c4.1,4.1,6.4,9.6,6.4,15.5 C262.5,63.7,260.2,69.2,256.1,73.4z"/>',
         '</svg>',
       '</a>',
       `<a rel="tooltip" title="Active" class="active table-actions" href="javascript:void(0)">`,
         '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="24px" height="24px" viewBox="0 0 261.7 280" style="enable-background:new 0 0 261.7 280;" xml:space="preserve">',
           '<g>',
            `<path class="${activeStyle}" d="M135.8,79.2c-6.7,0-12.1,5.4-12.1,12.1v60.4c0,4.6,2.5,8.7,6.7,10.8l45.4,23.3c1.7,0.8,3.8,1.2,5.4,1.2 c4.6,0,8.8-2.5,10.8-6.7c2.9-5.8,0.8-13.3-5.4-16.2l-38.8-20V91.3C147.9,84.6,142.5,79.2,135.8,79.2z"/>`,
            `<path class="${activeStyle}" d="M247.1,84.2h0.4c2.9,0,5.8-1.2,7.9-2.9c2.5-2.1,3.8-5,3.8-8.3l2.5-51.7c0.4-6.7-5-12.5-11.7-12.5 c-6.7-0.4-12.5,5-12.5,11.7l-0.8,18.3C210.8,14.2,176.2,0,140,0C62.5,0,0,62.9,0,140c0,77.5,62.9,140,140,140 c47.1,0,90.8-23.3,116.7-62.5c3.8-5.4,2.1-12.9-3.3-16.7c-5.4-3.8-12.9-2.1-16.7,3.3c-21.7,32.5-57.9,51.7-96.7,51.7 c-64.2,0-115.8-52.1-115.8-115.8S76.2,24.2,140,24.2c31.7,0,61.7,12.9,83.3,35.4l-27.5-1.2c-6.7-0.4-12.5,5-12.5,11.7 c-0.4,6.7,5,12.5,11.7,12.5L247.1,84.2z"/>`,
           '</g>',
         '</svg>',
       '</a>',
       `<a rel="tooltip" title="Power" class="power table-actions" href="javascript:void(0)">`,
         '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="24px" height="24px" viewBox="0 0 217.7 280" style="enable-background:new 0 0 217.7 280;" xml:space="preserve">',
           '<g transform="translate(0,-952.36218)">',
             `<path class="${runningStyle}" d="M108,952.4c-2.1,0.2-4,1.2-5.5,2.6C49.9,1005.1,0,1068.6,0,1126.6c0,57.7,48.9,105.7,108.8,105.7 c59.9,0,108.8-48,108.8-105.7c0-48.6-35.1-101-77.2-146.3c-3.3-3.9-9.2-4.5-13.1-1.2c-3.9,3.3-4.5,9.2-1.2,13.1 c0.2,0.3,0.5,0.5,0.7,0.7c40.6,43.7,72.1,94.4,72.1,133.6c0,47.1-40.2,87.1-90.2,87.1c-49.9,0-90.2-39.9-90.2-87.1 c0-46.7,45.7-109.5,96.6-158.1c3.8-3.5,4-9.4,0.5-13.2C113.8,953.2,110.9,952.1,108,952.4z M55.9,1064.3c-3.4,0.1-6.5,2-8.1,5 c-9.7,17.6-15.9,34.8-16.7,53.8c0,0.1,0,0.2,0,0.3c-0.4,21.8,7.4,42.3,21.4,56.5c3.4,3.9,9.3,4.3,13.2,0.9s4.3-9.3,0.9-13.2 c-0.3-0.3-0.5-0.6-0.8-0.8c-10-10.1-16.2-25.7-15.9-42.8c0,0,0-0.1,0-0.1c0-0.1,0-0.1,0-0.2c0.7-15.4,5.6-29.4,14.4-45.4 c2.6-4.5,1-10.2-3.4-12.7C59.2,1064.7,57.6,1064.2,55.9,1064.3z"/>`,
           '</g>',
         '</svg>',
       '</a>',
   '</div>',
  ].join('');
}

function detailFormatter(index, row) {
  const html = [];

  html.push('<p>    ')
  $.each(row, function (key, value) {
    html.push('<b>    ' + key + ':</b> ' + value);
  });
  html.push('</p>');
  return html.join('');
}

$().ready(function (){
  const skycons = new Skycons();
  $.getJSON('/api/weather/get', (conditions) => {
    $('#weatherString').replaceWith(`<p id="weatherString" class="lead">${conditions.summary}, ${conditions.temperature.toFixed(1)}˚F</p>`);
    skycons.add('weatherIcon', conditions.icon);
    skycons.play();
  });

  window.operateEvents = {
    'click .power': function (e, value, row, index) {
      $.ajax({
        url: `/zones/enable/${row.id}`,
        type: 'POST',
        data: { submit: true }, // An object with the key 'submit' and value 'true;
        success: function (result) {
          $cntlZoneTable.bootstrapTable('refresh');
          $openZoneTable.bootstrapTable('refresh');
        }
      });
    },
   'click .edit': function (e, value, row, index) {
      var inst = $('[data-remodal-id=editZoneModal]').remodal();

      $('[data-remodal-id=editZoneModal] #remodalTitle').text(`Edit: ${row.name} (Port #: ${row.id})`);
      $('[data-remodal-id=editZoneModal] #id').val(row.id);
      $('[data-remodal-id=editZoneModal] #name').val(row.name);
      $('[data-remodal-id=editZoneModal] #area').val(row.area);
      $('[data-remodal-id=editZoneModal] #emitterCount').val(row.emitterCount);
      $('[data-remodal-id=editZoneModal] #emitterRate').selectpicker('val', row.emitterRate);
      $('[data-remodal-id=editZoneModal] #swhc').selectpicker('val', row.swhc);
      // $('[data-remodal-id=editZoneModal] #zoneColor').colorpicker({
      //   color: row.color });

      $('[data-remodal-id=editZoneModal] #colorpicker-container').colorpicker({
        color: row.color,
        inline: true,
        container: true,
        format: 'hex',
        useAlpha: false
      })
      .on('colorpickerChange colorpickerCreate', function (e) {
        $('[data-remodal-id=editZoneModal] #color').val(e.value.toHexString());
      })
      .on('colorpickerShow', function (e) {
        $('[data-remodal-id=editZoneModal] #colorpicker-container').setValue(row.color);
      });

      const times = String(row.start).split(':');
      const now = new Date();
      now.setHours(times[0]);
      now.setMinutes(times[1]);

      $('[data-remodal-id=editZoneModal] #start').val(moment(now).format('HH:mm'));

      inst.open();
    }
  };

  initTables();

  //activate the tooltips after the data table is initialized
  $('[rel="tooltip"]').tooltip();

  $(window).resize(function () {
    $cntlZoneTable.bootstrapTable('resetView');
    $openZoneTable.bootstrapTable('resetView');
  });

  $('#starttimepicker').datetimepicker({
    format: 'HH:mm',
    icons: {
      time: 'far fa-clock',
      date: 'far fa-calendar-alt',
      up: 'fas fa-angle-up',
      down: 'fas fa-angle-down'
    }
  });
});
