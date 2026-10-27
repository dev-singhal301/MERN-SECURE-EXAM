const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  duration_minutes: { type: Number, required: true },
  is_published: { type: Boolean, default: false },
  is_ended: { type: Boolean, default: false },
  show_results: { type: Boolean, default: false },
  show_detailed_results: { type: Boolean, default: false },
  show_leaderboard: { type: Boolean, default: false },
  has_categories: { type: Boolean, default: false },
  category_selection_title: { type: String, default: 'Select Your Track' },
  category_selection_message: { type: String, default: 'Please select the track you wish to be tested on. You cannot change this later.' },
  allow_ai_assistant: { type: Boolean, default: false },
  ai_word_limit: { type: Number, default: 500 },
  ai_attempts_limit: { type: Number, default: 2 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);