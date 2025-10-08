import Quiz from "../Models/quiz.js";
import User from "../Models/userModel.js";
import QuizAttempt from "../Models/quizAttemptModel.js";

// Helper function to update quiz status based on timing
const updateQuizStatus = (quiz) => {
    // Check if required fields exist
    if (!quiz.startDate || !quiz.endDate || !quiz.startTime || !quiz.endTime) {
        return 'invalid';
    }
    
    const now = new Date();
    const startDateTime = new Date(`${quiz.startDate.toISOString().split('T')[0]}T${quiz.startTime}`);
    const endDateTime = new Date(`${quiz.endDate.toISOString().split('T')[0]}T${quiz.endTime}`);
    
    if (now < startDateTime) {
        return 'scheduled';
    } else if (now >= startDateTime && now <= endDateTime) {
        return 'active';
    } else {
        return 'ended';
    }
};

// ✅ Create Quiz (Teacher only)
export const createQuiz = async (req, res) => {
    try {
        const { 
            title, 
            description, 
            questions, 
            startDate, 
            endDate, 
            startTime, 
            endTime, 
            totalDuration 
        } = req.body;

        // Check if user is teacher
        if (req.user.role !== "teacher") {
            return res.status(403).json({ 
                success: false,
                message: "Only teachers can create quizzes." 
            });
        }

        // Validate required fields
        if (!title || !questions || !startDate || !endDate || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "Title, questions, startDate, endDate, startTime, and endTime are required."
            });
        }

        // Validate questions array
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Quiz must contain at least one question."
            });
        }

        // Validate each question
        for (const q of questions) {
            if (!q.questionText || !q.options || !Array.isArray(q.options) || q.options.length !== 4) {
                return res.status(400).json({
                    success: false,
                    message: "Each question must have questionText and exactly 4 options."
                });
            }
            
            if (q.correctAnswer === undefined || q.correctAnswer < 0 || q.correctAnswer > 3) {
                return res.status(400).json({
                    success: false,
                    message: "Each question must have a valid correctAnswer (0-3)."
                });
            }

            if (!q.timeLimit || q.timeLimit < 5) {
                return res.status(400).json({
                    success: false,
                    message: "Each question must have a timeLimit of at least 5 seconds."
                });
            }
        }

        // Validate dates
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);
        const now = new Date();

        if (startDateTime <= now) {
            return res.status(400).json({
                success: false,
                message: "Quiz start date and time must be in the future."
            });
        }

        if (endDateTime <= startDateTime) {
            return res.status(400).json({
                success: false,
                message: "Quiz end date and time must be after start date and time."
            });
        }

        // Validate time format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            return res.status(400).json({
                success: false,
                message: "Time must be in HH:MM format (24-hour)."
            });
        }

        // Calculate total duration if not provided
        let calculatedDuration = totalDuration;
        if (!calculatedDuration) {
            const diffInMinutes = Math.ceil((endDateTime - startDateTime) / (1000 * 60));
            calculatedDuration = diffInMinutes;
        }

        const quiz = new Quiz({
            title,
            description,
            questions,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            startTime,
            endTime,
            totalDuration: calculatedDuration,
            createdBy: req.user.userId
        });

        await quiz.save();
        
        res.status(201).json({ 
            success: true,
            message: "Quiz created successfully", 
            quiz: {
                ...quiz.toObject(),
                startDateTime: startDateTime,
                endDateTime: endDateTime
            }
        });
    } catch (error) {
        console.error('Create quiz error:', error);
        res.status(500).json({ 
            success: false,
            message: "Error creating quiz", 
            error: error.message 
        });
    }
};

