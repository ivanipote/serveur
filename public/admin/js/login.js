document.addEventListener('DOMContentLoaded', function() {

    const form = document.getElementById('loginForm');
    const messageDiv = document.getElementById('message');

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = 'message ' + type;
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!email || !password) {
            showMessage('⚠️ Veuillez remplir tous les champs.', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Connexion...';
        showMessage('⏳ Connexion en cours...', 'info');

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('✅ Connexion réussie ! Redirection...', 'success');
                
                // Stocker les infos admin
                localStorage.setItem('adminToken', 'logged_in');
                localStorage.setItem('adminName', data.admin.merchant_name);
                localStorage.setItem('adminId', data.admin.id);

                // ✅ REDIRIGER VERS ADMIN DASHBOARD
                setTimeout(() => {
                    window.location.href = '/admin/dashboard';
                }, 1000);
            } else {
                showMessage('❌ ' + (data.error || 'Email ou mot de passe incorrect'), 'error');
            }
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('❌ Erreur de connexion au serveur.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Se connecter';
        }
    });

});