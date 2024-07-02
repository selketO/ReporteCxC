document.addEventListener('DOMContentLoaded', function () {
 
    Highcharts.chart('container', {
        chart: {
            type: 'pie'
        },
        title: {
            text: "",
            align: 'center'
        },
        tooltip: {
            pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
        },
        accessibility: {
            point: {
                valueSuffix: '%'
            }
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                borderWidth: 2,
                cursor: 'pointer',
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b><br>{point.percentage:.1f}%',
                    distance: 20
                },
                showInLegend: false,
                innerSize: '70%',
                depth: 10,
                borderRadius: 10,
            }
        },
        colors: ['#F24410', '#0C9600'],
        series: [{
            name: 'Porcentaje del Total',
            enableMouseTracking: true,
            animation: {
                duration: 2000
            },
            colorByPoint: true,
            data: [{
                name: 'Vencido',
                y: totalVencido
            }, {
                name: 'A Tiempo',
                y: totalATiempo
            }]
        }]
    });
        // Nueva gráfica de pastel para los rangos de días
        Highcharts.chart('rangePieChart', {
            chart: {
                type: 'pie'
            },
            title: {
                text: ' ',
                align: 'center'
            },
            tooltip: {
                pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
            },
            accessibility: {
                point: {
                    valueSuffix: '%'
                }
            },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    dataLabels: {
                        enabled: true,
                        formatter: function() {
                            return '<b>' + this.point.name.replace("días", "") + '</br> ' + this.point.percentage.toFixed(1) + '%';
                        },
                        distance: 1
                    },
                    showInLegend: false,
                    innerSize: '70%',
                    depth: 10,
                    borderRadius: 10,
                }
            },
            series: [{
                name: 'Porcentaje del Total',
                colorByPoint: true,
                data: pieData
            }]
        });
   
        const categories = Object.keys(monthlyData);
        const totalCarteraData = categories.map(month => monthlyData[month].totalCartera);
        const totalATiempoData = categories.map(month => (monthlyData[month].totalATiempo / monthlyData[month].totalCartera) * 100);
        const totalVencidoData = categories.map(month => (monthlyData[month].totalVencido / monthlyData[month].totalCartera) * 100);
       
        Highcharts.chart('monthlyChart', {
            chart: {
                type: 'spline'
            },
            title: {
                text: 'Datos Mensuales (%)'
            },
            xAxis: {
                categories: categories.reverse()
            },
            yAxis: {
                title: {
                    text: 'Porcentaje (%)'
                },
                labels: {
                    format: '{value}%' // Esto añade el símbolo de porcentaje a los valores del eje Y
                }
            },
            tooltip: {
                pointFormatter: function () {
                    return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${this.y.toFixed(2)}%</b><br/>`;
                }
            },
            plotOptions: {
                spline: {
                    lineWidth: 4,
                    states: {
                        hover: {
                            lineWidth: 5
                        }
                    },
                    marker: {
                        enabled: false
                    },
                }
            },
            colors: [ '#0C9600', '#F24410'], // Define los colores aquí
       
            series: [{
                name: 'Cartera a Tiempo',
                data: totalATiempoData.reverse() // Invierte el orden de los datos
            }, {
                name: 'Cartera Vencida',
                data: totalVencidoData.reverse() // Invierte el orden de los datos
            }]
        });
       
});

document.addEventListener('DOMContentLoaded', function() {
    const allChannelsCheckbox = document.getElementById('allChannels');
    const channelCheckboxes = document.querySelectorAll('input[name="channels"]');

    allChannelsCheckbox.addEventListener('change', function() {
        channelCheckboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
        updateDashboard();
    });

    channelCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateDashboard);
    });

    document.getElementById('kamSelector').addEventListener('change', updateDashboard);
    document.getElementById('clientSelector').addEventListener('change', updateDashboard);
    document.getElementById('datePicker').addEventListener('change', updateDashboard);
});
function updateDashboard() {
    const kamSelector = document.getElementById('kamSelector');
    const userEmail = sessionStorage.getItem("userEmail");
    const emailToNameMapping = {
      'emacias@biancorelab.com': 'Eduardo Macías Beaz',
      'erivera@biancorelab.com': 'Esperanza Rivera Rodríguez',
      'fvargas@biancorelab.com': 'Fernando Vargas',
      'mrivas@biancorelab.com': 'Mariana Rivas Álvarez'
    };
    
    let selectedKam = kamSelector.value;
    if (emailToNameMapping[userEmail]) {
      selectedKam = emailToNameMapping[userEmail];
    }

    const selectedClient = document.getElementById('clientSelector').value;
    const selectedDate = document.getElementById('datePicker').value;
    const selectedChannels = Array.from(document.querySelectorAll('input[name="channels"]:checked'))
                                .filter(input => input.id !== 'allChannels')
                                .map(input => input.id);

    const queryString = `kam=${encodeURIComponent(selectedKam)}&client=${encodeURIComponent(selectedClient)}&date=${encodeURIComponent(selectedDate)}&channels=${encodeURIComponent(selectedChannels.join(','))}`;

    fetch(`/api/dashboard-data?${queryString}`)
      .then(response => response.json())
      .then(data => {
        // Actualizar los totales
        document.querySelector('#totalCarteraBox h2').textContent = formatCurrency(data.totalCartera);
        document.querySelector('#aTiempoBox h2').textContent = formatCurrency(data.totalATiempo);
        document.querySelector('#vencidoBox h2').textContent = formatCurrency(data.totalVencido);
        
        // Actualizar los porcentajes
        document.querySelector('#aTiempoBox .porcentajes_totales strong').textContent = 
          `${((data.totalATiempo / data.totalCartera) * 100).toFixed(2)}%`;
        document.querySelector('#vencidoBox .porcentajes_totales strong').textContent = 
          `${((data.totalVencido / data.totalCartera) * 100).toFixed(2)}%`;
        
        // Actualizar la tabla de rangos
        updateRangeTable(data.sumsByRange, data.percentagesByRange);
        
        // Actualizar los gráficos
        updateCharts(data);
      });
  }
  
  function formatCurrency(amount) {
    return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }
  
  function updateRangeTable(sumsByRange, percentagesByRange) {
    const tbody = document.querySelector('table tbody');
    tbody.innerHTML = '';
    for (const [range, amount] of Object.entries(sumsByRange)) {
      const row = `
        <tr>
          <td>${range}</td>
          <td>${formatCurrency(amount)}</td>
          <td>${percentagesByRange[range]}%</td>
        </tr>
      `;
      tbody.innerHTML += row;
    }
  }
  
  function updateCharts(data) {
    const pieData = Object.keys(data.sumsByRange).map(key => ({
          name: key + ' días',
          y: parseFloat(data.sumsByRange[key]),
          percentage: parseFloat(data.percentagesByRange[key])
      }));
          // Gráfico de pastel para Cuentas por Cobrar (Total vs Vencido)
          Highcharts.chart('container', {
              chart: { type: 'pie' },
              title: { text: '', align: 'center' },
              tooltip: { pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>' },
              accessibility: { point: { valueSuffix: '%' } },
              plotOptions: {
                pie: {
                    allowPointSelect: true,
                    borderWidth: 2,
                    cursor: 'pointer',
                    dataLabels: {
                        enabled: true,
                        format: '<b>{point.name}</b><br>{point.percentage:.1f}%',
                        distance: 20
                    },
                    showInLegend: false,
                    innerSize: '70%',
                    depth: 10,
                    borderRadius: 10,
                }
            },
              colors: ['#F24410', '#0C9600'],
              series: [{
                    name: 'Porcentaje del Total',
                  enableMouseTracking: true,
                  animation: { duration: 2000 },
                  colorByPoint: true,
                  data: [{
                      name: 'Vencido',
                      y: data.totalVencido
                  }, {
                      name: 'A Tiempo',
                      y: data.totalATiempo
                  }]
              }]
          });
 
          // Gráfico de pastel para Cartera vencida (Rango de días)
          Highcharts.chart('rangePieChart', {
          chart: { type: 'pie' },
          title: { text: '', align: 'center' },
          tooltip: { pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>' },
          accessibility: { point: { valueSuffix: '%' } },
          plotOptions: {
              pie: {
                  allowPointSelect: true,
                  cursor: 'pointer',
                  dataLabels: {
                    enabled: true,
                    formatter: function() {
                            return '<b>' + this.point.name.replace("días", "") + '</br> ' + this.point.percentage.toFixed(1) + '%';
                        },
                    distance: 1
                },
                  showInLegend: false,
                  innerSize: '70%',
                  depth: 10,
                  borderRadius: 10,
              }
          },
          series: [{
              name: 'Porcentaje del Total',
              colorByPoint: true,
              data: pieData
          }]
      });
 
  
          // Gráfico lineal para Datos Mensuales
          const categories = Object.keys(data.monthlyData);
          const totalATiempoData = categories.map(month => (data.monthlyData[month].totalATiempo / data.monthlyData[month].totalCartera) * 100);
          const totalVencidoData = categories.map(month => (data.monthlyData[month].totalVencido / data.monthlyData[month].totalCartera) * 100);
  
          Highcharts.chart('monthlyChart', {
              chart: { type: 'spline' },
              title: { text: 'Datos Mensuales (%)' },
              xAxis: { categories: categories.reverse() },
              yAxis: {
                  title: { text: 'Porcentaje (%)' },
                  labels: { format: '{value}%' }
              },
              plotOptions: {
                  spline: {
                      lineWidth: 4,
                      states: { hover: { lineWidth: 5 } },
                      marker: { enabled: false },
                  }
              },
              colors: ['#0C9600', '#F24410'],
              series: [{
                  name: 'Cartera a Tiempo',
                  data: totalATiempoData.reverse()
              }, {
                  name: 'Cartera Vencida',
                  data: totalVencidoData.reverse()
              }]
          });
      }

      