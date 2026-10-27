const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const router = express.Router();

// Get all exams (Public for students, but protected by auth)
router.get('/', protect, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { is_published: true };
    const exams = await Exam.find(query).sort({ createdAt: -1 });
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single exam and its questions
router.get('/:id', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    const questions = await Question.find({ examId: req.params.id });
    res.json({ exam, questions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create an Exam and its Questions (ADMIN ONLY)
router.post('/', protect, admin, async (req, res) => {
  try {
    const { examData, questionsData } = req.body;
    const exam = await Exam.create({ ...examData, createdBy: req.user._id });
    
    const qs = questionsData.map(q => ({ ...q, examId: exam._id }));
    await Question.insertMany(qs);
    res.status(201).json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Exam (Handles full updates from EditExam, or partial toggles from AdminDashboard)
router.put('/:id', protect, admin, async (req, res) => {
  try {
    if (req.body.examData && req.body.questionsData) {
      const exam = await Exam.findByIdAndUpdate(req.params.id, req.body.examData, { new: true });
      await Question.deleteMany({ examId: req.params.id });
      const qs = req.body.questionsData.map(q => ({ ...q, examId: req.params.id }));
      await Question.insertMany(qs);
      res.json(exam);
    } else {
      const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(exam);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete Exam (ADMIN ONLY)
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    await Exam.findByIdAndDelete(req.params.id);
    await Question.deleteMany({ examId: req.params.id });
    res.json({ message: 'Exam deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;