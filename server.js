// server.js (for frontend)
const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000; // Koyeb will set PORT

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, '.')));

// Handle SPA: send index.html for any unknown paths
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '.', 'index.html'));
});

app.listen(port, () => {
  console.log(`LearnSpark LMS frontend server listening on port ${port}`);
});
