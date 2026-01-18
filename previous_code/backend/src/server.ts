import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';

// Import routes
import leakDetectionRoutes from './routes/leakDetectionRoutes';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure required directories exist
const dataDirectories = [
  path.join(__dirname, '..', '..', 'data', 'temp_results'),
  path.join(__dirname, '..', '..', 'data', 'master_data'),
  path.join(__dirname, '..', '..', 'data', 'knowledge_base'),
  path.join(__dirname, '..', '..', 'data', 'leak_detection_results')
];

dataDirectories.forEach(dir => {
  fs.ensureDirSync(dir);
  console.log(`Ensured directory exists: ${dir}`);
});

// Routes
app.use('/api', leakDetectionRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
