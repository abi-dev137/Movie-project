/* ==========================================================
   1. FIREBASE IMPORTS & INITIALIZATION
   ========================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile
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

// Your UID is configured here to load the root /movies collection
const OWNER_UID = "4vJfW2A1YzcSEKcJZGNANpHGyer2";

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

// Sign in / sign up card elements
const authContainer    = document.getElementById("auth-container");
const authForm         = document.getElementById("auth-form");
const authTitle        = document.getElementById("auth-title");
const authSubtitle     = document.getElementById("auth-subtitle");
const authEmail        = document.getElementById("auth-email");
const authPassword     = document.getElementById("auth-password");
const authConfirmGroup = document.getElementById("auth-confirm-group");
const authConfirm      = document.getElementById("auth-confirm");
const authError        = document.getElementById("auth-error");
const authSubmitBtn    = document.getElementById("auth-submit-btn");
const authToggleText   = document.getElementById("auth-toggle-text");
const authToggleBtn    = document.getElementById("auth-toggle-btn");

// Signed-in bar and main app area
const userHeader       = document.getElementById("user-header");
const userDisplayEmail = document.getElementById("user-display-email");
const authNicknameGroup = document.getElementById("auth-nickname-group");
const authNickname     = document.getElementById("auth-nickname");
const userAvatar       = document.getElementById("user-avatar");
const logoutBtn        = document.getElementById("logout-btn");
const appContent       = document.getElementById("app-content");

/* ==========================================================
   3. SIGN IN / SIGN UP & REAL-TIME LISTENER
   ========================================================== */
let isSignUpMode = false;

function setAuthMode(signUp) {
  isSignUpMode = signUp;

  authTitle.textContent      = signUp ? "Create your account" : "Welcome to Movie Watchlist";
  authSubtitle.textContent   = signUp ? "Sign up to start your own watchlist" : "Sign in to access your personal movie library";
  authSubmitBtn.textContent  = signUp ? "Create account" : "Sign In";
  authToggleText.textContent = signUp ? "Already have an account?" : "Don't have an account?";
  authToggleBtn.textContent  = signUp ? "Sign in" : "Create one";

  authConfirmGroup.style.display = signUp ? "block" : "none";
  authConfirm.required = signUp;
  if (authNicknameGroup) authNicknameGroup.style.display = signUp ? "block" : "none";
  authPassword.autocomplete = signUp ? "new-password" : "current-password";

  hideAuthError();
}

function showAuthError(message) {
  authError.textContent = message;
  authError.style.display = "block";
}

function hideAuthError() {
  authError.textContent = "";
  authError.style.display = "none";
}

function friendlyAuthError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "That email already has an account. Try signing in instead.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/weak-password":
      return "Your password needs at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";
    case "auth/too-many-requests":
      return "Too many tries. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Can't reach the internet. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

authToggleBtn.addEventListener("click", () => {
  setAuthMode(!isSignUpMode);
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAuthError();

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (isSignUpMode && password !== authConfirm.value) {
    showAuthError("The two passwords don't match.");
    return;
  }

  authSubmitBtn.disabled = true;
  authSubmitBtn.textContent = isSignUpMode ? "Creating account..." : "Signing in...";

  try {
    if (isSignUpMode) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const nicknameVal = authNickname ? authNickname.value.trim() : "";
      if (nicknameVal) {
        await updateProfile(userCredential.user, {
          displayName: nicknameVal
        });
      }
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    authForm.reset();
  } catch (err) {
    showAuthError(friendlyAuthError(err.code));
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isSignUpMode ? "Create account" : "Sign In";
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authContainer.style.display = "none";
    userHeader.style.display = "flex";
    appContent.style.display = "block";

    // Grab nickname if set, or strip domain from email:
    const displayName = user.displayName || user.email.split('@')[0];
    userDisplayEmail.textContent = displayName;

    // Put first letter inside the avatar circle:
    if (userAvatar) {
      userAvatar.textContent = displayName.charAt(0).toUpperCase();
    }

    listenToFirestoreMovies();
  } else  {
    authContainer.style.display = "block";
    userHeader.style.display = "none";
    appContent.style.display = "none";
    setAuthMode(false);

    editingId = null;
    document.getElementById("addBtn").textContent = "Add to watchlist";
    document.getElementById("cancelEditBtn").style.display = "none";

    if (unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
    }
    movies = [];
    render();
  }
});

function listenToFirestoreMovies() {
  const moviesCollection = moviesCollectionRef();

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
function moviesCollectionRef() {
  if (currentUser.uid === OWNER_UID) {
    return collection(db, "movies");
  }
  return collection(db, "users", currentUser.uid, "movies");
}

function movieDocRef(id) {
  if (currentUser.uid === OWNER_UID) {
    return doc(db, "movies", id);
  }
  return doc(db, "users", currentUser.uid, "movies", id);
}

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
      const docRef = movieDocRef(editingId);
      await updateDoc(docRef, {
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
      await addDoc(moviesCollectionRef(), {
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
    const docRef = movieDocRef(id);
    await updateDoc(docRef, {
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
        const docRef = movieDocRef(id);
        await deleteDoc(docRef);
      } catch (error) {
        console.error("Error deleting movie:", error);
      }
    }, 250);
  }
}

/* ==========================================================
   5. UI RENDERING & TEMPLATES
   ========================================================== */
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

window.setMyNickname = async (name) => {
  if (currentUser) {
    await updateProfile(currentUser, { displayName: name });
    userDisplayEmail.textContent = name;
    if (userAvatar) userAvatar.textContent = name.charAt(0).toUpperCase();
    console.log("Nickname updated to:", name);
  }
};
