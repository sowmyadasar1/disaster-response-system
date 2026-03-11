const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const checkAdmin = require('./middleware/checkAdmin');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const adminRoutes = require("./routes/adminRoutes");
const path = require('path');

// Firebase Admin Initialization using environment variable
if (!admin.apps.length) {
  if (process.env.FIREBASE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_KEY)),
    });
  } else {
    // fallback (temporary if env variable not set)
    admin.initializeApp();
  }
}

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files from public folder
app.use(express.static(path.join(__dirname, '../public')));

// Root Route (disabled because it overrides the website)
// app.get('/', (req, res) => {
//   res.json({ message: 'API is running with Firebase...' });
// });

// Public Routes
app.post('/api/messages', async (req, res) => {
  try {
    const { name, message, location } = req.body;

    if (!name || !message) {
      return res.status(400).json({ message: 'Name and message are required' });
    }

    const docRef = await db.collection('messages').add({
      name,
      message,
      location: location || null,
      status: 'pending',
      createdAt: new Date()
    });

    res.status(201).json({
      id: docRef.id,
      name,
      message,
      status: 'pending'
    });

  } catch (err) {
    console.error('Error adding message:', err);
    res.status(500).json({ message: 'Failed to add message' });
  }
});

// Get all messages
app.get('/api/messages', async (req, res) => {
  try {
    const snapshot = await db
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .get();

    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(messages);

  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// Admin Setup
app.post('/setAdmin', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Missing email' });
    }

    const user = await admin.auth().getUserByEmail(email);

    await admin.auth().setCustomUserClaims(user.uid, { admin: true });

    res.json({ message: `Admin claim set for ${email}` });

  } catch (err) {
    console.error('Error in /setAdmin:', err);
    res.status(500).json({
      message: 'Failed to set admin claim',
      error: err.message
    });
  }
});

// Admin routes
app.use('/api/admin', adminRoutes);

// Change message status
app.patch('/api/messages/:id', checkAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Missing status' });
    }

    await db
      .collection('messages')
      .doc(req.params.id)
      .update({ status });

    res.json({ message: 'Status updated successfully' });

  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

// Delete message
app.delete('/api/messages/:id', checkAdmin, async (req, res) => {
  try {
    await db
      .collection('messages')
      .doc(req.params.id)
      .delete();

    res.json({ message: 'Message deleted successfully' });

  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ message: 'Failed to delete message' });
  }
});

// Admin test route
app.post('/api/admin/task', checkAdmin, (req, res) => {
  res.json({ message: 'This is only for admins.' });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
