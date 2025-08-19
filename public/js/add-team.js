document.addEventListener('DOMContentLoaded', () => {
    const teamForm = document.getElementById('teamForm');
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
    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(teamForm);
        const data = {
            teamName: formData.get('teamName'),
            owner: formData.get('owner'),
            home: formData.get('home'),
            logoUrl: formData.get('logoUrl')
        };
        try {
            const response = await fetch('/api/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'An unknown error occurred.');
            showNotification(result.message, 'success');
            teamForm.reset();
        } catch (err) {
            showNotification(err.message, 'error');
        }
    };
    teamForm.addEventListener('submit', handleSubmit);
});
