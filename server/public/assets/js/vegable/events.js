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
      var inst = $('[data-remodal-id=editScheduleModal]').remodal();

      $('[data-remodal-id=editScheduleModal] #remodalTitle').text('Create a new Event');
      $('[data-remodal-id=editScheduleModal] #title').val('');
      $('[data-remodal-id=editScheduleModal] #id').val('');
      $('[data-remodal-id=editScheduleModal] #zid').selectpicker('val', ['0']); // None
      $('[data-remodal-id=editScheduleModal] #amt').selectpicker('val', ['1']); // Min
      $('[data-remodal-id=editScheduleModal] #fertilize').prop('checked', false);
      $('[data-remodal-id=editScheduleModal] #start').val(moment(start).format('MM/DD/YYYY hh:mm A'));
      $('[data-remodal-id=editScheduleModal] #repeatDow').selectpicker('val', ['7']); // None
      $('[data-remodal-id=editScheduleModal] #repeatEnd').val(moment(end).format('MM/DD/YYYY hh:mm A'));

      inst.open();
      $('[data-remodal-id=editScheduleModal] #delete_action').addClass('hide-form-button');
    },
    eventClick: function(event, jsEvent, view) {
      var inst = $('[data-remodal-id=editScheduleModal]').remodal();

      $('[data-remodal-id=editScheduleModal] #remodalTitle').text('Update an Event');
      $('[data-remodal-id=editScheduleModal] #title').val(event.title);
      $('[data-remodal-id=editScheduleModal] #id').val(event.id);
      $('[data-remodal-id=editScheduleModal] #zid').selectpicker('val', event.zid);
      $('[data-remodal-id=editScheduleModal] #amt').selectpicker('val', event.amt);
      $('[data-remodal-id=editScheduleModal] #fertilize').prop("checked", event.fertilize);
      $('[data-remodal-id=editScheduleModal] #start').val(moment(event.start).format('MM/DD/YYYY hh:mm A'));
      $('[data-remodal-id=editScheduleModal] #repeatDow').selectpicker('val', (typeof event.repeatDow === 'undefined') ? "" : event.repeatDow);
      $('[data-remodal-id=editScheduleModal] #repeatEnd').val((typeof event.repeatEnd === 'undefined') ? moment(event.end).format('MM/DD/YYYY') :
      moment(event.repeatEnd).format('MM/DD/YYYY'));

      inst.open();
      $('[data-remodal-id=editScheduleModal] #delete_action').removeClass('hide-form-button');
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
      time: 'far fa-clock',
      date: 'far fa-calendar-alt',
      up: 'fas fa-angle-up',
      down: 'fas fa-angle-down'
    }
  });
  $('#repeatendpicker').datetimepicker({
    format: 'MM/DD/YYYY',
    icons: {
      time: 'far fa-clock',
      date: 'far fa-calendar-alt',
      up: 'fas fa-angle-up',
      down: 'fas fa-angle-down'
    }
  });
});
