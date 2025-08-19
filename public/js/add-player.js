document.addEventListener('DOMContentLoaded', () => {
    const teamSelect = document.getElementById('teamSelect');
    const playerForm = document.getElementById('playerForm');

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

    const fetchTeams = async () => {
        try {
            const response = await fetch('/api/teams');
            const teams = await response.json();
            teams.forEach(team => {
                const opt = document.createElement('option');
                opt.value = team.teamId;
                opt.textContent = team.tName;
                teamSelect.appendChild(opt);
            });
        } catch (err) {
            showNotification('Failed to load teams.', 'error');
        }
    };

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
