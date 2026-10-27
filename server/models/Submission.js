const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  student_name: { type: String },
  student_email: { type: String },
  selected_category: { type: String, default: null },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  manual_grades: { type: mongoose.Schema.Types.Mixed, default: {} },
  is_reviewed: { type: Boolean, default: false },
  score: { type: Number, default: 0 },
  violations_count: { type: Number, default: 0 },
  is_terminated: { type: Boolean, default: false },
  status: { type: String, enum: ['in_progress', 'completed', 'terminated'], default: 'in_progress' },
  time_taken_seconds: { type: Number, default: 0 },
  ai_usage_count: { type: Number, default: 0 },
  is_qualified: { type: Boolean, default: null },
  end_time: { type: Date }
}, { timestamps: true });

// Ensure a student can only have one submission per exam
submissionSchema.index({ examId: 1, studentId: 1 }, { unique: true });
// Index for the leaderboard queries
submissionSchema.index({ examId: 1, score: -1, time_taken_seconds: 1, createdAt: 1 });

module.exports = mongoose.model('Submission', submissionSchema);