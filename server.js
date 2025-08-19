const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
require('dotenv').config(); // To use environment variables from a .env file

const app = express();
const PORT = process.env.PORT || 3000;

// --- Database Connection Configuration -------------------------------------
// For local development, create a .env file with your PostgreSQL connection string:
// DATABASE_URL="postgresql://user:password@host:port/database"
// Render (hosting) will provide this DATABASE_URL automatically as an environment variable.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // For production environments like Render that require SSL, this is important
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});


// --- Middleware ------------------------------------------------------------
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(bodyParser.json()); // Parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// --- Utility Functions -----------------------------------------------------
/**
 * A helper function to format query results from snake_case to camelCase.
 * @param {Array} rows - The array of rows from the database.
 * @returns {Array} - The formatted array of rows.
 */
const toCamelCase = (rows) => {
  return rows.map(row => {
    const newRow = {};
    for (let key in row) {
      const camelCaseKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      newRow[camelCaseKey] = row[key];
    }
    return newRow;
  });
};


// GET all teams
app.get('/api/teams', async (req, res) => {
  try {
    const result = await pool.query('SELECT team_id, t_name FROM "Team" ORDER BY t_name');
    res.json(toCamelCase(result.rows));
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Database error while fetching teams.' });
  }
});

// GET players for a specific team
app.get('/api/teams/:teamId/players', async (req, res) => {
    try {
        const { teamId } = req.params;
        const result = await pool.query('SELECT player_id, p_name FROM "Player" WHERE team_id = $1 ORDER BY p_name', [teamId]);
        res.json(toCamelCase(result.rows));
    } catch (err) {
        console.error('Error fetching players for team:', err);
        res.status(500).json({ error: 'Database error while fetching players.' });
    }
});

// GET all players
app.get('/api/players', async (req, res) => {
  try {
    const sql = `
        SELECT p.player_id, p.p_name, t.t_name, p.matches_played, p.wickets, p.economy, p.best, p.total_runs, p.avg_sr
        FROM "Player" p
        LEFT JOIN "Team" t ON p.team_id = t.team_id
        ORDER BY p.p_name
    `;
    const result = await pool.query(sql);
    res.json(toCamelCase(result.rows));
  } catch (err) {
    console.error('Error fetching players:', err);
    res.status(500).json({ error: 'Database error while fetching players.' });
  }
});

// GET top 10 batters
app.get('/api/top-batters', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "TopBatters" LIMIT 10');
    res.json(toCamelCase(result.rows));
  } catch (err) {
    console.error('Error fetching top batters:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET top 10 bowlers
app.get('/api/top-bowlers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "TopBowlers" LIMIT 10');
    res.json(toCamelCase(result.rows));
  } catch (err) {
    console.error('Error fetching top bowlers:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET points table
app.get('/api/points-table', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "TeamStandings"');
    res.json(toCamelCase(result.rows));
  } catch (err) {
    console.error('Error fetching points table:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST a new player
app.post('/api/players', async (req, res) => {
    const { playerName, teamId } = req.body;
    if (!playerName || !teamId) {
        return res.status(400).json({ error: 'Player name and team ID are required.' });
    }
    try {
        const result = await pool.query('INSERT INTO "Player" (p_name, team_id) VALUES ($1, $2) RETURNING player_id', [playerName, teamId]);
        res.status(201).json({ message: 'Player added successfully!', playerId: result.rows[0].player_id });
    } catch (err) {
        console.error('Error adding player:', err);
        res.status(500).json({ error: 'Failed to add player to the database.' });
    }
});

// POST a new match
app.post('/api/matches', async (req, res) => {
  const { matchNo, matchDate, team1Id, team2Id, team1Score, team2Score, winnerId, venue, playerPerformances } = req.body;

  if (!matchNo || !team1Id || !team2Id) {
    return res.status(400).json({ error: 'Match number and team IDs are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert into Matches table
    const matchSql = 'INSERT INTO "Matches" (match_no, match_date, team1_id, team2_id, team1_score, team2_score, winner_id, venue) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING match_id';
    const matchResult = await client.query(matchSql, [matchNo, matchDate, team1Id, team2Id, team1Score, team2Score, winnerId, venue]);
    const matchId = matchResult.rows[0].match_id;

    // Insert player performances
    if (playerPerformances && playerPerformances.length > 0) {
        for (const p of playerPerformances) {
             const perfSql = 'INSERT INTO "PlayerMatch" (match_id, player_id, runs_scored, balls_faced, wickets_taken, overs_bowled, runs_conceded) VALUES ($1, $2, $3, $4, $5, $6, $7)';
             await client.query(perfSql, [matchId, p.playerId, p.runsScored, p.ballsFaced, p.wicketsTaken, p.oversBowled, p.runsConceded]);
        }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Match recorded successfully!', matchId });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recording match:', err);
    res.status(500).json({ error: 'Failed to record match. Transaction rolled back.' });
  } finally {
    client.release();
  }
});

// --- HTML Routes ---
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, 'public', req.path);
    if (req.path.endsWith('/')) {
        res.sendFile(path.join(__dirname, 'public', req.path, 'index.html'));
    } else if (path.extname(req.path).length > 0) {
        res.sendFile(filePath);
    } else {
        res.sendFile(`${filePath}.html`);
    }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
