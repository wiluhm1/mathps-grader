import os
from flask import Flask, request, jsonify
import requests
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # This allows cross-origin requests from your frontend

# Directory to save uploaded files temporarily
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# API Key for OpenAI's GPT (replace with your own key)
OPENAI_API_KEY = 'insert api key here'

# Route to handle assessment requests
@app.route('/api/assess-student', methods=['POST'])
def assess_student():
    try:
        # Get the uploaded files
        blank_problem_set = request.files.get('blankProblemSet')
        teacher_solution = request.files.get('teacherSolution')
        student_solution = request.files.get('studentSolution')

        # Check if all files were uploaded
        if not blank_problem_set or not teacher_solution or not student_solution:
            return jsonify({'error': 'Missing one or more files.'}), 400

        # Save the files to the upload folder
        blank_problem_set_path = os.path.join(UPLOAD_FOLDER, blank_problem_set.filename)
        teacher_solution_path = os.path.join(UPLOAD_FOLDER, teacher_solution.filename)
        student_solution_path = os.path.join(UPLOAD_FOLDER, student_solution.filename)

        blank_problem_set.save(blank_problem_set_path)
        teacher_solution.save(teacher_solution_path)
        student_solution.save(student_solution_path)

        # Determine file types and read content accordingly
        def read_file_content(file_path):
            _, ext = os.path.splitext(file_path)
            if ext.lower() in ['.txt']:  # Only read text files
                with open(file_path, 'r', encoding='utf-8') as file:
                    return file.read()
            else:
                return f"[{ext.upper()} file, cannot be displayed as text]"

        # Read the contents of the text-based files only
        blank_problem_set_content = read_file_content(blank_problem_set_path)
        teacher_solution_content = read_file_content(teacher_solution_path)
        student_solution_content = read_file_content(student_solution_path)

        # Construct the prompt for ChatGPT
        prompt = f"""
        You are a teacher assessing a student's submission.

        Blank Problem Set:
        {blank_problem_set_content}

        Teacher Solution:
        {teacher_solution_content}

        Student's Submission:
        {student_solution_content}

        For each question, please provide feedback on the student's submission. 
        Give a score out of 100 on the student's solution compared to the teacher's solution.
        If you cannot interpret any parts of the student's solution, please specify what those parts are.
        
        Finally, output a brief assessment of the parts of the student's solution in the following format:
        Errors in solution: Y/N/?
        Showed work: Y/N/?
        Final answer correct: Y/N/?
        """

        # Log the prompt being sent
        print("Sending prompt to OpenAI API:", prompt)

        # Send the request to ChatGPT API
        response = requests.post(
            'https://api.openai.com/v1/completions',
            headers={
                'Authorization': f'Bearer {OPENAI_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'gpt-4',
                'prompt': prompt,
                'max_tokens': 1000
            }
        )

        # Check if the response from OpenAI was successful
        if response.status_code != 200:
            return jsonify({'error': 'Error from OpenAI API: ' + response.text}), response.status_code

        result = response.json()
        assessment_text = result['choices'][0]['text']

        # Clean up the uploaded files after processing
        os.remove(blank_problem_set_path)
        os.remove(teacher_solution_path)
        os.remove(student_solution_path)

        return jsonify({'assessment': assessment_text})

    except Exception as e:
        print(f"Error in assessment: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Entry point to start the server
if __name__ == '__main__':
    app.run(debug=True, port=5500)  # Run the app on localhost:5000 with debug mode enabled
