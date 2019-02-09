/**
 * @file Events page javascript
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

function initCalendar() {
  $calendar = $('#fullCalendar');

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();

  $calendar.fullCalendar({
    header: {
      left: 'title',
      center: 'month,agendaWeek,agendaDay',
      right: 'prev,next,today'
    },
    eventColor: '#666666',
    eventTextColor: '#FFF',
    defaultDate: today,
    selectable: true,
    selectHelper: true,
    views: {
      month: { // name of view
        titleFormat: 'MMMM YYYY'
        // other view-specific options here
      },
      week: {
        titleFormat: ' MMMM D YYYY'
      },
      day: {
        titleFormat: 'D MMM, YYYY'
      }
    },
    select: (start, end) => {
      $('[id=editScheduleModal] #editScheduleModalLabel').text('Create a new Event');
      $('[id=editScheduleModal] #title').val('');
      $('[id=editScheduleModal] #id').val('');
      $('[id=editScheduleModal] #zid').selectpicker('val', ['0']); // None
      $('[id=editScheduleModal] #amt').selectpicker('val', ['1']); // Min
      $('[id=editScheduleModal] #fertilize').prop('checked', false);
      $('[id=editScheduleModal] #start').val(moment(start).format('MM/DD/YYYY hh:mm A'));
      $('[id=editScheduleModal] #repeatDow').selectpicker('val', ['7']); // None
      $('[id=editScheduleModal] #repeatEnd').val(moment(end).format('MM/DD/YYYY hh:mm A'));

      $('[id=editScheduleModal] #deleteScheduleButton').addClass('d-none');

      $('[id=editScheduleModal]').modal();
    },
    eventClick: function(event, jsEvent, view) {
      $('[id=editScheduleModal] #editScheduleModalLabel').text('Update an Event');
      $('[id=editScheduleModal] #title').val(event.title);
      $('[id=editScheduleModal] #id').val(event.id);
      $('[id=editScheduleModal] #zid').selectpicker('val', event.zid);
      $('[id=editScheduleModal] #amt').selectpicker('val', event.amt);
      $('[id=editScheduleModal] #fertilize').prop("checked", event.fertilize);
      $('[id=editScheduleModal] #start').val(moment(event.start).format('MM/DD/YYYY hh:mm A'));
      $('[id=editScheduleModal] #repeatDow').selectpicker('val', (typeof event.repeatDow === 'undefined') ? "" : event.repeatDow);
      $('[id=editScheduleModal] #repeatEnd').val((typeof event.repeatEnd === 'undefined') ? moment(event.end).format('MM/DD/YYYY') :
      moment(event.repeatEnd).format('MM/DD/YYYY'));

      $('[id=editScheduleModal] #deleteScheduleButton').removeClass('d-none');

      $('[id=editScheduleModal]').modal();
    },
    eventDrop: function(event, delta, revertFunc) {
      var event = {
        id: event.id,
        zid: event.zid,
        title: event.title,
        start: event.start,
        end: event.end,
        repeatDow: event.repeatDow,
        repeatEnd: repeatEnd
      };

      $.ajax({
        url: '/events/update',
        type: 'POST',
        data: JSON.stringify(event),
        contentType: 'application/json',
        success: function (result) {
        }
      });
    },
    editable: true,
    eventLimit: true, // allow "more" link when too many events
    events: {
        url: '/api/events/get',
        type: 'GET',
    }
  });
}

$(document).ready(function (){
  initCalendar();

  $('#starttimepicker').datetimepicker({
    format: 'MM/DD/YYYY hh:mm A',
    icons: {
      time: 'icon icon-clock',
      date: 'icon icon-calendar',
      up: 'icon icon-chevron-up',
      down: 'icon icon-chevron-down'
    }
  });
  $('#repeatendpicker').datetimepicker({
    format: 'MM/DD/YYYY',
    icons: {
      time: 'icon icon-clock',
      date: 'icon icon-calendar',
      up: 'icon icon-chevron-up',
      down: 'icon icon-chevron-down'
    }
  });
});
