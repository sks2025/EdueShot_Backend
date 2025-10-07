import Quiz from "../Models/quiz.js";

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
        
        const quizWithStatus = {
            ...quizObj,
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



