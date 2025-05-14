const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/freelancer_expense', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String
});

const userLogSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  name: String,
  email: String,
  createdAt: { type: Date, default: Date.now }
});

const expenseSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: String,
  amount: Number,
  category: String,
  date: Date
});

const expenseUpdateLogSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: String,
  amount: Number,
  category: String,
  date: Date,
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const UserLog = mongoose.model('UserLog', userLogSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const ExpenseUpdateLog = mongoose.model('ExpenseUpdateLog', expenseUpdateLogSchema);

// Signup
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const newUser = new User({ name, email, password });
    const savedUser = await newUser.save();

    // Save to user logs
    const newLog = new UserLog({ userId: savedUser._id, name, email });
    await newLog.save();

    res.status(201).json({ message: 'Signup successful', userId: savedUser._id });
  } catch (err) {
    res.status(500).json({ message: 'Signup error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (email.trim() === 'admin@gmail.com' && password === 'admin123') {
    return res.status(200).json({ message: 'Admin login successful', userId: 0, role: 'admin' });
  }

  try {
    const user = await User.findOne({ email, password });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    res.status(200).json({ message: 'Login successful', userId: user._id, role: 'user' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add Expense
app.post('/api/expense', async (req, res) => {
  const { userId, title, amount, category, date } = req.body;
  try {
    const newExpense = new Expense({ userId, title, amount, category, date });
    await newExpense.save();
    res.status(201).json({ message: 'Expense added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add expense' });
  }
});

// Get Expenses
app.get('/api/expenses/:userId', async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.params.userId }).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch expenses' });
  }
});

// Delete Expense
app.delete('/api/expense/:id', async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

// Update Expense
app.put('/api/expense/:id', async (req, res) => {
  const { title, amount, category, date } = req.body;
  try {
    const oldExpense = await Expense.findById(req.params.id);
    if (!oldExpense) return res.status(404).json({ message: 'Expense not found' });

    // Log old data
    const log = new ExpenseUpdateLog({
      userId: oldExpense.userId,
      title: oldExpense.title,
      amount: oldExpense.amount,
      category: oldExpense.category,
      date: oldExpense.date
    });
    await log.save();

    // Update
    await Expense.findByIdAndUpdate(req.params.id, { title, amount, category, date });
    res.json({ message: 'Expense updated' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating expense' });
  }
});

// Show update logs
app.get('/api/expense-update-logs/:userId', async (req, res) => {
  try {
    const logs = await ExpenseUpdateLog.find({ userId: req.params.userId }).sort({ updatedAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching logs' });
  }
});

// Admin join query
app.get('/api/admin/join', async (req, res) => {
  try {
    const results = await Expense.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails'
        }
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          name: '$userDetails.name',
          email: '$userDetails.email',
          title: 1,
          amount: 1,
          category: 1,
          date: 1
        }
      },
      { $sort: { date: -1 } }
    ]);

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Join failed' });
  }
});

// Start Server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
