import Quiz from "../Models/quiz.js";

// ✅ Create Quiz (Teacher only)
export const createQuiz = async (req, res) => {
    try {
        const { title, description, questions } = req.body;

        if (req.user.role !== "teacher") {
            return res.status(403).json({ message: "Only teachers can create quizzes." });
        }

        // Validate that each question has timeLimit
        for (const q of questions) {
            if (!q.timeLimit || q.timeLimit < 5) {
                return res.status(400).json({
                    message: "Each question must have a timeLimit of at least 5 seconds."
                });
            }
        }

        const quiz = new Quiz({
            title,
            description,
            questions,
            createdBy: req.user.userId
        });

        await quiz.save();
        res.status(201).json({ message: "Quiz created successfully", quiz });
    } catch (error) {
        res.status(500).json({ message: "Error creating quiz", error: error.message });
    }
};

// ✅ Fetch all quizzes
export const getAllQuizzes = async (req, res) => {
    try {
        const quizzes = await Quiz.find().populate("createdBy", "name email");
        res.status(200).json(quizzes);
    } catch (error) {
        res.status(500).json({ message: "Error fetching quizzes", error: error.message });
    }
};

// ✅ Fetch single quiz
export const getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id).populate("createdBy", "name email");
        if (!quiz) return res.status(404).json({ message: "Quiz not found" });
        res.status(200).json(quiz);
    } catch (error) {
        res.status(500).json({ message: "Error fetching quiz", error: error.message });
    }
};