// ✅ Fetch all quizzes
export const getAllQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find().populate("createdBy", "name email");
        
        // Add status and timing information to each quiz
        const quizzesWithStatus = quizzes.map(quiz => {
            const quizObj = quiz.toObject();
            const status = updateQuizStatus(quiz);
            const startDateTime = new Date(`${quiz.startDate.toISOString().split('T')[0]}T${quiz.startTime}`);
            const endDateTime = new Date(`${quiz.endDate.toISOString().split('T')[0]}T${quiz.endTime}`);
            
            return {
                ...quizObj,
                status,
                startDateTime,
                endDateTime,
                isActive: status === 'active',
                isScheduled: status === 'scheduled',
                isEnded: status === 'ended'
            };
        });
        
        res.status(200).json({
            success: true,
            quizzes: quizzesWithStatus
        });
    } catch (error) {
        console.error('Get all quizzes error:', error);
        res.status(500).json({ 
            success: false,
            message: "Error fetching quizzes", 
            error: error.message 
        });
    }
};

// ✅ Fetch single quiz
export const getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id).populate("createdBy", "name email");
        if (!quiz) {
            return res.status(404).json({ 
                success: false,
                message: "Quiz not found" 
            });
        }
        
        // Add status and timing information
        const quizObj = quiz.toObject();
        const status = updateQuizStatus(quiz);
        const startDateTime = new Date(`${quiz.startDate.toISOString().split('T')[0]}T${quiz.startTime}`);
        const endDateTime = new Date(`${quiz.endDate.toISOString().split('T')[0]}T${quiz.endTime}`);
        
        // Remove correct answers from questions for security
        const questionsWithoutAnswers = quizObj.questions.map(q => ({
            questionText: q.questionText,
            options: q.options,
            timeLimit: q.timeLimit
            // correctAnswer is intentionally excluded
        }));

        const quizWithStatus = {
            ...quizObj,
            questions: questionsWithoutAnswers, // Use questions without correct answers
            status,
            startDateTime,
            endDateTime,
            isActive: status === 'active',
            isScheduled: status === 'scheduled',
            isEnded: status === 'ended'
        };
        
        res.status(200).json({
            success: true,
            quiz: quizWithStatus
        });
    } catch (error) {
        console.error('Get quiz by ID error:', error);
        res.status(500).json({ 
            success: false,
            message: "Error fetching quiz", 
            error: error.message 
        });
    }
};

// ✅ Delete Quiz (Teacher only - can only delete own quizzes)
export const deleteQuiz = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;

        // Check if user is teacher
        if (userRole !== "teacher") {
            return res.status(403).json({
                success: false,
                message: "Only teachers can delete quizzes."
            });
        }

        // Find the quiz
        const quiz = await Quiz.findById(id);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "Quiz not found."
            });
        }

        // Check if the teacher owns this quiz
        if (quiz.createdBy.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own quizzes."
            });
        }

        // Check if quiz is currently active (optional - you might want to prevent deletion of active quizzes)
        const status = updateQuizStatus(quiz);
        if (status === 'active') {
            return res.status(400).json({
                success: false,
                message: "Cannot delete an active quiz. Please wait for it to end."
            });
        }

        // Delete the quiz
        await Quiz.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Quiz deleted successfully.",
            deletedQuiz: {
                id: quiz._id,
                title: quiz.title,
                status: status
            }
        });

    } catch (error) {
        console.error('Delete quiz error:', error);
        res.status(500).json({
            success: false,
            message: "Error deleting quiz",
            error: error.message
        });
    }
};

