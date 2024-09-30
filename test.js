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
    // console.log(`Sheet "${sheetName}" not found in the workbook.`);
    return;
  }

  // Get the worksheet
  const worksheet = workbook.Sheets[sheetName];
  fs.unlinkSync(filePath);
  return extractData(worksheet, settings)
  // Convert the worksheet to JSON format
//   const jsonData = xlsx.utils.sheet_to_json(worksheet);

//   return jsonData;
}

function extractData(worksheet, settings){
    // Extract the period date from cell D2 (Assuming D2 has the period date based on the image)
  const period = worksheet['C3'] ? worksheet['C3'].v : '';


  // Initialize data structure
  const logsData = {
    period: period,
    users: []
  };

  // Iterate over the worksheet to extract user data
  const range = xlsx.utils.decode_range(worksheet['!ref']);
//   return range
  let currentUser = null;
  const rowData = [];
  for (let C = range.s.c; C <= range.e.c; C++) {

    const cellAddress = xlsx.utils.encode_cell({ r: 4 - 1, c: C }); // Subtract 1 for 0-based index
    const cell = worksheet[cellAddress];

    // Add cell value to rowData array if it exists
    rowData.push(cell ? cell.v : null);
  }

//   return rowData;

  for (let R = range.s.r; R <= range.e.r; R++) {
    // console.log(R)
    // Read user information
    const noCell = worksheet[xlsx.utils.encode_cell({ r: R, c: 0 })];
    const nameCell = worksheet[xlsx.utils.encode_cell({ r: R, c: 10 })];
    const deptCell = worksheet[xlsx.utils.encode_cell({ r: R, c: 20 })];
    
    // console.log(nameCell)

    if (noCell && noCell.v === 'No :') {
      // If we encounter 'No:', it indicates a new user section
        const year = period.substring(0, 4);
        const month = period.substring(5, 7);

      // Create a new user object
      let userTotalmin = 0
      currentUser = {
        number: worksheet[xlsx.utils.encode_cell({ r: R, c: 2 })].v,
        name: nameCell ? nameCell.v : '',
        department: deptCell ? deptCell.v:'',
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
        day = dayName+ "-"+ date
        // console.log(accountingSetting)
        if (day) {
            let times = worksheet[xlsx.utils.encode_cell({ r: R + 1, c: C })]?.v || '';
            let start = times.split('\n')[0]??"";
            let time = times.split('\n');
            const len = time.length
            let end = time[1]??""
            // console.log("end"+end)
            let penalty = 0
            let overTime = 0
            let total = 0
            let min = 0
            if(start == "" && end == ''){
              total = min
            }else{
            // if(start !== ''){
            //   if (isTimeGreater(start,"12:00")){
            //     end = start;
            //     // start = accountingSetting.workScheduleStartTime;
            //   }

            // }

            // if (start !=="" && end=="") {
            //   end = accountingSetting.workScheduleEndTime ;
            // }
            

            let min = calculateTotalMinutes(start, end)
            let maxTime = calculateTotalMinutes(accountingSetting.workScheduleStartTime, accountingSetting.workScheduleEndTime)
            total = min
            if(min>maxTime && accountingSetting.noOvertime){
              overTime = calculateTotalMinutes(accountingSetting.workScheduleEndTime, end)
              total = maxTime
            }

            
            if(isTimeGreater(start, accountingSetting.workScheduleStartTime)){
              total = total - accountingSetting.noSignInPenalty
              penalty = accountingSetting.noSignInPenalty
            } 
            if(isTimeGreater(accountingSetting.workScheduleEndTime, end)){
              total = total - accountingSetting.noSignOutPenalty
              penalty = accountingSetting.noSignOutPenalty
            }



            
            userTotalmin = userTotalmin + total
          }
            // console.log(calculateTotalMinutes(start, end)); 
            currentUser.logs[day]= {
                'start': start,
                'end': end,
                'min': min == NaN?0:min,
                'totalMin': total == NaN?0:total,
                'overTime': overTime < 0?0:overTime,
                'penaltyMin': penalty
            }

          
        //   console.log(worksheet[xlsx.utils.encode_cell({ r: R + 2, c: C })]?.v || '')
        //   console.log(R)
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
// console.log(excelFilePath)
const outputJsonPath = path.resolve(__dirname, 'line4Data.json');

function writeDataToJsonFile(data, outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    // console.log(`Data successfully written to ${outputPath}`);
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
  
    // Check if end time is not provided or empty

  
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