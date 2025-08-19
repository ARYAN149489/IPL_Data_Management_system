document.addEventListener('DOMContentLoaded', () => {
    const playerDetailsArea = document.getElementById('player-details-area');
    const urlParams = new URLSearchParams(window.location.search);
    const playerId = urlParams.get('id');

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

    const renderPlayerDetails = async () => {
        if (!playerId) {
            playerDetailsArea.innerHTML = '<p class="text-center text-red-500">No player ID provided.</p>';
            return;
        }
        const data = await fetchData(`/api/players/${playerId}`, 'Failed to load player details.');
        if (!data) return;

        const { player, performances } = data;
        const detailsHtml = `
            <div class="bg-white p-8 rounded-xl shadow-md">
                <div class="flex items-center mb-6 border-b pb-4">
                     <img src="${player.teamLogoUrl || 'https://via.placeholder.com/60x60.png?text=L'}" alt="${player.tName}" class="w-16 h-16 mr-4 rounded-full">
                    <div>
                        <h1 class="text-4xl font-bold text-gray-800">${player.pName}</h1>
                        <p class="text-gray-500">${player.tName}</p>
                    </div>
                </div>
                <h2 class="text-2xl font-bold mb-4">Career Statistics</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div class="bg-gray-50 p-4 rounded-lg text-center">
                        <p class="text-sm text-gray-500">Matches</p>
                        <p class="text-2xl font-bold">${player.matchesPlayed}</p>
                    </div>
                    <div class="bg-gray-50 p-4 rounded-lg text-center">
                        <p class="text-sm text-gray-500">Total Runs</p>
                        <p class="text-2xl font-bold">${player.totalRuns}</p>
                    </div>
                    <div class="bg-gray-50 p-4 rounded-lg text-center">
                        <p class="text-sm text-gray-500">Wickets</p>
                        <p class="text-2xl font-bold">${player.wickets}</p>
                    </div>
                    <div class="bg-gray-50 p-4 rounded-lg text-center">
                        <p class="text-sm text-gray-500">Avg. SR</p>
                        <p class="text-2xl font-bold">${parseFloat(player.avgSr).toFixed(2)}</p>
                    </div>
                </div>

                <h2 class="text-2xl font-bold mb-4">Match Performances</h2>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Match</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Against</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Runs</th>
                                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Wickets</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${performances.map(p => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-4 py-2 text-sm text-gray-900">#${p.matchNo}</td>
                                    <td class="px-4 py-2 text-sm text-gray-500">${p.againstTeam}</td>
                                    <td class="px-4 py-2 text-sm text-gray-900">${p.runsScored} (${p.ballsFaced})</td>
                                    <td class="px-4 py-2 text-sm text-gray-900">${p.wicketsTaken}-${p.runsConceded}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="4" class="text-center py-4">No match performances found.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>`;
        playerDetailsArea.innerHTML = detailsHtml;
    };
    renderPlayerDetails();
});
