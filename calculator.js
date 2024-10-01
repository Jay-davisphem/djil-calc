const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let settings = {
    weekdaySchedule: [8, 30, 17, 0],
    saturdaySchedule: [8, 30, 14, 0],
    sundaySchedule: null,
    noSignInPenalty: 0,
    noSignOutPenalty: 90, // Deduct 1.5 hours if no sign-out
    calculateOvertime: false,
    omittedDays: [], // New setting for omitted days
};

function parseLogInput(logInput) {
    const log = [];
    const lines = logInput.split('\n');
    lines.forEach(line => {
        const dayLog = line.split(',');
        log.push({
            sign_in: dayLog[0].trim() === 'N' ? null : dayLog[0].trim(),
            sign_out: dayLog[1].trim() === 'N' ? null : dayLog[1].trim(),
        });
    });
    return log;
}

function calculateWorkMinutes(log, month, year = 2024, settings) {
    let totalMinutes = { Weekday: 0, Saturday: 0, Sunday: 0 };
    let summary = '';
    let maxAttainableMinutes = 0;

    log.forEach((entry, index) => {
        const day = index + 1;
        const sign_in = entry.sign_in;
        const sign_out = entry.sign_out;

        const dayName = new Date(year, month - 1, day).toLocaleString('en-US', { weekday: 'long' });
        let workSchedule, dayType;

        if (dayName === 'Saturday') {
            workSchedule = settings.saturdaySchedule;
            dayType = 'Saturday';
        } else if (dayName === 'Sunday') {
            workSchedule = settings.sundaySchedule;
            dayType = 'Sunday';
        } else {
            workSchedule = settings.weekdaySchedule;
            dayType = 'Weekday';
        }

        let workMinutes = 0;
        if (workSchedule && sign_in) {
            let [startHour, startMinute, endHour, endMinute] = workSchedule;

            let signInTime = new Date(`${year}-${month}-${day}T${sign_in}:00`);
            let signOutTime = sign_out ? new Date(`${year}-${month}-${day}T${sign_out}:00`) : null;
            const startTime = new Date(`${year}-${month}-${day}T${startHour}:${startMinute}:00`);
            const endTime = new Date(`${year}-${month}-${day}T${endHour}:${endMinute}:00`);

            if (signInTime < startTime) signInTime.setHours(startHour, startMinute);
            if (!signOutTime) signOutTime = new Date(endTime.getTime() - settings.noSignOutPenalty * 60000);
            if (signOutTime > endTime) signOutTime = endTime;

            workMinutes = (signOutTime - signInTime) / 60000;
        }

        if (workMinutes) {
            totalMinutes[dayType] += workMinutes;
        }

        // Calculate max attainable minutes
        if (workSchedule && !settings.omittedDays.includes(day.toString())) {
            maxAttainableMinutes += (workSchedule[2] * 60 + workSchedule[3]) - (workSchedule[0] * 60 + workSchedule[1]);
        }

        summary += `${day}${getOrdinalSuffix(day)}: ${sign_in || 'N'}, ${sign_out || 'N'} (${dayName})\n`;
        if (!sign_in || !sign_out) {
            summary += '   - No sign-in or sign-out\n';
        }
        summary += `   - Work Minutes: ${Math.round(workMinutes)}\n\n`;
    });

    let finalSummary = `Summarizing:\n\n`;

    if (totalMinutes.Weekday) {
        finalSummary += `- Total Weekday Minutes: ${totalMinutes.Weekday} minutes\n`;
    }
    if (totalMinutes.Saturday) {
        finalSummary += `- Total Saturday Minutes: ${totalMinutes.Saturday} minutes\n`;
    }
    if (totalMinutes.Sunday) {
        finalSummary += `- Total Sunday Minutes: ${totalMinutes.Sunday} minutes\n`;
    }

    const finalTotal = totalMinutes.Weekday + totalMinutes.Saturday + totalMinutes.Sunday;
    finalSummary += `\nFinal Totals:\n- Total Work Minutes for ${getMonthName(month)} ${year}: ${finalTotal} minutes\n`;
    finalSummary += `- Maximum Attainable Minutes: ${maxAttainableMinutes} minutes\n`;

    return { finalTotal, summary, finalSummary, maxAttainableMinutes };
}

function getOrdinalSuffix(i) {
    const j = i % 10, k = i % 100;
    if (j == 1 && k != 11) {
        return "st";
    }
    if (j == 2 && k != 12) {
        return "nd";
    }
    if (j == 3 && k != 13) {
        return "rd";
    }
    return "th";
}

function getMonthName(monthNumber) {
    const date = new Date();
    date.setMonth(monthNumber - 1);
    return date.toLocaleString('en-US', { month: 'long' });
}

app.post('/settings', (req, res) => {
    const { weekdaySchedule, saturdaySchedule, sundaySchedule, noSignInPenalty, noSignOutPenalty, calculateOvertime, omittedDays } = req.body;
    settings = {
        weekdaySchedule,
        saturdaySchedule,
        sundaySchedule: sundaySchedule || null,
        noSignInPenalty,
        noSignOutPenalty,
        calculateOvertime,
        omittedDays: omittedDays ? omittedDays.split(',').map(day => day.trim()) : [], // Parse omitted days
    };
    res.json({ success: true });
});

app.post('/calculate', (req, res) => {
    const { year, month, log, name } = req.body;
    const parsedLog = parseLogInput(log);
    const { finalTotal, summary, finalSummary, maxAttainableMinutes } = calculateWorkMinutes(parsedLog, month, year, settings);
    res.json({ name, final_total: finalTotal, summary, final_summary: finalSummary, max_attainable_minutes: maxAttainableMinutes });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});