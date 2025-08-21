--
-- IPL Database Schema for PostgreSQL (FINAL VERSION with NRR Fix)
--

-- Drop existing tables, views, and functions if they exist to start fresh
DROP TRIGGER IF EXISTS after_playermatch_insert_trigger ON "PlayerMatch";
DROP TRIGGER IF EXISTS after_match_insert_trigger ON "Matches";
DROP TRIGGER IF EXISTS after_team_insert_trigger ON "Team";
DROP VIEW IF EXISTS "TeamStandings", "TopBowlers", "TopBatters";
DROP TABLE IF EXISTS "Extras", "PlayerMatch", "PointsTable", "Matches", "Player", "Team";
DROP FUNCTION IF EXISTS trg_after_team_insert(), trg_after_match_insert(), trg_after_playermatch_insert(), validate_score_breakdown(), calculate_nrr(integer);

--
-- Table structure for table "Team"
--
CREATE TABLE "Team" (
  "team_id" SERIAL PRIMARY KEY,
  "t_name" VARCHAR(50) NOT NULL UNIQUE,
  "owner" VARCHAR(100),
  "captain_id" INT,
  "t_home" VARCHAR(100),
  "team_logo_url" VARCHAR(255)
);

--
-- Table structure for table "Player"
--
CREATE TABLE "Player" (
  "player_id" SERIAL PRIMARY KEY,
  "p_name" VARCHAR(100) NOT NULL,
  "team_id" INT,
  "matches_played" INT DEFAULT 0,
  "wickets" INT DEFAULT 0,
  "economy" DECIMAL(5,2) DEFAULT 0.00,
  "best" VARCHAR(20),
  "total_runs" INT DEFAULT 0,
  "avg_sr" DECIMAL(5,2) DEFAULT 0.00,
  CONSTRAINT "fk_player_team" FOREIGN KEY ("team_id") REFERENCES "Team" ("team_id") ON DELETE SET NULL
);

--
-- Add foreign key constraint for captain in Team table after Player table is created
--
ALTER TABLE "Team" ADD CONSTRAINT "fk_team_captain" FOREIGN KEY ("captain_id") REFERENCES "Player" ("player_id") ON DELETE SET NULL;

--
-- Table structure for table "Matches"
--
CREATE TABLE "Matches" (
  "match_id" SERIAL PRIMARY KEY,
  "match_no" INT NOT NULL UNIQUE,
  "team1_id" INT,
  "team2_id" INT,
  "winner_id" INT,
  "man_of_the_match_id" INT,
  "team1_score" VARCHAR(20),
  "team2_score" VARCHAR(20),
  "team1_overs" DECIMAL(3,1),
  "team2_overs" DECIMAL(3,1),
  "match_date" DATE,
  "venue" VARCHAR(100),
  CONSTRAINT "fk_match_team1" FOREIGN KEY ("team1_id") REFERENCES "Team" ("team_id") ON DELETE CASCADE,
  CONSTRAINT "fk_match_team2" FOREIGN KEY ("team2_id") REFERENCES "Team" ("team_id") ON DELETE CASCADE,
  CONSTRAINT "fk_match_winner" FOREIGN KEY ("winner_id") REFERENCES "Team" ("team_id") ON DELETE SET NULL,
  CONSTRAINT "fk_match_mom" FOREIGN KEY ("man_of_the_match_id") REFERENCES "Player" ("player_id") ON DELETE SET NULL
);

--
-- Table structure for table "PointsTable"
--
CREATE TABLE "PointsTable" (
  "team_id" INT PRIMARY KEY,
  "matches_played" INT DEFAULT 0,
  "wins" INT DEFAULT 0,
  "losses" INT DEFAULT 0,
  "points" INT DEFAULT 0,
  "nrr" DECIMAL(6,3) DEFAULT 0.000,
  CONSTRAINT "fk_points_team" FOREIGN KEY ("team_id") REFERENCES "Team" ("team_id") ON DELETE CASCADE
);

