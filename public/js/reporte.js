document.addEventListener('DOMContentLoaded', function() {
  const allChannelsCheckbox = document.getElementById('allChannels');
  const channelCheckboxes = document.querySelectorAll('input[name="channels"]');
 
  allChannelsCheckbox.addEventListener('change', function() {
    channelCheckboxes.forEach(checkbox => {
      checkbox.checked = this.checked;
    });
    updateReport();
  });
 
  channelCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateReport);
  });
 
  document.getElementById('kamSelector').addEventListener('change', updateReport);
  document.getElementById('clientSelector').addEventListener('change', updateReport);
  document.getElementById('fechaCierre').addEventListener('change', updateReport);
 
  attachClickHandlers();
});
 
function attachClickHandlers() {
  document.querySelectorAll('.clickable-row').forEach(row => {
    row.removeEventListener('click', handleRowClick);
    row.addEventListener('click', handleRowClick);
  });
}
 
function handleRowClick(event) {
  event.preventDefault();
  const targetId = this.getAttribute('data-bs-target').substring(1);
  const detailsRow = document.getElementById(targetId);
  const tds = this.querySelectorAll('td');
 
  if (detailsRow.style.display === 'none' || detailsRow.style.display === '') {
    detailsRow.style.display = 'table-row';
    detailsRow.classList.add('show');
    tds.forEach(td => td.classList.add('bg-grey'));
    this.setAttribute('aria-expanded', 'true');
    this.classList.remove('collapsed');
  } else {
    detailsRow.style.display = 'none';
    detailsRow.classList.remove('show');
    tds.forEach(td => td.classList.remove('bg-grey'));
    this.setAttribute('aria-expanded', 'false');
    this.classList.add('collapsed');
  }
 
}
function updateReport() {
  const selectedKam = document.getElementById('kamSelector').value;
  const selectedClient = document.getElementById('clientSelector').value;
  const selectedDate = document.getElementById('fechaCierre').value;
  const selectedChannels = Array.from(document.querySelectorAll('input[name="channels"]:checked'))
                                .map(input => input.id)
                                .filter(id => id !== 'allChannels');
 
  const queryString = `kam=${encodeURIComponent(selectedKam)}&client=${encodeURIComponent(selectedClient)}&date=${encodeURIComponent(selectedDate)}&channels=${encodeURIComponent(selectedChannels.join(','))}`;
 
  fetch(`/api/dashboard-datas?${queryString}`)
    .then(response => response.json())
    .then(data => {
      document.querySelector('#totalCarteraBox h2').textContent = formatCurrency(data.totalCartera);
      document.querySelector('#aTiempoBox h2').textContent = data.rotacionCartera;
      document.querySelector('#vencidoBox h2').textContent = '60';
     
      // Update totalAmountSigned
      document.querySelector('#totalCarteraBox h2').textContent = formatCurrency(data.totalAmountSigned);
 
      updateMainTable(data.groupedRecords);
    })
    .catch(error => console.error('Error al cargar los datos:', error));
}
function formatCurrency(amount) {
  return amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}
 
function updateMainTable(groupedRecords) {
  const tbody = document.getElementById('mainTableBody');
  tbody.innerHTML = ''; // Clear the existing table content
 
  groupedRecords.forEach((cliente, index) => {
    const row = generateRowHtml(cliente, index);
    tbody.innerHTML += row;
  });
 
  attachClickHandlers(); // Re-attach event handlers for expandable rows
}
 
 
function generateRowHtml(cliente, index) {
  return `
    <tr class="clickable-row collapsed" data-bs-toggle="collapse" data-bs-target="#details-${index}" aria-expanded="false" aria-controls="details-${index}">
      <td><span class="collapse-indicator"></span>${cliente.cliente}</td>
      <td>$${cliente.en_fecha.toLocaleString('es-MX')}</td>
      <td>$${cliente.dias_1_30.toLocaleString('es-MX')}</td>
      <td>$${cliente.dias_31_60.toLocaleString('es-MX')}</td>
      <td>$${cliente.dias_61_90.toLocaleString('es-MX')}</td>
      <td>$${cliente.dias_91_120.toLocaleString('es-MX')}</td>
      <td>$${cliente.mas_antiguos.toLocaleString('es-MX')}</td>
      <td>$${cliente.total.toLocaleString('es-MX')}</td>
    </tr>
    <tr class="collapse" id="details-${index}">
      <td colspan="8" class="p-0">
        <div class="collapse-content">
          <table class="table table-sm details-table">
            <thead>
              <tr>
                <th>Factura</th>
                <th>Fecha Vencimiento</th>
                <th>En Fecha</th>
                <th>1-30</th>
                <th>31-60</th>
                <th>61-90</th>
                <th>91-120</th>
                <th>Más antiguos</th>
              </tr>
            </thead>
            <tbody>
              ${cliente.facturas.map(factura => `
                <tr>
                  <td>${factura.factura}</td>
                  <td>${new Date(factura.fecha_vencimiento).toLocaleDateString('es-MX')}</td>
                  <td>${factura.rango === 'en_fecha' ? `$${factura.importe.toLocaleString('es-MX')}` : ''}</td>
                  <td>${factura.rango === 'dias_1_30' ? `$${factura.importe.toLocaleString('es-MX')}` : ''}</td>
                  <td>${factura.rango === 'dias_31_60' ? `$${factura.importe.toLocaleString('es-MX')}` : ''}</td>
                  <td>${factura.rango === 'dias_61_90' ? `$${factura.importe.toLocaleString('es-MX')}` : ''}</td>
                  <td>${factura.rango === 'dias_91_120' ? `$${factura.importe.toLocaleString('es-MX')}` : ''}</td>
                  <td>${factura.rango === 'mas_antiguos' ? `$${factura.importe.toLocaleString('es-MX')}` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  `;
}
 
 
function reattachClickHandlers() {
  // Vincular nuevamente los controladores de eventos a las filas que pueden expandirse/cerrarse
  document.querySelectorAll('.clickable-row').forEach(row => {
    row.addEventListener('click', function() {
      const targetId = this.getAttribute('data-bs-target').substring(1);
      const detailsRow = document.getElementById(targetId);
      toggleRow(detailsRow, this);
    });
  });
}
 
function toggleRow(detailsRow, triggerRow) {
  // Alternar la visibilidad de la fila de detalles
  const isVisible = detailsRow.style.display === 'table-row';
  detailsRow.style.display = isVisible ? 'none' : 'table-row';
  triggerRow.setAttribute('aria-expanded', !isVisible);
  triggerRow.classList.toggle('collapsed', isVisible);
}

window.onload = function() {
  var fecha = new Date(); // Fecha actual
  var dia = fecha.getDate(); // Obteniendo día
  var mes = fecha.toLocaleString('es-ES', { month: 'long' }); // Obteniendo mes en formato largo
  var ano = fecha.getFullYear(); // Obteniendo año

  document.getElementById('fechaFormateada').textContent = dia + " de " + mes + " del " + ano;
};