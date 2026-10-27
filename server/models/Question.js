const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  question_text: { type: String, required: true },
  type: { type: String, enum: ['single', 'multiple', 'boolean', 'text'], required: true },
  options: { type: [String], default: [] },
  correct_answers: { type: [Number], default: [] },
  marks: { type: Number, default: 1 },
  negative_marks: { type: Number, default: 0 },
  category: { type: String, default: 'General' }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);