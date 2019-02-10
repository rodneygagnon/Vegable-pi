/**
 * @file Zones page javascript
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

$().ready(function () {
  $('#starttimepicker').datetimepicker({
    format: 'HH:mm',
    icons: {
      time: 'icon icon-clock',
      date: 'icon icon-calendar',
      up: 'icon icon-chevron-up',
      down: 'icon icon-chevron-down'
    }
  });
});
