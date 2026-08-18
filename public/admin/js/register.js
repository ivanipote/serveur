document.addEventListener('DOMContentLoaded', function() {

    const form = document.getElementById('registerForm');
    const messageDiv = document.getElementById('message');

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = 'message ' + type;
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const merchantName = document.getElementById('merchantName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const contact = document.getElementById('contact').value.trim();
        const logo = document.getElementById('logo').value.trim();

        if (!merchantName || !email || !password) {
            showMessage('⚠️ Nom, email et mot de passe requis.', 'error');
            return;
        }

        if (password.length < 6) {
            showMessage('⚠️ Le mot de passe doit faire au moins 6 caractères.', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Inscription...';
        showMessage('⏳ Création du compte en cours...', 'info');

        try {
            const response = await fetch('/api/admin/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ merchantName, email, password, contact, logo })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('✅ Compte créé avec succès ! Redirection...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            } else {
                showMessage('❌ ' + (data.error || 'Erreur lors de l\'inscription'), 'error');
            }
        } catch (error) {
            console.error('Erreur:', error);
            showMessage('❌ Erreur de connexion au serveur.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'S\'inscrire';
        }
    });

});