// ✅ Get all quizzes for student dashboard (created by teachers)
export const getQuizzesForStudentDashboard = async (req, res) => {
    try {
        // Check if user is student
        if (req.user.role !== "student") {
            return res.status(403).json({ 
                success: false,
                message: "Only students can access this endpoint." 
            });
        }

        // Get all quizzes created by teachers, populate teacher information
        const quizzes = await Quiz.find()
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 }); // Sort by newest first
        
        // Add status and timing information to each quiz
        const quizzesWithStatus = quizzes.map(quiz => {
            const quizObj = quiz.toObject();
            
            // Check if startDate and endDate exist before processing
            if (!quiz.startDate || !quiz.endDate) {
                console.warn(`Quiz ${quiz._id} has missing startDate or endDate`);
                return {
                    ...quizObj,
                    status: 'invalid',
                    startDateTime: null,
                    endDateTime: null,
                    isActive: false,
                    isScheduled: false,
                    isEnded: false,
                    teacherName: quiz.createdBy?.name || 'Unknown Teacher',
                    teacherEmail: quiz.createdBy?.email || 'Unknown Email',
                    error: 'Missing start or end date'
                };
            }
            
            const status = updateQuizStatus(quiz);
            const startDateTime = new Date(`${quiz.startDate.toISOString().split('T')[0]}T${quiz.startTime}`);
            const endDateTime = new Date(`${quiz.endDate.toISOString().split('T')[0]}T${quiz.endTime}`);
            
            return {
                ...quizObj,
                status,
                startDateTime,
                endDateTime,
                isActive: status === 'active',
                isScheduled: status === 'scheduled',
                isEnded: status === 'ended',
                teacherName: quiz.createdBy?.name || 'Unknown Teacher',
                teacherEmail: quiz.createdBy?.email || 'Unknown Email'
            };
        });
        
        res.status(200).json({
            success: true,
            message: "Quizzes fetched successfully for student dashboard",
            count: quizzesWithStatus.length,
            quizzes: quizzesWithStatus
        });
    } catch (error) {
        console.error('Get quizzes for student dashboard error:', error);
        res.status(500).json({ 
            success: false,
            message: "Error fetching quizzes for dashboard", 
            error: error.message 
        });
    }
};

// ✅ Get simplified quiz list for student dashboard (only essential info)
export const getStudentDashboardQuizzes = async (req, res) => {
    try {
        // Check if user is student
        if (req.user.role !== "student") {
            return res.status(403).json({ 
                success: false,
                message: "Only students can access this endpoint." 
            });
        }

        // Get all quizzes with only essential fields
        const quizzes = await Quiz.find()
            .select('title category startDate startTime questions')
            .populate("createdBy", "name")
            .sort({ startDate: 1, startTime: 1 }); // Sort by start date and time
        
        // Transform to simplified format
        const simplifiedQuizzes = quizzes.map(quiz => {
            const status = updateQuizStatus(quiz);
            const startDateTime = new Date(`${quiz.startDate.toISOString().split('T')[0]}T${quiz.startTime}`);
            
            return {
                _id: quiz._id,
                title: quiz.title,
                category: quiz.category,
                startTime: quiz.startTime,
                startDate: quiz.startDate,
                startDateTime: startDateTime,
                numberOfQuestions: quiz.questions.length,
                status: status,
                teacherName: quiz.createdBy?.name || 'Unknown Teacher'
            };
        });
        
        res.status(200).json({
            success: true,
            message: "Student dashboard quizzes fetched successfully",
            count: simplifiedQuizzes.length,
            quizzes: simplifiedQuizzes
        });
    } catch (error) {
        console.error('Get student dashboard quizzes error:', error);
        res.status(500).json({ 
            success: false,
            message: "Error fetching student dashboard quizzes", 
            error: error.message 
        });
    }
};

