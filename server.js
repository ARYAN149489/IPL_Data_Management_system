// server.js - IPL DBMS Backend (FINAL VERSION - Corrected)

const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

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

// --- API Routes ---

app.get('/api/next-match-number', async (req, res) => {
    try {
        const result = await pool.query('SELECT COALESCE(MAX(match_no), 0) + 1 as next_match_no FROM "Matches"');
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Database error.' }); }
});

app.get('/api/teams', async (req, res) => {
  try {
    const result = await pool.query('SELECT team_id, t_name, team_logo_url FROM "Team" ORDER BY t_name');
    res.json(toCamelCase(result.rows));
  } catch (err) { res.status(500).json({ error: 'Database error while fetching teams.' }); }
});

app.get('/api/teams/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const teamQuery = 'SELECT * FROM "Team" WHERE team_id = $1';
        const playersQuery = 'SELECT player_id, p_name FROM "Player" WHERE team_id = $1 ORDER BY p_name';
        const matchesQuery = `
            SELECT m.match_id, m.match_no, t1.t_name as team1_name, t2.t_name as team2_name, m.team1_score, m.team2_score, w.t_name as winner_name
            FROM "Matches" m
            JOIN "Team" t1 ON m.team1_id = t1.team_id
            JOIN "Team" t2 ON m.team2_id = t2.team_id
            LEFT JOIN "Team" w ON m.winner_id = w.team_id
            WHERE m.team1_id = $1 OR m.team2_id = $1
            ORDER BY m.match_no DESC`;

        const [teamRes, playersRes, matchesRes] = await Promise.all([
            pool.query(teamQuery, [id]),
            pool.query(playersQuery, [id]),
            pool.query(matchesQuery, [id])
        ]);

        if (teamRes.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        res.json({
            team: toCamelCase(teamRes.rows)[0],
            players: toCamelCase(playersRes.rows),
            matches: toCamelCase(matchesRes.rows)
        });
    } catch (err) { res.status(500).json({ error: 'Database error.' }); }
});


app.get('/api/teams/:teamId/players', async (req, res) => {
    try {
        const { teamId } = req.params;
        const result = await pool.query('SELECT player_id, p_name FROM "Player" WHERE team_id = $1 ORDER BY p_name', [teamId]);
        res.json(toCamelCase(result.rows));
    } catch (err) { res.status(500).json({ error: 'Database error while fetching players.' }); }
});

// *** FIX: Corrected the query to select all player stats ***
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
    console.error("Error fetching players:", err);
    res.status(500).json({ error: 'Database error while fetching players.' }); 
  }
});

