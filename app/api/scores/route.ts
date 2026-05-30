import { type NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const dataFilePath = path.join(process.cwd(), 'data', 'scores.json');

// Helper to read scores from file
async function readScores() {
  try {
    const data = await fs.readFile(dataFilePath, 'utf8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error: any) {
    // If file doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Error reading scores:', error);
    return [];
  }
}

// Helper to write scores to file
async function writeScores(scores: any[]) {
  try {
    // Ensure the data directory exists
    const dirPath = path.dirname(dataFilePath);
    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(dataFilePath, JSON.stringify(scores, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing scores:', error);
  }
}

export async function GET() {
  const scores = await readScores();
  
  // Sort by score descending
  const sortedScores = scores.sort((a: any, b: any) => {
    const scoreA = Number(a.score) || 0;
    const scoreB = Number(b.score) || 0;
    return scoreB - scoreA;
  });

  return Response.json(sortedScores);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, score } = body;

    // Basic validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }

    const numericScore = Number(score);
    if (isNaN(numericScore)) {
      return Response.json({ error: 'Score must be a number' }, { status: 400 });
    }

    const scores = await readScores();

    const newScore = {
      id: Date.now().toString(),
      name: name.trim().toUpperCase().substring(0, 10), // Limit name to 10 characters, upper case for retro style
      score: numericScore,
      date: new Date().toISOString()
    };

    scores.push(newScore);

    // Sort descending
    scores.sort((a: any, b: any) => b.score - a.score);

    // Keep top 100 to prevent file size growing indefinitely
    const topScores = scores.slice(0, 100);

    await writeScores(topScores);

    return Response.json({ success: true, score: newScore });
  } catch (error) {
    console.error('Error in POST scores:', error);
    return Response.json({ error: 'Failed to save score' }, { status: 500 });
  }
}
