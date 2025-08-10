document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const team1Select = document.getElementById('team1');
    const team2Select = document.getElementById('team2');
    const winnerSelect = document.getElementById('winner');
    const performanceSection = document.getElementById('player-performance-section');
    const matchForm = document.getElementById('matchForm');
    const submitLoader = document.getElementById('submit-loader');
    const submitText = document.getElementById('submit-text');

    // --- State ---
    let allTeams = [];
    let team1Players = [];
    let team2Players = [];

    // --- Utility Functions ---
    const showNotification = (message, type = 'success') => {
        const notifArea = document.getElementById('notification-area');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notifArea.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    };

    // --- Data Fetching and Population ---
    const fetchTeams = async () => {
        try {
            const response = await fetch('/api/teams');
            allTeams = await response.json();
            populateTeamSelects();
        } catch (err) {
            showNotification('Failed to fetch teams.', 'error');
        }
    };

    const populateTeamSelects = () => {
        [team1Select, team2Select, winnerSelect].forEach(select => {
            // Clear existing options except the first placeholder
            select.length = 1;
            allTeams.forEach(team => {
                const opt = document.createElement('option');
                opt.value = team.teamId;
                opt.textContent = team.tName;
                select.appendChild(opt);
            });
        });
    };

    const fetchPlayersForTeam = async (teamId) => {
        if (!teamId) return [];
        try {
            const response = await fetch(`/api/teams/${teamId}/players`);
            return await response.json();
        } catch (err) {
            showNotification(`Failed to fetch players for team ID ${teamId}.`, 'error');
            return [];
        }
    };

    // --- UI Rendering ---
    const renderPerformanceUI = () => {
        const team1Id = team1Select.value;
        const team2Id = team2Select.value;

        if (!team1Id || !team2Id || team1Id === team2Id) {
            performanceSection.innerHTML = '<p class="text-gray-500">Select two different teams above to add player performances.</p>';
            return;
        }

        performanceSection.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 class="text-md font-semibold mb-2">${team1Select.options[team1Select.selectedIndex].text}</h3>
                    <div id="team1-players" class="space-y-2"></div>
                    <button type="button" data-team="1" class="add-player-btn mt-2 text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded">+ Add Player</button>
                </div>
                <div>
                    <h3 class="text-md font-semibold mb-2">${team2Select.options[team2Select.selectedIndex].text}</h3>
                    <div id="team2-players" class="space-y-2"></div>
                    <button type="button" data-team="2" class="add-player-btn mt-2 text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded">+ Add Player</button>
                </div>
            </div>`;
    };

    const createPlayerPerformanceRow = (teamNum) => {
        const players = (teamNum === 1) ? team1Players : team2Players;
        const div = document.createElement('div');
        div.className = 'performance-row grid grid-cols-12 gap-2 items-center';
        div.innerHTML = `
            <select name="playerId" class="col-span-3 border p-2 rounded-md bg-white text-sm">
                <option value="">Select Player</option>
                ${players.map(p => `<option value="${p.playerId}">${p.pName}</option>`).join('')}
            </select>
            <input type="number" name="runsScored" placeholder="R" class="col-span-1 border p-2 rounded-md text-sm" min="0">
            <input type="number" name="ballsFaced" placeholder="B" class="col-span-1 border p-2 rounded-md text-sm" min="0">
            <input type="number" name="wicketsTaken" placeholder="W" class="col-span-1 border p-2 rounded-md text-sm" min="0">
            <input type="number" name="oversBowled" placeholder="O" class="col-span-1 border p-2 rounded-md text-sm" step="0.1" min="0">
            <input type="number" name="runsConceded" placeholder="RC" class="col-span-2 border p-2 rounded-md text-sm" min="0">
            <button type="button" class="remove-player-btn text-red-500 hover:text-red-700 col-span-1">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        return div;
    };

    // --- Event Handlers ---
    const handleTeamChange = async () => {
        const team1Id = team1Select.value;
        const team2Id = team2Select.value;
        
        // Update winner dropdown
        winnerSelect.length = 1;
        if (team1Id) winnerSelect.add(new Option(team1Select.options[team1Select.selectedIndex].text, team1Id));
        if (team2Id) winnerSelect.add(new Option(team2Select.options[team2Select.selectedIndex].text, team2Id));
        
        // Fetch players and render UI
        [team1Players, team2Players] = await Promise.all([
            fetchPlayersForTeam(team1Id),
            fetchPlayersForTeam(team2Id)
        ]);
        renderPerformanceUI();
    };

    const handleAddPlayerClick = (e) => {
        if (e.target.classList.contains('add-player-btn')) {
            const teamNum = parseInt(e.target.dataset.team, 10);
            const container = document.getElementById(`team${teamNum}-players`);
            container.appendChild(createPlayerPerformanceRow(teamNum));
        }
    };

    const handleRemovePlayerClick = (e) => {
        const removeBtn = e.target.closest('.remove-player-btn');
        if (removeBtn) {
            removeBtn.closest('.performance-row').remove();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        submitLoader.style.display = 'inline-block';
        submitText.textContent = 'Submitting...';

        const formData = new FormData(matchForm);
        const data = {
            matchNo: formData.get('matchNo'),
            matchDate: formData.get('matchDate'),
            team1Id: formData.get('team1Id'),
            team2Id: formData.get('team2Id'),
            team1Score: formData.get('team1Score'),
            team2Score: formData.get('team2Score'),
            winnerId: formData.get('winnerId'),
            venue: formData.get('venue'),
            playerPerformances: []
        };

        document.querySelectorAll('.performance-row').forEach(row => {
            const playerId = row.querySelector('[name="playerId"]').value;
            if (playerId) { // Only add if a player is selected
                data.playerPerformances.push({
                    playerId: parseInt(playerId),
                    runsScored: parseInt(row.querySelector('[name="runsScored"]').value || 0),
                    ballsFaced: parseInt(row.querySelector('[name="ballsFaced"]').value || 0),
                    wicketsTaken: parseInt(row.querySelector('[name="wicketsTaken"]').value || 0),
                    oversBowled: parseFloat(row.querySelector('[name="oversBowled"]').value || 0),
                    runsConceded: parseInt(row.querySelector('[name="runsConceded"]').value || 0)
                });
            }
        });

        try {
            const response = await fetch('/api/matches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'An unknown error occurred.');
            }
            showNotification(result.message, 'success');
            matchForm.reset();
            handleTeamChange(); // Reset UI
        } catch (err) {
            showNotification(err.message, 'error');
        } finally {
            submitLoader.style.display = 'none';
            submitText.textContent = 'Submit Match';
        }
    };

    // --- Initialization ---
    const init = () => {
        fetchTeams();
        team1Select.addEventListener('change', handleTeamChange);
        team2Select.addEventListener('change', handleTeamChange);
        performanceSection.addEventListener('click', handleAddPlayerClick);
        performanceSection.addEventListener('click', handleRemovePlayerClick);
        matchForm.addEventListener('submit', handleSubmit);
    };

    init();
});