--
-- Table structure for table "PlayerMatch"
--
CREATE TABLE "PlayerMatch" (
  "player_match_id" SERIAL PRIMARY KEY,
  "player_id" INT,
  "match_id" INT,
  "runs_scored" INT DEFAULT 0,
  "balls_faced" INT DEFAULT 0,
  "wickets_taken" INT DEFAULT 0,
  "overs_bowled" DECIMAL(3,1) DEFAULT 0.0,
  "runs_conceded" INT DEFAULT 0,
  UNIQUE ("player_id", "match_id"),
  CONSTRAINT "fk_pm_player" FOREIGN KEY ("player_id") REFERENCES "Player" ("player_id") ON DELETE CASCADE,
  CONSTRAINT "fk_pm_match" FOREIGN KEY ("match_id") REFERENCES "Matches" ("match_id") ON DELETE CASCADE
);

--
-- Table structure for table "Extras"
--
CREATE TABLE "Extras" (
    "extra_id" SERIAL PRIMARY KEY,
    "match_id" INT NOT NULL,
    "team_id" INT NOT NULL,
    "runs" INT DEFAULT 0,
    UNIQUE ("match_id", "team_id"),
    CONSTRAINT "fk_extra_match" FOREIGN KEY ("match_id") REFERENCES "Matches" ("match_id") ON DELETE CASCADE,
    CONSTRAINT "fk_extra_team" FOREIGN KEY ("team_id") REFERENCES "Team" ("team_id") ON DELETE CASCADE
);

CREATE OR REPLACE VIEW "TopBatters" AS SELECT p.player_id, p.p_name, t.t_name, p.total_runs, p.avg_sr FROM "Player" p JOIN "Team" t ON p.team_id = t.team_id ORDER BY p.total_runs DESC;
CREATE OR REPLACE VIEW "TopBowlers" AS SELECT p.player_id, p.p_name, t.t_name, p.wickets, p.economy, p.best FROM "Player" p JOIN "Team" t ON p.team_id = t.team_id ORDER BY p.wickets DESC;
CREATE OR REPLACE VIEW "TeamStandings" AS SELECT t.team_id, t.t_name, t.team_logo_url, pt.matches_played, pt.wins, pt.losses, pt.points, pt.nrr FROM "Team" t JOIN "PointsTable" pt ON t.team_id = pt.team_id ORDER BY pt.points DESC, pt.nrr DESC;

CREATE OR REPLACE FUNCTION trg_after_team_insert() RETURNS TRIGGER AS $$ BEGIN INSERT INTO "PointsTable" (team_id) VALUES (NEW.team_id); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER after_team_insert_trigger AFTER INSERT ON "Team" FOR EACH ROW EXECUTE PROCEDURE trg_after_team_insert();

-- NEW: Accurate NRR Calculation Function
CREATE OR REPLACE FUNCTION calculate_nrr(p_team_id INT)
RETURNS DECIMAL AS $$
DECLARE
    total_runs_scored INT;
    total_overs_faced DECIMAL;
    total_runs_conceded INT;
    total_overs_bowled DECIMAL;
    nrr DECIMAL;
BEGIN
    -- Calculate runs scored and overs faced by the team
    SELECT
        COALESCE(SUM(CAST(SPLIT_PART(CASE WHEN team1_id = p_team_id THEN team1_score ELSE team2_score END, '/', 1) AS INT)), 0),
        COALESCE(SUM(CASE WHEN team1_id = p_team_id THEN team1_overs ELSE team2_overs END), 0)
    INTO total_runs_scored, total_overs_faced
    FROM "Matches"
    WHERE team1_id = p_team_id OR team2_id = p_team_id;

    -- Calculate runs conceded and overs bowled by the team
    SELECT
        COALESCE(SUM(CAST(SPLIT_PART(CASE WHEN team1_id = p_team_id THEN team2_score ELSE team1_score END, '/', 1) AS INT)), 0),
        COALESCE(SUM(CASE WHEN team1_id = p_team_id THEN team2_overs ELSE team1_overs END), 0)
    INTO total_runs_conceded, total_overs_bowled
    FROM "Matches"
    WHERE team1_id = p_team_id OR team2_id = p_team_id;

    IF total_overs_faced = 0 OR total_overs_bowled = 0 THEN
        nrr := 0;
    ELSE
        nrr := (total_runs_scored / total_overs_faced) - (total_runs_conceded / total_overs_bowled);
    END IF;

    RETURN nrr;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION trg_after_match_insert() RETURNS TRIGGER AS $$ 
