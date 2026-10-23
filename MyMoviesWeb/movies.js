/* ==========================================================
   1. FIREBASE IMPORTS & INITIALIZATION
   ========================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBpDGPBYba1Mt1GH1NTGT9o4fHlNKsPPyc",
  authDomain: "my-movie-watchlist-6f3d1.firebaseapp.com",
  projectId: "my-movie-watchlist-6f3d1",
  storageBucket: "my-movie-watchlist-6f3d1.firebasestorage.app",
  messagingSenderId: "276572095229",
  appId: "1:276572095229:web:9a6dbeb4c1c39d2c427494"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ==========================================================
   2. APP STATE & GLOBAL REFERENCES
   ========================================================== */
let movies = [];
let editingId = null;
let currentUser = null;
let unsubscribeFirestore = null;

const FALLBACK_POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="70" height="100">
      <rect width="70" height="100" fill="#0F1420"/>
      <text x="35" y="53" font-size="9" fill="#5C6479"
        text-anchor="middle" font-family="sans-serif">No image</text>
    </svg>
  `);

const movieListEl  = document.getElementById("movieList");
const countLabelEl = document.getElementById("countLabel");
const searchInput  = document.getElementById("searchInput");
const sortSelect   = document.getElementById("sortSelect");
const viewSelect   = document.getElementById("viewSelect");

// Auth Bar Elements
const authEmail    = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const btnLogin     = document.getElementById("btnLogin");
const btnLogout    = document.getElementById("btnLogout");
const userStatus   = document.getElementById("userStatus");

/* ==========================================================
   3. AUTHENTICATION & REAL-TIME FIRESTORE LISTENER
   ========================================================== */
btnLogin.addEventListener("click", async () => {
  try {
    await signInWithEmailAndPassword(auth, authEmail.value.trim(), authPassword.value);
    authEmail.value = "";
    authPassword.value = "";
  } catch (err) {
    alert("Login failed: " + err.message);
  }
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    userStatus.textContent = `Logged in: ${user.email}`;
    authEmail.style.display = "none";
    authPassword.style.display = "none";
    btnLogin.style.display = "none";
    btnLogout.style.display = "inline-block";

    listenToFirestoreMovies();
  } else {
    userStatus.textContent = "Not logged in";
    authEmail.style.display = "inline-block";
    authPassword.style.display = "inline-block";
    btnLogin.style.display = "inline-block";
    btnLogout.style.display = "none";

    // Stop real-time listener and clear memory
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
    }
    movies = [];
    render();
  }
});

function listenToFirestoreMovies() {
  const moviesCollection = collection(db, "movies");

  // onSnapshot triggers automatically whenever docs are added, changed, or removed
  unsubscribeFirestore = onSnapshot(moviesCollection, (snapshot) => {
    movies = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    render();
  }, (error) => {
    console.error("Firestore listener error:", error);
    if (error.code === "permission-denied") {
      alert("Permission denied. Check that your user UID matches Firestore rules.");
    }
  });
}

/* ==========================================================
   4. MOVIE CRUD ACTIONS (FIRESTORE)
   ========================================================== */
async function addMovie() {
  if (!currentUser) {
    alert("Please log in first to manage your watchlist.");
    return;
  }

  const titleEl = document.getElementById("inputTitle");
  const yearEl = document.getElementById("inputYear");
  const genreEl = document.getElementById("inputGenre");
  const posterEl = document.getElementById("inputPoster");
  const descriptionEl = document.getElementById("inputDescription");
  const countryEl = document.getElementById("inputCountry");

  const title = titleEl.value.trim();
  const year = yearEl.value.trim();

  if (!title) {
    titleEl.focus();
    return;
  }

  // Duplicate prevention
  if (!editingId) {
    const isDuplicate = movies.some(m =>
      m.title.toLowerCase() === title.toLowerCase() && m.year === year
    );
    if (isDuplicate) {
      alert("That movie is already on your list.");
      return;
    }
  }

  try {
    if (editingId) {
      // EDIT MODE: update Firestore document
      const movieDocRef = doc(db, "movies", editingId);
      await updateDoc(movieDocRef, {
        title: title,
        year: year,
        genre: genreEl.value.trim(),
        poster: posterEl.value.trim(),
        description: descriptionEl.value.trim(),
        country: countryEl.value.trim()
      });

      editingId = null;
      document.getElementById("addBtn").textContent = "Add to watchlist";
      document.getElementById("cancelEditBtn").style.display = "none";
    } else {
      // ADD MODE: create new document in Firestore
      await addDoc(collection(db, "movies"), {
        title: title,
        year: year,
        country: countryEl.value.trim(),
        genre: genreEl.value.trim(),
        poster: posterEl.value.trim(),
        description: descriptionEl.value.trim(),
        watched: false,
        addedAt: Date.now()
      });
    }

    // Reset input fields
    titleEl.value = "";
    yearEl.value = "";
    genreEl.value = "";
    posterEl.value = "";
    countryEl.value = "";
    descriptionEl.value = "";
    titleEl.focus();
  } catch (error) {
    console.error("Error saving movie:", error);
    alert("Could not save movie: " + error.message);
  }
}

function editMovie(id) {
  const movie = movies.find(m => m.id === id);
  if (!movie) return;

  document.getElementById("inputTitle").value = movie.title;
  document.getElementById("inputYear").value = movie.year;
  document.getElementById("inputGenre").value = movie.genre;
  document.getElementById("inputPoster").value = movie.poster;
  document.getElementById("inputDescription").value = movie.description || "";
  document.getElementById("inputCountry").value = movie.country || "";

  editingId = id;

  document.getElementById("addBtn").textContent = "Save changes";
  document.getElementById("cancelEditBtn").style.display = "inline-block";

  document.getElementById("inputTitle").scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("inputTitle").focus();
}

async function toggleWatched(id) {
  const movie = movies.find(m => m.id === id);
  if (!movie) return;

  try {
    const movieDocRef = doc(db, "movies", id);
    await updateDoc(movieDocRef, {
      watched: !movie.watched
    });
  } catch (error) {
    console.error("Error updating watched status:", error);
  }
}

function deleteMovie(id) {
  const cardEl = document.querySelector(`[data-id="${id}"]`);

  if (cardEl) {
    cardEl.classList.add("removing");
    setTimeout(async () => {
      try {
        const movieDocRef = doc(db, "movies", id);
        await deleteDoc(movieDocRef);
      } catch (error) {
        console.error("Error deleting movie:", error);
      }
    }, 250);
  }
}

/* ==========================================================
   5. UI RENDERING & TEMPLATES
   ========================================================= */
function buildCard(movie) {
  const posterSrc = movie.poster || FALLBACK_POSTER;
  const dateAdded = movie.addedAt ? new Date(movie.addedAt).toLocaleDateString() : "Recently";
  const watchedClass = movie.watched ? "watched" : "";

  return `
    <div class="card ${watchedClass}" data-id="${movie.id}">
      <img class="poster" src="${escapeHtml(posterSrc)}"
           alt="${escapeHtml(movie.title)} poster"
           onerror="this.onerror=null; this.src='${FALLBACK_POSTER}';">
      <div class="card-body">
        <div class="card-title-row">
          <span class="card-title">${escapeHtml(movie.title)}</span>${movie.year ? `<span class="card-divider">|</span><span class="card-year">${escapeHtml(movie.year)}</span>` : ""}
          ${movie.country ? `<span class="card-divider">|</span><span class="card-country">${escapeHtml(movie.country)}</span>` : ""}
        </div>
        ${movie.genre ? `<span class="badge">${escapeHtml(movie.genre)}</span>` : ""}
        ${movie.description ? `<span class="card-description">${escapeHtml(movie.description)}</span>` : ""}
        <span class="card-meta">Added ${dateAdded}</span>
        <div class="card-actions">
          <button class="toggle-btn" onclick="window.toggleWatched('${movie.id}')">
            ${movie.watched ? "Watched" : "Mark watched"}
          </button>
          <button class="edit-btn" onclick="window.editMovie('${movie.id}')">Edit</button>
          <button class="delete-btn" onclick="window.deleteMovie('${movie.id}')">Delete</button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const sortMode = sortSelect.value;

  let visible = movies.filter(m => {
    const haystack = `${m.title} ${m.year} ${m.country || ""} ${m.genre || ""}`.toLowerCase();
    return haystack.includes(query);
  });

  visible.sort((a, b) => {
    switch (sortMode) {
      case "earliest": return (a.addedAt || 0) - (b.addedAt || 0);
      case "latest":   return (b.addedAt || 0) - (a.addedAt || 0);
      case "az":       return (a.title || "").localeCompare(b.title || "");
      case "year":     return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
      default:         return 0;
    }
  });

  if (!currentUser) {
    movieListEl.innerHTML = `<div class="empty-state">Log in above to load and view your watchlist.</div>`;
    countLabelEl.textContent = `0 movies`;
    return;
  }

  if (visible.length === 0) {
    movieListEl.innerHTML = movies.length === 0
      ? `<div class="empty-state">Your watchlist is empty — add a movie above to get started.</div>`
      : `<div class="empty-state">No movies match your search.</div>`;
  } else {
    movieListEl.innerHTML = visible.map(buildCard).join("");
  }

  countLabelEl.textContent = `${movies.length} movie${movies.length === 1 ? "" : "s"}`;
}

