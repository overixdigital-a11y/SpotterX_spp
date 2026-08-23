// Esperar a que el documento cargue por completo
document.addEventListener('DOMContentLoaded', () => {

    // Forzar reproducción del video en dispositivos móviles
    const videoElement = document.querySelector('.post-media');
    if (videoElement) {
        videoElement.play().catch(error => {
            console.log("El navegador requiere interacción para reproducir:", error);
        });
    }

    // 1. Interacción del botón Pulse (Me gusta)
    const pulseBtn = document.querySelector('.action-btn');
    let isPulsed = false;

    if (pulseBtn) {
        pulseBtn.addEventListener('click', () => {
            isPulsed = !isPulsed;
            
            if (isPulsed) {
                pulseBtn.style.color = '#00f2fe';
                pulseBtn.querySelector('.icon').style.transform = 'scale(1.3)';
            } else {
                pulseBtn.style.color = '#ffffff';
                pulseBtn.querySelector('.icon').style.transform = 'scale(1)';
            }
        });
    }

    // 2. Interacción para los demás botones laterales (Dialogue y Remix)
    const sideButtons = document.querySelectorAll('.side-actions .action-btn');
    sideButtons.forEach((btn, index) => {
        if (index > 0) {
            let activeState = false;
            btn.addEventListener('click', () => {
                activeState = !activeState;
                if (activeState) {
                    btn.style.color = '#ff5e36';
                    btn.querySelector('.icon').style.transform = 'scale(1.3)';
                } else {
                    btn.style.color = '#ffffff';
                    btn.querySelector('.icon').style.transform = 'scale(1)';
                }
            });
        }
    });

    // 3. Selección de pestañas en la barra inferior
    const navButtons = document.querySelectorAll('.bottom-nav .nav-btn');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        });
    });

});
