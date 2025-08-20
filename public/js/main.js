document.addEventListener('DOMContentLoaded', function() {
    let currentTab = 'all-players';
    let chartInstances = {};
    const contentArea = document.getElementById('content-area');
    const teamStandingsContent = document.getElementById('team-standings-content');
    const recentMatchesContent = document.getElementById('recent-matches-content');
    const teamFilter = document.getElementById('team-filter');
    const playerSearch = document.getElementById('player-search');
    const filterSection = document.getElementById('filter-section');
    const API_BASE_URL = 'http://localhost:3000';

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

    const showLoader = (area) => {
        area.innerHTML = '<div class="loader"></div>';
    };

    const fetchData = async (url, errorMessage) => {
        try {
            const response = await fetch(`${API_BASE_URL}${url}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (err) {
            console.error(`Error loading data from ${url}:`, err);
            showNotification(errorMessage, 'error');
            return [];
        }
    };

    const loadTeams = async () => {
        const teams = await fetchData('/api/teams', 'Failed to load teams.');
        teamFilter.innerHTML = '<option value="">All Teams</option>';
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.tName;
            option.textContent = team.tName;
            teamFilter.appendChild(option);
        });
    };

    const renderAllPlayers = async () => {
        const players = await fetchData('/api/players', 'Failed to load players.');
        if (!players || players.length === 0) {
            contentArea.innerHTML = '<p class="text-center text-gray-500">No players found.</p>';
            return;
        }
        const tableHtml = `
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr>${['Name', 'Team', 'Matches', 'Runs', 'Avg SR', 'Wickets', 'Economy', 'Best'].map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('')}</tr></thead>
                    <tbody id="data-table-body" class="bg-white divide-y divide-gray-200">
                        ${players.map(p => `
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 hover:underline">
                                    <a href="/player?id=${p.playerId}">${p.pName}</a>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.tName || '-'}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.matchesPlayed || 0}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.totalRuns || 0}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.avgSr ? parseFloat(p.avgSr).toFixed(2) : '0.00'}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.wickets || 0}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.economy ? parseFloat(p.economy).toFixed(2) : '0.00'}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.best || '-'}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        contentArea.innerHTML = tableHtml;
        filterPlayers();
    };
    
    const renderTeamStandingsTab = async () => {
        const standings = await fetchData('/api/points-table', 'Failed to load points table.');
        if (!standings || standings.length === 0) {
            teamStandingsContent.innerHTML = '<p class="text-center text-gray-500">No standings available.</p>';
            return;
        }
        const tableHtml = `
            <div class="bg-white rounded-lg shadow-md overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr>${['Pos', 'Team', 'Played', 'Won', 'Lost', 'Points', 'NRR'].map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('')}</tr></thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${standings.map((t, i) => `
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${i + 1}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                                    <img src="${t.teamLogoUrl || 'https://via.placeholder.com/20x20.png?text=L'}" alt="${t.tName}" class="w-5 h-5 mr-2 rounded-full">
                                    <a href="/team?id=${t.teamId}" class="hover:underline">${t.tName}</a>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${t.matchesPlayed}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${t.wins}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${t.losses}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${t.points}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${t.nrr ? parseFloat(t.nrr).toFixed(3) : '0.000'}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        teamStandingsContent.innerHTML = tableHtml;
    };
    
    const renderRecentMatchesTab = async () => {
        const matches = await fetchData('/api/matches/recent', 'Failed to load recent matches.');
        if (!matches || matches.length === 0) {
            recentMatchesContent.innerHTML = '<p class="text-center text-gray-500">No recent matches found.</p>';
            return;
        }
        recentMatchesContent.innerHTML = `
            <div class="bg-white p-6 rounded-xl shadow-md space-y-4">
                ${matches.map(m => `
                    <div class="border-t pt-4">
                        <p class="text-sm text-gray-500">Match #${m.matchNo}</p>
                        <div class="flex justify-between items-center text-lg mt-2">
                            <div class="flex items-center">
                                <img src="${m.team1Logo || 'https://via.placeholder.com/20x20.png?text=L'}" class="w-6 h-6 mr-2 rounded-full">
                                <span class="font-semibold">${m.team1Name}</span>
                            </div>
                            <span class="font-bold">${m.team1Score || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between items-center text-lg mt-1">
                            <div class="flex items-center">
                                <img src="${m.team2Logo || 'https://via.placeholder.com/20x20.png?text=L'}" class="w-6 h-6 mr-2 rounded-full">
                                <span class="font-semibold">${m.team2Name}</span>
                            </div>
                            <span class="font-bold">${m.team2Score || 'N/A'}</span>
                        </div>
                        <p class="text-sm text-green-600 mt-2 font-semibold">${m.winnerName} won.</p>
                    </div>
                `).join('')}
            </div>`;
    };

    const renderTopStats = async (type) => {
        const isBatters = type === 'batters';
        const endpoint = isBatters ? '/api/top-batters' : '/api/top-bowlers';
        const data = await fetchData(endpoint, `Failed to load top ${type}.`);
        if (!data || data.length === 0) {
            contentArea.innerHTML = `<p class="text-center text-gray-500">No top ${type} found.</p>`;
            return;
        }
        
        const title = isBatters ? 'Top 5 Run Scorers' : 'Top 5 Wicket Takers';
        const headers = isBatters ? ['Rank', 'Name', 'Team', 'Runs', 'Avg SR'] : ['Rank', 'Name', 'Team', 'Wickets', 'Economy', 'Best'];
        const top5Data = data.slice(0, 5);

        const rows = top5Data.map((p, i) => `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-2 text-sm font-medium text-gray-900">${i + 1}</td>
                <td class="px-4 py-2 text-sm font-medium text-blue-600 hover:underline">
                    <a href="/player?id=${p.playerId}">${p.pName}</a>
                </td>
                <td class="px-4 py-2 text-sm text-gray-500">${p.tName}</td>
                ${isBatters ? `
                    <td class="px-4 py-2 text-sm text-gray-500">${p.totalRuns}</td>
                    <td class="px-4 py-2 text-sm text-gray-500">${p.avgSr ? parseFloat(p.avgSr).toFixed(2) : '0.00'}</td>
                ` : `
                    <td class="px-4 py-2 text-sm text-gray-500">${p.wickets}</td>
                    <td class="px-4 py-2 text-sm text-gray-500">${p.economy ? parseFloat(p.economy).toFixed(2) : '0.00'}</td>
                    <td class="px-4 py-2 text-sm text-gray-500">${p.best || '-'}</td>
                `}
            </tr>`).join('');

        const chartTitle = isBatters ? 'Top 5 Run Scorers' : 'Top 5 Wicket Takers';
        const chartLabel = isBatters ? 'Total Runs' : 'Wickets';
        const chartData = top5Data.map(p => isBatters ? p.totalRuns : p.wickets);
        const chartLabels = top5Data.map(p => p.pName);

        const layoutHtml = `
            <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div class="lg:col-span-3 bg-white p-4 rounded-lg shadow-md">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">${title}</h2>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50"><tr>${headers.map(h => `<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('')}</tr></thead>
                            <tbody class="bg-white divide-y divide-gray-200">${rows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="lg:col-span-2 bg-white p-4 rounded-lg shadow-md">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">${chartTitle}</h2>
                    <div class="relative h-80">
                        <canvas id="stats-chart"></canvas>
                    </div>
                </div>
            </div>`;
        contentArea.innerHTML = layoutHtml;
        createChart('stats-chart', chartLabels, chartData, chartLabel);
    };

    const createChart = (canvasId, labels, data, label) => {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        const ctx = document.getElementById(canvasId).getContext('2d');
        chartInstances[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: label, data: data, backgroundColor: 'rgba(54, 162, 235, 0.6)', borderColor: 'rgba(54, 162, 235, 1)', borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
        });
    };

    const filterPlayers = () => {
        const searchText = playerSearch.value.toLowerCase();
        const selectedTeam = teamFilter.value;
        const rows = document.querySelectorAll('#data-table-body tr');
        rows.forEach(row => {
            const name = row.children[0].textContent.toLowerCase();
            const team = row.children[1].textContent;
            const nameMatch = name.includes(searchText);
            const teamMatch = !selectedTeam || team === selectedTeam;
            row.style.display = (nameMatch && teamMatch) ? '' : 'none';
        });
    };

    const handleTabClick = (e) => {
        e.preventDefault();
        const tabLink = e.target;
        if (tabLink.classList.contains('tab-active')) return;
        document.querySelectorAll('.data-tab').forEach(t => t.classList.replace('tab-active', 'tab-inactive'));
        tabLink.classList.replace('tab-inactive', 'tab-active');
        
        currentTab = tabLink.getAttribute('data-tab');
        
        contentArea.classList.add('hidden');
        teamStandingsContent.classList.add('hidden');
        recentMatchesContent.classList.add('hidden');

        if (['all-players', 'top-batters', 'top-bowlers'].includes(currentTab)) {
            contentArea.classList.remove('hidden');
            filterSection.style.display = 'flex';
        } else if (currentTab === 'team-standings') {
            teamStandingsContent.classList.remove('hidden');
            filterSection.style.display = 'none';
        } else if (currentTab === 'recent-matches') {
            recentMatchesContent.classList.remove('hidden');
            filterSection.style.display = 'none';
        }
        
        loadTabData();
    };

    const loadTabData = () => {
        switch (currentTab) {
            case 'all-players': showLoader(contentArea); renderAllPlayers(); break;
            case 'top-batters': showLoader(contentArea); renderTopStats('batters'); break;
            case 'top-bowlers': showLoader(contentArea); renderTopStats('bowlers'); break;
            case 'team-standings': showLoader(teamStandingsContent); renderTeamStandingsTab(); break;
            case 'recent-matches': showLoader(recentMatchesContent); renderRecentMatchesTab(); break;
        }
    };

    const init = () => {
        document.querySelectorAll('.data-tab').forEach(tab => tab.addEventListener('click', handleTabClick));
        document.getElementById('refresh-btn').addEventListener('click', () => {
            loadTabData();
            showNotification('Data refreshed!', 'success');
        });
        playerSearch.addEventListener('input', filterPlayers);
        teamFilter.addEventListener('change', filterPlayers);
        document.getElementById('copyright-year').textContent = new Date().getFullYear();
        loadTeams();
        loadTabData();
    };
    init();
});
