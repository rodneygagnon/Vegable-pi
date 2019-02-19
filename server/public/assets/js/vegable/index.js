/**
 * @file Index page javascript
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

$().ready(function () {
  /**
   * Weather Elements
   **/
  const skycons = new Skycons();
  // Current Conditions
  $.getJSON('/api/weather/get', (conditions) => {
    $('#weatherString').replaceWith(`<p id="weatherString" class="lead">${conditions.summary}, ${conditions.temperature.toFixed(1)}˚F</p>`);
    skycons.add('weatherIcon', conditions.icon);
  });

  // Forecast Conditions
  $.getJSON('/api/forecast/get', (forecast) => {
    // No more that 5 days
    const forecastLength = forecast.length < 5 ? forecast.length : 5;
    for (let day = 0; day < forecastLength; day++) {
      const dateString = (day === 0 ? 'Today' :
                          (day === 1 ? 'Tomorrow' :
                            moment.unix(forecast[day].time).format('dddd')));

      $(`#day${day}DateString`).replaceWith(`<h5 id="day${day}DateString">${dateString}</h5>`);
      skycons.add(`day${day}WeatherIcon`, forecast[day].icon);

      // Indicator Heat Stress Conditions
      let hiTempIndicator;
      if (forecast[day].temperatureHigh >= 90) {
        hiTempIndicator = `<span class="badge badge-danger">High: ${forecast[day].temperatureHigh.toFixed(0)}˚</span>`;
      } else {
        hiTempIndicator = `High: ${forecast[day].temperatureHigh.toFixed(0)}˚`;
      }

      // Indicate Frost/Freeze Conditions
      let loTempIndicator;
      if (forecast[day].temperatureLow <= 32) {
        loTempIndicator = `<span class="badge badge-primary">Low: ${forecast[day].temperatureLow.toFixed(0)}˚</span>`;
      } else {
        loTempIndicator = `Low: ${forecast[day].temperatureLow.toFixed(0)}˚`;
      }

      $(`#day${day}TempString`).replaceWith(`<h6 id="day${day}TempString">${hiTempIndicator} ${loTempIndicator}</h6>`);

      const precip = forecast[day].precipIntensity * 24;
      const probability = forecast[day].precipProbability * 100;
      $(`#day${day}PrecipString`).replaceWith(`<h6 id="day${day}PrecipString">Precip ${precip.toFixed(1)}&#34 ${probability.toFixed(0)}%</h6>`);
      $(`#day${day}SummaryString`).replaceWith(`<p id="day${day}SummaryString">${forecast[day].summary}</p>`);
    }
    skycons.play();
  });

  /**
   * Statistics Elements
   **/
  const ctx = document.getElementById('overviewChart').getContext('2d');
  const chartConfig = {
    type: 'bar',
    data: {
      datasets: []
    },
    options: {
      responsive: true,
      legend: {
        position: 'bottom',
      },
      tooltips: {
        callbacks: {
          label: function(tooltipItem, data) {
            const zoneData = data.datasets[tooltipItem.datasetIndex].data[tooltipItem.datasetIndex];
            const time = moment(zoneData.x).format('h:mm a');

            let label = data.datasets[tooltipItem.datasetIndex].label;
            if (label) {
                label += ': ';
            }
            label += `${tooltipItem.yLabel} gal @ ${time}`;

            return label;
          }
        }
      },
      scales: {
        xAxes: [{
          type: "time",
          time: {
            unit: 'day',
            round: 'day',
            tooltipFormat: 'MMM D',
            displayFormats: {
              day: 'MMM D'
            }
          },
          gridLines: {
            offsetGridLines: true
          }
        }],
        yAxes: [{
          scaleLabel: {
            display: true,
            labelString: 'Gallons'
          },
          ticks: {
            beginAtZero: true
          }
        }]
      }
    }
  };
  const color = Chart.helpers.color;

  // We'll get the stats from the start of the year,
  // but we will display them starting from the first irrigation event
  const start = new Date();
  start.setMonth(0);
  start.setDate(1);

  const end = new Date();

  const initZoneData = (zone, first, last) => {
    const next = new Date(first);
    const data = [];
    const colors = [];

    while (next <= last) {
      data.push({ x: new Date(next), y: 0 });
      colors.push(color(zone.color).alpha(0.85).rgbString());
      next.setDate(next.getDate() + 1);
    }

    return { zone: zone, zoneData: data, zoneColors: colors };
  };

  window.myBar = new Chart(ctx, chartConfig);

  // Get statistics for all planting zones
  $.getJSON('/api/stats/get', { start: start.getTime(), stop: end.getTime() }, (stats) => {
    if (stats.length > 0) {
      let irrTotal = 0;
      let fertEvents = 0;

      const firstDate = new Date(stats[0].started);
      firstDate.setDate(firstDate.getDate() - 1);

      const lastDate = new Date(stats[stats.length - 1].started);
      lastDate.setDate(lastDate.getDate() + 1);

      $.getJSON('/api/zones/get/planting', (zones) => {
        const statsTable = {};
        for (let i = 0; i < zones.length; i++) {
          statsTable[zones[i].id] = initZoneData(zones[i], firstDate, lastDate);
        }

        for (let i = 0; i < stats.length; i++) {
          const day = moment(stats[i].started).diff(moment(firstDate), 'days');
          const amount = Math.floor(stats[i].amount * 100) / 100;

          statsTable[stats[i].zid].zoneData[day] = {
            x: new Date(stats[i].started),
            y: amount
          };

          irrTotal += amount;

          const fertilizerObj = JSON.parse(stats[i].fertilizer);
          const fertilized = (fertilizerObj.n || fertilizerObj.p || fertilizerObj.k) ? true : false;
          if (fertilized) {
            fertEvents += 1;
            statsTable[stats[i].zid].zoneColors[day] = pattern.draw('diagonal', statsTable[stats[i].zid].zoneColors[day]);
          }
        }

        for (const zid in statsTable) {
          chartConfig.data.datasets.push({
            label: statsTable[zid].zone.name,
            backgroundColor: statsTable[zid].zoneColors,
            data: statsTable[zid].zoneData
          });
        }

        $(`#irrTotal`).replaceWith(`<h4 id="irrTotal" class="mt-4">${irrTotal.toFixed(1)} Gallons</h4>`);
        $(`#irrEvents`).replaceWith(`<h6 id="irrEvents" class="mb-4">Irrigated ${stats.length}x Fertilized ${fertEvents}x</h6>`);

        window.myBar.update();
      });
    }
  });
});