// ✅ Start Quiz - Student begins playing a quiz
export const startQuiz = async (req, res) => {
    try {
        const { quizId } = req.params;
        const studentId = req.user.userId;

        // Check if user is student
        if (req.user.role !== "student") {
            return res.status(403).json({
                success: false,
                message: "Only students can start quizzes."
            });
        }

        // Find the quiz
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "Quiz not found."
            });
        }

        // Check quiz status
        const status = updateQuizStatus(quiz);
        if (status !== 'active') {
            return res.status(400).json({
                success: false,
                message: `Quiz is not currently active. Status: ${status}`,
                quizStatus: status
            });
        }

        // Check if student has already attempted this quiz
        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        // Check if student has already attempted this quiz
        if (student.quizAttempts && student.quizAttempts.includes(quizId)) {
            return res.status(400).json({
                success: false,
                message: "You have already attempted this quiz."
            });
        }

        // Create quiz session data
        const quizSession = {
            quizId: quiz._id,
            studentId: studentId,
            startTime: new Date(),
            currentQuestionIndex: 0,
            answers: [],
            totalQuestions: quiz.questions.length,
            timeRemaining: quiz.totalDuration * 60 // Convert minutes to seconds
        };

        res.status(200).json({
            success: true,
            message: "Quiz started successfully",
            quizSession: {
                quizId: quiz._id,
                title: quiz.title,
                description: quiz.description,
                totalQuestions: quiz.questions.length,
                totalDuration: quiz.totalDuration,
                timeRemaining: quizSession.timeRemaining,
                currentQuestionIndex: 0
            }
        });

    } catch (error) {
        console.error('Start quiz error:', error);
        res.status(500).json({
            success: false,
            message: "Error starting quiz",
            error: error.message
        });
    }
};

// ✅ Get Quiz Question - Fetch a specific question for the student
export const getQuizQuestion = async (req, res) => {
    try {
        const { quizId, questionIndex } = req.params;
        const studentId = req.user.userId;

        // Check if user is student
        if (req.user.role !== "student") {
            return res.status(403).json({
                success: false,
                message: "Only students can access quiz questions."
            });
        }

        // Find the quiz
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "Quiz not found."
            });
        }

        // Check quiz status
        const status = updateQuizStatus(quiz);
        if (status !== 'active') {
            return res.status(400).json({
                success: false,
                message: `Quiz is not currently active. Status: ${status}`,
                quizStatus: status
            });
        }

        // Validate question index
        const questionIdx = parseInt(questionIndex);
        if (isNaN(questionIdx) || questionIdx < 0 || questionIdx >= quiz.questions.length) {
            return res.status(400).json({
                success: false,
                message: "Invalid question index."
            });
        }

        const question = quiz.questions[questionIdx];

        // Return question without correct answer - explicitly exclude correctAnswer
        const questionForStudent = {
            questionIndex: questionIdx,
            questionText: question.questionText,
            options: question.options,
            timeLimit: question.timeLimit,
            totalQuestions: quiz.questions.length,
            quizTitle: quiz.title
            // Note: correctAnswer is intentionally excluded for security
        };

        res.status(200).json({
            success: true,
            message: "Question fetched successfully",
            question: questionForStudent
        });

    } catch (error) {
        console.error('Get quiz question error:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching question",
            error: error.message
        });
    }
};

// ✅ Submit Answer - Student submits answer for a question
export const submitAnswer = async (req, res) => {
    try {
        const { quizId, questionIndex } = req.params;
        const { selectedAnswer } = req.body;
        const studentId = req.user.userId;

        // Check if user is student
        if (req.user.role !== "student") {
            return res.status(403).json({
                success: false,
                message: "Only students can submit answers."
            });
        }

        // Validate selected answer
        if (selectedAnswer === undefined || selectedAnswer < 0 || selectedAnswer > 3) {
            return res.status(400).json({
                success: false,
                message: "Invalid answer. Please select an option between 0-3."
            });
        }

        // Find the quiz
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "Quiz not found."
            });
        }

        // Check quiz status
        const status = updateQuizStatus(quiz);
        if (status !== 'active') {
            return res.status(400).json({
                success: false,
                message: `Quiz is not currently active. Status: ${status}`,
                quizStatus: status
            });
        }

        // Validate question index
        const questionIdx = parseInt(questionIndex);
        if (isNaN(questionIdx) || questionIdx < 0 || questionIdx >= quiz.questions.length) {
            return res.status(400).json({
                success: false,
                message: "Invalid question index."
            });
        }

        const question = quiz.questions[questionIdx];
        const isCorrect = selectedAnswer === question.correctAnswer;

        // For now, we'll just return the result
        // In a real application, you'd want to store this in a separate QuizAttempt model
        res.status(200).json({
            success: true,
            message: "Answer submitted successfully",
            result: {
                questionIndex: questionIdx,
                selectedAnswer: selectedAnswer,
                correctAnswer: question.correctAnswer,
                isCorrect: isCorrect,
                nextQuestionIndex: questionIdx + 1,
                isLastQuestion: questionIdx === quiz.questions.length - 1
            }
        });

    } catch (error) {
        console.error('Submit answer error:', error);
        res.status(500).json({
            success: false,
            message: "Error submitting answer",
            error: error.message
        });
    }
};

