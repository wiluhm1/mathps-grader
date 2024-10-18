const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 5500;

// Helper function to create a unique folder name with a timestamp
function getUniqueFolderName(baseFolderPath) {
    const timestamp = Date.now(); // Use current timestamp for uniqueness
    return `${baseFolderPath}_${timestamp}`;
}

// Setup file storage with dynamic folder creation
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const assignmentName = req.body.assignmentName || 'untitled-assignment';
        const sanitizedAssignmentName = assignmentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const baseFolderPath = path.join('uploads', sanitizedAssignmentName);

        // Get a unique folder name by appending a timestamp
        const uniqueFolderPath = getUniqueFolderName(baseFolderPath);

        // Ensure the assignment folder exists
        if (!fs.existsSync(uniqueFolderPath)) {
            fs.mkdirSync(uniqueFolderPath, { recursive: true });
        }

        cb(null, uniqueFolderPath); // Set the unique upload folder
    },
    filename: function (req, file, cb) {
        let fileName = file.fieldname === 'blankProblemSet' ? 'blankProblemSet' : 'teacherSolution';
        cb(null, `${fileName}${path.extname(file.originalname)}`); // Name the file appropriately
    }
});

const upload = multer({ storage: storage });

// Serve static HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/create-assignment.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'create-assignment.html'));
});

// Handle form submission for creating a new assignment
app.post('/uploadAssignment', upload.fields([{ name: 'blankProblemSet' }, { name: 'teacherSolution' }]), (req, res) => {
    console.log('Received form submission for uploadAssignment'); // Check if route is hit

    const { assignmentName, className } = req.body;

    if (!assignmentName || !className) {
        console.log('Missing assignment name or class name'); // Log missing data
        return res.status(400).json({ message: 'Missing assignment name or class name' });
    }

    const sanitizedAssignmentName = assignmentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const baseFolderPath = path.join('uploads', sanitizedAssignmentName);

    // Get a unique folder name for this assignment
    const uniqueFolderPath = getUniqueFolderName(baseFolderPath);

    const blankProblemSet = req.files.blankProblemSet ? req.files.blankProblemSet[0].path : '';
    const teacherSolution = req.files.teacherSolution ? req.files.teacherSolution[0].path : '';

    console.log('Assignment data:', { assignmentName, className, blankProblemSet, teacherSolution }); // Log form data

    const newAssignment = {
        assignmentName,
        className,
        blankProblemSet,
        teacherSolution,
        folderPath: uniqueFolderPath // Store the unique folder path in the assignment data
    };

    // Save to a JSON file (you could replace this with a database)
    fs.readFile('assignments.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading assignments.json:', err); // Log file read error
            return res.status(500).send('Error reading assignments data.');
        }

        const assignments = JSON.parse(data || '[]');
        assignments.push(newAssignment);

        fs.writeFile('assignments.json', JSON.stringify(assignments, null, 2), (err) => {
            if (err) {
                console.error('Error saving assignment to assignments.json:', err); // Log file write error
                return res.status(500).send('Error saving assignment.');
            }

            console.log('Assignment saved successfully!'); // Log success
            res.status(200).json({ message: 'Assignment uploaded successfully' });
        });
    });
});

// Route to get all assignments as JSON
app.get('/getAssignments', (req, res) => {
    fs.readFile('assignments.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading assignments data.');
        }

        const assignments = JSON.parse(data || '[]');
        res.json(assignments);  // Respond with JSON data
    });
});

// Route to update an existing assignment
app.post('/updateAssignment', upload.fields([{ name: 'blankProblemSet' }, { name: 'teacherSolution' }]), (req, res) => {
    const { index } = req.query;
    const { assignmentName, className } = req.body;

    fs.readFile('assignments.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading assignments data.');
        }

        const assignments = JSON.parse(data || '[]');

        if (!assignments[index]) {
            return res.status(404).send('Assignment not found');
        }

        const updatedAssignment = {
            ...assignments[index],
            assignmentName,
            className,
            blankProblemSet: req.files.blankProblemSet ? req.files.blankProblemSet[0].path : assignments[index].blankProblemSet,
            teacherSolution: req.files.teacherSolution ? req.files.teacherSolution[0].path : assignments[index].teacherSolution,
        };

        assignments[index] = updatedAssignment;

        fs.writeFile('assignments.json', JSON.stringify(assignments, null, 2), (err) => {
            if (err) {
                return res.status(500).send('Error updating assignment.');
            }

            res.status(200).send('Assignment updated successfully');
        });
    });
});

// Route to delete an assignment
app.delete('/deleteAssignment', (req, res) => {
    const { index } = req.query;

    fs.readFile('assignments.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading assignments data.');
        }

        let assignments = JSON.parse(data || '[]');

        if (!assignments[index]) {
            return res.status(404).send('Assignment not found');
        }

        const assignmentFolder = assignments[index].folderPath;

        // Delete the assignment folder and its contents
        fs.rmdir(assignmentFolder, { recursive: true }, (err) => {
            if (err) {
                return res.status(500).send('Error deleting assignment folder.');
            }

            // Remove the assignment from the list
            assignments.splice(index, 1);

            fs.writeFile('assignments.json', JSON.stringify(assignments, null, 2), (err) => {
                if (err) {
                    return res.status(500).send('Error deleting assignment.');
                }

                res.status(200).send('Assignment deleted successfully');
            });
        });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://127.0.0.1:${port}`);
});