/* ==========================================================
   6. GLOBAL EXPOSURE & EVENT LISTENERS
   ========================================================== */
// Expose functions to window because this file is an ES module
window.toggleWatched = toggleWatched;
window.editMovie = editMovie;
window.deleteMovie = deleteMovie;

document.getElementById("addBtn").addEventListener("click", addMovie);

document.querySelectorAll(".panel input").forEach(el => {
  el.addEventListener("keydown", e => {
    if (e.key === "Enter" && el.id !== "inputCountry" && el.id !== "inputGenre") addMovie();
  });
});

document.getElementById("cancelEditBtn").addEventListener("click", () => {
  editingId = null;
  document.getElementById("addBtn").textContent = "Add to watchlist";
  document.getElementById("cancelEditBtn").style.display = "none";

  document.getElementById("inputTitle").value = "";
  document.getElementById("inputYear").value = "";
  document.getElementById("inputGenre").value = "";
  document.getElementById("inputCountry").value = "";
  document.getElementById("inputPoster").value = "";
  document.getElementById("inputDescription").value = "";
});

searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);

viewSelect.addEventListener("change", () => {
  if (viewSelect.value === "grid") {
    movieListEl.classList.add("grid-view");
  } else {
    movieListEl.classList.remove("grid-view");
  }
});

sortSelect.value = "earliest";
render();