// ✅ Complete Quiz - Student finishes the quiz
export const completeQuiz = async (req, res) => {
    try {
        const { quizId } = req.params;
        const { answers } = req.body; // Array of {questionIndex, selectedAnswer}
        const studentId = req.user.userId;

        // Check if user is student
        if (req.user.role !== "student") {
            return res.status(403).json({
                success: false,
                message: "Only students can complete quizzes."
            });
        }

        // Find the quiz
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "Quiz not found."
            });
        }

        // Check quiz status
        const status = updateQuizStatus(quiz);
        if (status !== 'active') {
            return res.status(400).json({
                success: false,
                message: `Quiz is not currently active. Status: ${status}`,
                quizStatus: status
            });
        }

        // Validate answers array
        if (!Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Answers array is required and cannot be empty."
            });
        }

        // Calculate score
        let correctAnswers = 0;
        const detailedResults = [];

        answers.forEach(answer => {
            const questionIdx = answer.questionIndex;
            const selectedAnswer = answer.selectedAnswer;
            
            if (questionIdx >= 0 && questionIdx < quiz.questions.length) {
                const question = quiz.questions[questionIdx];
                const isCorrect = selectedAnswer === question.correctAnswer;
                
                if (isCorrect) {
                    correctAnswers++;
                }
                
                detailedResults.push({
                    questionIndex: questionIdx,
                    questionText: question.questionText,
                    selectedAnswer: selectedAnswer,
                    correctAnswer: question.correctAnswer,
                    isCorrect: isCorrect
                });
            }
        });

        const totalQuestions = quiz.questions.length;
        const score = (correctAnswers / totalQuestions) * 100;
        const marksObtained = (correctAnswers / totalQuestions) * quiz.totalMarks;

        // Check if student has already attempted this quiz
        const existingAttempt = await QuizAttempt.findOne({ 
            studentId: studentId, 
            quizId: quizId 
        });

        if (existingAttempt) {
            return res.status(400).json({
                success: false,
                message: "You have already completed this quiz."
            });
        }

        // Create quiz attempt record
        const quizAttempt = new QuizAttempt({
            studentId: studentId,
            quizId: quizId,
            answers: detailedResults,
            score: Math.round(score * 100) / 100,
            marksObtained: Math.round(marksObtained * 100) / 100,
            totalMarks: quiz.totalMarks,
            correctAnswers: correctAnswers,
            wrongAnswers: totalQuestions - correctAnswers,
            totalQuestions: totalQuestions,
            completedAt: new Date(),
            status: 'completed'
        });

        await quizAttempt.save();

        // Mark quiz as attempted for the student
        const student = await User.findById(studentId);
        if (student) {
            if (!student.quizAttempts) {
                student.quizAttempts = [];
            }
            if (!student.quizAttempts.includes(quizId)) {
                student.quizAttempts.push(quizId);
                await student.save();
            }
        }

        res.status(200).json({
            success: true,
            message: "Quiz completed successfully",
            results: {
                attemptId: quizAttempt._id,
                quizId: quiz._id,
                quizTitle: quiz.title,
                totalQuestions: totalQuestions,
                correctAnswers: correctAnswers,
                wrongAnswers: totalQuestions - correctAnswers,
                score: Math.round(score * 100) / 100, // Round to 2 decimal places
                marksObtained: Math.round(marksObtained * 100) / 100,
                totalMarks: quiz.totalMarks,
                completedAt: quizAttempt.completedAt,
                detailedResults: detailedResults
            }
        });

    } catch (error) {
        console.error('Complete quiz error:', error);
        res.status(500).json({
            success: false,
            message: "Error completing quiz",
            error: error.message
        });
    }
};