BEGIN 
    IF NEW.winner_id IS NOT NULL THEN 
        UPDATE "PointsTable" SET "matches_played" = "matches_played" + 1, "wins" = "wins" + 1, "points" = "points" + 2 WHERE "team_id" = NEW.winner_id; 
        IF NEW.winner_id = NEW.team1_id THEN 
            UPDATE "PointsTable" SET "matches_played" = "matches_played" + 1, "losses" = "losses" + 1 WHERE "team_id" = NEW.team2_id; 
        ELSE 
            UPDATE "PointsTable" SET "matches_played" = "matches_played" + 1, "losses" = "losses" + 1 WHERE "team_id" = NEW.team1_id; 
        END IF; 
    ELSE 
        UPDATE "PointsTable" SET "matches_played" = "matches_played" + 1, "points" = "points" + 1 WHERE "team_id" IN (NEW.team1_id, NEW.team2_id); 
    END IF; 

    -- Update NRR for both teams
    UPDATE "PointsTable" SET nrr = calculate_nrr(NEW.team1_id) WHERE team_id = NEW.team1_id;
    UPDATE "PointsTable" SET nrr = calculate_nrr(NEW.team2_id) WHERE team_id = NEW.team2_id;

    RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_match_insert_trigger AFTER INSERT ON "Matches" FOR EACH ROW EXECUTE PROCEDURE trg_after_match_insert();

CREATE OR REPLACE FUNCTION trg_after_playermatch_insert() RETURNS TRIGGER AS $$ DECLARE total_balls_faced INT; total_runs_scored INT; total_overs_bowled DECIMAL(10,1); total_runs_conceded INT; BEGIN UPDATE "Player" SET "matches_played" = "matches_played" + 1, "total_runs" = "total_runs" + NEW.runs_scored, "wickets" = "wickets" + NEW.wickets_taken WHERE "player_id" = NEW.player_id; SELECT SUM(pm.runs_scored), SUM(pm.balls_faced) INTO total_runs_scored, total_balls_faced FROM "PlayerMatch" pm WHERE pm.player_id = NEW.player_id; IF total_balls_faced > 0 THEN UPDATE "Player" SET "avg_sr" = (total_runs_scored::DECIMAL / total_balls_faced) * 100 WHERE "player_id" = NEW.player_id; END IF; SELECT SUM(pm.overs_bowled), SUM(pm.runs_conceded) INTO total_overs_bowled, total_runs_conceded FROM "PlayerMatch" pm WHERE pm.player_id = NEW.player_id; IF total_overs_bowled > 0 THEN UPDATE "Player" SET "economy" = total_runs_conceded / total_overs_bowled WHERE "player_id" = NEW.player_id; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER after_playermatch_insert_trigger AFTER INSERT ON "PlayerMatch" FOR EACH ROW EXECUTE PROCEDURE trg_after_playermatch_insert();

