document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const fileInput = document.getElementById('fileInput');
    formData.append('file', fileInput.files[0]);
  
    fetch('https://calculator-fe.onrender.com/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => response.text())
    .then(data => {
        
        data = JSON.parse(data)
        console.log(data)
        const tableContainer = document.getElementById('table-container');
        tableContainer.innerHTML = ""
        const table = createTable(data.users);
        const users = JSON.stringify(data.users)
        localStorage.setItem('users', users)
        tableContainer.appendChild(table);
    })
    // .catch(error => {
    //   document.getElementById('message').innerText = 'Error uploading file.';
    // });
  });


  function createTable(data) {
    const table = document.createElement('table');
    const headerRow = document.createElement('tr');

    const headers = ['Employee Number', 'Name', 'Department', 'Total Minutes'];
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });

    table.appendChild(headerRow);

    data.forEach(employee => {
        // for (const [date, log] of Object.entries(employee.logs)) {
            const rowLink = document.createElement('a');
            rowLink.href = `employee.html?number=${employee.number}`; // Dynamic URL for new page
            rowLink.style.textDecoration = 'none'; 
            rowLink.style.color = "black"

            const row = document.createElement('tr');

            const employeeNumberCell = document.createElement('td');
            employeeNumberCell.textContent = employee.number;
            row.appendChild(employeeNumberCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = employee.name;
            rowLink.appendChild(nameCell);
            row.appendChild(rowLink);

            const departmentCell = document.createElement('td');
            departmentCell.textContent = employee.department;
            row.appendChild(departmentCell);

            // const dateCell = document.createElement('td');
            // dateCell.textContent = date;
            // row.appendChild(dateCell);

            // const startCell = document.createElement('td');
            // startCell.textContent = log.start || '-';
            // row.appendChild(startCell);

            // const endCell = document.createElement('td');
            // endCell.textContent = log.end || '-';
            // row.appendChild(endCell);

            const minCell = document.createElement('td');
            minCell.textContent = employee.totalMinutes;
            row.appendChild(minCell);

            
            table.appendChild(row);
        // }
    });

    return table;
}




  