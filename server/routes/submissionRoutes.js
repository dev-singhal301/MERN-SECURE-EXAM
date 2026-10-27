const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const Submission = require('../models/Submission');
const router = express.Router();

// Get logged-in student's submissions
router.get('/me', protect, async (req, res) => {
  try {
    const submissions = await Submission.find({ studentId: req.user._id });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all submissions for a specific exam
router.get('/exam/:examId', protect, admin, async (req, res) => {
  try {
    const submissions = await Submission.find({ examId: req.params.examId }).sort({ submitted_at: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Start Exam
router.post('/start', protect, async (req, res) => {
  try {
    const { examId, duration_minutes, selected_category } = req.body;
    let submission = await Submission.findOne({ examId, studentId: req.user._id });

    if (!submission) {
      const end_time = new Date(Date.now() + duration_minutes * 60 * 1000);
      submission = await Submission.create({
        examId, studentId: req.user._id, student_name: req.user.full_name,
        student_email: req.user.email, selected_category, end_time
      });
    }
    res.status(200).json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit Exam
router.put('/:id/submit', protect, async (req, res) => {
  try {
    const { answers, score, violations_count, is_terminated, time_taken_seconds, ai_usage_count } = req.body;
    const submission = await Submission.findByIdAndUpdate(
      req.params.id,
      { answers, score, violations_count, is_terminated, status: is_terminated ? 'terminated' : 'completed', time_taken_seconds, ai_usage_count },
      { new: true }
    );
    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin Route: Terminate a live student
router.put('/:id/terminate', protect, admin, async (req, res) => {
  try {
    const submission = await Submission.findByIdAndUpdate(req.params.id, { is_terminated: true, status: 'terminated' }, { new: true });
    req.app.get('io').to(`live_candidate_${submission.studentId}`).emit('exam_terminated');
    res.json({ message: 'Terminated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin Route: Grade Submission
router.put('/:id/grade', protect, admin, async (req, res) => {
  try {
    const { score, manual_grades } = req.body;
    const submission = await Submission.findByIdAndUpdate(req.params.id, { score, manual_grades, is_reviewed: true }, { new: true });
    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin Route: Bulk update leaderboard qualifications
router.put('/bulk-qualify', protect, admin, async (req, res) => {
  try {
    const { qualifiedIds, disqualifiedIds } = req.body;
    if (qualifiedIds?.length > 0) {
      await Submission.updateMany({ _id: { $in: qualifiedIds } }, {$set: { is_qualified: true } });
    }
    if (disqualifiedIds?.length > 0) {
      await Submission.updateMany({ _id: { $in: disqualifiedIds } }, {$set: { is_qualified: false } });
    }
    res.json({ message: 'Qualifications updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Leaderboard
router.get('/leaderboard/:examId', protect, async (req, res) => {
  try {
    const leaderboard = await Submission.find({ examId: req.params.examId, is_terminated: false })
      .sort({ score: -1, time_taken_seconds: 1, createdAt: 1 })
      .select('studentId student_name student_email score time_taken_seconds is_qualified');
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;