CREATE OR REPLACE FUNCTION validate_score_breakdown(p_match_id INT, p_team_id INT, p_total_score_str VARCHAR) RETURNS BOOLEAN AS $$ DECLARE total_player_runs INT; extra_runs INT; calculated_total INT; declared_total INT; BEGIN declared_total := CAST(SPLIT_PART(p_total_score_str, '/', 1) AS INT); SELECT COALESCE(SUM(pm.runs_scored), 0) INTO total_player_runs FROM "PlayerMatch" pm JOIN "Player" p ON pm.player_id = p.player_id WHERE pm.match_id = p_match_id AND p.team_id = p_team_id; SELECT COALESCE(runs, 0) INTO extra_runs FROM "Extras" WHERE match_id = p_match_id AND team_id = p_team_id; calculated_total := total_player_runs + extra_runs; RETURN calculated_total = declared_total; END; $$ LANGUAGE plpgsql;

-- Sample Data
INSERT INTO "Team" ("t_name", "owner", "t_home", "team_logo_url") VALUES
('Mumbai Indians', 'Reliance Industries', 'Wankhede Stadium, Mumbai', 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/MI/Logos/Roundbig/MIroundbig.png'),
('Chennai Super Kings', 'India Cements', 'M. A. Chidambaram Stadium, Chennai', 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/CSK/logos/Roundbig/CSKroundbig.png'),
('Royal Challengers Bengaluru', 'United Spirits', 'M. Chinnaswamy Stadium, Bengaluru', 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/RCB/Logos/Roundbig/RCBroundbig.png'),
('Kolkata Knight Riders', 'Red Chillies Entertainment', 'Eden Gardens, Kolkata', 'https://bcciplayerimages.s3.ap-south-1.amazonaws.com/ipl/KKR/Logos/Roundbig/KKRroundbig.png');

INSERT INTO "Player" ("p_name", "team_id") VALUES
('Rohit Sharma', 1), ('Jasprit Bumrah', 1), ('Suryakumar Yadav', 1),
('MS Dhoni', 2), ('Ravindra Jadeja', 2), ('Ruturaj Gaikwad', 2),
('Virat Kohli', 3), ('Faf du Plessis', 3), ('Glenn Maxwell', 3),
('Shreyas Iyer', 4), ('Andre Russell', 4), ('Sunil Narine', 4);

UPDATE "Team" SET "captain_id" = 1 WHERE "team_id" = 1;
UPDATE "Team" SET "captain_id" = 4 WHERE "team_id" = 2;
UPDATE "Team" SET "captain_id" = 8 WHERE "team_id" = 3;
UPDATE "Team" SET "captain_id" = 10 WHERE "team_id" = 4;

-- dummy data---------------

-- Match 1: MI vs CSK
WITH new_match AS (
  INSERT INTO "Matches" (match_no, match_date, team1_id, team2_id, team1_score, team2_score, winner_id, man_of_the_match_id, venue)
  VALUES (1, '2025-04-05', 1, 2, '185/5', '186/4', 2, 6, 'Wankhede Stadium, Mumbai')
  RETURNING match_id
)
INSERT INTO "PlayerMatch" (match_id, player_id, runs_scored, balls_faced, wickets_taken, overs_bowled, runs_conceded)
VALUES
  ((SELECT match_id FROM new_match), 1, 45, 30, 0, 0, 0),   -- MI: Rohit Sharma
  ((SELECT match_id FROM new_match), 3, 25, 20, 0, 0, 0),   -- MI: Suryakumar Yadav
  ((SELECT match_id FROM new_match), 2, 0, 0, 2, 4.0, 30),  -- MI: Jasprit Bumrah
  ((SELECT match_id FROM new_match), 6, 80, 55, 0, 0, 0),   -- CSK: Ruturaj Gaikwad (MOM)
  ((SELECT match_id FROM new_match), 4, 30, 25, 1, 4.0, 35),  -- CSK: Ravindra Jadeja
  ((SELECT match_id FROM new_match), 5, 20, 15, 0, 0, 0);   -- CSK: MS Dhoni (as player)


-- Match 2: RCB vs KKR
WITH new_match AS (
  INSERT INTO "Matches" (match_no, match_date, team1_id, team2_id, team1_score, team2_score, winner_id, man_of_the_match_id, venue)
  VALUES (2, '2025-04-06', 3, 4, '205/3', '195/8', 3, 7, 'M. Chinnaswamy Stadium, Bengaluru')
  RETURNING match_id
)
INSERT INTO "PlayerMatch" (match_id, player_id, runs_scored, balls_faced, wickets_taken, overs_bowled, runs_conceded)
VALUES
  ((SELECT match_id FROM new_match), 7, 110, 65, 1, 2.0, 15), -- RCB: Virat Kohli (MOM)
  ((SELECT match_id FROM new_match), 8, 55, 30, 0, 0, 0),   -- RCB: Faf du Plessis
  ((SELECT match_id FROM new_match), 9, 25, 15, 2, 4.0, 28),  -- RCB: Glenn Maxwell
  ((SELECT match_id FROM new_match), 10, 60, 40, 0, 0, 0),  -- KKR: Shreyas Iyer
  ((SELECT match_id FROM new_match), 11, 45, 20, 1, 4.0, 45), -- KKR: Andre Russell
  ((SELECT match_id FROM new_match), 12, 10, 8, 3, 4.0, 25);  -- KKR: Sunil Narine


-- Match 3: CSK vs RCB
WITH new_match AS (
  INSERT INTO "Matches" (match_no, match_date, team1_id, team2_id, team1_score, team2_score, winner_id, man_of_the_match_id, venue)
  VALUES (3, '2025-04-10', 2, 3, '170/7', '171/2', 3, 8, 'M. A. Chidambaram Stadium, Chennai')
  RETURNING match_id
)
INSERT INTO "PlayerMatch" (match_id, player_id, runs_scored, balls_faced, wickets_taken, overs_bowled, runs_conceded)
VALUES
  ((SELECT match_id FROM new_match), 5, 50, 35, 0, 0, 0),   -- CSK: MS Dhoni
  ((SELECT match_id FROM new_match), 4, 40, 30, 2, 4.0, 33),  -- CSK: Ravindra Jadeja
  ((SELECT match_id FROM new_match), 7, 80, 55, 0, 0, 0),   -- RCB: Virat Kohli
  ((SELECT match_id FROM new_match), 8, 60, 40, 0, 0, 0),   -- RCB: Faf du Plessis (MOM)
  ((SELECT match_id FROM new_match), 9, 15, 10, 3, 4.0, 22);  -- RCB: Glenn Maxwell

-- Match 4: MI vs KKR
WITH new_match AS (
  INSERT INTO "Matches" (match_no, match_date, team1_id, team2_id, team1_score, team2_score, winner_id, man_of_the_match_id, venue)
  VALUES (4, '2025-04-12', 1, 4, '199/4', '198/7', 1, 3, 'Eden Gardens, Kolkata')
  RETURNING match_id
)
INSERT INTO "PlayerMatch" (match_id, player_id, runs_scored, balls_faced, wickets_taken, overs_bowled, runs_conceded)
VALUES
  ((SELECT match_id FROM new_match), 1, 70, 45, 0, 0, 0),   -- MI: Rohit Sharma
  ((SELECT match_id FROM new_match), 3, 90, 50, 0, 0, 0),   -- MI: Suryakumar Yadav (MOM)
  ((SELECT match_id FROM new_match), 2, 0, 0, 3, 4.0, 28),  -- MI: Jasprit Bumrah
  ((SELECT match_id FROM new_match), 10, 50, 35, 0, 0, 0),  -- KKR: Shreyas Iyer
  ((SELECT match_id FROM new_match), 11, 30, 15, 2, 4.0, 40), -- KKR: Andre Russell
  ((SELECT match_id FROM new_match), 12, 5, 5, 1, 4.0, 30);   -- KKR: Sunil Narine

-- Add extras for all matches
INSERT INTO "Extras" (match_id, team_id, runs) VALUES
(1, 1, 10), (1, 2, 5),
(2, 3, 15), (2, 4, 10),
(3, 2, 8), (3, 3, 6),
(4, 1, 12), (4, 4, 13);
