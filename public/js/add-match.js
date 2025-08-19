document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements and State ---
    const team1Select = document.getElementById('team1');
    const team2Select = document.getElementById('team2');
    const winnerSelect = document.getElementById('winner');
    const performanceSection = document.getElementById('player-performance-section');
    const matchForm = document.getElementById('matchForm');
    const submitLoader = document.getElementById('submit-loader');
    const submitText = document.getElementById('submit-text');
    let allTeams = [], team1Players = [], team2Players = [];

    // --- Utility: Show Notification ---
    const showNotification = (message, type = 'success') => { /* ... same as in index.html ... */ };

    // --- Data Fetching ---
    const fetchTeams = async () => { /* ... fetches teams and populates selects ... */ };
    const fetchPlayersForTeam = async (teamId) => { /* ... fetches players for a given team ID ... */ };

    // --- UI Rendering ---
    const renderPerformanceUI = () => { /* ... dynamically builds the player performance input area ... */ };
    const createPlayerPerformanceRow = (teamNum) => { /* ... creates a single row for player stats input ... */ };

    // --- Event Handlers ---
    const handleTeamChange = async () => { /* ... handles logic when a team is selected ... */ };
    const handleAddPlayerClick = (e) => { /* ... handles adding a new player row ... */ };
    const handleRemovePlayerClick = (e) => { /* ... handles removing a player row ... */ };
    const handleSubmit = async (e) => {
        e.preventDefault();
        submitLoader.style.display = 'inline-block';
        submitText.textContent = 'Submitting...';
        // ... gather form data ...
        try {
            const response = await fetch('/api/matches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'An unknown error occurred.');
            showNotification(result.message, 'success');
            matchForm.reset();
            handleTeamChange();
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
