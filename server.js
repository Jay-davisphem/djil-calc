const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const { extractLogsSheet, writeDataToJsonFile } = require('./test');
const app = express();
const port = 3000;

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir); // Use the dynamically created directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const mongoURI = 'mongodb+srv://josiah:12345@cluster0.ebpon.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

// Define a schema and model for storing Excel data
const excelDataSchema = new mongoose.Schema({
  data: Object, // Schema could be refined based on the expected data structure
});

const ExcelData = mongoose.model('ExcelData', excelDataSchema);

const upload = multer({ storage: storage });

// Serve static files from 'public' directory
// app.use(express.static('public'));

app.use(cors());
app.use(express.json());

// Middleware to parse URL-encoded data
app.use(express.urlencoded({ extended: true }));

const settingsSchema = new mongoose.Schema({
  department: { type: String, required: true, unique: true }, // Department name (unique for each department)
  noOvertime: { type: Boolean, default: false }, // No overtime allowed (Yes/No)
  workScheduleEndTime: { type: String, default: '17:30' }, // Work schedule end time, e.g., '17:30' for 5:30 PM
  workScheduleStartTime: { type: String, default: '08:30' },
  noSignOutPenalty: { type: Number, default: null }, // Penalty minutes for not signing out
  noSignInPenalty: { type: Number, default: 0 } // Penalty minutes for not signing in
});

// Create a model for Settings
const Settings = mongoose.model('Settings', settingsSchema);

// Route for handling file upload
app.post('/upload', upload.single('file'), async (req, res) => {
    console.log(req.file); // Debugging line to check if file is being uploaded
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path; // Get the file path

    try {
        const settings = await Settings.find();
        const jsonData = await extractLogsSheet(filePath, settings);
        const outputJsonPath = path.resolve(__dirname, 'line4Data.json');
        await writeDataToJsonFile(jsonData, outputJsonPath);

        res.json(jsonData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/settings', async (req, res) => {
  try {
    console.log(req.body)
    const { department, noOvertime, workScheduleEndTime, workScheduleStartTime, noSignOutPenalty, noSignInPenalty } = req.body;

    // Validate department
    if (!department) {
      return res.status(400).json({ message: 'Department is required.' });
    }

    // Check if settings already exist for this department in the database
    let settings = await Settings.findOne({ department });

    if (settings) {
      // Update existing settings for this department
      settings.noOvertime = noOvertime ?? settings.noOvertime;
      settings.workScheduleEndTime = workScheduleEndTime ?? settings.workScheduleEndTime;
      settings.workScheduleStartTime = workScheduleStartTime ?? settings.workScheduleStartTime;
      settings.noSignOutPenalty = noSignOutPenalty ?? settings.noSignOutPenalty;
      settings.noSignInPenalty = noSignInPenalty ?? settings.noSignInPenalty;
    } else {
      // Create new settings for this department
      settings = new Settings({
        department,
        noOvertime,
        workScheduleEndTime,
        workScheduleStartTime,
        noSignOutPenalty,
        noSignInPenalty
      });
    }

    await settings.save();
    res.status(200).json({ message: 'Settings saved successfully', settings });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).send('An error occurred while saving settings.');
  }
});

// GET endpoint to retrieve settings for a specific department
app.get('/settings/:department', async (req, res) => {
  try {
    const { department } = req.params;

    // Find settings for the specified department
    const settings = await Settings.findOne({ department });

    if (!settings) {
      return res.status(404).json({ message: 'Settings not found for this department.' });
    }

    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).send('An error occurred while fetching settings.');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
