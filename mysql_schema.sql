--
-- IPL Database Schema for MySQL
--

-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS `PlayerMatch`;
DROP TABLE IF EXISTS `PointsTable`;
DROP TABLE IF EXISTS `Matches`;
DROP TABLE IF EXISTS `Player`;
DROP TABLE IF EXISTS `Team`;

--
-- Table structure for table `Team`
--
CREATE TABLE `Team` (
  `team_id` INT AUTO_INCREMENT PRIMARY KEY,
  `t_name` VARCHAR(50) NOT NULL UNIQUE,
  `owner` VARCHAR(100),
  `captain_id` INT,
  `t_home` VARCHAR(100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Table structure for table `Player`
--
CREATE TABLE `Player` (
  `player_id` INT AUTO_INCREMENT PRIMARY KEY,
  `p_name` VARCHAR(100) NOT NULL,
  `team_id` INT,
  `matches_played` INT DEFAULT 0,
  `wickets` INT DEFAULT 0,
  `economy` DECIMAL(5,2) DEFAULT 0.00,
  `best` VARCHAR(20),
  `total_runs` INT DEFAULT 0,
  `avg_sr` DECIMAL(5,2) DEFAULT 0.00,
  CONSTRAINT `fk_player_team` FOREIGN KEY (`team_id`) REFERENCES `Team` (`team_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Add foreign key constraint for captain in Team table after Player table is created
--
ALTER TABLE `Team` ADD CONSTRAINT `fk_team_captain` FOREIGN KEY (`captain_id`) REFERENCES `Player`(`player_id`) ON DELETE SET NULL;

--
-- Table structure for table `Matches`
--
CREATE TABLE `Matches` (
  `match_id` INT AUTO_INCREMENT PRIMARY KEY,
  `match_no` INT NOT NULL,
  `team1_id` INT,
  `team2_id` INT,
  `winner_id` INT,
  `team1_score` VARCHAR(20),
  `team2_score` VARCHAR(20),
  `match_date` DATE,
  `venue` VARCHAR(100),
  CONSTRAINT `fk_match_team1` FOREIGN KEY (`team1_id`) REFERENCES `Team` (`team_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_match_team2` FOREIGN KEY (`team2_id`) REFERENCES `Team` (`team_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_match_winner` FOREIGN KEY (`winner_id`) REFERENCES `Team` (`team_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Table structure for table `PointsTable`
--
CREATE TABLE `PointsTable` (
  `team_id` INT PRIMARY KEY,
  `matches_played` INT DEFAULT 0,
  `wins` INT DEFAULT 0,
  `losses` INT DEFAULT 0,
  `points` INT DEFAULT 0,
  `nrr` DECIMAL(6,3) DEFAULT 0.000,
  CONSTRAINT `fk_points_team` FOREIGN KEY (`team_id`) REFERENCES `Team` (`team_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Table structure for table `PlayerMatch` (Player performance in a match)
--
CREATE TABLE `PlayerMatch` (
  `player_match_id` INT AUTO_INCREMENT PRIMARY KEY,
  `player_id` INT,
  `match_id` INT,
  `runs_scored` INT DEFAULT 0,
  `balls_faced` INT DEFAULT 0,
  `wickets_taken` INT DEFAULT 0,
  `overs_bowled` DECIMAL(3,1) DEFAULT 0.0,
  `runs_conceded` INT DEFAULT 0,
  UNIQUE KEY `player_match_unique` (`player_id`, `match_id`),
  CONSTRAINT `fk_pm_player` FOREIGN KEY (`player_id`) REFERENCES `Player` (`player_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pm_match` FOREIGN KEY (`match_id`) REFERENCES `Matches` (`match_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


--
-- Views for easy access to statistics
--
CREATE OR REPLACE VIEW `TopBatters` AS
SELECT
    p.player_id,
    p.p_name,
    t.t_name,
    p.total_runs,
    p.avg_sr
FROM Player p
JOIN Team t ON p.team_id = t.team_id
ORDER BY p.total_runs DESC;

CREATE OR REPLACE VIEW `TopBowlers` AS
SELECT
    p.player_id,
    p.p_name,
    t.t_name,
    p.wickets,
    p.economy,
    p.best
FROM Player p
JOIN Team t ON p.team_id = t.team_id
ORDER BY p.wickets DESC;

CREATE OR REPLACE VIEW `TeamStandings` AS
SELECT
    t.t_name,
    pt.matches_played,
    pt.wins,
    pt.losses,
    pt.points,
    pt.nrr
FROM Team t
JOIN PointsTable pt ON t.team_id = pt.team_id
ORDER BY pt.points DESC, pt.nrr DESC;

--
-- Triggers for automatic updates
--

DELIMITER $$

-- Trigger to initialize a team's entry in the PointsTable
CREATE TRIGGER `trg_after_team_insert`
AFTER INSERT ON `Team`
FOR EACH ROW
BEGIN
    INSERT INTO `PointsTable` (team_id, matches_played, wins, losses, points, nrr)
    VALUES (NEW.team_id, 0, 0, 0, 0, 0.000);
END$$

-- Trigger to update points table and player stats after a match result is inserted
CREATE TRIGGER `trg_after_match_insert`
AFTER INSERT ON `Matches`
FOR EACH ROW
BEGIN
    -- Update winner's points
    IF NEW.winner_id IS NOT NULL THEN
        UPDATE `PointsTable`
        SET `matches_played` = `matches_played` + 1,
            `wins` = `wins` + 1,
            `points` = `points` + 2
        WHERE `team_id` = NEW.winner_id;

        -- Update loser's points
        IF NEW.winner_id = NEW.team1_id THEN
            UPDATE `PointsTable`
            SET `matches_played` = `matches_played` + 1,
                `losses` = `losses` + 1
            WHERE `team_id` = NEW.team2_id;
        ELSE
            UPDATE `PointsTable`
            SET `matches_played` = `matches_played` + 1,
                `losses` = `losses` + 1
            WHERE `team_id` = NEW.team1_id;
        END IF;
    -- Handle a tie or no result (e.g., washed out)
    ELSE
        UPDATE `PointsTable`
        SET `matches_played` = `matches_played` + 1,
            `points` = `points` + 1
        WHERE `team_id` IN (NEW.team1_id, NEW.team2_id);
    END IF;
END$$

-- Trigger to update player stats after their performance in a match is recorded
CREATE TRIGGER `trg_after_playermatch_insert`
AFTER INSERT ON `PlayerMatch`
FOR EACH ROW
BEGIN
    DECLARE total_balls_faced INT;
    DECLARE total_runs_scored INT;
    DECLARE total_overs_bowled DECIMAL(10,1);
    DECLARE total_runs_conceded INT;
    DECLARE total_wickets_taken INT;

    -- Update player's general stats
    UPDATE `Player`
    SET `matches_played` = `matches_played` + 1,
        `total_runs` = `total_runs` + NEW.runs_scored,
        `wickets` = `wickets` + NEW.wickets_taken
    WHERE `player_id` = NEW.player_id;

    -- Recalculate batting strike rate
    SELECT SUM(pm.runs_scored), SUM(pm.balls_faced)
    INTO total_runs_scored, total_balls_faced
    FROM `PlayerMatch` pm
    WHERE pm.player_id = NEW.player_id;

    IF total_balls_faced > 0 THEN
        UPDATE `Player`
        SET `avg_sr` = (total_runs_scored / total_balls_faced) * 100
        WHERE `player_id` = NEW.player_id;
    END IF;

    -- Recalculate bowling economy
    SELECT SUM(pm.overs_bowled), SUM(pm.runs_conceded)
    INTO total_overs_bowled, total_runs_conceded
    FROM `PlayerMatch` pm
    WHERE pm.player_id = NEW.player_id;

    IF total_overs_bowled > 0 THEN
        UPDATE `Player`
        SET `economy` = total_runs_conceded / total_overs_bowled
        WHERE `player_id` = NEW.player_id;
    END IF;
END$$

DELIMITER ;
