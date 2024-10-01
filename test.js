const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Function to extract data from the 'logs' sheet of the Excel file
async function extractLogsSheet(filePath, settings) {
  // Read the Excel file
  const workbook = xlsx.readFile(filePath);
  console.log(settings)

  // Check if the 'logs' sheet exists
  const sheetName = 'Logs';
  if (!workbook.SheetNames.includes(sheetName)) {
    return;
  }

  // Get the worksheet
  const worksheet = workbook.Sheets[sheetName];
  fs.unlinkSync(filePath);
  return extractData(worksheet, settings)
}

function extractData(worksheet, settings){
  // Extract the period date from cell C3
  const period = worksheet['C3'] ? worksheet['C3'].v : '';

  // Initialize data structure
  const logsData = {
    period: period,
    users: []
  };

  // Iterate over the worksheet to extract user data
  const range = xlsx.utils.decode_range(worksheet['!ref']);
  let currentUser = null;
  const rowData = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellAddress = xlsx.utils.encode_cell({ r: 4 - 1, c: C }); // Subtract 1 for 0-based index
    const cell = worksheet[cellAddress];
    // Add cell value to rowData array if it exists
    rowData.push(cell ? cell.v : null);
  }

  for (let R = range.s.r; R <= range.e.r; R++) {
    // Read user information
    const noCell = worksheet[xlsx.utils.encode_cell({ r: R, c: 0 })];
    const nameCell = worksheet[xlsx.utils.encode_cell({ r: R, c: 10 })];
    const deptCell = worksheet[xlsx.utils.encode_cell({ r: R, c: 20 })];

    if (noCell && noCell.v === 'No :') {
      // If we encounter 'No:', it indicates a new user section
      const year = period.substring(0, 4);
      const month = period.substring(5, 7);

      // Create a new user object
      let userTotalmin = 0
      currentUser = {
        number: worksheet[xlsx.utils.encode_cell({ r: R, c: 2 })].v,
        name: nameCell ? nameCell.v : '',
        department: deptCell ? deptCell.v : '',
        totalMinutes: 0,
        logs: {}
      };

      for (let C = 0; C <= range.e.c; C++) {
        let accountingSetting = settings.find(setting => setting.department == 'Others');
        if(currentUser && currentUser.department == "Accounting"){
          accountingSetting = settings.find(setting => setting.department == 'Accounting');
        }
        let day = worksheet[xlsx.utils.encode_cell({ r: R-1, c: C })]?.v;
        const date = `${year}/${month}/${day}`
        const newdate = new Date(date);
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(newdate);
        day = dayName + "-" + date

        if (day) {
          let times = worksheet[xlsx.utils.encode_cell({ r: R + 1, c: C })]?.v || '';
          let start = times.split('\n')[0] ?? "";
          let time = times.split('\n');
          const len = time.length
          let end = time[1] ?? ""

          let penalty = 0
          let overTime = 0
          let total = 0
          let min = 0

          if (start !== "" && end !== "") {
            min = calculateTotalMinutes(start, end)
            let maxTime = calculateTotalMinutes(accountingSetting.workScheduleStartTime, accountingSetting.workScheduleEndTime)
            total = min

            if (min > maxTime && accountingSetting.noOvertime) {
              overTime = calculateTotalMinutes(accountingSetting.workScheduleEndTime, end)
              total = maxTime
            }
          } else {
            // Apply penalties only when start or end time is missing
            if (start === "") {
              penalty += accountingSetting.noSignInPenalty;
            }
            if (end === "") {
              penalty += accountingSetting.noSignOutPenalty;
            }
            
            // If there's a start time but no end time, calculate total up to the scheduled end time
            if (start !== "" && end === "") {
              total = calculateTotalMinutes(start, accountingSetting.workScheduleEndTime);
            }
            // If there's an end time but no start time, calculate total from the scheduled start time
            else if (start === "" && end !== "") {
              total = calculateTotalMinutes(accountingSetting.workScheduleStartTime, end);
            }
          }

          // Deduct penalty from total minutes worked
          total = Math.max(0, total - penalty);

          userTotalmin = userTotalmin + total

          currentUser.logs[day] = {
            'start': start,
            'end': end,
            'min': min,
            'totalMin': total,
            'overTime': overTime < 0 ? 0 : overTime,
            'penaltyMin': penalty
          }
        }
      }
      currentUser.totalMinutes = userTotalmin

      logsData.users.push(currentUser);

      // Skip to the next row
      R += 1;
    } 
  }

  // Push the last user data if present
  if (currentUser) {
    logsData.users.push(currentUser);
  }

  return logsData;
}

// Path to the uploaded Excel file
const excelFilePath = path.resolve(__dirname, '001_2024_7_MON.xls');
const outputJsonPath = path.resolve(__dirname, 'line4Data.json');

function writeDataToJsonFile(data, outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
}

function timeStringToDate(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0); // Set hours and minutes
  return date;
}

// Function to compare two time strings
function isTimeGreater(time1, time2) {
  const date1 = timeStringToDate(time1);
  const date2 = timeStringToDate(time2);
  return date1 > date2;
}

function calculateTotalMinutes(startTime, endTime) {
  // Split start time into hours and minutes
  const [startHours, startMinutes] = startTime.split(':').map(Number);

  // Split end time into hours and minutes
  const [endHours, endMinutes] = endTime.split(':').map(Number);

  // Convert both times to total minutes since midnight
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;

  // Calculate the difference in minutes
  const totalMinutes = endTotalMinutes - startTotalMinutes;

  return isNaN(totalMinutes) ? 0 : totalMinutes;
}

module.exports = { extractLogsSheet, writeDataToJsonFile };