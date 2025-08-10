// server.js - IPL DBMS Backend (MySQL Version)

// Import required modules
const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
require('dotenv').config(); // To use environment variables from a .env file

// --- Basic Setup -----------------------------------------------------------
const app = express();
// Railway provides the PORT environment variable.
const PORT = process.env.PORT || 3000;

// --- Database Connection Configuration -------------------------------------
// Railway provides a DATABASE_URL. We parse it for the mysql2 driver.
// For local development, you can create a .env file with:
// DATABASE_URL="mysql://user:password@host:port/database"
const dbUrl = new URL(process.env.DATABASE_URL);
const dbConfig = {
  host: dbUrl.hostname,
  user: dbUrl.username,
  password: dbUrl.password,
  port: dbUrl.port,
  database: dbUrl.pathname.slice(1),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// --- Middleware ------------------------------------------------------------
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(bodyParser.json()); // Parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' directory

// --- Utility Functions -----------------------------------------------------
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

// --- API Routes ------------------------------------------------------------

// GET all teams
app.get('/api/teams', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT team_id, t_name FROM Team ORDER BY t_name');
    res.json(toCamelCase(rows));
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Database error while fetching teams.' });
  }
});

// GET players for a specific team
app.get('/api/teams/:teamId/players', async (req, res) => {
    try {
        const { teamId } = req.params;
        const [rows] = await pool.query('SELECT player_id, p_name FROM Player WHERE team_id = ? ORDER BY p_name', [teamId]);
        res.json(toCamelCase(rows));
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
        FROM Player p
        LEFT JOIN Team t ON p.team_id = t.team_id
        ORDER BY p.p_name
    `;
    const [rows] = await pool.query(sql);
    res.json(toCamelCase(rows));
  } catch (err) {
    console.error('Error fetching players:', err);
    res.status(500).json({ error: 'Database error while fetching players.' });
  }
});

// GET top 10 batters
app.get('/api/top-batters', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM TopBatters LIMIT 10');
    res.json(toCamelCase(rows));
  } catch (err) {
    console.error('Error fetching top batters:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET top 10 bowlers
app.get('/api/top-bowlers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM TopBowlers LIMIT 10');
    res.json(toCamelCase(rows));
  } catch (err) {
    console.error('Error fetching top bowlers:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET points table
app.get('/api/points-table', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM TeamStandings');
    res.json(toCamelCase(rows));
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
        const [result] = await pool.query('INSERT INTO Player (p_name, team_id) VALUES (?, ?)', [playerName, teamId]);
        res.status(201).json({ message: 'Player added successfully!', playerId: result.insertId });
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

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Insert into Matches table
    const matchSql = 'INSERT INTO Matches (match_no, match_date, team1_id, team2_id, team1_score, team2_score, winner_id, venue) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const [matchResult] = await connection.query(matchSql, [matchNo, matchDate, team1Id, team2Id, team1Score, team2Score, winnerId, venue]);
    const matchId = matchResult.insertId;

    // Insert player performances
    if (playerPerformances && playerPerformances.length > 0) {
      const perfSql = 'INSERT INTO PlayerMatch (match_id, player_id, runs_scored, balls_faced, wickets_taken, overs_bowled, runs_conceded) VALUES ?';
      const perfValues = playerPerformances.map(p => [
        matchId,
        p.playerId,
        p.runsScored,
        p.ballsFaced,
        p.wicketsTaken,
        p.oversBowled,
        p.runsConceded
      ]);
      await connection.query(perfSql, [perfValues]);
    }

    await connection.commit();
    res.status(201).json({ message: 'Match recorded successfully!', matchId });

  } catch (err) {
    await connection.rollback();
    console.error('Error recording match:', err);
    res.status(500).json({ error: 'Failed to record match. Transaction rolled back.' });
  } finally {
    connection.release();
  }
});

// --- HTML Routes -----------------------------------------------------------
app.get('*', (req, res) => {
    const page = req.path === '/' ? 'index.html' : req.path;
    res.sendFile(path.join(__dirname, 'public', page));
});


// --- Server Start ----------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
