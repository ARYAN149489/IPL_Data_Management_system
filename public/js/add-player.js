document.addEventListener('DOMContentLoaded', () => {
    const teamSelect = document.getElementById('teamSelect');
    const playerForm = document.getElementById('playerForm');

    const showNotification = (message, type = 'success') => { /* ... same as in index.html ... */ };

    const fetchTeams = async () => { /* ... fetches teams and populates the select dropdown ... */ };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(playerForm);
        const data = {
            playerName: formData.get('playerName'),
            teamId: formData.get('teamId')
        };
        try {
            const response = await fetch('/api/players', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'An unknown error occurred.');
            showNotification(result.message, 'success');
            playerForm.reset();
        } catch (err) {
            showNotification(err.message, 'error');
        }
    };

    fetchTeams();
    playerForm.addEventListener('submit', handleSubmit);
});