app.get('/api/players/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const playerQuery = `
            SELECT p.*, t.t_name, t.team_logo_url
            FROM "Player" p
            JOIN "Team" t ON p.team_id = t.team_id
            WHERE p.player_id = $1`;
        const performanceQuery = `
            SELECT pm.*, m.match_no, t1.t_name as against_team
            FROM "PlayerMatch" pm
            JOIN "Matches" m ON pm.match_id = m.match_id
            JOIN "Player" p ON pm.player_id = p.player_id
            JOIN "Team" t1 ON (CASE WHEN m.team1_id = p.team_id THEN m.team2_id ELSE m.team1_id END) = t1.team_id
            WHERE pm.player_id = $1
            ORDER BY m.match_no DESC`;
        
        const [playerRes, performanceRes] = await Promise.all([
            pool.query(playerQuery, [id]),
            pool.query(performanceQuery, [id])
        ]);

        if (playerRes.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        res.json({
            player: toCamelCase(playerRes.rows)[0],
            performances: toCamelCase(performanceRes.rows)
        });
    } catch (err) { res.status(500).json({ error: 'Database error.' }); }
});


app.get('/api/top-batters', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "TopBatters" LIMIT 10');
    res.json(toCamelCase(result.rows));
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/top-bowlers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "TopBowlers" LIMIT 10');
    res.json(toCamelCase(result.rows));
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/points-table', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "TeamStandings"');
    res.json(toCamelCase(result.rows));
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/matches/recent', async (req, res) => {
    try {
        const query = `
            SELECT m.match_id, m.match_no, t1.t_name as team1_name, t2.t_name as team2_name, t1.team_logo_url as team1_logo, t2.team_logo_url as team2_logo, m.team1_score, m.team2_score, w.t_name as winner_name
            FROM "Matches" m
            JOIN "Team" t1 ON m.team1_id = t1.team_id
            JOIN "Team" t2 ON m.team2_id = t2.team_id
            LEFT JOIN "Team" w ON m.winner_id = w.team_id
            ORDER BY m.match_no DESC
            LIMIT 5`;
        const result = await pool.query(query);
        res.json(toCamelCase(result.rows));
    } catch (err) { res.status(500).json({ error: 'Database error.' }); }
});


app.post('/api/players', async (req, res) => {
    const { playerName, teamId } = req.body;
    if (!playerName || !teamId) {
        return res.status(400).json({ error: 'Player name and team ID are required.' });
    }
    try {
        const result = await pool.query('INSERT INTO "Player" (p_name, team_id) VALUES ($1, $2) RETURNING player_id', [playerName, teamId]);
        res.status(201).json({ message: 'Player added successfully!', playerId: result.rows[0].player_id });
    } catch (err) { res.status(500).json({ error: 'Failed to add player.' }); }
});

app.post('/api/teams', async (req, res) => {
    const { teamName, owner, home, logoUrl } = req.body;
    if (!teamName) {
        return res.status(400).json({ error: 'Team name is required.' });
    }
    try {
        const result = await pool.query('INSERT INTO "Team" (t_name, owner, t_home, team_logo_url) VALUES ($1, $2, $3, $4) RETURNING team_id', [teamName, owner, home, logoUrl]);
        res.status(201).json({ message: 'Team added successfully!', teamId: result.rows[0].team_id });
    } catch (err) { res.status(500).json({ error: 'Failed to add team.' }); }
});


app.post('/api/matches', async (req, res) => {
  const { matchNo, matchDate, team1Id, team2Id, team1Score, team2Score, team1Extras, team2Extras, winnerId, momId, venue, playerPerformances } = req.body;

  if (!matchNo || !team1Id || !team2Id) {
    return res.status(400).json({ error: 'Match number and team IDs are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const matchSql = 'INSERT INTO "Matches" (match_no, match_date, team1_id, team2_id, team1_score, team2_score, winner_id, man_of_the_match_id, venue) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING match_id';
    const matchResult = await client.query(matchSql, [matchNo, matchDate, team1Id, team2Id, team1Score, team2Score, winnerId, momId, venue]);
    const matchId = matchResult.rows[0].match_id;

    await client.query('INSERT INTO "Extras" (match_id, team_id, runs) VALUES ($1, $2, $3)', [matchId, team1Id, team1Extras]);
    await client.query('INSERT INTO "Extras" (match_id, team_id, runs) VALUES ($1, $2, $3)', [matchId, team2Id, team2Extras]);
    
    if (playerPerformances && playerPerformances.length > 0) {
        for (const p of playerPerformances) {
             const perfSql = 'INSERT INTO "PlayerMatch" (match_id, player_id, runs_scored, balls_faced, wickets_taken, overs_bowled, runs_conceded) VALUES ($1, $2, $3, $4, $5, $6, $7)';
             await client.query(perfSql, [matchId, p.playerId, p.runsScored, p.ballsFaced, p.wicketsTaken, p.oversBowled, p.runsConceded]);
        }
    }

    const team1ValidationResult = await client.query('SELECT validate_score_breakdown($1, $2, $3) as is_valid', [matchId, team1Id, team1Score]);
    const team2ValidationResult = await client.query('SELECT validate_score_breakdown($1, $2, $3) as is_valid', [matchId, team2Id, team2Score]);

    if (!team1ValidationResult.rows[0].is_valid) {
        throw new Error(`Team 1 score breakdown does not match the total score of ${team1Score}.`);
    }
    if (!team2ValidationResult.rows[0].is_valid) {
        throw new Error(`Team 2 score breakdown does not match the total score of ${team2Score}.`);
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Match recorded successfully!', matchId });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message || 'Failed to record match.' });
  } finally {
    client.release();
  }
});

// --- HTML Routes ---
app.get('/team', (req, res) => res.sendFile(path.join(__dirname, 'public', 'team-details.html')));
app.get('/player', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player-details.html')));
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, 'public', req.path);
    if (req.path.endsWith('/')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else if (path.extname(req.path).length > 0) {
        res.sendFile(filePath);
    } else {
        res.sendFile(`${filePath}.html`);
    }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