// ✅ Get Quiz Result - Retrieve completed quiz results
export const getQuizResult = async (req, res) => {
    try {
        const { quizId } = req.params;
        const studentId = req.user.userId;

        // Check if user is student
        if (req.user.role !== "student") {
            return res.status(403).json({
                success: false,
                message: "Only students can view quiz results."
            });
        }

        // Find the quiz
        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: "Quiz not found."
            });
        }

        // Check if student has attempted this quiz
        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        // Find the quiz attempt
        const quizAttempt = await QuizAttempt.findOne({ 
            studentId: studentId, 
            quizId: quizId 
        }).populate('quizId', 'title description totalMarks');

        if (!quizAttempt) {
            return res.status(400).json({
                success: false,
                message: "You have not attempted this quiz yet."
            });
        }

        res.status(200).json({
            success: true,
            message: "Quiz results retrieved successfully",
            result: {
                attemptId: quizAttempt._id,
                quizId: quiz._id,
                quizTitle: quiz.title,
                description: quiz.description,
                totalQuestions: quizAttempt.totalQuestions,
                correctAnswers: quizAttempt.correctAnswers,
                wrongAnswers: quizAttempt.wrongAnswers,
                score: quizAttempt.score,
                marksObtained: quizAttempt.marksObtained,
                totalMarks: quizAttempt.totalMarks,
                completedAt: quizAttempt.completedAt,
                status: quizAttempt.status,
                detailedResults: quizAttempt.answers
            }
        });

    } catch (error) {
        console.error('Get quiz result error:', error);
        res.status(500).json({
            success: false,
            message: "Error retrieving quiz result",
            error: error.message
        });
    }
};

// ✅ Get Recent Played Quizzes - Get student's recent quiz attempts
export const getRecentPlayedQuizzes = async (req, res) => {
    try {
        const studentId = req.user.userId;

        // Check if user is student
        if (req.user.role !== "student") {
            return res.status(403).json({
                success: false,
                message: "Only students can view their recent played quizzes."
            });
        }

        // Get recent quiz attempts with quiz details
        const recentAttempts = await QuizAttempt.find({ studentId: studentId })
            .populate('quizId', 'title description totalMarks')
            .sort({ completedAt: -1 }) // Sort by most recent first
            .limit(10); // Limit to 10 most recent attempts

        if (recentAttempts.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No quiz attempts found",
                count: 0,
                recentQuizzes: []
            });
        }

        // Format the response
        const formattedQuizzes = recentAttempts.map(attempt => {
            const quiz = attempt.quizId;
            return {
                attemptId: attempt._id,
                testName: quiz.title,
                totalQuestions: attempt.totalQuestions,
                correctAnswers: attempt.correctAnswers,
                wrongAnswers: attempt.wrongAnswers,
                percentage: attempt.score,
                marksObtained: attempt.marksObtained,
                totalMarks: attempt.totalMarks,
                completedAt: attempt.completedAt,
                status: attempt.status,
                quizDescription: quiz.description
            };
        });

        res.status(200).json({
            success: true,
            message: "Recent played quizzes retrieved successfully",
            count: formattedQuizzes.length,
            recentQuizzes: formattedQuizzes
        });

    } catch (error) {
        console.error('Get recent played quizzes error:', error);
        res.status(500).json({
            success: false,
            message: "Error retrieving recent played quizzes",
            error: error.message
        });
    }
};



