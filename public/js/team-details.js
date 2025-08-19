document.addEventListener('DOMContentLoaded', () => {
    const teamDetailsArea = document.getElementById('team-details-area');
    const urlParams = new URLSearchParams(window.location.search);
    const teamId = urlParams.get('id');

    const showNotification = (message, type = 'success') => {
        const notifArea = document.getElementById('notification-area');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notifArea.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 3000);
        }, 3000);
    };

    const fetchData = async (url, errorMessage) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (err) {
            showNotification(errorMessage, 'error');
            return null;
        }
    };

    const renderTeamDetails = async () => {
        if (!teamId) {
            teamDetailsArea.innerHTML = '<p class="text-center text-red-500">No team ID provided.</p>';
            return;
        }
        const data = await fetchData(`/api/teams/${teamId}`, 'Failed to load team details.');
        if (!data) return;

        const { team, players, matches } = data;
        const detailsHtml = `
            <div class="bg-white p-8 rounded-xl shadow-md">
                <div class="flex items-center mb-6 border-b pb-4">
                    <img src="${team.teamLogoUrl || 'https://via.placeholder.com/60x60.png?text=L'}" alt="${team.tName}" class="w-16 h-16 mr-4 rounded-full">
                    <div>
                        <h1 class="text-4xl font-bold text-gray-800">${team.tName}</h1>
                        <p class="text-gray-500">${team.owner || 'Owner not specified'}</p>
                        <p class="text-sm text-gray-500">${team.tHome || 'Home ground not specified'}</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h2 class="text-2xl font-bold mb-4">Player Squad</h2>
                        <ul class="space-y-2">
                            ${players.map(p => `<li><a href="/player?id=${p.playerId}" class="text-blue-600 hover:underline">${p.pName}</a></li>`).join('') || '<li>No players found for this team.</li>'}
                        </ul>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold mb-4">Match History</h2>
                        <div class="space-y-4">
                            ${matches.map(m => `
                                <div class="border-t pt-2">
                                    <p class="text-sm">vs ${m.team1Name === team.tName ? m.team2Name : m.team1Name}</p>
                                    <p class="text-xs text-gray-500">${m.winnerName} won.</p>
                                </div>
                            `).join('') || '<p>No match history found.</p>'}
                        </div>
                    </div>
                </div>
            </div>`;
        teamDetailsArea.innerHTML = detailsHtml;
    };
    renderTeamDetails();
});
