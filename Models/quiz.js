import mongoose from 'mongoose';

// Schema for each Question
const questionSchema = new mongoose.Schema({
    questionText: { type: String, required: true },
    options: {
        type: [String], // Array of 4 options
        validate: {
            validator: (v) => v.length === 4,
            message: "Each question must have exactly 4 options."
        },
        required: true
    },
    correctAnswer: {
        type: Number, // Index (0–3) of the correct option
        required: true,
        min: 0,
        max: 3
    },
    timeLimit: { 
        type: Number, // Time in seconds to answer
        required: true,
        min: 5,
        default: 30 // Default 30 seconds if not specified
    }
}, { _id: false });

// Main Quiz Schema
const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    questions: {
        type: [questionSchema],
        validate: {
            validator: (v) => v.length > 0,
            message: "Quiz must contain at least one question."
        },
        required: true
    }
}, { timestamps: true });

export default mongoose.model("Quiz", quizSchema);
