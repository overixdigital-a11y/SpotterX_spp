document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Forzar reproducción del video inicial
    const video = document.getElementById("meVideo");
    if (video) {
        video.play().catch(() => console.log("Autoplay detenido por el navegador."));
    }

    // Cambiar de vista
    const switchView = (targetViewId) => {
        const viewSections = document.querySelectorAll(".view-section");
        const navButtons = document.querySelectorAll(".bottom-nav .nav-btn");

        viewSections.forEach(section => {
            section.style.display = (section.id === targetViewId) ? "block" : "none";
        });

        navButtons.forEach(btn => {
            if (btn.getAttribute("data-target") === targetViewId) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    };

    // 2. Navegación
    const navButtons = document.querySelectorAll(".bottom-nav .nav-btn");
    navButtons.forEach(button => {
        button.addEventListener("click", () => {
            const targetViewId = button.getAttribute("data-target");
            if (targetViewId) switchView(targetViewId);
        });
    });

    const headerNotifBtn = document.querySelector(".header-nav-btn");
    if (headerNotifBtn) {
        headerNotifBtn.addEventListener("click", () => {
            const targetViewId = headerNotifBtn.getAttribute("data-target");
            if (targetViewId) switchView(targetViewId);
        });
    }

    // Delegación de eventos para la interacción de posts (Pulse, Dialogue, Remix, More)
    const feedList = document.getElementById("feed-list");
    const commentsModal = document.getElementById("comments-modal");
    const remixModal = document.getElementById("remix-modal");

    if (feedList) {
        feedList.addEventListener("click", (e) => {
            // Pulse
            const pulseBtn = e.target.closest(".btn-pulse-item");
            if (pulseBtn) {
                const isPulsed = pulseBtn.classList.toggle("pulsed");
                pulseBtn.style.color = isPulsed ? "#ff5e36" : "#ffffff";
                pulseBtn.style.transform = isPulsed ? "scale(1.2)" : "scale(1)";
                return;
            }

            // Dialogue
            const dialogueBtn = e.target.closest(".btn-dialogue-item");
            if (dialogueBtn && commentsModal) {
                commentsModal.style.display = "flex";
                return;
            }

            // Remix
            const remixBtn = e.target.closest(".btn-remix-item");
            if (remixBtn && remixModal) {
                remixModal.style.display = "flex";
                return;
            }

            // More / Less
            const moreBtn = e.target.closest(".btn-more");
            if (moreBtn) {
                const postCaption = moreBtn.closest(".post-caption");
                const moreText = postCaption.querySelector(".more-text");
                if (moreText) {
                    const isHidden = moreText.style.display !== "inline";
                    moreText.style.display = isHidden ? "inline" : "none";
                    moreBtn.textContent = isHidden ? "Less" : "More";
                }
            }
        });
    }

    // Modal Comentarios - Cierre y Envíos
    const closeCommentsBtn = document.getElementById("close-comments");
    const sendCommentBtn = document.getElementById("send-comment-btn");
    const commentInput = document.getElementById("comment-input");
    const commentsContainer = document.getElementById("comments-container");

    if (closeCommentsBtn && commentsModal) {
        closeCommentsBtn.addEventListener("click", () => commentsModal.style.display = "none");
        commentsModal.addEventListener("click", (e) => {
            if (e.target === commentsModal) commentsModal.style.display = "none";
        });
    }

    if (sendCommentBtn && commentInput && commentsContainer) {
        sendCommentBtn.addEventListener("click", () => {
            const text = commentInput.value.trim();
            if (text !== "") {
                const newComment = document.createElement("div");
                newComment.classList.add("comment-item");
                newComment.innerHTML = `
                    <img src="https://i.pravatar.cc/100?img=33" alt="Avatar" class="comment-avatar">
                    <div class="comment-body">
                        <strong>Alex Morgan</strong>
                        <p>${text}</p>
                    </div>
                `;
                commentsContainer.appendChild(newComment);
                commentInput.value = "";
                commentsContainer.scrollTop = commentsContainer.scrollHeight;
            }
        });
    }

    // Modal Remix - Cierre
    const closeRemixBtn = document.getElementById("close-remix");
    if (closeRemixBtn && remixModal) {
        closeRemixBtn.addEventListener("click", () => remixModal.style.display = "none");
        remixModal.addEventListener("click", (e) => {
            if (e.target === remixModal) remixModal.style.display = "none";
        });
    }

    // Menú Lateral Desplegable (Drawer)
    const menuBtn = document.getElementById("menu-btn");
    const sideDrawer = document.getElementById("side-drawer");
    const closeDrawerBtn = document.getElementById("close-drawer");

    if (menuBtn && sideDrawer && closeDrawerBtn) {
        menuBtn.addEventListener("click", () => sideDrawer.style.display = "flex");
        closeDrawerBtn.addEventListener("click", () => sideDrawer.style.display = "none");
        sideDrawer.addEventListener("click", (e) => {
            if (e.target === sideDrawer) sideDrawer.style.display = "none";
        });
    }

    // 8. Creación de Contenido (➕ Create Modal)
    const btnAddPost = document.getElementById("btn-add-post");
    const createModal = document.getElementById("create-modal");
    const closeCreateBtn = document.getElementById("close-create");
    const publishBtn = document.getElementById("publish-btn");
    const createCaption = document.getElementById("create-caption");
    const createCategory = document.getElementById("create-category");
    const userPostsCount = document.getElementById("user-posts-count");

    let postCounter = 1;

    if (btnAddPost && createModal && closeCreateBtn) {
        btnAddPost.addEventListener("click", () => {
            createModal.style.display = "flex";
        });

        closeCreateBtn.addEventListener("click", () => {
            createModal.style.display = "none";
        });

        createModal.addEventListener("click", (e) => {
            if (e.target === createModal) {
                createModal.style.display = "none";
            }
        });
    }

    if (publishBtn && feedList) {
        publishBtn.addEventListener("click", () => {
            const captionText = createCaption.value.trim() || "New workout completed!";
            const categoryText = createCategory.value;

            // Nuevo elemento del feed
            const newPostCard = document.createElement("div");
            newPostCard.classList.add("post-card");
            newPostCard.innerHTML = `
                <div class="post-header">
                    <img src="https://i.pravatar.cc/100?img=33" alt="Avatar" class="avatar">
                    <div class="user-info">
                        <h3>Alex Morgan <span class="badge">✓</span></h3>
                        <p>@alexm_fitness</p>
                    </div>
                </div>

                <div class="media-container">
                    <video class="post-media" autoplay muted loop playsinline preload="auto">
                        <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
                        Tu navegador no soporta videos.
                    </video>
                    
                    <div class="side-actions">
                        <button class="action-btn btn-pulse-item">
                            <span class="icon">⚡</span>
                            <span class="label">Pulse</span>
                        </button>
                        <button class="action-btn btn-dialogue-item">
                            <span class="icon">💬</span>
                            <span class="label">Dialogue</span>
                        </button>
                        <button class="action-btn btn-remix-item">
                            <span class="icon">🔄</span>
                            <span class="label">Remix</span>
                        </button>
                    </div>
                </div>

                <div class="post-caption">
                    <p>${captionText} <span class="link-orange">${categoryText}</span></p>
                </div>

                <div class="co-authors">
                    <span>Co-Authors</span>
                    <div class="avatar-group">
                        <img src="https://i.pravatar.cc/100?img=33" alt="Co-author">
                    </div>
                </div>
            `;

            // Insertar arriba de todo
            feedList.insertBefore(newPostCard, feedList.firstChild);

            // Actualizar contador del perfil
            postCounter++;
            if (userPostsCount) userPostsCount.textContent = postCounter;

            // Limpiar y cerrar modal
            createCaption.value = "";
            createModal.style.display = "none";

            // Volver a la vista del Home
            switchView("home-view");
        });
    }

});
